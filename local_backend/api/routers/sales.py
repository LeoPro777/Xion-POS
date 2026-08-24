# filepath: local_backend/api/routers/sales.py
# -----------------------------------------------------------------------------
# MÓDULO: Router de Ventas (Multi-pago dinámico)
# CONTEXT: Offline-First, soporte split-tender contra métodos de SystemConfig
# VERSION: 3.0 — Reemplaza campo único payment_method con tabla SalePayment
# -----------------------------------------------------------------------------

import json
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session, select

from local_backend.core.database import get_session, get_system_config
from local_backend.core.models import Sale, SaleItem, SalePayment, Product, ProductComposition, CashSession, InventoryTransaction, Client

router = APIRouter(prefix="/sales", tags=["Sales"])


# =============================================================================
# DTOs (contratos de entrada)
# =============================================================================

class SalePaymentDTO(BaseModel):
    """
    Un único registro de pago dentro de una venta.
    Puede haber varios por venta (split-tender).
    """
    payment_method_id: str = Field(..., description="ID del método en SystemConfig.payment_methods_json")
    payment_method_label: str = Field(..., description="Nombre del método (snapshot)")
    currency: str = Field(..., description="'USD' o 'VES'")
    amount_tendered: float = Field(..., ge=0, description="Monto en la moneda original del método")
    amount_usd: float = Field(..., ge=0, description="Contravalor en USD")
    reference_code: Optional[str] = None

    @field_validator("currency")
    @classmethod
    def currency_must_be_valid(cls, v: str) -> str:
        if v not in ("USD", "VES"):
            raise ValueError("La moneda debe ser 'USD' o 'VES'")
        return v


class SaleItemDTO(BaseModel):
    product_id: str
    product_name: str
    quantity: float
    unit_price_usd: float
    tax_amount_usd: float
    total_price_usd: float


class SaleCreateDTO(BaseModel):
    client_id: Optional[str] = Field(default=None, description="ID del cliente (Opcional para Cliente Final)")
    client_name: str = "Cliente Final"
    subtotal_usd: float
    tax_amount_usd: float
    total_amount_usd: float
    total_amount_bs: float
    exchange_rate: float
    # Lista de pagos — reemplaza el campo único payment_method
    payments: List[SalePaymentDTO] = Field(..., min_length=1)
    items: List[SaleItemDTO] = Field(..., min_length=1)


# =============================================================================
# Helpers de validación
# =============================================================================

def _validate_payment_methods(
    payment_method_ids: List[str],
    config_json: str,
) -> None:
    """
    Verifica que todos los métodos de pago enviados existan en la configuración.
    Lanza HTTPException 400 si alguno es inválido, para proteger la integridad.
    """
    try:
        configured: List[dict] = json.loads(config_json or "[]")
    except json.JSONDecodeError:
        configured = []

    configured_ids = {m.get("id") for m in configured if m.get("id")}

    # Si no hay métodos configurados aún: permitir cualquier ID (modo permisivo inicial)
    if not configured_ids:
        return

    # Permitir 'CREDITO' como método interno del sistema independientemente de la configuración
    invalid = [pid for pid in payment_method_ids if pid not in configured_ids and pid != "CREDITO"]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Métodos de pago no reconocidos en la configuración: {invalid}",
        )


def _validate_payment_total(payments: List[SalePaymentDTO], total_usd: float) -> None:
    """
    Confirma que la suma de pagos en USD cubra el total de la venta.
    Tolerancia de $0.05 para manejar diferencias de redondeo en pagos en Bs.
    """
    paid_usd = sum(p.amount_usd for p in payments)
    if paid_usd < (total_usd - 0.05):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Pago insuficiente. Total requerido: ${total_usd:.2f}, "
                f"total recibido: ${paid_usd:.2f}"
            ),
        )


# =============================================================================
# Endpoints
# =============================================================================

