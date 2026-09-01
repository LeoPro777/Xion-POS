# filepath: local_backend/api/utils/audit_service.py
import json
import asyncio
import inspect
from functools import wraps
from datetime import datetime, UTC
from typing import Optional, Any, Dict
from sqlmodel import Session
from fastapi.encoders import jsonable_encoder

from local_backend.core.database import engine
from local_backend.core.models import AuditLog
from local_backend.api.utils.audit_context import audit_context

async def log_event(
    module: str,
    action: str,
    description: str,
    severity: str = "INFO",
    entity_name: Optional[str] = None,
    entity_id: Optional[str] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Registra un evento en la bitácora de auditoría de forma asíncrona.
    Utiliza asyncio.to_thread para evitar que la escritura en disco de SQLite bloquee el event loop de FastAPI.
    """
    ctx = audit_context.get()
    
    # Serializar objetos a JSON strings para almacenamiento seguro en SQLite usando jsonable_encoder
    old_str = json.dumps(jsonable_encoder(old_values)) if old_values is not None else None
    new_str = json.dumps(jsonable_encoder(new_values)) if new_values is not None else None
    meta_str = json.dumps(jsonable_encoder(metadata)) if metadata is not None else None
    
    # El usuario de la auditoría viene del contexto HTTP o de los metadatos si es una acción programada
    user_id = ctx.get("user_id")
    username = ctx.get("username", "SYSTEM")
    user_role = ctx.get("user_role")
    
    # Si viene en metadata explícita de la acción (por ejemplo en logins o overrides), sobreescribir el contexto
    if metadata:
        if "user_id" in metadata:
            user_id = metadata["user_id"]
        if "username" in metadata:
            username = metadata["username"]
        if "user_role" in metadata:
            user_role = metadata["user_role"]
            
    audit_log = AuditLog(
        timestamp=datetime.now(UTC),
        user_id=user_id,
        username=username,
        user_role=user_role,
        module=module,
        action=action,
        severity=severity,
        entity_name=entity_name,
        entity_id=entity_id,
        ip_address=ctx.get("ip_address"),
        endpoint=ctx.get("endpoint"),
        http_method=ctx.get("http_method"),
        description=description,
        old_values=old_str,
        new_values=new_str,
        metadata_json=meta_str
    )
    
    def _save_to_db():
        with Session(engine) as session:
            session.add(audit_log)
            session.commit()
            
    await asyncio.to_thread(_save_to_db)

def fire_audit_log(
    module: str,
    action: str,
    description: str,
    severity: str = "INFO",
    entity_name: Optional[str] = None,
    entity_id: Optional[str] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
):
    """
    Despacha la escritura de la auditoría de forma segura.
    Si hay un event loop activo (producción Uvicorn), crea un background task.
    Si no lo hay (entornos de pruebas con TestClient), ejecuta el corrutina de forma síncrona.
    """
    coro = log_event(
        module=module,
        action=action,
        description=description,
        severity=severity,
        entity_name=entity_name,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values,
        metadata=metadata
    )
    try:
        loop = asyncio.get_running_loop()
        if loop.is_running():
            loop.create_task(coro)
        else:
            asyncio.run(coro)
    except RuntimeError:
        # No hay event loop en ejecución
        asyncio.run(coro)

def audit_action(module: str, action: str, severity: str = "INFO", description_template: Optional[str] = None):
    """
    Decorador para auditoría automática de endpoints.
    Detecta si el endpoint es síncrono o asíncrono y gestiona la llamada de auditoría sin penalizar latencia.
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            response = await func(*args, **kwargs)
            # Deducir entity_id de los parámetros comunes
            entity_id = kwargs.get("product_id") or kwargs.get("sale_id") or kwargs.get("user_id") or kwargs.get("client_id")
            entity_name = None
            if "product_id" in kwargs:
                entity_name = "product"
            elif "sale_id" in kwargs:
                entity_name = "sale"
            elif "user_id" in kwargs:
                entity_name = "user"
            elif "client_id" in kwargs:
                entity_name = "client"
                
            desc = description_template or f"Ejecutado endpoint {action} de {module}"
            if "{entity_id}" in desc and entity_id:
                desc = desc.format(entity_id=entity_id)
                
            await log_event(
                module=module,
                action=action,
                description=desc,
                severity=severity,
                entity_name=entity_name,
                entity_id=str(entity_id) if entity_id else None
            )
            return response

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            response = func(*args, **kwargs)
            # Deducir entity_id de los parámetros comunes
            entity_id = kwargs.get("product_id") or kwargs.get("sale_id") or kwargs.get("user_id") or kwargs.get("client_id")
            entity_name = None
            if "product_id" in kwargs:
                entity_name = "product"
            elif "sale_id" in kwargs:
                entity_name = "sale"
            elif "user_id" in kwargs:
                entity_name = "user"
            elif "client_id" in kwargs:
                entity_name = "client"
                
            desc = description_template or f"Ejecutado endpoint {action} de {module}"
            if "{entity_id}" in desc and entity_id:
                desc = desc.format(entity_id=entity_id)
                
            fire_audit_log(
                module=module,
                action=action,
                description=desc,
                severity=severity,
                entity_name=entity_name,
                entity_id=str(entity_id) if entity_id else None
            )
            return response

        if inspect.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator
