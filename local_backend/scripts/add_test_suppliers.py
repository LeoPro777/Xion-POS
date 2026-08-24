import sys
import os
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import uuid
import random
import string
from sqlmodel import Session, select
from local_backend.core.database import engine
from local_backend.core.models import Supplier

def generate_random_string(length=8):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def add_suppliers(count=100):
    with Session(engine) as session:
        # Check current count to avoid adding too many if already exists
        existing_count = session.exec(select(Supplier)).all()
        print(f"Current count: {len(existing_count)}")
        
        for i in range(1, count + 1):
            supplier = Supplier(
                id=str(uuid.uuid4()),
                name=f"Proveedor {i:03d} - {generate_random_string(6)}",
                email=f"proveedor{i}@test.com",
                phone=f"+58{random.randint(412, 426)}{random.randint(1000000, 9999999)}",
                address=f"Calle {i}, Zona Industrial {random.randint(1, 10)}, Local {i*2}",
                identification_type="RIF",
                identification_number=f"J-{random.randint(10000000, 99999999)}-{random.randint(0, 9)}",
                category=random.choice(["Alimentos", "Limpieza", "Papelería", "Tecnología", "Repuestos", "Bebidas", "Ferretería"]),
                payment_terms=random.choice(["Contado", "Crédito 7 días", "Crédito 15 días", "Crédito 30 días"]),
                notes=f"Dato de prueba autogenerado (Seed #{i})",
                is_active=True,
                is_synced=False
            )
            session.add(supplier)
        
        session.commit()
        
        new_count = session.exec(select(Supplier)).all()
        print(f"Successfully added {count} suppliers to the database.")
        print(f"New total count: {len(new_count)}")

if __name__ == "__main__":
    try:
        add_suppliers(100)
    except Exception as e:
        print(f"Error adding suppliers: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
