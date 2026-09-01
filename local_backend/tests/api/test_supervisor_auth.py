# filepath: local_backend/tests/api/test_supervisor_auth.py
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from local_backend.main import app
from local_backend.core.database import engine
from local_backend.core.models import User, SupervisorAuthCode, AuditLog

client = TestClient(app)

@pytest.fixture(autouse=True)
def seed_test_data():
    """Limpia y siembra usuarios de prueba antes de cada ejecución."""
    with Session(engine) as session:
        # Limpiar tablas
        codes = session.exec(select(SupervisorAuthCode)).all()
        for c in codes:
            session.delete(c)
            
        users = session.exec(select(User)).all()
        for u in users:
            session.delete(u)
            
        logs = session.exec(select(AuditLog)).all()
        for l in logs:
            session.delete(l)
            
        session.commit()
        
        # Crear usuarios de prueba
        sup = User(id="sup-123", name="Carlos Gerente", email="carlos@xion.com", role="manager", status="active")
        cash = User(id="cash-456", name="Maria Cajera", email="maria@xion.com", role="cashier", status="active")
        session.add(sup)
        session.add(cash)
        session.commit()
    yield

def test_generate_auth_code_rbac():
    """Valida la restricción RBAC en la generación de códigos."""
    # 1. Cajero intenta generar (Debe retornar 403)
    response = client.post(
        "/api/v1/supervisor-auth/generate",
        headers={"X-User-Id": "cash-456", "X-User-Role": "cashier"}
    )
    assert response.status_code == 403
    
    # 2. Supervisor (Manager) genera exitosamente
    response = client.post(
        "/api/v1/supervisor-auth/generate",
        headers={"X-User-Id": "sup-123", "X-User-Role": "manager"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "code" in data
    assert "qrDataUrl" in data
    assert len(data["code"]) == 10
    assert data["prefix"] == data["code"][:3]

def test_verify_auth_code_cycle():
    """Prueba el flujo completo de generación, verificación y auditoría."""
    # 1. Generar código de supervisor
    gen_response = client.post(
        "/api/v1/supervisor-auth/generate",
        headers={"X-User-Id": "sup-123", "X-User-Role": "manager"}
    )
    assert gen_response.status_code == 200
    auth_code = gen_response.json()["code"]
    
    # 2. Verificar código válido
    verify_payload = {
        "code": auth_code,
        "actionRequired": "VOID_SALE",
        "entityId": "SALE-101",
        "reason": "Cliente canceló producto"
    }
    verify_response = client.post(
        "/api/v1/supervisor-auth/verify",
        json=verify_payload,
        headers={"X-User-Id": "cash-456"} # Petición iniciada por la cajera
    )
    assert verify_response.status_code == 200
    verify_data = verify_response.json()
    assert verify_data["valid"] is True
    assert verify_data["supervisor"]["id"] == "sup-123"
    assert verify_data["supervisor"]["name"] == "Carlos Gerente"
    
    # 3. Comprobar que se registró en la bitácora de auditoría
    with Session(engine) as session:
        logs = session.exec(select(AuditLog).order_by(AuditLog.id.desc())).all()
        # El último log debería ser el de OVERRIDE
        override_log = logs[0]
        assert override_log.module == "sales"
        assert override_log.action == "OVERRIDE"
        assert override_log.severity == "INFO"
        assert "Carlos Gerente" in override_log.description
        assert "cash-456" in override_log.description

def test_verify_auth_code_invalid():
    """Verifica que códigos erróneos o expirados sean rechazados con 401."""
    # Verificar un código inexistente
    verify_payload = {
        "code": "INVALID123",
        "actionRequired": "DRAWER_OPEN"
    }
    response = client.post(
        "/api/v1/supervisor-auth/verify",
        json=verify_payload,
        headers={"X-User-Id": "cash-456"}
    )
    assert response.status_code == 401
    
    # Validar que quedó guardado el intento fallido en la bitácora
    with Session(engine) as session:
        logs = session.exec(select(AuditLog).where(AuditLog.severity == "WARNING")).all()
        assert len(logs) > 0
        assert "Intento de validación fallido" in logs[0].description

def test_revoke_auth_code():
    """Prueba que la revocación invalide de inmediato el código."""
    # 1. Generar código
    gen_response = client.post(
        "/api/v1/supervisor-auth/generate",
        headers={"X-User-Id": "sup-123", "X-User-Role": "manager"}
    )
    auth_code = gen_response.json()["code"]
    
    # 2. Revocar código
    revoke_response = client.delete(
        "/api/v1/supervisor-auth/revoke",
        headers={"X-User-Id": "sup-123", "X-User-Role": "manager"}
    )
    assert revoke_response.status_code == 200
    
    # 3. Intentar verificar (debe dar 401)
    verify_payload = {"code": auth_code, "actionRequired": "PRICE_OVERRIDE"}
    verify_response = client.post(
        "/api/v1/supervisor-auth/verify",
        json=verify_payload,
        headers={"X-User-Id": "cash-456"}
    )
    assert verify_response.status_code == 401
