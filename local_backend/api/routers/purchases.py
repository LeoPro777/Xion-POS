from typing import List, Optional
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from local_backend.core.database import get_session
from local_backend.core.models import Purchase, PurchaseItem, Product

router = APIRouter(prefix="/purchases", tags=["Purchases"])

class PurchaseItemDTO(BaseModel):
    product_id: str
    quantity: float
    unit_cost_usd: float
    total_cost_usd: float

class PurchaseCreateDTO(BaseModel):
    supplier_id: Optional[str] = None
    supplier_name: str
    total_amount_usd: float
    total_amount_bs: float
    items: List[PurchaseItemDTO]

@router.post("", status_code=status.HTTP_201_CREATED)
def register_purchase(payload: PurchaseCreateDTO, session: Session = Depends(get_session)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Purchase must contain at least one item")

    try:
        # Create Purchase
        new_purchase = Purchase(
            id=str(uuid4()),
            supplier_id=payload.supplier_id,
            supplier_name=payload.supplier_name,
            total_amount_usd=payload.total_amount_usd,
            total_amount_bs=payload.total_amount_bs,
            is_synced=False
        )
        session.add(new_purchase)

        # Create Items and Update Inventory
        for item in payload.items:
            product = session.get(Product, item.product_id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Product with id {item.product_id} not found")
            
            # Create Item
            purchase_item = PurchaseItem(
                id=str(uuid4()),
                purchase_id=new_purchase.id,
                product_id=product.id,
                quantity=item.quantity,
                unit_cost_usd=item.unit_cost_usd,
                total_cost_usd=item.total_cost_usd
            )
            session.add(purchase_item)

            # Update Inventory
            current_stock = product.cached_stock_quantity if product.cached_stock_quantity is not None else 0.0
            product.cached_stock_quantity = current_stock + item.quantity
            product.cost_usd = item.unit_cost_usd # Update to latest cost
            product.is_synced = False
            
            from local_backend.core.models import InventoryTransaction
            kardex = InventoryTransaction(
                id=str(uuid4()),
                product_id=product.id,
                transaction_type="IN",
                reason="PURCHASE",
                quantity=item.quantity,
                reference_id=new_purchase.id,
            )
            session.add(kardex)
            session.add(product)

        session.commit()
        return {"detail": "Purchase registered successfully", "purchase_id": new_purchase.id}

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
