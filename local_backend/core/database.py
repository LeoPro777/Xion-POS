import sys
from pathlib import Path
from typing import Generator
from sqlmodel import SQLModel, create_engine, Session, select
from local_backend.core.config import settings
from local_backend.core.models import SystemConfig, PaymentMethodModel

ROOT_DIR = Path(__file__).resolve().parents[1].parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

engine = create_engine(
    settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    """
    Crea las tablas en la base de datos local y asegura un registro de configuración
    así como los métodos de pago nativos.
    """
    settings.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        config = session.exec(select(SystemConfig).limit(1)).first()
        if not config:
            config = SystemConfig()
            session.add(config)
            
        # Default payment methods
        default_methods = [
            {"code": "pago_movil", "name": "Pago Móvil", "currency": "VES", "allow_decimals": True, "is_system": True},
            {"code": "transferencia_nacional", "name": "Transferencia", "currency": "VES", "allow_decimals": True, "is_system": True},
            {"code": "tarjeta_debito", "name": "Débito", "currency": "VES", "allow_decimals": True, "is_system": True},
            {"code": "biopago", "name": "Biopago", "currency": "VES", "allow_decimals": True, "is_system": True},
            {"code": "efectivo_bs", "name": "Efectivo BS", "currency": "VES", "allow_decimals": False, "is_system": True},
            {"code": "efectivo_usd", "name": "Efectivo USD", "currency": "USD", "allow_decimals": False, "is_system": True},
            {"code": "zelle", "name": "Zelle", "currency": "USD", "allow_decimals": True, "is_system": True},
        ]
        
        for dm in default_methods:
            pm = session.exec(select(PaymentMethodModel).where(PaymentMethodModel.code == dm["code"])).first()
            if not pm:
                new_pm = PaymentMethodModel(**dm)
                session.add(new_pm)

        session.commit()
        session.refresh(config)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def get_system_config(session: Session) -> SystemConfig:
    config = session.exec(select(SystemConfig).limit(1)).first()
    if not config:
        config = SystemConfig()
        session.add(config)
        session.commit()
        session.refresh(config)
    return config
