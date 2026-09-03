import urllib.request
import uuid
import sys
from pathlib import Path
from sqlmodel import Session, select

# Ensure local_backend is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from local_backend.core.database import engine
from local_backend.core.models import Category

URL = "https://www.google.com/basepages/producttype/taxonomy-with-ids.es-ES.txt"

def seed_taxonomy():
    print(f"Downloading Google Product Taxonomy from {URL}...")
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('utf-8')
        
    lines = content.splitlines()
    
    with Session(engine) as session:
        print("Deleting existing categories to start fresh...")
        existing = session.exec(select(Category)).all()
        for cat in existing:
            session.delete(cat)
        session.commit()

        print("Parsing and Importing Google Taxonomy...")
        path_to_id = {}
        batch = []
        
        for line in lines:
            line = line.strip()
            # Ignore comments and empty lines
            if not line or line.startswith("#"):
                continue
            
            # Format: {id} - {Category > Subcategory > ...}
            parts = line.split(" - ", 1)
            if len(parts) != 2:
                continue
                
            try:
                tax_id = int(parts[0])
            except ValueError:
                continue
                
            full_path = parts[1]
            path_parts = [p.strip() for p in full_path.split(">")]
            
            name = path_parts[-1]
            parent_path = " > ".join(path_parts[:-1])
            
            parent_id = path_to_id.get(parent_path)
            
            cat_uuid = str(uuid.uuid4())
            
            category = Category(
                id=cat_uuid,
                name=name,
                parent_id=parent_id,
                google_taxonomy_id=tax_id,
                is_active=True
            )
            
            path_to_id[full_path] = cat_uuid
            batch.append(category)
            
            if len(batch) >= 500:
                session.add_all(batch)
                session.commit()
                batch = []
                
        if batch:
            session.add_all(batch)
            session.commit()
            
        print(f"Successfully imported {len(path_to_id)} categories into the database.")

if __name__ == "__main__":
    seed_taxonomy()
