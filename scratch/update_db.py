from local_backend.core.database import engine
from sqlmodel import SQLModel
from local_backend.core.models import *

SQLModel.metadata.create_all(engine)
print("Tablas actualizadas exitosamente.")
