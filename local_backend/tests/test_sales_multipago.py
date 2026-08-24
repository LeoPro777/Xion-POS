# filepath: local_backend/tests/test_sales_multipago.py
# -----------------------------------------------------------------------------
# TESTS: Módulo de Ventas — Multi-pago dinámico
# Verifica la integridad de la lógica de negocio: atomicidad, validación de
# métodos de pago y corrección del estado de inventario post-venta.
# -----------------------------------------------------------------------------

import json
import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from local_backend.main import app
from local_backend.core.models import (
    Product,
    SystemConfig,
    Sale,
    SalePayment,
    SaleItem,
)
from local_backend.core.database import get_session


# =============================================================================
# Fixtures
# =============================================================================

PAYMENT_METHODS_CONFIG = [
    {"id": "pm_efectivo_usd", "label": "Efectivo USD", "currency": "USD", "icon": "DollarSign"},
    {"id": "pm_pago_movil",   "label": "Pago Móvil",   "currency": "VES", "icon": "Smartphone"},
]


@pytest.fixture(name="session")
def session_fixture():
    """Crea una BD en memoria para cada test — no contamina la BD real."""
    from sqlalchemy.pool import StaticPool
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        # Config con métodos de pago dinámicos
        config = SystemConfig(
            payment_methods_json=json.dumps(PAYMENT_METHODS_CONFIG),
            current_exchange_rate_bs=36.5,
        )
        session.add(config)

        # Crear usuario cashier y sesión de caja abierta para validaciones del API
        from local_backend.core.models import User, CashSession, Client
        user = User(
            id="user-1",
            name="Cajero Test",
            email="cajero@test.com",
            role="cashier"
        )
        session.add(user)
        session.commit()

        cash_session = CashSession(
            id="session-1",
            user_id=user.id,
            user_name=user.name,
            status="open"
        )
        session.add(cash_session)
        session.commit()

        # Crear cliente para clave foránea
        client = Client(
            id="client-1",
            name="Cliente Test",
            email="cliente@test.com",
            identification_number="12345678"
        )
        session.add(client)
        session.commit()

        # Producto físico de prueba
        product = Product(
            id=str(uuid4()),
            sku="TEST-001",
            name="Producto de Prueba",
            price_usd=10.0,
            product_type="physical",
            cached_stock_quantity=50.0,
        )
        session.add(product)
        session.commit()
        session.refresh(product)

        yield session, product


@pytest.fixture(name="client")
def client_fixture(session):
    """TestClient con la BD en memoria inyectada."""
    db_session, _ = session

    def override_get_session():
        yield db_session

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# =============================================================================
# Tests
# =============================================================================

