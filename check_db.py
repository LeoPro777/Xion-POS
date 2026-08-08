import sqlite3

def check_db():
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM systemconfig")
    print("Config:", cursor.fetchone())
    
    cursor.execute("SELECT status FROM cashsession ORDER BY created_at DESC LIMIT 1")
    session = cursor.fetchone()
    print("Last Cash Session:", session)

if __name__ == "__main__":
    try:
        check_db()
    except Exception as e:
        print("Error:", e)