@router.post("", status_code=status.HTTP_201_CREATED)
def register_sale(payload: SaleCreateDTO, session: Session = Depends(get_session)):
    """
    Registra una venta completa con soporte multi-pago.
    Operación atómica: Sale + SalePayment(s) + SaleItem(s) + descuento de inventario.
    """
    # Validar que existe una sesión de caja abierta
    active_session = session.exec(
        select(CashSession).where(CashSession.status == "open")
    ).first()
    
    if not active_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede procesar la venta: No hay una sesión de caja abierta."
        )

    config = get_system_config(session)

    # Validar métodos de pago contra la configuración activa
    method_ids = [p.payment_method_id for p in payload.payments]
    _validate_payment_methods(method_ids, config.payment_methods_json)

    # Validar que el pago cubra el total
    _validate_payment_total(payload.payments, payload.total_amount_usd)

    try:
        # --- Crear cabecera de la venta ---
        new_sale = Sale(
            id=str(uuid4()),
            client_id=payload.client_id,
            client_name=payload.client_name,
            subtotal_usd=payload.subtotal_usd,
            tax_amount_usd=payload.tax_amount_usd,
            total_amount_usd=payload.total_amount_usd,
            total_amount_bs=payload.total_amount_bs,
            exchange_rate=payload.exchange_rate,
            cash_session_id=active_session.id,
            is_synced=False,
        )
        session.add(new_sale)

        # --- Registrar cada método de pago (split-tender inmutable) ---
        for pmt in payload.payments:
            sale_payment = SalePayment(
                id=str(uuid4()),
                sale_id=new_sale.id,
                payment_method_id=pmt.payment_method_id,
                payment_method_label=pmt.payment_method_label,
                currency=pmt.currency,
                amount_tendered=pmt.amount_tendered,
                amount_usd=pmt.amount_usd,
                reference_code=pmt.reference_code,
            )
            session.add(sale_payment)
            
            # --- Lógica de Fiar / Crédito ---
            if pmt.payment_method_id == "CREDITO":
                if not payload.client_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Debe seleccionar un cliente registrado para poder fiar (Crédito)."
                    )
                client = session.get(Client, payload.client_id)
                if not client:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Cliente no encontrado en la base de datos."
                    )
                
                # Sumar a la deuda del cliente
                client.current_debt += pmt.amount_usd
                client.is_synced = False
                session.add(client)

        # --- Procesar ítems y descontar inventario ---
        for item in payload.items:
            product = session.get(Product, item.product_id)
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Producto con id '{item.product_id}' no encontrado",
                )

            sale_item = SaleItem(
                id=str(uuid4()),
                sale_id=new_sale.id,
                product_id=product.id,
                product_name=item.product_name,
                quantity=item.quantity,
                unit_price_usd=item.unit_price_usd,
                tax_amount_usd=item.tax_amount_usd,
                total_price_usd=item.total_price_usd,
            )
            session.add(sale_item)

            # Descuento de stock para productos físicos (Se permite stock negativo en offline)
            if product.product_type == "physical":
                current_stock = product.cached_stock_quantity or 0.0
                # Nota: Validación de stock insuficiente removida para soportar stock negativo offline.
                product.cached_stock_quantity = current_stock - item.quantity
                product.is_synced = False
                
                kardex = InventoryTransaction(
                    id=str(uuid4()),
                    product_id=product.id,
                    transaction_type="OUT",
                    reason="SALE",
                    quantity=item.quantity,
                    reference_id=new_sale.id,
                    user_id=active_session.user_id
                )
                session.add(kardex)
                session.add(product)

            elif product.product_type == "virtual":
                # Para combos: descontar stock de los hijos
                components = session.exec(
                    select(ProductComposition).where(ProductComposition.parent_id == product.id)
                ).all()
                for comp in components:
                    child = session.get(Product, comp.child_id)
                    if not child or child.product_type != "physical":
                        continue
                    required = comp.quantity_required * item.quantity
                    child_stock = child.cached_stock_quantity or 0.0
                    # Nota: Validación de stock insuficiente removida para combos para soportar stock negativo offline.
                    child.cached_stock_quantity = child_stock - required
                    child.is_synced = False
                    
                    kardex_child = InventoryTransaction(
                        id=str(uuid4()),
                        product_id=child.id,
                        transaction_type="OUT",
                        reason="SALE",
                        quantity=required,
                        reference_id=new_sale.id,
                        user_id=active_session.user_id
                    )
                    session.add(kardex_child)
                    session.add(child)
            # Los servicios no consumen stock

        session.commit()
        return {"detail": "Venta procesada exitosamente", "sale_id": new_sale.id}

    except HTTPException as http_exc:
        session.rollback()
        raise http_exc
    except Exception as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno procesando la venta: {str(exc)}",
        )


@router.get("", response_model=List[Sale])
def get_sales(session: Session = Depends(get_session)):
    """Retorna todas las ventas ordenadas por fecha descendente."""
    return session.exec(select(Sale).order_by(Sale.created_at.desc())).all()


@router.get("/{sale_id}/payments", response_model=List[SalePayment])
def get_sale_payments(sale_id: str, session: Session = Depends(get_session)):
    """Retorna todos los métodos de pago de una venta específica."""
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")
    payments = session.exec(
        select(SalePayment).where(SalePayment.sale_id == sale_id)
    ).all()
    return payments

@router.post("/{sale_id}/refund", response_model=Sale)
def refund_sale(sale_id: str, session: Session = Depends(get_session)):
    """
    Procesa la devolución total de una venta.
    Devuelve los items al inventario y marca la venta como 'refunded'.
    """
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
        
    if sale.status == "refunded":
        raise HTTPException(status_code=400, detail="Esta venta ya ha sido devuelta")
        
    # Obtener items de la venta
    items = session.exec(select(SaleItem).where(SaleItem.sale_id == sale_id)).all()
    
    # Reponer inventario y registrar en Kardex
    for item in items:
        product = session.get(Product, item.product_id)
        if not product:
            continue
            
        if product.product_type == "physical":
            product.cached_stock_quantity = (product.cached_stock_quantity or 0.0) + item.quantity
            product.is_synced = False
            session.add(product)
            
            kardex = InventoryTransaction(
                id=str(uuid4()),
                product_id=product.id,
                transaction_type="IN",
                reason="REFUND",
                quantity=item.quantity,
                reference_id=sale.id
            )
            session.add(kardex)
            
        elif product.product_type == "virtual":
            components = session.exec(select(ProductComposition).where(ProductComposition.parent_id == product.id)).all()
            for comp in components:
                child = session.get(Product, comp.child_id)
                if child and child.product_type == "physical":
                    required = comp.quantity_required * item.quantity
                    child.cached_stock_quantity = (child.cached_stock_quantity or 0.0) + required
                    child.is_synced = False
                    session.add(child)
                    
                    kardex_child = InventoryTransaction(
                        id=str(uuid4()),
                        product_id=child.id,
                        transaction_type="IN",
                        reason="REFUND",
                        quantity=required,
                        reference_id=sale.id
                    )
                    session.add(kardex_child)
                    
    sale.status = "refunded"
    sale.is_synced = False
    session.add(sale)
    
    try:
        session.commit()
        session.refresh(sale)
        return sale
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
