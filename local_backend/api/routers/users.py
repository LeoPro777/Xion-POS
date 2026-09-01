from typing import List, Dict, Optional
from uuid import uuid4
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, Field, SQLModel

from local_backend.core.database import get_session
from local_backend.core.models import User

router = APIRouter(prefix="/users", tags=["Users"])

class UserCreate(SQLModel):
    name: str = Field(min_length=2)
    email: str
    role: str = "viewer"
    status: str = "active"
    perm_sales: bool = False
    perm_inventory: bool = False
    perm_reports: bool = False
    perm_users: bool = False

class UserNotFoundError(HTTPException):
    def __init__(self, user_id: str):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with id {user_id} not found")

@router.get("", response_model=List[User])
def get_users(session: Session = Depends(get_session)):
    statement = select(User)
    results = session.exec(statement).all()
    return results

@router.post("", status_code=status.HTTP_201_CREATED, response_model=User)
def create_user(payload: UserCreate, session: Session = Depends(get_session)):
    existing_email = session.exec(select(User).where(User.email == payload.email)).first()
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already exists")

    new_user = User(
        id=str(uuid4()),
        **payload.model_dump(),
        is_synced=False,
        last_login="Nunca"
    )
    
    session.add(new_user)
    try:
        session.commit()
        session.refresh(new_user)
        return new_user
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail="Transaction failed")

@router.put("/{user_id}", response_model=User)
def update_user(user_id: str, updated_data: Dict[str, object], session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise UserNotFoundError(user_id)

    if "email" in updated_data and updated_data["email"] != user.email:
        existing = session.exec(select(User).where(User.email == updated_data["email"])).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")

    # Guardar valores previos para auditar
    old_role = user.role
    old_pin = user.access_pin
            
    for key, value in updated_data.items():
        if hasattr(user, key) and key not in {"id", "created_at", "updated_at", "is_synced"}:
            setattr(user, key, value)

    user.is_synced = False
    user.updated_at = datetime.utcnow()
    session.add(user)
    session.commit()
    session.refresh(user)

    # Auditar cambios de rol y contraseña/PIN
    new_role = user.role
    new_pin = user.access_pin

    if old_role != new_role:
        fire_audit_log(
            module="users",
            action="ROLE_CHANGE",
            description=f"Cambio de rol para el usuario '{user.name}'. Rol anterior: {old_role}, nuevo: {new_role}",
            severity="CRITICAL",
            entity_name="user",
            entity_id=user.id,
            old_values={"role": old_role},
            new_values={"role": new_role}
        )

    if old_pin != new_pin:
        fire_audit_log(
            module="users",
            action="RESET_PWD",
            description=f"Actualización de PIN de seguridad/acceso para el usuario '{user.name}'",
            severity="CRITICAL",
            entity_name="user",
            entity_id=user.id
        )

    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise UserNotFoundError(user_id)
    session.delete(user)
    session.commit()

class AccessVerificationRequest(SQLModel):
    pin: Optional[str] = None
    qr_token: Optional[str] = None
    required_role: str = "manager"

import asyncio
from local_backend.api.utils.audit_service import log_event, fire_audit_log

@router.post("/verify-access")
def verify_access(payload: AccessVerificationRequest, session: Session = Depends(get_session)):
    if payload.pin:
        user = session.exec(select(User).where(User.access_pin == payload.pin)).first()
    elif payload.qr_token:
        user = session.exec(select(User).where(User.qr_token == payload.qr_token)).first()
    else:
        fire_audit_log(
            module="users",
            action="AUTH",
            severity="WARNING",
            description="Intento fallido de autenticación: No se proveyó pin ni qr_token"
        )
        raise HTTPException(status_code=400, detail="Debe proveer pin o qr_token")
    
    if not user:
        fire_audit_log(
            module="users",
            action="AUTH",
            severity="WARNING",
            description="Intento fallido de autenticación: Credenciales inválidas"
        )
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
        
    roles = ["admin", "manager", "cashier", "viewer"]
    try:
        user_role_idx = roles.index(user.role)
    except ValueError:
        user_role_idx = 99
        
    try:
        req_role_idx = roles.index(payload.required_role)
    except ValueError:
        req_role_idx = 99
    
    if user_role_idx > req_role_idx:
        fire_audit_log(
            module="users",
            action="OVERRIDE",
            severity="WARNING",
            description=f"Autorización rechazada para {user.name}: Permisos insuficientes (Requiere {payload.required_role})",
            entity_name="user",
            entity_id=user.id,
            metadata={"user_id": user.id, "username": user.name, "user_role": user.role, "required_role": payload.required_role}
        )
        raise HTTPException(status_code=403, detail="Permisos insuficientes para esta acción")
        
    # Determinar si es login de cajero regular o una autorización de supervisor
    # Un requerido_role "viewer" representa el mínimo acceso, mapeado a login general.
    is_login = payload.required_role == "viewer"
    action = "LOGIN" if is_login else "OVERRIDE"
    severity = "INFO" if is_login else "CRITICAL"
    desc = f"Inicio de sesión exitoso para {user.name}" if is_login else f"Autorización/Override concedido a {user.name} (Rol: {user.role}) para nivel {payload.required_role}"
    
    fire_audit_log(
        module="users",
        action=action,
        severity=severity,
        description=desc,
        entity_name="user",
        entity_id=user.id,
        metadata={"user_id": user.id, "username": user.name, "user_role": user.role, "required_role": payload.required_role}
    )
        
    return {
        "valid": True, 
        "user_id": user.id, 
        "user_name": user.name, 
        "user_role": user.role
    }


