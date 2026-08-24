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
            "theme_mode": "TEXT DEFAULT 'light'",
            "font_size": "INTEGER DEFAULT 16",
            "primary_color": "TEXT DEFAULT '#132DA8'",
            "compact_mode": "BOOLEAN DEFAULT 0",
            "animations": "BOOLEAN DEFAULT 1",
            "high_contrast": "BOOLEAN DEFAULT 0",
            "interface_density": "TEXT DEFAULT 'normal'"
        }
        
        for col_name, col_type in new_columns.items():
            if col_name not in cols:
                print(f"Adding '{col_name}' column to 'systemconfig' table...")
                cursor.execute(f"ALTER TABLE systemconfig ADD COLUMN {col_name} {col_type}")
                
        conn.commit()
        conn.close()
        print("Database preferences migration completed successfully.")
    except Exception as e:
        print(f"Error updating database: {e}")
