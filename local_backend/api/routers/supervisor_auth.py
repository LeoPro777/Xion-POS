# filepath: local_backend/api/routers/supervisor_auth.py
import io
import json
import base64
import secrets
import hashlib
from datetime import datetime, UTC
from typing import Optional, Dict, Any

import qrcode
from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from sqlmodel import Session, select

from local_backend.core.database import get_session
from local_backend.core.models import User, SupervisorAuthCode
from local_backend.api.utils.audit_service import fire_audit_log

router = APIRouter(prefix="/supervisor-auth", tags=["Supervisor Auth"])

# Crockford Base32 seguro para lectura manual (excluye I, L, O, 0, 1)
CROCKFORD_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

def get_current_supervisor_id(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role")
) -> str:
    """
    Valida la cabecera HTTP de rol para asegurar que el solicitante sea Admin o Manager.
    """
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Falta la cabecera de autenticación X-User-Id"
        )
    if x_user_role not in ("admin", "manager"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: Se requieren privilegios de supervisor (Admin/Manager)"
        )
    return x_user_id

def generate_secure_code() -> str:
    """Genera un código aleatorio de 10 caracteres Crockford Base32."""
    return "".join(secrets.choice(CROCKFORD_CHARSET) for _ in range(10))

def hash_code(code: str, salt: str) -> str:
    """Calcula el hash seguro SHA-256 de un código + salt."""
    return hashlib.sha256((code + salt).encode("utf-8")).hexdigest()

def generate_qr_base64(payload: dict) -> str:
    """Genera el código QR en base64 a partir de un payload JSON."""
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(json.dumps(payload))
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{img_base64}"

@router.get("/status")
def get_auth_code_status(
    session: Session = Depends(get_session),
    supervisor_id: str = Depends(get_current_supervisor_id)
):
    """
    Retorna información sobre si existe un código de autorización activo para el supervisor,
    evitando exponer el hash secreto pero proveyendo metadatos como el prefijo público.
    """
    stmt = select(SupervisorAuthCode).where(
        SupervisorAuthCode.user_id == supervisor_id,
        SupervisorAuthCode.is_active == True
    )
    auth = session.exec(stmt).first()
    if not auth:
        return {"hasCode": False}
        
    return {
        "hasCode": True,
        "prefix": auth.code_prefix,
        "created_at": auth.created_at.isoformat() if auth.created_at else None,
        "times_used": auth.times_used
    }

@router.post("/generate")
def generate_auth_code(
    session: Session = Depends(get_session),
    supervisor_id: str = Depends(get_current_supervisor_id)
):
    """
    Genera un nuevo código de autorización de 10 caracteres para el supervisor autenticado,
    revocando inmediatamente cualquier código anterior.
    Retorna el código plano una única vez y el QR base64.
    """
    supervisor = session.get(User, supervisor_id)
    if not supervisor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario supervisor no encontrado"
        )
        
    # 1. Buscar si ya existe un registro para este supervisor (UNIQUE user_id)
    stmt = select(SupervisorAuthCode).where(SupervisorAuthCode.user_id == supervisor_id)
    auth_record = session.exec(stmt).first()
        
    # 2. Generar el código alfanumérico seguro Crockford
    raw_code = generate_secure_code()
    prefix = raw_code[:3]
    salt = secrets.token_hex(16)
    code_hash = hash_code(raw_code, salt)
    
    # 3. Guardar o actualizar en base de datos para respetar la restricción UNIQUE
    if auth_record:
        auth_record.code_hash = code_hash
        auth_record.salt = salt
        auth_record.code_prefix = prefix
        auth_record.is_active = True
        auth_record.times_used = 0
        auth_record.created_at = datetime.now(UTC)
        auth_record.expires_at = None
        auth_record.last_used_at = None
        auth_record.revoked_at = None
        session.add(auth_record)
        db_auth = auth_record
    else:
        db_auth = SupervisorAuthCode(
            user_id=supervisor_id,
            code_hash=code_hash,
            salt=salt,
            code_prefix=prefix,
            is_active=True,
            created_at=datetime.now(UTC)
        )
        session.add(db_auth)
        
    session.commit()
    session.refresh(db_auth)
    
    # 4. Crear payload y generar imagen QR
    qr_payload = {
        "app": "xion_pos",
        "type": "SUPERVISOR_KEY",
        "uid": supervisor_id,
        "code": raw_code
    }
    qr_base64 = generate_qr_base64(qr_payload)
    
    # Audit trail
    fire_audit_log(
        module="users",
        action="RESET_PWD",
        description=f"Credencial de autorización (QR) generada para supervisor {supervisor.name}",
        severity="INFO",
        entity_name="user",
        entity_id=supervisor_id
    )
    
    return {
        "code": raw_code,
        "prefix": prefix,
        "qrDataUrl": qr_base64,
        "expires_at": None
    }

