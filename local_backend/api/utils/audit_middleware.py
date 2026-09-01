# filepath: local_backend/api/utils/audit_middleware.py
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from local_backend.api.utils.audit_context import audit_context

class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware para interceptar las peticiones HTTP entrantes.
    Extrae la IP de origen, ruta, método y la identidad del usuario autenticado
    desde las cabeceras custom inyectadas por el frontend.
    """
    async def dispatch(self, request: Request, call_next):
        # Intentar extraer la IP real de la petición
        ip_address = "127.0.0.1"
        if request.client:
            ip_address = request.client.host
        
        # Soportar cabecera X-Forwarded-For si viene de proxy/red local
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            ip_address = forwarded_for.split(",")[0].strip()
            
        endpoint = request.url.path
        http_method = request.method
        
        # Extraer credenciales inyectadas por Axios en el frontend
        user_id = request.headers.get("x-user-id")
        username = request.headers.get("x-username", "SYSTEM")
        user_role = request.headers.get("x-user-role")
        
        # Instanciar el contexto de auditoría para esta corrutina / hilo
        token = audit_context.set({
            "ip_address": ip_address,
            "endpoint": endpoint,
            "http_method": http_method,
            "user_id": user_id,
            "username": username,
            "user_role": user_role,
        })
        
        try:
            response = await call_next(request)
            return response
        finally:
            # Limpiar el contexto de auditoría para evitar fugas de memoria
            audit_context.reset(token)
