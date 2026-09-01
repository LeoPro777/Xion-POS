from typing import Dict, List, Optional
from uuid import uuid4
import asyncio
from datetime import datetime, UTC
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, SQLModel, select, Field

from local_backend.core.database import get_session
from local_backend.core.models import Product, ProductType, TaxType, ProductComposition, InventoryTransaction
from local_backend.api.utils.audit_service import log_event, fire_audit_log

router = APIRouter(prefix="/inventory", tags=["Inventory"])

class StockAdjustmentDTO(SQLModel):
    product_id: str
    new_quantity: float
    justification: str


class ComboItemCreate(SQLModel):
    product_id: str
    quantity: float = Field(gt=0)

class ProductCreate(SQLModel):
    sku: str
    name: str
    barcode: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    price_usd: float = Field(gt=0)
    cost_usd: float = Field(ge=0)
    product_type: str = "physical"
    tax_type: str = "none"
    unit_measure: str = "UND"
    wholesale_price_usd: float = 0.0
    package_quantity: int = 1
    min_stock_alert: float = 0.0
    tags: Optional[str] = None
    combo_items: List[ComboItemCreate] = []

class ProductNotFoundError(HTTPException):
    def __init__(self, product_id: str):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with id {product_id} not found")


@router.get("/products", response_model=List[Product])
def get_products(session: Session = Depends(get_session)):
    statement = select(Product).where(Product.is_deleted == False)
    results = session.exec(statement).all()
    return results


@router.post("/products", status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, session: Session = Depends(get_session)):
    """
    Crea un producto. Si es combo, verifica atómicamente sus dependencias.
    """
    if payload.product_type == "virtual" and not payload.combo_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Combos require at least one child product"
        )

    # Verifica duplicados de SKU y barcode
    existing_sku = session.exec(select(Product).where(Product.sku == payload.sku)).first()
    if existing_sku:
        raise HTTPException(status_code=409, detail="SKU already exists")
    
    if payload.barcode:
        existing_bc = session.exec(select(Product).where(Product.barcode == payload.barcode)).first()
        if existing_bc:
            raise HTTPException(status_code=409, detail="Barcode already exists")

    product_type_map = {
        "physical": ProductType.PHYSICAL,
        "virtual": ProductType.VIRTUAL,
        "service": ProductType.SERVICE
    }
    ptype = product_type_map.get(payload.product_type, ProductType.PHYSICAL)

    tax_type_map = {
        "none": TaxType.NONE,
        "vat": TaxType.VAT,
        "islr": TaxType.ISLR
    }
    ttype = tax_type_map.get(payload.tax_type, TaxType.NONE)

    new_product = Product(
        id=str(uuid4()),
        sku=payload.sku,
        barcode=payload.barcode,
        name=payload.name,
        description=payload.description,
        category_id=payload.category_id,
        price_usd=payload.price_usd,
        cost_usd=payload.cost_usd,
        product_type=ptype,
        tax_type=ttype,
        unit_measure=payload.unit_measure,
        wholesale_price_usd=payload.wholesale_price_usd,
        package_quantity=payload.package_quantity,
        cached_stock_quantity=0.0,
        min_stock_alert=payload.min_stock_alert,
        tags=payload.tags,
        is_synced=False,
        is_deleted=False,
    )
    
    session.add(new_product)

    # Lógica atómica para Combos
    if payload.product_type == "virtual":
        for item in payload.combo_items:
            # Validar que el hijo exista
            child = session.get(Product, item.product_id)
            if not child:
                session.rollback()
                raise HTTPException(status_code=404, detail=f"Child product {item.product_id} not found")
            
            combo_link = ProductComposition(
                parent_id=new_product.id,
                child_id=item.product_id,
                quantity_required=item.quantity
            )
            session.add(combo_link)

    try:
        session.commit()
        session.refresh(new_product)
        
        fire_audit_log(
            module="inventory",
            action="CREATE",
            description=f"Producto '{new_product.name}' ({new_product.sku}) creado exitosamente",
            severity="INFO",
            entity_name="product",
            entity_id=new_product.id,
            new_values=new_product.model_dump()
        )
        
        return new_product
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail="Transaction failed in local storage")



