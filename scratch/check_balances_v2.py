
from sqlmodel import Session, create_engine, select, func
from local_backend.core.config import settings
from local_backend.core.models import SystemConfig, SalePayment, Sale
import json

engine = create_engine(settings.database_url)

def check_methods():
    with Session(engine) as session:
        config = session.exec(select(SystemConfig)).first()
        if not config:
            print("No config found")
            return
        
        print(f"Current Methods JSON: {config.payment_methods_json}")
        
        methods = json.loads(config.payment_methods_json or "[]")
        print(f"Found {len(methods)} methods in config.")
        for m in methods:
            usage = session.exec(
                select(func.coalesce(func.sum(SalePayment.amount_usd), 0.0))
                .where(SalePayment.payment_method_id == m["id"])
            ).one()
            print(f"Method {m['label']} (ID: {m['id']}): Balance ${usage:.2f}")

if __name__ == "__main__":
    try:
        check_methods()
    except Exception as e:
        import traceback
        traceback.print_exc()
