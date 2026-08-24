# filepath: local_backend/tests/test_cash_sessions.py
import json
import pytest
import os
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select

from local_backend.main import app
from local_backend.core.models import (
    Product,
    SystemConfig,
    Sale,
    CashSession,
    User,
    SalePayment,
    SaleItem,
    ProductComposition,
    Client,
    Supplier,
    Purchase,
    PurchaseItem,
)
from local_backend.core.database import get_session

PAYMENT_METHODS_CONFIG = [
    {"id": "pm_efectivo_usd", "label": "Efectivo USD", "currency": "USD", "icon": "DollarSign"},
]

@pytest.fixture(name="session")
def session_fixture():
    db_file = "test_sessions.db"
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
        except:
            pass
    engine = create_engine(f"sqlite:///{db_file}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        config = SystemConfig(
            payment_methods_json=json.dumps(PAYMENT_METHODS_CONFIG),
            current_exchange_rate_bs=36.5,
        )
        session.add(config)
        
        user = User(
            id="user-1",
            name="Cajero Test",
            email="cajero@test.com",
            role="cashier"
        )
        session.add(user)

        client = Client(
            id="client-1",
            name="Cliente Test",
            email="cliente@test.com",
            identification_number="12345678"
        )
        session.add(client)
        
        product = Product(
            id=str(uuid4()),
            sku="PROD-001",
            name="Test Product",
            price_usd=10.0,
            product_type="physical",
            cached_stock_quantity=100.0,
        )
        session.add(product)
        session.commit()
        session.refresh(user)
        session.refresh(product)
        yield session, user, product
    
    # Cleanup after test
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
        except:
            pass

@pytest.fixture(name="client")
def client_fixture(session):
    db_session, _, _ = session
    def override_get_session():
        yield db_session
    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_full_cash_session_cycle(client: TestClient, session):
    db_session, user, product = session
    
    # 1. Intentar vender sin caja abierta (Debe fallar 400)
    payload = {
        "client_id": "client-1",
        "client_name": "Cliente de Prueba",
        "subtotal_usd": 10.0,
        "tax_amount_usd": 0.0,
        "total_amount_usd": 10.0,
        "total_amount_bs": 365.0,
        "exchange_rate": 36.5,
        "payments": [
            {
                "payment_method_id": "pm_efectivo_usd", 
                "payment_method_label": "Efectivo", 
                "currency": "USD", 
                "amount_tendered": 10.0, 
                "amount_usd": 10.0
            }
        ],
        "items": [
            {
                "product_id": product.id, 
                "product_name": product.name, 
                "quantity": 1, 
                "unit_price_usd": 10.0, 
                "tax_amount_usd": 0.0, 
                "total_price_usd": 10.0
            }
        ]
    }
    resp = client.post("/api/v1/sales", json=payload)
    assert resp.status_code == 400
    assert "sesión de caja abierta" in resp.json()["detail"]

    # 2. Abrir caja
    resp = client.post("/api/v1/cash-register/open", json={
        "user_id": user.id,
        "opening_balance_usd": 50.0
    })
    assert resp.status_code == 201
    
    # 3. Vender con caja abierta
    resp = client.post("/api/v1/sales", json=payload)
    assert resp.status_code == 201
    
    # 4. Cerrar caja
    resp = client.post("/api/v1/cash-register/close", json={
        "closing_balance_usd": 60.0 # 50 apertura + 10 venta
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["session"]["status"] == "closed"
    assert data["session"]["total_sales_usd"] == 10.0
    assert "report_path" in data
    
    # 5. Intentar vender de nuevo (Caja ya cerrada)
    resp = client.post("/api/v1/sales", json=payload)
    assert resp.status_code == 400