@router.post("/verify")
def verify_auth_code(
    payload: Dict[str, Any],
    session: Session = Depends(get_session),
    x_operator_id: Optional[str] = Header(None, alias="X-User-Id")
):
    """
    Verifica si el código provisto (plano o extraído del JSON QR) corresponde a un supervisor activo.
    En caso exitoso, registra la acción en la bitácora y actualiza el conteo de usos.
    """
    raw_input = payload.get("code")
    action_requested = payload.get("actionRequired", "GENERIC_OVERRIDE")
    entity_id = payload.get("entityId")
    reason = payload.get("reason", "")
    
    if not raw_input:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe proporcionar el código de autorización"
        )
        
    code_to_check = raw_input.strip()
    
    # 1. Comprobar si la entrada es el JSON de escaneo QR
    if code_to_check.startswith("{") and code_to_check.endswith("}"):
        try:
            parsed = json.loads(code_to_check)
            if parsed.get("app") == "xion_pos" and parsed.get("type") == "SUPERVISOR_KEY":
                code_to_check = parsed.get("code", "")
        except Exception:
            pass # Si no parsea como JSON, se comprueba la cadena literal
            
    # Normalizar (mayúsculas y sin guiones)
    code_to_check = code_to_check.replace("-", "").upper()
    
    if len(code_to_check) != 10:
        # Registrar auditoría de intento fallido (formato inválido)
        fire_audit_log(
            module="users",
            action="OVERRIDE",
            severity="WARNING",
            description=f"Intento de validación fallido: Formato de código incorrecto ({len(code_to_check)} caracteres)",
            metadata={"operator_id": x_operator_id, "action_requested": action_requested, "entity_id": entity_id}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código de autorización inválido (debe tener exactamente 10 caracteres)"
        )
        
    # 2. Consultar todos los códigos activos
    stmt = select(SupervisorAuthCode).where(SupervisorAuthCode.is_active == True)
    active_codes = session.exec(stmt).all()
    
    matched_auth = None
    now = datetime.now(UTC)
    
    # 3. Comprobar correspondencia de hash
    for auth in active_codes:
        # Comprobar expiración temporal
        if auth.expires_at and auth.expires_at.replace(tzinfo=UTC) < now:
            continue
        # Comprobar expiración por usos máximos
        if auth.max_uses is not None and auth.times_used >= auth.max_uses:
            continue
            
        calculated = hash_code(code_to_check, auth.salt)
        if calculated == auth.code_hash:
            matched_auth = auth
            break
            
    if not matched_auth:
        # Registrar auditoría de intento fallido (código incorrecto/expirado)
        fire_audit_log(
            module="users",
            action="OVERRIDE",
            severity="WARNING",
            description=f"Intento de validación fallido: Código de supervisor no encontrado o expirado",
            metadata={"operator_id": x_operator_id, "action_requested": action_requested, "entity_id": entity_id}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código de autorización inválido, expirado o revocado"
        )
        
    # 4. Código válido: Obtener datos del supervisor
    supervisor = session.get(User, matched_auth.user_id)
    if not supervisor or supervisor.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El supervisor asociado a esta credencial no se encuentra activo"
        )
        
    # 5. Actualizar estadísticas de uso
    matched_auth.times_used += 1
    matched_auth.last_used_at = datetime.now(UTC)
    session.add(matched_auth)
    session.commit()
    
    # Deducir el módulo a auditar
    audit_module = "system"
    if action_requested in ("VOID_SALE", "CANCEL_ITEM"):
        audit_module = "sales"
    elif action_requested == "PRICE_OVERRIDE":
        audit_module = "inventory"
    elif action_requested == "DRAWER_OPEN":
        audit_module = "cash_register"
        
    # Audit trail
    fire_audit_log(
        module=audit_module,
        action="OVERRIDE",
        description=f"Acción '{action_requested}' autorizada por supervisor {supervisor.name} ({matched_auth.code_prefix}***) para operador ID {x_operator_id or 'N/A'}. Motivo: {reason or 'Ninguno'}",
        severity="INFO",
        entity_name="user",
        entity_id=supervisor.id,
        metadata={
            "supervisor_id": supervisor.id,
            "supervisor_name": supervisor.name,
            "operator_id": x_operator_id,
            "action_requested": action_requested,
            "entity_id": entity_id,
            "reason": reason
        }
    )
    
    return {
        "valid": True,
        "supervisor": {
            "id": supervisor.id,
            "name": supervisor.name,
            "role": supervisor.role
        }
    }

@router.delete("/revoke")
def revoke_auth_code(
    session: Session = Depends(get_session),
    supervisor_id: str = Depends(get_current_supervisor_id)
):
    """
    Invalida de inmediato el código de autorización activo del supervisor.
    """
    stmt = select(SupervisorAuthCode).where(
        SupervisorAuthCode.user_id == supervisor_id,
        SupervisorAuthCode.is_active == True
    )
    auths = session.exec(stmt).all()
    for auth in auths:
        auth.is_active = False
        auth.revoked_at = datetime.now(UTC)
        session.add(auth)
        
    session.commit()
    
    fire_audit_log(
        module="users",
        action="UPDATE",
        description="Código de autorización del supervisor revocado manualmente",
        severity="INFO",
        entity_name="user",
        entity_id=supervisor_id
    )
    
    return {"success": True}
