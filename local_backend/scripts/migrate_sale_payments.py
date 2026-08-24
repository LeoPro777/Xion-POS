#!/usr/bin/env python
# filepath: scripts/migrate_sale_payments.py
# -----------------------------------------------------------------------------
# MIGRACION: Añadir tabla salepayment y eliminar campo payment_method de sale
#
# PROPOSITO: Migrar la BD existente de single-payment a multi-payment.
# EJECUCION: python scripts/migrate_sale_payments.py
# SEGURIDAD: Hace backup automatico de la BD antes de cualquier cambio.
# -----------------------------------------------------------------------------

import shutil
import sqlite3
import sys
import uuid
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "local_backend" / "data" / "xion_offline.db"
BACKUP_DIR = Path(__file__).resolve().parents[1] / "local_backend" / "data" / "backups"


def backup_database() -> Path:
    """Crea una copia de seguridad con timestamp antes de migrar."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"xion_pos_pre_multipago_{timestamp}.db"
    shutil.copy2(DB_PATH, backup_path)
    print(f"[OK] Backup creado en: {backup_path}")
    return backup_path


def migrate(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()

    # 1. Verificar si la tabla salepayment ya existe
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='salepayment'"
    )
    if cursor.fetchone():
        print("[INFO] La tabla 'salepayment' ya existe. Migrando datos residuales si los hay...")
    else:
        print("[...] Creando tabla 'salepayment'...")
        cursor.execute("""
            CREATE TABLE salepayment (
                id                   TEXT PRIMARY KEY,
                sale_id              TEXT NOT NULL REFERENCES sale(id),
                payment_method_id    TEXT NOT NULL,
                payment_method_label TEXT NOT NULL,
                currency             TEXT NOT NULL DEFAULT 'USD',
                amount_tendered      REAL NOT NULL DEFAULT 0.0,
                amount_usd           REAL NOT NULL DEFAULT 0.0,
                reference_code       TEXT
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_salepayment_sale_id ON salepayment(sale_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_salepayment_method_id ON salepayment(payment_method_id)")
        print("[OK] Tabla 'salepayment' creada.")

    # 2. Migrar registros historicos: cada venta con payment_method sin registro nuevo
    cursor.execute("PRAGMA table_info(sale)")
    columns = [row[1] for row in cursor.fetchall()]

    if "payment_method" in columns:
        print("[>>] Migrando ventas historicas de payment_method a salepayment...")
        cursor.execute("""
            SELECT s.id, s.payment_method, s.total_amount_usd, s.total_amount_bs, s.exchange_rate
            FROM sale s
            WHERE NOT EXISTS (
                SELECT 1 FROM salepayment sp WHERE sp.sale_id = s.id
            )
        """)
        historic_sales = cursor.fetchall()

        for sale_id, method, total_usd, total_bs, exchange_rate in historic_sales:
            # Determinar currency del metodo historico
            is_bs = method in ("cash_bs", "pago_movil", "mobile_pay", "biopago")
            currency = "VES" if is_bs else "USD"
            amount_tendered = total_bs if is_bs else total_usd
            amount_usd_val = total_usd

            cursor.execute("""
                INSERT INTO salepayment
                    (id, sale_id, payment_method_id, payment_method_label, currency,
                     amount_tendered, amount_usd, reference_code)
                VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
            """, (
                str(uuid.uuid4()),
                sale_id,
                method or "legacy_unknown",
                (method or "Desconocido").replace("_", " ").title(),
                currency,
                amount_tendered,
                amount_usd_val,
            ))

        print(f"[OK] {len(historic_sales)} ventas historicas migradas.")

        # 3. Eliminar la columna payment_method (SQLite >= 3.35.0)
        sqlite_version = tuple(int(x) for x in sqlite3.sqlite_version.split("."))
        if sqlite_version >= (3, 35, 0):
            print("[...] Eliminando columna obsoleta 'payment_method' de 'sale'...")
            cursor.execute("ALTER TABLE sale DROP COLUMN payment_method")
            print("[OK] Columna 'payment_method' eliminada.")
        else:
            print(
                f"[WARN] SQLite {sqlite3.sqlite_version} es < 3.35.0 -- no soporta DROP COLUMN. "
                "La columna se conserva pero ya no se usara."
            )

        # 4. Eliminar columna reference_number si existe
        if "reference_number" in columns:
            if sqlite_version >= (3, 35, 0):
                cursor.execute("ALTER TABLE sale DROP COLUMN reference_number")
                print("[OK] Columna obsoleta 'reference_number' eliminada.")
    else:
        print("[INFO] Columna 'payment_method' ya no existe en 'sale'. Nada que migrar.")

    conn.commit()
    print("\n[DONE] Migracion completada exitosamente.")


def main() -> int:
    if not DB_PATH.exists():
        print(f"[ERROR] Base de datos no encontrada en: {DB_PATH}")
        print("        Asegurate de que el backend haya iniciado al menos una vez.")
        return 1

    backup_database()

    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON")

    try:
        migrate(conn)
    except Exception as exc:
        conn.rollback()
        print(f"[ERROR] Error durante la migracion: {exc}")
        return 1
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
