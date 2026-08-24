import sqlite3
from pathlib import Path

db_path = Path(r"c:\Users\Leo\Desktop\Xion\XionPOS\local_backend\data\xion_offline.db")

if not db_path.exists():
    print(f"Error: Database not found at {db_path}")
else:
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(systemconfig)")
        cols = [col[1] for col in cursor.fetchall()]
        
        new_columns = {
            "store_name": "TEXT DEFAULT 'Mi Tienda POS'",
            "store_rif": "TEXT DEFAULT 'J-12345678-9'",
            "store_address": "TEXT DEFAULT ''",
            "store_phone": "TEXT DEFAULT ''",
            "tax_rate": "FLOAT DEFAULT 16.0",
            "wholesale_enabled": "BOOLEAN DEFAULT 1",
            "wholesale_min_qty": "INTEGER DEFAULT 10",
            "auto_print": "BOOLEAN DEFAULT 1",
            "print_logo": "BOOLEAN DEFAULT 1",
            "ticket_size": "TEXT DEFAULT '80mm'",
            "ticket_message": "TEXT DEFAULT 'Gracias por su compra. ¡Vuelva pronto!'"
        }
        
        for col_name, col_type in new_columns.items():
            if col_name not in cols:
                print(f"Adding '{col_name}' column to 'systemconfig' table...")
                cursor.execute(f"ALTER TABLE systemconfig ADD COLUMN {col_name} {col_type}")
                
        conn.commit()
        conn.close()
        print("Database migration completed successfully.")
    except Exception as e:
        print(f"Error updating database: {e}")
