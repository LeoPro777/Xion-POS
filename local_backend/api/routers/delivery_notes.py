# filepath: local_backend/api/routers/delivery_notes.py
import os
from typing import List, Optional
from uuid import uuid4
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, select, func

from local_backend.core.database import get_session, get_system_config
from local_backend.core.models import (
    DeliveryNote, DeliveryNoteItem, Product, ProductComposition, 
    CashSession, InventoryTransaction, Client
)
from local_backend.api.utils.audit_service import fire_audit_log
from local_backend.api.utils.pdf_generator import generate_delivery_note_pdf

router = APIRouter(prefix="/delivery-notes", tags=["Delivery Notes"])

class DeliveryNoteItemDTO(BaseModel):
    product_id: str
    product_name: str
    quantity: float
    unit_price_usd: float
    total_price_usd: float

class DeliveryNoteCreateDTO(BaseModel):
    document_type: str = Field(..., description="'PREFACTURA' o 'NOTA_ENTREGA'")
    client_id: Optional[str] = None
    client_name: str = "Cliente Final"
    subtotal_usd: float
    discount_usd: float = 0.0
    total_amount_usd: float
    total_amount_bs: float
    exchange_rate: float
    items: List[DeliveryNoteItemDTO] = Field(..., min_length=1)

@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_delivery_note(payload: DeliveryNoteCreateDTO, session: Session = Depends(get_session)):
    """
    Crea una Nota de Entrega o Prefactura.
    Si es NOTA_ENTREGA, descuenta inventario.
    """
    if payload.document_type not in ("PREFACTURA", "NOTA_ENTREGA"):
        raise HTTPException(status_code=400, detail="document_type debe ser 'PREFACTURA' o 'NOTA_ENTREGA'")

    config = get_system_config(session)
    active_session = session.exec(select(CashSession).where(CashSession.status == "open")).first()

    # Generar correlativo
    max_number = session.exec(select(func.max(DeliveryNote.document_number))).first()
    next_number = (max_number or 0) + 1

    try:
        new_note = DeliveryNote(
            id=str(uuid4()),
            document_type=payload.document_type,
            document_number=next_number,
            client_id=payload.client_id,
            client_name=payload.client_name,
            subtotal_usd=payload.subtotal_usd,
            discount_usd=payload.discount_usd,
            total_amount_usd=payload.total_amount_usd,
            total_amount_bs=payload.total_amount_bs,
            exchange_rate=payload.exchange_rate,
            status="EMITIDA",
            cash_session_id=active_session.id if active_session else None
        )
        session.add(new_note)

        items_for_pdf = []

        for item in payload.items:
            product = session.get(Product, item.product_id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Producto {item.product_id} no encontrado")

            note_item = DeliveryNoteItem(
                id=str(uuid4()),
                delivery_note_id=new_note.id,
                product_id=product.id,
                product_name=item.product_name,
                quantity=item.quantity,
                unit_price_usd=item.unit_price_usd,
                total_price_usd=item.total_price_usd
            )
            session.add(note_item)

            items_for_pdf.append({
                "product_name": item.product_name,
                "quantity": item.quantity,
                "unit_price_usd": item.unit_price_usd,
                "total_price_usd": item.total_price_usd
            })

            # Solo descontar stock si es NOTA_ENTREGA
            if payload.document_type == "NOTA_ENTREGA":
                if product.product_type == "physical":
                    current_stock = product.cached_stock_quantity or 0.0
                    if not config.allow_negative_stock and current_stock < item.quantity:
                        raise HTTPException(status_code=400, detail=f"Stock insuficiente para {product.name}")
                    product.cached_stock_quantity = current_stock - item.quantity
                    product.is_synced = False
                    session.add(product)

                    # Kardex
                    kardex = InventoryTransaction(
                        id=str(uuid4()),
                        product_id=product.id,
                        transaction_type="OUT",
                        reason="DELIVERY_NOTE",
                        quantity=item.quantity,
                        reference_id=new_note.id,
                        user_id=active_session.user_id if active_session else None
                    )
                    session.add(kardex)
                elif product.product_type == "virtual":
                    components = session.exec(select(ProductComposition).where(ProductComposition.parent_id == product.id)).all()
                    for comp in components:
                        child = session.get(Product, comp.child_id)
                        if child and child.product_type == "physical":
                            required = comp.quantity_required * item.quantity
                            child_stock = child.cached_stock_quantity or 0.0
                            if not config.allow_negative_stock and child_stock < required:
                                raise HTTPException(status_code=400, detail=f"Stock insuficiente para {child.name}")
                            child.cached_stock_quantity = child_stock - required
                            child.is_synced = False
                            session.add(child)

                            kardex_child = InventoryTransaction(
                                id=str(uuid4()),
                                product_id=child.id,
                                transaction_type="OUT",
                                reason="DELIVERY_NOTE",
                                quantity=required,
                                reference_id=new_note.id,
                                user_id=active_session.user_id if active_session else None
                            )
                            session.add(kardex_child)

        session.commit()

        # Generar PDF
        pdf_dir = os.path.join(os.getcwd(), "data", "delivery_notes")
        os.makedirs(pdf_dir, exist_ok=True)
        pdf_filename = f"{payload.document_type}_{next_number}_{new_note.id[:8]}.pdf"
        pdf_path = os.path.join(pdf_dir, pdf_filename)

        note_data = {
            "store_name": config.store_name,
            "store_rif": config.store_rif,
            "document_type": payload.document_type,
            "document_number": str(next_number).zfill(6),
            "client_name": payload.client_name,
            "date": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "total_amount_usd": payload.total_amount_usd,
            "total_amount_bs": payload.total_amount_bs
        }

        generate_delivery_note_pdf(note_data, items_for_pdf, pdf_path, config.ticket_size)

        new_note.pdf_path = pdf_filename
        session.add(new_note)
        session.commit()

        fire_audit_log(
            module="sales",
            action="CREATE",
            description=f"Registro de {payload.document_type} #{next_number} por ${payload.total_amount_usd:.2f}",
            severity="INFO",
            entity_name="delivery_note",
            entity_id=new_note.id
        )

        return {"id": new_note.id, "document_number": new_note.document_number, "pdf_path": pdf_filename}

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[DeliveryNote])
def get_delivery_notes(session: Session = Depends(get_session)):
    return session.exec(select(DeliveryNote).order_by(DeliveryNote.created_at.desc())).all()

