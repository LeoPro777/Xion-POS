import sys
import os

from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from local_backend.core.database import init_db, get_session
from local_backend.api.routers.system import router as system_router
from local_backend.api.routers.inventory import router as inventory_router
from local_backend.api.routers.clients import router as clients_router
from local_backend.api.routers.users import router as users_router
from local_backend.api.routers.suppliers import router as suppliers_router
from local_backend.api.routers.purchases import router as purchases_router
from local_backend.api.routers.sales import router as sales_router
from local_backend.api.routers.cash_register import router as cash_register_router
from local_backend.api.routers.reports import router as reports_router
from local_backend.api.routers.audit import router as audit_router
from local_backend.api.routers.supervisor_auth import router as supervisor_auth_router


from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_db()
        print("[PYTHON] Database initialized and verified.")
    except Exception as e:
        print(f"[CRITICAL] Database initialization failed: {e}")
        raise
    yield
    print("[PYTHON] Shutting down local backend lifecycle...")


from local_backend.api.utils.audit_middleware import AuditMiddleware

app = FastAPI(
    title="Xion POS Local API",
    version="1.1.3",
    description="Offline-first POS backend for Desktop nodes",
    lifespan=lifespan,
    debug=True,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "app://.",                # Electron en producción (Windows)
        "file://",                # Electron cargando index.html directamente
    ],
    allow_origin_regex=r".*",     # En modo dev-empaquetado puede venir como 'null' o vacío
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AuditMiddleware)

# Setup static files for images
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "data", "uploads", "products")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/static/products", StaticFiles(directory=UPLOAD_DIR), name="product_images")


app.include_router(system_router, prefix="/api/v1")
app.include_router(inventory_router, prefix="/api/v1")
app.include_router(clients_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(suppliers_router, prefix="/api/v1")
app.include_router(purchases_router, prefix="/api/v1")
app.include_router(sales_router, prefix="/api/v1")
app.include_router(cash_register_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(supervisor_auth_router, prefix="/api/v1")



@app.get("/api/v1/health")
def health_check(session: Session = Depends(get_session)):
    try:
        session.exec(select(1)).first()
        return {"status": "ok", "db_connected": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")


@app.get("/health")
def check_health() -> dict:
    return {
        "status": "online",
        "mode": "offline_first",
        "anchor_currency": "USD",
    }


def get_frozen_path() -> str:
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


if __name__ == "__main__":
    import uvicorn

    is_frozen = getattr(sys, 'frozen', False)
    
    if is_frozen:
        # En producción: Pasamos el objeto app directamente y deshabilitamos el reload
        print(f"[PYTHON] Starting production backend from: {sys.executable}")
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=8000,
            log_level="info",
            workers=1
        )
    else:
        # En desarrollo: Usamos el string para permitir el auto-reload
        uvicorn.run(
            "local_backend.main:app",
            host="127.0.0.1",
            port=8000,
            reload=True,
            workers=1,
        )
