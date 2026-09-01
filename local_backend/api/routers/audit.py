# filepath: local_backend/api/routers/audit.py
import csv
import io
import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from fastapi.responses import StreamingResponse, Response
from sqlmodel import Session, select, func, or_

from local_backend.core.database import get_session
from local_backend.core.models import AuditLog

# Importar ReportLab para la exportación de PDFs
from reportlab.lib.pagesizes import letter, landscape
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import inch

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])

def require_admin_or_manager(x_user_role: Optional[str] = Header(None, alias="X-User-Role")):
    """
    Dependency para validar que solo usuarios administradores o gerentes
    puedan acceder a los logs de auditoría (RBAC).
    """
    # En entornos locales/offline, manager y admin tienen los permisos elevados.
    if x_user_role not in ("admin", "manager"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: Se requieren permisos de nivel Administrador o Auditor."
        )
    return x_user_role

def get_filtered_query(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    modules: Optional[List[str]] = None,
    action: Optional[str] = None,
    severity: Optional[str] = None,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    Construye la sentencia select de SQLModel con filtros dinámicos basados en parámetros de entrada.
    """
    stmt = select(AuditLog)
    
    if start_date:
        try:
            dt_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            stmt = stmt.where(AuditLog.timestamp >= dt_start)
        except ValueError:
            pass
            
    if end_date:
        try:
            dt_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            stmt = stmt.where(AuditLog.timestamp <= dt_end)
        except ValueError:
            pass
            
    if modules:
        # FastAPI recibe múltiples query params 'module' como una lista
        stmt = stmt.where(AuditLog.module.in_(modules))
        
    if action:
        stmt = stmt.where(AuditLog.action == action)
        
    if severity:
        stmt = stmt.where(AuditLog.severity == severity)
        
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
        
    if username:
        stmt = stmt.where(AuditLog.username.like(f"%{username}%"))
        
    if search:
        search_term = f"%{search}%"
        stmt = stmt.where(
            or_(
                AuditLog.description.like(search_term),
                AuditLog.entity_id.like(search_term),
                AuditLog.username.like(search_term)
            )
        )
        
    # Ordenar por fecha decreciente (los más recientes primero)
    return stmt.order_by(AuditLog.timestamp.desc())

@router.get("", dependencies=[Depends(require_admin_or_manager)])
def get_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    module: Optional[List[str]] = Query(None),
    action: Optional[str] = None,
    severity: Optional[str] = None,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    search: Optional[str] = None,
    session: Session = Depends(get_session),
):
    """
    Retorna la lista paginada de logs de auditoría aplicando filtros avanzados.
    """
    stmt = get_filtered_query(
        start_date=start_date,
        end_date=end_date,
        modules=module,
        action=action,
        severity=severity,
        user_id=user_id,
        username=username,
        search=search,
    )
    
    # Calcular el total de registros para paginación en el frontend
    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = session.exec(total_stmt).one()
    
    # Aplicar paginación
    offset = (page - 1) * limit
    stmt = stmt.offset(offset).limit(limit)
    
    results = session.exec(stmt).all()
    
    # Serializar snapshots antes de retornar
    serialized_results = []
    for log in results:
        log_dict = log.model_dump()
        log_dict["old_values"] = json.loads(log.old_values) if log.old_values else None
        log_dict["new_values"] = json.loads(log.new_values) if log.new_values else None
        log_dict["metadata_json"] = json.loads(log.metadata_json) if log.metadata_json else None
        serialized_results.append(log_dict)
        
    return {
        "items": serialized_results,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

@router.get("/export", dependencies=[Depends(require_admin_or_manager)])
def export_audit_logs(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    module: Optional[List[str]] = Query(None),
    action: Optional[str] = None,
    severity: Optional[str] = None,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    search: Optional[str] = None,
    session: Session = Depends(get_session),
):
    """
    Exporta la bitácora filtrada en formatos CSV o PDF (Apaisado) para fines de auditoría física o archivado.
    """
    stmt = get_filtered_query(
        start_date=start_date,
        end_date=end_date,
        modules=module,
        action=action,
        severity=severity,
        user_id=user_id,
        username=username,
        search=search,
    )
    # Limitar la exportación a un número razonable para no saturar memoria en SQLite local
    stmt = stmt.limit(5000)
    logs = session.exec(stmt).all()
    
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Escribir cabeceras en CSV
        writer.writerow([
            "ID", "Fecha/Hora (UTC)", "Usuario ID", "Usuario", "Rol", 
            "Módulo", "Acción", "Severidad", "Entidad", "Entidad ID", 
            "IP Origen", "Endpoint", "Método HTTP", "Descripción", "Metadata Extra"
        ])
        
        for log in logs:
            writer.writerow([
                log.id,
                log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if log.timestamp else "",
                log.user_id or "",
                log.username,
                log.user_role or "",
                log.module,
                log.action,
                log.severity,
                log.entity_name or "",
                log.entity_id or "",
                log.ip_address or "",
                log.endpoint or "",
                log.http_method or "",
                log.description,
                log.metadata_json or ""
            ])
            
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=bitacora_auditoria.csv"}
        )
        
    elif format == "pdf":
        buffer = io.BytesIO()
        # Formato horizontal (landscape letter) para dar espacio a todas las columnas
        page_size = landscape(letter)
        width, height = page_size
        
        c = canvas.Canvas(buffer, pagesize=page_size)
        
        # Margen de 0.5 pulgadas
        margin = 0.5 * inch
        
        def draw_header(canvas_obj, page_num):
            canvas_obj.saveState()
            canvas_obj.setFont("Helvetica-Bold", 14)
            canvas_obj.drawString(margin, height - 0.6 * inch, "REPORTE DE BITÁCORA Y AUDITORÍA DE EVENTOS")
            canvas_obj.setFont("Helvetica", 9)
            canvas_obj.drawString(margin, height - 0.8 * inch, "XION POS - SISTEMA LOCAL INMUTABLE")
            
            # Línea decorativa
            canvas_obj.setStrokeColor(colors.HexColor("#1E3A8A"))
            canvas_obj.setLineWidth(1.5)
            canvas_obj.line(margin, height - 0.9 * inch, width - margin, height - 0.9 * inch)
            
            # Cabeceras de la tabla
            canvas_obj.setFont("Helvetica-Bold", 8)
            canvas_obj.setFillColor(colors.HexColor("#374151"))
            
            # Anchos de columna
            # Total ancho: 792 - 72 = 720 points
            # Fecha (105), Severidad (60), Usuario (95), Modulo (70), Acción (70), Descripción (320)
            canvas_obj.drawString(margin + 5, height - 1.1 * inch, "Fecha/Hora (UTC)")
            canvas_obj.drawString(margin + 110, height - 1.1 * inch, "Severidad")
            canvas_obj.drawString(margin + 175, height - 1.1 * inch, "Usuario (Rol)")
            canvas_obj.drawString(margin + 275, height - 1.1 * inch, "Módulo")
            canvas_obj.drawString(margin + 350, height - 1.1 * inch, "Acción")
            canvas_obj.drawString(margin + 425, height - 1.1 * inch, "Descripción del Evento")
            
            canvas_obj.line(margin, height - 1.15 * inch, width - margin, height - 1.15 * inch)
            canvas_obj.restoreState()
            
        page = 1
        draw_header(c, page)
        
        y_pos = height - 1.35 * inch
        c.setFont("Helvetica", 8)
        
        for idx, log in enumerate(logs):
            # Cambiar de página si nos acercamos al margen inferior (0.6 in)
            if y_pos < 0.6 * inch:
                c.setFont("Helvetica-Oblique", 7)
                c.drawString(width - margin - 50, 0.3 * inch, f"Pág. {page}")
                c.showPage()
                page += 1
                draw_header(c, page)
                y_pos = height - 1.35 * inch
                c.setFont("Helvetica", 8)
            
            # Colores según severidad
            sev_color = colors.black
            if log.severity == "CRITICAL":
                sev_color = colors.HexColor("#DC2626")  # Rojo
            elif log.severity == "WARNING":
                sev_color = colors.HexColor("#D97706")  # Naranja
            elif log.severity == "INFO":
                sev_color = colors.HexColor("#2563EB")  # Azul
                
            # Escribir registro
            timestamp_str = log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if log.timestamp else ""
            user_str = f"{log.username} ({log.user_role or 'N/A'})"
            
            c.drawString(margin + 5, y_pos, timestamp_str)
            
            c.saveState()
            c.setFillColor(sev_color)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(margin + 110, y_pos, log.severity)
            c.restoreState()
            
            # Truncar textos largos para no desbordar columnas
            user_truncated = user_str[:22] + "..." if len(user_str) > 25 else user_str
            desc_truncated = log.description[:85] + "..." if len(log.description) > 88 else log.description
            
            c.drawString(margin + 175, y_pos, user_truncated)
            c.drawString(margin + 275, y_pos, log.module)
            c.drawString(margin + 350, y_pos, log.action)
            c.drawString(margin + 425, y_pos, desc_truncated)
            
            # Línea divisoria suave entre filas
            c.setStrokeColor(colors.HexColor("#E5E7EB"))
            c.setLineWidth(0.5)
            c.line(margin, y_pos - 6, width - margin, y_pos - 6)
            
            y_pos -= 18
            
        # Dibujar pie de página en la última hoja
        c.setFont("Helvetica-Oblique", 7)
        c.drawString(width - margin - 50, 0.3 * inch, f"Pág. {page}")
        c.drawString(margin, 0.3 * inch, f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M:%S')} - Xion POS Auditoría")
        
        c.save()
        buffer.seek(0)
        return Response(
            buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=bitacora_auditoria.pdf"}
        )

@router.get("/{log_id}", dependencies=[Depends(require_admin_or_manager)])
def get_audit_log_by_id(log_id: int, session: Session = Depends(get_session)):
    """
    Retorna el detalle completo de un registro de auditoría.
    """
    log = session.get(AuditLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Registro de auditoría no encontrado")
        
    log_dict = log.model_dump()
    log_dict["old_values"] = json.loads(log.old_values) if log.old_values else None
    log_dict["new_values"] = json.loads(log.new_values) if log.new_values else None
    log_dict["metadata_json"] = json.loads(log.metadata_json) if log.metadata_json else None
    
    return log_dict