@router.put("/products/{product_id}", response_model=Product)
def update_product(product_id: str, updated_data: Dict[str, object], session: Session = Depends(get_session)):
    product = session.get(Product, product_id)
    if not product or product.is_deleted:
        raise ProductNotFoundError(product_id)

    # Guardar valores anteriores para auditar
    old_price = product.price_usd
    old_cost = product.cost_usd
    old_values = product.model_dump()

    # Block manual stock manipulation from updates
    if "cached_stock_quantity" in updated_data:
        updated_data.pop("cached_stock_quantity")

    # Validate required fields where applicable
    if "product_type" in updated_data and updated_data["product_type"] == ProductType.SERVICE:
        updated_data["min_stock_alert"] = 0

    for key, value in updated_data.items():
        if hasattr(product, key) and key not in {"id", "created_at", "updated_at", "is_deleted", "is_synced"}:
            setattr(product, key, value)

    product.is_synced = False
    product.updated_at = datetime.utcnow()
    session.add(product)
    session.commit()
    session.refresh(product)

    # Auditar cambios de precios u otros campos
    new_price = product.price_usd
    new_cost = product.cost_usd
    new_values = product.model_dump()

    if old_price != new_price or old_cost != new_cost:
        old_margin = ((old_price - old_cost) / old_price * 100) if old_price > 0 else 0
        new_margin = ((new_price - new_cost) / new_price * 100) if new_price > 0 else 0
        
        fire_audit_log(
            module="inventory",
            action="PRICE_CHANGE",
            description=f"Cambio de precio/costo para '{product.name}' ({product.sku})",
            severity="WARNING",
            entity_name="product",
            entity_id=product.id,
            old_values={"price_usd": old_price, "cost_usd": old_cost, "margin": old_margin},
            new_values={"price_usd": new_price, "cost_usd": new_cost, "margin": new_margin}
        )
    else:
        # Auditoría general de actualización
        diff_old = {k: v for k, v in old_values.items() if k in updated_data and v != new_values[k]}
        diff_new = {k: v for k, v in new_values.items() if k in updated_data and v != old_values[k]}
        if diff_old:
            fire_audit_log(
                module="inventory",
                action="UPDATE",
                description=f"Producto '{product.name}' ({product.sku}) modificado",
                severity="INFO",
                entity_name="product",
                entity_id=product.id,
                old_values=diff_old,
                new_values=diff_new
            )

    return product



@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: str, session: Session = Depends(get_session)):
    product = session.get(Product, product_id)
    if not product or product.is_deleted:
        raise ProductNotFoundError(product_id)

    product.is_deleted = True
    product.is_synced = False
    session.add(product)
    session.commit()

    fire_audit_log(
        module="inventory",
        action="DELETE",
        description=f"Producto '{product.name}' ({product.sku}) marcado como eliminado",
        severity="CRITICAL",
        entity_name="product",
        entity_id=product.id
    )



class ProductComboComponent(SQLModel):
    child_id: str
    quantity_required: float = 1.0


@router.get("/products/{combo_id}/components")
def get_combo_components(combo_id: str, session: Session = Depends(get_session)):
    combo = session.get(Product, combo_id)
    if not combo or combo.is_deleted:
        raise ProductNotFoundError(combo_id)

    if combo.product_type != ProductType.VIRTUAL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only combo products can have components")

    statement = select(ProductComposition).where(ProductComposition.parent_id == combo_id)
    results = session.exec(statement).all()
    return results


@router.put("/products/{combo_id}/components")
def set_combo_components(combo_id: str, components: List[ProductComboComponent], session: Session = Depends(get_session)):
    combo = session.get(Product, combo_id)
    if not combo or combo.is_deleted:
        raise ProductNotFoundError(combo_id)

    if combo.product_type != ProductType.VIRTUAL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only combo products can have components")

    # Clear existing
    existing = session.exec(select(ProductComposition).where(ProductComposition.parent_id == combo_id)).all()
    for row in existing:
        session.delete(row)

    # Add new components
    for component in components:
        child = session.get(Product, component.child_id)
        if not child or child.is_deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Child product {component.child_id} not found")
        comp = ProductComposition(parent_id=combo_id, child_id=component.child_id, quantity_required=component.quantity_required)
        session.add(comp)

    session.commit()
    updated = session.exec(select(ProductComposition).where(ProductComposition.parent_id == combo_id)).all()
    return updated

class ShrinkageCreate(SQLModel):
    product_id: str
    quantity: float = Field(gt=0)
    reason: str = "No especificado"
    user_id: Optional[str] = None

