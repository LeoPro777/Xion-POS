import asyncio
from pydantic import BaseModel
import requests

payload = {
  "client_name": "Cliente Final",
  "subtotal_usd": 10.0,
  "tax_amount_usd": 0.0,
  "total_amount_usd": 10.0,
  "total_amount_bs": 360.0,
  "exchange_rate": 36.0,
  "payments": [
    {
      "payment_method_id": "CREDITO",
      "payment_method_label": "Crédito",
      "currency": "USD",
      "amount_tendered": 10.0,
      "amount_usd": 10.0
    }
  ],
  "items": [
    {
      "product_id": "dummy",
      "product_name": "dummy",
      "quantity": 1,
      "unit_price_usd": 10.0,
      "tax_amount_usd": 0.0,
      "total_price_usd": 10.0
    }
  ]
}

response = requests.post("http://127.0.0.1:8000/api/v1/sales", json=payload)
print(response.status_code)
print(response.text)