@router.get("/{id}/pdf")
def get_delivery_note_pdf(id: str, session: Session = Depends(get_session)):
    note = session.get(DeliveryNote, id)
    if not note or not note.pdf_path:
        raise HTTPException(status_code=404, detail="PDF no encontrado")
    
    pdf_path = os.path.join(os.getcwd(), "data", "delivery_notes", note.pdf_path)
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="Archivo PDF físico no encontrado")
        
    return FileResponse(
        pdf_path, 
        media_type="application/pdf", 
        filename=note.pdf_path,
        headers={"Content-Disposition": f"inline; filename={note.pdf_path}"}
    )

@router.post("/{id}/cancel")
def cancel_delivery_note(id: str, session: Session = Depends(get_session)):
    """
    Anula una Nota de Entrega y reversa el inventario si aplica.
    """
    note = session.get(DeliveryNote, id)
    if not note:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if note.status == "ANULADA":
        raise HTTPException(status_code=400, detail="El documento ya está anulado")

    items = session.exec(select(DeliveryNoteItem).where(DeliveryNoteItem.delivery_note_id == id)).all()

    try:
        if note.document_type == "NOTA_ENTREGA":
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
                        reason="REFUND_DELIVERY_NOTE",
                        quantity=item.quantity,
                        reference_id=note.id
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
                                reason="REFUND_DELIVERY_NOTE",
                                quantity=required,
                                reference_id=note.id
                            )
                            session.add(kardex_child)

        note.status = "ANULADA"
        session.add(note)
        session.commit()

        fire_audit_log(
            module="sales",
            action="CANCEL",
            description=f"Anulación de {note.document_type} #{note.document_number}",
            severity="WARNING",
            entity_name="delivery_note",
            entity_id=note.id
        )

        return {"detail": "Documento anulado con éxito"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
