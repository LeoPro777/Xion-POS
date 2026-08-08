
from sqlmodel import Session, create_engine, select, func
from local_backend.core.models import SystemConfig, SalePayment, Sale
import json
import os

# SQLite path
db_path = "xionpos.db" # Check if this is the correct name
if not os.path.exists(db_path):
    # Try common locations or check database.py
    print(f"Database {db_path} not found in current dir.")
    # Let's check local_backend/core/database.py for the URI
    with open("local_backend/core/database.py", "r") as f:
        print(f.read())

engine = create_engine(f"sqlite:///{db_path}")

def check_methods():
    with Session(engine) as session:
        config = session.exec(select(SystemConfig)).first()
        if not config:
            print("No config found")
            return
        
        print(f"Current Methods: {config.payment_methods_json}")
        
        methods = json.loads(config.payment_methods_json or "[]")
        for m in methods:
            usage = session.exec(
                select(func.coalesce(func.sum(SalePayment.amount_usd), 0.0))
                .where(SalePayment.payment_method_id == m["id"])
            ).one()
            print(f"Method {m['label']} ({m['id']}): Usage ${usage}")

if __name__ == "__main__":
    try:
        check_methods()
    except Exception as e:
        print(f"Error: {e}")
