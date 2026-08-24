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
        
        if "enable_taxes" not in cols:
            print("Adding 'enable_taxes' column to 'systemconfig' table...")
            cursor.execute("ALTER TABLE systemconfig ADD COLUMN enable_taxes BOOLEAN DEFAULT 1")
                
        conn.commit()
        conn.close()
        print("Database taxes preference migration completed successfully.")
    except Exception as e:
        print(f"Error updating database: {e}")
