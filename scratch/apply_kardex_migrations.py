from local_backend.core.database import engine
from sqlmodel import Session, text, SQLModel
from local_backend.core.models import *

def apply_migrations():
    # 1. Eliminar tabla duplicada 'cashsession' si existe
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS cashsession"))
        
        # Opcional: si supplier_id, status no existen en purchase/sale, SQLite ALTER TABLE ADD COLUMN.
        # SQLite no soporta agregar FK fácilmente con ALTER TABLE, pero sí añadir columnas simples.
        try:
            conn.execute(text("ALTER TABLE purchase ADD COLUMN supplier_id VARCHAR"))
            print("Columna supplier_id añadida a purchase.")
        except Exception as e:
            print("Nota: supplier_id ya existe o no pudo añadirse directamente.", e)
            
        try:
            conn.execute(text("ALTER TABLE sale ADD COLUMN status VARCHAR NOT NULL DEFAULT 'completed'"))
            print("Columna status añadida a sale.")
        except Exception as e:
            print("Nota: status ya existe en sale.", e)

    # 2. Crear nuevas tablas (InventoryTransaction, etc)
    SQLModel.metadata.create_all(engine)
    print("Migraciones aplicadas correctamente y Kardex creado.")

if __name__ == "__main__":
    apply_migrations()