from local_backend.core.models import InventoryShrinkage

@router.post("/shrinkage", status_code=status.HTTP_201_CREATED)
def register_shrinkage(payload: ShrinkageCreate, session: Session = Depends(get_session)):
    product = session.get(Product, payload.product_id)
    if not product or product.is_deleted:
        raise ProductNotFoundError(payload.product_id)
        
    if product.product_type == ProductType.SERVICE:
        raise HTTPException(status_code=400, detail="Los servicios no pueden tener mermas")
        
    # Descontar stock
    product.cached_stock_quantity -= payload.quantity
    product.is_synced = False
    
    # Calcular pérdida financiera
    loss = product.cost_usd * payload.quantity
    
    from local_backend.core.models import InventoryShrinkage, InventoryTransaction
    
    shrinkage = InventoryShrinkage(
        id=str(uuid4()),
        product_id=product.id,
        product_name=product.name,
        quantity=payload.quantity,
        cost_loss_usd=loss,
        reason=payload.reason,
        user_id=payload.user_id
    )

    kardex = InventoryTransaction(
        id=str(uuid4()),
        product_id=product.id,
        transaction_type="OUT",
        reason="SHRINKAGE",
        quantity=payload.quantity,
        reference_id=shrinkage.id,
        user_id=payload.user_id
    )
    
    session.add(product)
    session.add(shrinkage)
    session.add(kardex)
    try:
        session.commit()
        session.refresh(shrinkage)
        
        fire_audit_log(
            module="inventory",
            action="STOCK_ADJUST",
            description=f"Registro de merma para '{product.name}' ({product.sku}). Pérdida: ${loss:.2f}. Cantidad: {payload.quantity}",
            severity="WARNING",
            entity_name="product",
            entity_id=product.id,
            metadata={"quantity": payload.quantity, "reason": payload.reason, "cost_loss_usd": loss}
        )
        
        return shrinkage
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail="Transaction failed in local storage")

@router.get("/shrinkage")
def get_shrinkage_history(session: Session = Depends(get_session)):
    statement = select(InventoryShrinkage).order_by(InventoryShrinkage.created_at.desc())
    results = session.exec(statement).all()
    return results

@router.post("/adjust-stock", status_code=status.HTTP_200_OK)
def adjust_stock(payload: StockAdjustmentDTO, session: Session = Depends(get_session)):
    """
    Realiza un ajuste manual de inventario, registrándolo en Kardex y auditando el evento inmutable.
    """
    product = session.get(Product, payload.product_id)
    if not product or product.is_deleted:
        raise ProductNotFoundError(payload.product_id)
        
    if product.product_type == ProductType.SERVICE:
        raise HTTPException(status_code=400, detail="Los servicios no tienen stock físico que ajustar.")
        
    old_stock = product.cached_stock_quantity or 0.0
    new_stock = payload.new_quantity
    diff = new_stock - old_stock
    
    if diff == 0:
        return {"detail": "No se detectaron cambios en el stock", "product": product}
        
    product.cached_stock_quantity = new_stock
    product.is_synced = False
    
    # Registrar la transacción en el Kardex
    kardex = InventoryTransaction(
        id=str(uuid4()),
        product_id=product.id,
        transaction_type="IN" if diff > 0 else "OUT",
        reason="MANUAL_ADJUSTMENT",
        quantity=abs(diff),
        user_id=None,  # Será recuperado por el contexto de auditoría del HTTP Request
        created_at=datetime.utcnow()
    )
    
    session.add(product)
    session.add(kardex)
    
    try:
        session.commit()
        session.refresh(product)
        
        # Auditamos el ajuste manual
        # El cambio se considera crítico si el volumen de ajuste supera 50 unidades de diferencia
        severity = "CRITICAL" if abs(diff) >= 50 else "INFO"
        fire_audit_log(
            module="inventory",
            action="STOCK_ADJUST",
            description=f"Ajuste manual de inventario para '{product.name}' ({product.sku}). Stock previo: {old_stock}, nuevo: {new_stock} ({'+' if diff > 0 else ''}{diff})",
            severity=severity,
            entity_name="product",
            entity_id=product.id,
            old_values={"stock": old_stock},
            new_values={"stock": new_stock},
            metadata={"justification": payload.justification, "difference": diff}
        )
        
        return {"detail": "Ajuste de inventario realizado correctamente", "product": product}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Transaction failed: {str(e)}")


