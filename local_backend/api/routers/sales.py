# filepath: local_backend/api/routers/sales.py
# -----------------------------------------------------------------------------
# MÓDULO: Router de Ventas (Multi-pago dinámico)
# CONTEXT: Offline-First, soporte split-tender contra métodos de SystemConfig
# VERSION: 3.0 — Reemplaza campo único payment_method con tabla SalePayment
# -----------------------------------------------------------------------------

import json
import asyncio
import os
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session, select

from local_backend.api.utils.audit_service import log_event, fire_audit_log
from local_backend.api.utils.pdf_generator import generate_delivery_note_pdf
from local_backend.core.database import get_session, get_system_config
from local_backend.core.models import Sale, SaleItem, SalePayment, Product, ProductComposition, CashSession, InventoryTransaction, Client, PaymentMethodModel

router = APIRouter(prefix="/sales", tags=["Sales"])

class RefundRequestDTO(BaseModel):
    reason: str = "Devolución / Anulación de venta"
    supervisor_id: Optional[str] = None



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
    session: Session,
) -> None:
    """
    Verifica que todos los métodos de pago enviados existan en la base de datos.
    Lanza HTTPException 400 si alguno es inválido, para proteger la integridad.
    """
    configured = session.exec(select(PaymentMethodModel.code).where(PaymentMethodModel.is_active == True)).all()
    configured_ids = set(configured)

    # Permitir 'CREDITO' como método interno del sistema independientemente de la configuración
    invalid = [pid for pid in payment_method_ids if pid not in configured_ids and pid != "CREDITO"]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Métodos de pago no reconocidos o inactivos: {invalid}",
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
    _validate_payment_methods(method_ids, session)

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
              # Descuento de stock para productos físicos (Se permite stock negativo si config.allow_negative_stock es True)
            if product.product_type == "physical":
                current_stock = product.cached_stock_quantity or 0.0
                if not config.allow_negative_stock and current_stock < item.quantity:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Stock insuficiente para {product.name}. Disponible: {current_stock}, Requerido: {item.quantity}"
                    )
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
                    if not config.allow_negative_stock and child_stock < required:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Stock insuficiente para el componente '{child.name}' del combo '{product.name}'. Disponible: {child_stock}, Requerido: {required}"
                        )
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
        
        # Auditoría de la venta creada
        sale_data = {
            "sale_id": new_sale.id,
            "total_usd": new_sale.total_amount_usd,
            "total_bs": new_sale.total_amount_bs,
            "exchange_rate": new_sale.exchange_rate,
            "payments": [p.model_dump() for p in payload.payments],
            "items": [i.model_dump() for i in payload.items]
        }
        fire_audit_log(
            module="sales",
            action="CREATE",
            description=f"Registro de venta #{new_sale.id[:8]} por un total de ${new_sale.total_amount_usd:.2f}",
            severity="INFO",
            entity_name="sale",
            entity_id=new_sale.id,
            new_values=sale_data
        )
        
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

@router.get("/{sale_id}/ticket")
def get_sale_ticket(sale_id: str, session: Session = Depends(get_session)):
    """Genera y retorna el PDF de la Nota de Entrega (Ticket) de la venta."""
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    config = get_system_config(session)
    items = session.exec(select(SaleItem).where(SaleItem.sale_id == sale_id)).all()
    
    # Prepara directorio y path
    pdf_dir = os.path.join(os.getcwd(), "data", "tickets")
    os.makedirs(pdf_dir, exist_ok=True)
    pdf_filename = f"NOTA_ENTREGA_{sale_id[:8]}.pdf"
    pdf_path = os.path.join(pdf_dir, pdf_filename)
    
    # Si ya existe y está en estado final, podríamos retornarlo directo, pero para este 
    # caso lo generamos on-the-fly o sobreescribimos por si cambiaron datos como config.
    
    items_for_pdf = []
    for item in items:
        items_for_pdf.append({
            "product_name": item.product_name,
            "quantity": item.quantity,
            "unit_price_usd": item.unit_price_usd,
            "total_price_usd": item.total_price_usd
        })
        
    note_data = {
        "store_name": config.store_name,
        "store_rif": config.store_rif,
        "document_type": "NOTA DE ENTREGA",
        # Usamos el short id o un correlativo. Para simplificar, los ultimos 6 chars o un numero interno.
        "document_number": str(sale.id[:6]).upper(),
        "client_name": sale.client_name,
        "date": sale.created_at.strftime("%d/%m/%Y %H:%M") if sale.created_at else "",
        "total_amount_usd": sale.total_amount_usd,
        "total_amount_bs": sale.total_amount_bs
    }
    
    generate_delivery_note_pdf(note_data, items_for_pdf, pdf_path, config.ticket_size)
    
    return FileResponse(
        pdf_path, 
        media_type="application/pdf", 
        filename=pdf_filename,
        headers={"Content-Disposition": f"inline; filename={pdf_filename}"}
    )

@router.post("/{sale_id}/refund", response_model=Sale)
def refund_sale(
    sale_id: str, 
    payload: Optional[RefundRequestDTO] = None, 
    session: Session = Depends(get_session)
):
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
        
        # Auditoría de la anulación
        reason_str = payload.reason if payload else "Anulación estándar de venta"
        supervisor_id = payload.supervisor_id if payload else None
        
        fire_audit_log(
            module="sales",
            action="CANCEL",
            description=f"Venta #{sale.id[:8]} anulada/devuelta por un total de ${sale.total_amount_usd:.2f}",
            severity="CRITICAL",
            entity_name="sale",
            entity_id=sale.id,
            old_values={"status": "completed", "total_usd": sale.total_amount_usd},
            new_values={"status": "refunded"},
            metadata={"reason": reason_str, "supervisor_id": supervisor_id}
        )
        
        return sale
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))

