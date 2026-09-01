# filepath: local_backend/tests/api/test_audit.py
import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from local_backend.main import app
from local_backend.core.database import engine
from local_backend.core.models import AuditLog
from local_backend.api.utils.audit_service import log_event

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_audit_logs():
    """Limpia los logs de auditoría antes y después de cada test."""
    with Session(engine) as session:
        session.exec(select(AuditLog)).all()
        # Eliminar todos los logs existentes para tener aislamiento
        db_logs = session.exec(select(AuditLog)).all()
        for log in db_logs:
            session.delete(log)
        session.commit()
    yield

def test_audit_logs_rbac_protection():
    """Verifica que el endpoint de consulta esté protegido con RBAC."""
    # 1. Sin cabecera
    response = client.get("/api/v1/audit-logs")
    assert response.status_code == 403
    assert "Acceso denegado" in response.json()["detail"]

    # 2. Con rol cajero (cashier) - Insuficiente
    response = client.get("/api/v1/audit-logs", headers={"X-User-Role": "cashier"})
    assert response.status_code == 403

    # 3. Con rol administrador (admin) - Válido
    response = client.get("/api/v1/audit-logs", headers={"X-User-Role": "admin"})
    assert response.status_code == 200
    
    # 4. Con rol gerente (manager) - Válido
    response = client.get("/api/v1/audit-logs", headers={"X-User-Role": "manager"})
    assert response.status_code == 200

def test_audit_log_filtering_and_retrieval():
    """Crea logs manualmente y comprueba que se pueden listar y filtrar correctamente."""
    
    # Crear logs usando la función de servicio (se corre asíncronamente en el event loop)
    async def create_mock_logs():
        await log_event(
            module="sales",
            action="CREATE",
            description="Venta de prueba",
            severity="INFO",
            entity_name="sale",
            entity_id="sale-abc",
            new_values={"total": 100.0}
        )
        await log_event(
            module="inventory",
            action="STOCK_ADJUST",
            description="Ajuste critico",
            severity="CRITICAL",
            entity_name="product",
            entity_id="prod-xyz",
            old_values={"stock": 10},
            new_values={"stock": 20}
        )
    
    # Ejecutar la creación asíncrona de logs
    asyncio.run(create_mock_logs())

    # 1. Listar sin filtros
    response = client.get("/api/v1/audit-logs", headers={"X-User-Role": "admin"})
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2

    # El orden debe ser descendente (el último creado primero)
    assert data["items"][0]["module"] == "inventory"
    assert data["items"][1]["module"] == "sales"
    assert data["items"][0]["new_values"]["stock"] == 20

    # 2. Filtrar por módulo 'sales'
    response = client.get("/api/v1/audit-logs?module=sales", headers={"X-User-Role": "admin"})
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["module"] == "sales"

    # 3. Búsqueda de texto libre en descripción/entity_id
    response = client.get("/api/v1/audit-logs?search=crit", headers={"X-User-Role": "admin"})
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert "critico" in data["items"][0]["description"].lower()

def test_audit_log_details():
    """Verifica la consulta de detalle de un evento por ID."""
    async def create_log():
        await log_event(
            module="system",
            action="UPDATE",
            description="Configuración actualizada",
            severity="WARNING",
            entity_name="system_config",
            entity_id="sys-1",
            old_values={"enable_taxes": False},
            new_values={"enable_taxes": True}
        )
    asyncio.run(create_log())

    # Obtener el ID de la base de datos
    with Session(engine) as session:
        log = session.exec(select(AuditLog)).first()
        log_id = log.id

    # Consultar detalle
    response = client.get(f"/api/v1/audit-logs/{log_id}", headers={"X-User-Role": "admin"})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == log_id
    assert data["module"] == "system"
    assert data["old_values"]["enable_taxes"] is False
    assert data["new_values"]["enable_taxes"] is True

def test_audit_logs_exports():
    """Comprueba las exportaciones de bitácora en CSV y PDF."""
    async def create_logs():
        await log_event(
            module="sales",
            action="CREATE",
            description="Venta exportable",
            severity="INFO"
        )
    asyncio.run(create_logs())

    # 1. Exportar a CSV
    response = client.get("/api/v1/audit-logs/export?format=csv", headers={"X-User-Role": "admin"})
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment; filename=bitacora_auditoria.csv" in response.headers["content-disposition"]
    csv_content = response.text
    assert "Venta exportable" in csv_content
    assert "sales" in csv_content

    # 2. Exportar a PDF
    response = client.get("/api/v1/audit-logs/export?format=pdf", headers={"X-User-Role": "admin"})
    assert response.status_code == 200
    assert "application/pdf" in response.headers["content-type"]
    assert len(response.content) > 0  # El archivo PDF no debe estar vacío
