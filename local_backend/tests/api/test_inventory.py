import pytest
from fastapi.testclient import TestClient
from local_backend.main import app

client = TestClient(app)

def test_create_physical_product():
    import uuid
    random_sku = f"SKU-{uuid.uuid4().hex[:6]}"
    payload = {
        "sku": random_sku,
        "name": "Coca Cola 2L",
        "price_usd": 2.50,
        "cost_usd": 1.00,
        "product_type": "physical",
        "tax_type": "vat"
    }
    response = client.post("/api/v1/inventory/products", json=payload)
    assert response.status_code == 201
    assert response.json()["sku"] == random_sku
    assert response.json()["tax_type"] == "vat"

def test_create_combo_without_items_fails():
    payload = {
        "sku": "COMB-01",
        "name": "Combo Hamburguesa",
        "price_usd": 10.00,
        "cost_usd": 5.00,
        "product_type": "virtual",
        "tax_type": "vat",
        "combo_items": [] # Vacío a propósito
    }
    response = client.post("/api/v1/inventory/products", json=payload)
    assert response.status_code == 400
    assert "Combos require" in response.json()["detail"]
