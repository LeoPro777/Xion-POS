# filepath: local_backend/api/utils/audit_context.py
import contextvars
from typing import Dict, Any

# ContextVar para guardar información contextual sobre el usuario e IP de la petición actual.
# Se vacía y recrea por petición de forma aislada entre hilos y tareas asíncronas.
audit_context: contextvars.ContextVar[Dict[str, Any]] = contextvars.ContextVar(
    "audit_context",
    default={
        "ip_address": "127.0.0.1",
        "endpoint": None,
        "http_method": None,
        "user_id": None,
        "username": "SYSTEM",
        "user_role": None,
    }
)