class TestSaleRegistration:
    """Tests del endpoint POST /sales."""

    def test_sale_single_payment_usd(self, client: TestClient, session):
        """Una venta con un único pago en USD debe crearse correctamente."""
        db_session, product = session
        payload = {
            "client_id": "client-1",
            "client_name": "Cliente Test",
            "subtotal_usd": 10.0,
            "tax_amount_usd": 1.6,
            "total_amount_usd": 11.6,
            "total_amount_bs": 423.4,
            "exchange_rate": 36.5,
            "payments": [
                {
                    "payment_method_id": "pm_efectivo_usd",
                    "payment_method_label": "Efectivo USD",
                    "currency": "USD",
                    "amount_tendered": 11.6,
                    "amount_usd": 11.6,
                }
            ],
            "items": [
                {
                    "product_id": product.id,
                    "product_name": product.name,
                    "quantity": 1,
                    "unit_price_usd": 10.0,
                    "tax_amount_usd": 1.6,
                    "total_price_usd": 11.6,
                }
            ],
        }
        response = client.post("/api/v1/sales", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert "sale_id" in data

        # Verificar que el pago se guardó
        sale_id = data["sale_id"]
        payments = db_session.query(SalePayment).filter(SalePayment.sale_id == sale_id).all()
        assert len(payments) == 1
        assert payments[0].payment_method_id == "pm_efectivo_usd"
        assert payments[0].amount_usd == pytest.approx(11.6, abs=0.01)

    def test_sale_split_tender(self, client: TestClient, session):
        """Una venta split-tender (USD + Bs) debe crear dos registros SalePayment."""
        db_session, product = session
        payload = {
            "client_id": "client-1",
            "client_name": "Cliente Split",
            "subtotal_usd": 20.0,
            "tax_amount_usd": 3.2,
            "total_amount_usd": 23.2,
            "total_amount_bs": 846.8,
            "exchange_rate": 36.5,
            "payments": [
                {
                    "payment_method_id": "pm_efectivo_usd",
                    "payment_method_label": "Efectivo USD",
                    "currency": "USD",
                    "amount_tendered": 10.0,
                    "amount_usd": 10.0,
                },
                {
                    "payment_method_id": "pm_pago_movil",
                    "payment_method_label": "Pago Móvil",
                    "currency": "VES",
                    "amount_tendered": 483.8,   # 13.2 USD * 36.65
                    "amount_usd": 13.2,
                },
            ],
            "items": [
                {
                    "product_id": product.id,
                    "product_name": product.name,
                    "quantity": 2,
                    "unit_price_usd": 10.0,
                    "tax_amount_usd": 3.2,
                    "total_price_usd": 23.2,
                }
            ],
        }
        response = client.post("/api/v1/sales", json=payload)
        assert response.status_code == 201

        sale_id = response.json()["sale_id"]
        payments = db_session.query(SalePayment).filter(SalePayment.sale_id == sale_id).all()
        assert len(payments) == 2

    def test_inventory_decremented_after_sale(self, client: TestClient, session):
        """El stock del producto debe reducirse tras una venta exitosa."""
        db_session, product = session
        initial_stock = product.cached_stock_quantity  # 50.0
        payload = {
            "client_id": "client-1",
            "client_name": "Test Inv",
            "subtotal_usd": 10.0,
            "tax_amount_usd": 0.0,
            "total_amount_usd": 10.0,
            "total_amount_bs": 365.0,
            "exchange_rate": 36.5,
            "payments": [
                {
                    "payment_method_id": "pm_efectivo_usd",
                    "payment_method_label": "Efectivo USD",
                    "currency": "USD",
                    "amount_tendered": 10.0,
                    "amount_usd": 10.0,
                }
            ],
            "items": [
                {
                    "product_id": product.id,
                    "product_name": product.name,
                    "quantity": 3,
                    "unit_price_usd": 10.0,
                    "tax_amount_usd": 0.0,
                    "total_price_usd": 10.0,
                }
            ],
        }
        client.post("/api/v1/sales", json=payload)
        db_session.refresh(product)
        assert product.cached_stock_quantity == pytest.approx(initial_stock - 3, abs=0.001)

    def test_insufficient_stock_raises_400(self, client: TestClient, session):
        """Una venta que supere el stock debe rechazarse con 400."""
        _, product = session
        payload = {
            "client_id": "client-1",
            "client_name": "Test Over",
            "subtotal_usd": 10.0,
            "tax_amount_usd": 0.0,
            "total_amount_usd": 10.0,
            "total_amount_bs": 365.0,
            "exchange_rate": 36.5,
            "payments": [
                {
                    "payment_method_id": "pm_efectivo_usd",
                    "payment_method_label": "Efectivo USD",
                    "currency": "USD",
                    "amount_tendered": 10.0,
                    "amount_usd": 10.0,
                }
            ],
            "items": [
                {
                    "product_id": product.id,
                    "product_name": product.name,
                    "quantity": 999,  # Más stock del disponible
                    "unit_price_usd": 10.0,
                    "tax_amount_usd": 0.0,
                    "total_price_usd": 10.0,
                }
            ],
        }
        response = client.post("/api/v1/sales", json=payload)
        assert response.status_code == 400
        assert "insuficiente" in response.json()["detail"].lower()

    def test_invalid_payment_method_raises_400(self, client: TestClient, session):
        """Un método de pago no configurado debe rechazarse con 400."""
        _, product = session
        payload = {
            "client_id": "client-1",
            "client_name": "Test Invalid",
            "subtotal_usd": 10.0,
            "tax_amount_usd": 0.0,
            "total_amount_usd": 10.0,
            "total_amount_bs": 365.0,
            "exchange_rate": 36.5,
            "payments": [
                {
                    "payment_method_id": "pm_INEXISTENTE",
                    "payment_method_label": "Método Raro",
                    "currency": "USD",
                    "amount_tendered": 10.0,
                    "amount_usd": 10.0,
                }
            ],
            "items": [
                {
                    "product_id": product.id,
                    "product_name": product.name,
                    "quantity": 1,
                    "unit_price_usd": 10.0,
                    "tax_amount_usd": 0.0,
                    "total_price_usd": 10.0,
                }
            ],
        }
        response = client.post("/api/v1/sales", json=payload)
        assert response.status_code == 400
        assert "reconocidos" in response.json()["detail"].lower()

    def test_underpayment_raises_400(self, client: TestClient, session):
        """Si el pago no cubre el total de la venta debe rechazarse con 400."""
        _, product = session
        payload = {
            "client_id": "client-1",
            "client_name": "Test Under",
            "subtotal_usd": 100.0,
            "tax_amount_usd": 0.0,
            "total_amount_usd": 100.0,
            "total_amount_bs": 3650.0,
            "exchange_rate": 36.5,
            "payments": [
                {
                    "payment_method_id": "pm_efectivo_usd",
                    "payment_method_label": "Efectivo USD",
                    "currency": "USD",
                    "amount_tendered": 5.0,   # Pago incompleto
                    "amount_usd": 5.0,
                }
            ],
            "items": [
                {
                    "product_id": product.id,
                    "product_name": product.name,
                    "quantity": 5,
                    "unit_price_usd": 20.0,
                    "tax_amount_usd": 0.0,
                    "total_price_usd": 100.0,
                }
            ],
        }
        response = client.post("/api/v1/sales", json=payload)
        assert response.status_code == 400
        assert "insuficiente" in response.json()["detail"].lower()

    def test_empty_items_raises_400(self, client: TestClient, session):
        """Una venta sin ítems debe rechazarse en la validación del DTO."""
        payload = {
            "client_id": "client-1",
            "client_name": "Test Empty",
            "subtotal_usd": 0.0,
            "tax_amount_usd": 0.0,
            "total_amount_usd": 0.0,
            "total_amount_bs": 0.0,
            "exchange_rate": 36.5,
            "payments": [
                {
                    "payment_method_id": "pm_efectivo_usd",
                    "payment_method_label": "Efectivo USD",
                    "currency": "USD",
                    "amount_tendered": 0.0,
                    "amount_usd": 0.0,
                }
            ],
            "items": [],  # Lista vacía → Pydantic min_length=1
        }
        response = client.post("/api/v1/sales", json=payload)
        assert response.status_code == 422  # Unprocessable Entity de Pydantic

    def test_get_sale_payments_endpoint(self, client: TestClient, session):
        """El endpoint GET /sales/{id}/payments debe retornar los pagos de la venta."""
        db_session, product = session
        # Crear venta
        payload = {
            "client_id": "client-1",
            "client_name": "Test Get Payments",
            "subtotal_usd": 10.0,
            "tax_amount_usd": 0.0,
            "total_amount_usd": 10.0,
            "total_amount_bs": 365.0,
            "exchange_rate": 36.5,
            "payments": [
                {
                    "payment_method_id": "pm_efectivo_usd",
                    "payment_method_label": "Efectivo USD",
                    "currency": "USD",
                    "amount_tendered": 10.0,
                    "amount_usd": 10.0,
                }
            ],
            "items": [
                {
                    "product_id": product.id,
                    "product_name": product.name,
                    "quantity": 1,
                    "unit_price_usd": 10.0,
                    "tax_amount_usd": 0.0,
                    "total_price_usd": 10.0,
                }
            ],
        }
        post_resp = client.post("/api/v1/sales", json=payload)
        sale_id = post_resp.json()["sale_id"]

        get_resp = client.get(f"/api/v1/sales/{sale_id}/payments")
        assert get_resp.status_code == 200
        payments = get_resp.json()
        assert len(payments) == 1
        assert payments[0]["payment_method_id"] == "pm_efectivo_usd"
        assert payments[0]["currency"] == "USD"
