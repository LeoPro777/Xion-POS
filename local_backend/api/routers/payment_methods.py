from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel

from local_backend.core.database import get_session
from local_backend.core.models import PaymentMethodModel
from local_backend.api.services.image_service import save_and_process_payment_method_image, delete_payment_method_images

router = APIRouter(prefix="/payment-methods", tags=["Payment Methods"])

class PaymentMethodCreate(BaseModel):
    name: str
    code: str
    currency: str
    allow_decimals: bool = True
    is_active: bool = True

class PaymentMethodUpdate(BaseModel):
    name: Optional[str] = None
    currency: Optional[str] = None
    allow_decimals: Optional[bool] = None
    is_active: Optional[bool] = None
    image_url: Optional[str] = None


@router.get("/", response_model=List[PaymentMethodModel])
def get_payment_methods(active: Optional[bool] = None, session: Session = Depends(get_session)):
    query = select(PaymentMethodModel)
    if active is not None:
        query = query.where(PaymentMethodModel.is_active == active)
    
    methods = session.exec(query).all()
    return methods


@router.post("/", response_model=PaymentMethodModel)
def create_payment_method(pm_in: PaymentMethodCreate, session: Session = Depends(get_session)):
    # Validate uniqueness
    existing = session.exec(select(PaymentMethodModel).where(PaymentMethodModel.code == pm_in.code)).first()
    if existing:
        raise HTTPException(status_code=400, detail="El código de método de pago ya existe.")
        
    new_pm = PaymentMethodModel(
        name=pm_in.name,
        code=pm_in.code,
        currency=pm_in.currency,
        allow_decimals=pm_in.allow_decimals,
        is_active=pm_in.is_active,
        is_system=False, # Created by user
    )
    
    session.add(new_pm)
    session.commit()
    session.refresh(new_pm)
    
    return new_pm


@router.put("/{pm_id}", response_model=PaymentMethodModel)
def update_payment_method(pm_id: int, pm_in: PaymentMethodUpdate, session: Session = Depends(get_session)):
    pm = session.exec(select(PaymentMethodModel).where(PaymentMethodModel.id == pm_id)).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Método de pago no encontrado.")
        
    if pm.is_system:
        # Prevent structural changes to system methods
        if pm_in.is_active is not None:
            pm.is_active = pm_in.is_active
        if pm_in.image_url is not None:
            pm.image_url = pm_in.image_url
            
        # Allow updating the name of system methods if desired (for presentation) or maybe not?
        # Requerimiento: "bloquear los campos estructurales críticos (como el identificador o nombre interno), permitiendo únicamente alternar su estado activo/inactivo, cambiar su imagen o actualizar parámetros visuales menores."
        if pm_in.name is not None:
            pm.name = pm_in.name
    else:
        # Non-system, update allowed fields
        if pm_in.name is not None: pm.name = pm_in.name
        if pm_in.currency is not None: pm.currency = pm_in.currency
        if pm_in.allow_decimals is not None: pm.allow_decimals = pm_in.allow_decimals
        if pm_in.is_active is not None: pm.is_active = pm_in.is_active
        if pm_in.image_url is not None: pm.image_url = pm_in.image_url
        
    session.add(pm)
    session.commit()
    session.refresh(pm)
    
    return pm


@router.delete("/{pm_id}")
def delete_payment_method(pm_id: int, session: Session = Depends(get_session)):
    pm = session.exec(select(PaymentMethodModel).where(PaymentMethodModel.id == pm_id)).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Método de pago no encontrado.")
        
    if pm.is_system:
        raise HTTPException(status_code=400, detail="No se pueden eliminar métodos de pago del sistema.")
        
    # Check if there are historical transactions using this method (by code/id).
    # "SalePayment" uses payment_method_id which is a string (e.g., pm.code).
    from local_backend.core.models import SalePayment
    transactions = session.exec(select(SalePayment).where(SalePayment.payment_method_id == pm.code).limit(1)).first()
    if transactions:
        raise HTTPException(status_code=400, detail="No se puede eliminar porque existen transacciones asociadas. Desactívelo en su lugar.")
        
    if pm.image_url:
        delete_payment_method_images(pm.image_url)
        
    session.delete(pm)
    session.commit()
    
    return {"status": "deleted"}


@router.post("/image")
def upload_payment_method_image(file: UploadFile = File(...), old_image_id: Optional[str] = Query(None)):
    image_id = save_and_process_payment_method_image(file, old_image_id)
    return {"image_id": image_id}
