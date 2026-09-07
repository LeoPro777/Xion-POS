from datetime import datetime, UTC
def get_now_utc():
    return datetime.now(UTC)
from typing import Optional

from enum import Enum
from sqlmodel import SQLModel, Field


class ProductType(str, Enum):
    PHYSICAL = "physical"
    VIRTUAL = "virtual"
    SERVICE = "service"


class TaxType(str, Enum):
    NONE = "none"
    VAT = "vat"
    ISLR = "islr"

class Category(SQLModel, table=True):
    __tablename__: str = "categories"

    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    name: str = Field(nullable=False, index=True)
    slug: Optional[str] = Field(default=None, unique=True, index=True)
    parent_id: Optional[str] = Field(default=None, foreign_key="categories.id")
    google_taxonomy_id: Optional[int] = None
    is_active: bool = Field(default=True)


class Product(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    sku: str = Field(nullable=False, index=True)
    barcode: Optional[str] = None
    name: str = Field(nullable=False)
    description: Optional[str] = None
    category_id: Optional[str] = Field(default=None, foreign_key="categories.id")
    image_id: Optional[str] = Field(default=None, index=True, max_length=32)
    cost_usd: float = Field(default=0.0, nullable=False)
    price_usd: float = Field(default=0.0, nullable=False)
    product_type: ProductType = Field(default=ProductType.PHYSICAL)
    tax_type: TaxType = Field(default=TaxType.NONE)
    unit_measure: str = Field(default="UND")
    wholesale_price_usd: float = Field(default=0.0)
    package_quantity: int = Field(default=1)
    cached_stock_quantity: float = Field(default=0.0)
    min_stock_alert: float = Field(default=0.0)
    is_synced: bool = Field(default=False)
    is_deleted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ProductComposition(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    parent_id: str = Field(nullable=False, foreign_key="product.id")
    child_id: str = Field(nullable=False, foreign_key="product.id")
    quantity_required: float = Field(default=1.0, nullable=False)

class SystemConfig(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    anchor_currency: str = Field(default="USD", nullable=False)
    current_exchange_rate_bs: float = Field(default=36.5, nullable=False)
    lockdown_mode: bool = Field(default=False, nullable=False)
    
    # Store settings
    store_name: str = Field(default="Mi Tienda POS", nullable=False)
    store_rif: str = Field(default="J-12345678-9", nullable=False)
    store_address: str = Field(default="", nullable=False)
    store_phone: str = Field(default="", nullable=False)
    tax_rate: float = Field(default=16.0, nullable=False)
    enable_taxes: bool = Field(default=True, nullable=False)
    wholesale_enabled: bool = Field(default=True, nullable=False)
    wholesale_min_qty: int = Field(default=10, nullable=False)
    
    # Printing
    auto_print: bool = Field(default=True, nullable=False)
    print_logo: bool = Field(default=True, nullable=False)
    ticket_size: str = Field(default="80mm", nullable=False)
    ticket_message: str = Field(default="Gracias por su compra. ¡Vuelva pronto!", nullable=False)
    
    # Preferences
    theme_mode: str = Field(default="light", nullable=False)
    font_size: int = Field(default=16, nullable=False)
    primary_color: str = Field(default="#132DA8", nullable=False)
    compact_mode: bool = Field(default=False, nullable=False)
    animations: bool = Field(default=True, nullable=False)
    high_contrast: bool = Field(default=False, nullable=False)
    interface_density: str = Field(default="normal", nullable=False)
    
    # Custom Payment Methods as JSON
    payment_methods_json: str = Field(default='[]', nullable=False)
    
    # Permisión de stock negativo en modo offline (Regla de negocio)
    allow_negative_stock: bool = Field(default=False, nullable=False)
    
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

class Client(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    name: str = Field(nullable=False, index=True)
    email: str = Field(nullable=False, index=True)
    phone: Optional[str] = None
    address: Optional[str] = None
    identification_type: str = Field(default="CI", nullable=False)
    identification_number: str = Field(nullable=False, index=True)
    credit_limit: float = Field(default=0.0)
    current_debt: float = Field(default=0.0)
    is_active: bool = Field(default=True)
    is_synced: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class User(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    name: str = Field(nullable=False)
    email: str = Field(nullable=False, index=True)
    role: str = Field(default="viewer", nullable=False) # admin, manager, cashier, viewer
    status: str = Field(default="active", nullable=False) # active, inactive
    last_login: Optional[str] = None
    access_pin: Optional[str] = None # PIN para autorizaciones
    qr_token: Optional[str] = Field(default=None, unique=True, index=True) # Token unico para QR
    
    # Permissions
    perm_sales: bool = Field(default=False)
    perm_inventory: bool = Field(default=False)
    perm_reports: bool = Field(default=False)
    perm_users: bool = Field(default=False)
    
    is_synced: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Supplier(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    name: str = Field(nullable=False, index=True)
    email: str = Field(nullable=False, index=True)
    phone: Optional[str] = None
    address: Optional[str] = None
    identification_type: str = Field(default="RIF", nullable=False)
    identification_number: str = Field(nullable=False, index=True)
    category: str = Field(default="Varios", nullable=False)
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = Field(default=True)
    is_synced: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Purchase(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    supplier_id: Optional[str] = Field(default=None, foreign_key="supplier.id", index=True)
    supplier_name: str = Field(nullable=False)
    total_amount_usd: float = Field(default=0.0)
    total_amount_bs: float = Field(default=0.0)
    is_synced: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PurchaseItem(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    purchase_id: str = Field(nullable=False, foreign_key="purchase.id", index=True)
    product_id: str = Field(nullable=False, foreign_key="product.id")
    quantity: float = Field(nullable=False)
    unit_cost_usd: float = Field(default=0.0)
    total_cost_usd: float = Field(default=0.0)

class Sale(SQLModel, table=True):
    """
    Cabecera de la venta. El detalle de cómo se pagó vive en SalePayment.
    Se elimina el campo payment_method único para soportar multi-pago dinámico.
    """
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    client_id: Optional[str] = Field(default=None, foreign_key="client.id")
    client_name: str = Field(default="Cliente Final", nullable=False)
    subtotal_usd: float = Field(default=0.0)
    tax_amount_usd: float = Field(default=0.0)
    total_amount_usd: float = Field(default=0.0)
    total_amount_bs: float = Field(default=0.0)
    exchange_rate: float = Field(default=36.5, nullable=False)
    cash_session_id: Optional[str] = Field(default=None, foreign_key="cash_sessions.id", index=True)
    status: str = Field(default="completed", nullable=False) # 'completed', 'refunded'
    is_synced: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CashSession(SQLModel, table=True):
    """
    Representa una sesión de caja (Apertura/Cierre).
    Controla los montos acumulados durante un turno de trabajo.
    """
    __tablename__: str = "cash_sessions"
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    user_id: str = Field(nullable=False, foreign_key="user.id", index=True)
    user_name: str = Field(nullable=False) # Snapshot para el reporte
    
    opening_time: datetime = Field(default_factory=datetime.utcnow)
    closing_time: Optional[datetime] = None
    
    opening_balance_usd: float = Field(default=0.0)
    closing_balance_usd: float = Field(default=0.0) # Lo que el cajero cuenta al final
    
    # Totales calculados al momento del cierre
    total_sales_usd: float = Field(default=0.0)
    total_tax_usd: float = Field(default=0.0)
    
    # Desglose por método de pago (almacenado como JSON para flexibilidad)
    # Ejemplo: {"pm_efectivo_usd": 150.0, "pm_pago_movil": 2400.0}
    payments_summary_json: str = Field(default='{}', nullable=False)
    
    status: str = Field(default="open") # "open", "closed"
    is_synced: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SalePayment(SQLModel, table=True):
    """
    Registro de cada forma de pago aplicada a una venta.
    Soporta split-tender: una venta puede tener múltiples registros.
    - payment_method_id: ID del método dinámico definido en SystemConfig.payment_methods_json
    - payment_method_label: Snapshot del nombre en el momento de la venta (inmutable)
    - currency: 'USD' o 'VES' (snapshot de la moneda del método)
    - amount_tendered: Monto entregado en la moneda original del método
    - amount_usd: Contravalor en USD calculado al momento de la venta
    """
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    sale_id: str = Field(nullable=False, foreign_key="sale.id", index=True)

    # Snapshot del método de pago (desacoplado del Enum estático)
    payment_method_id: str = Field(nullable=False, index=True)   # Ej: "pm_efectivo_usd"
    payment_method_label: str = Field(nullable=False)             # Ej: "Efectivo USD" (snapshot inmutable)
    currency: str = Field(default="USD", nullable=False)          # "USD" o "VES"

    amount_tendered: float = Field(default=0.0)   # En la moneda original del método
    amount_usd: float = Field(default=0.0)         # Contravalor en USD
    reference_code: Optional[str] = None           # Número de referencia bancaria / lote

class SaleItem(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    sale_id: str = Field(nullable=False, foreign_key="sale.id", index=True)
    product_id: str = Field(nullable=False, foreign_key="product.id")
    product_name: str = Field(nullable=False)
    quantity: float = Field(nullable=False)
    unit_price_usd: float = Field(default=0.0)
    tax_amount_usd: float = Field(default=0.0)
    total_price_usd: float = Field(default=0.0)

class InventoryShrinkage(SQLModel, table=True):
    """
    Registro de mermas de inventario (productos dañados, vencidos, perdidos).
    Afecta el stock negativo y se registra financieramente como pérdida.
    """
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    product_id: str = Field(nullable=False, foreign_key="product.id", index=True)
    product_name: str = Field(nullable=False)
    quantity: float = Field(nullable=False) # Cantidad descontada
    cost_loss_usd: float = Field(default=0.0) # quantity * cost_usd al momento de la merma
    reason: str = Field(default="No especificado")
    user_id: Optional[str] = Field(default=None, index=True) # Cajero/Admin que registró
    created_at: datetime = Field(default_factory=datetime.utcnow)

class InventoryTransaction(SQLModel, table=True):
    """
    Kardex / Ledger de Inventario.
    Registra TODO movimiento: IN (Compras, Ajustes), OUT (Ventas, Mermas, Devoluciones a proveedor)
    """
    __tablename__: str = "inventory_transactions"
    id: Optional[str] = Field(default=None, primary_key=True, index=True)
    product_id: str = Field(nullable=False, foreign_key="product.id", index=True)
    transaction_type: str = Field(nullable=False) # "IN" o "OUT"
    reason: str = Field(nullable=False) # "SALE", "PURCHASE", "SHRINKAGE", "REFUND", "MANUAL_ADJUSTMENT"
    quantity: float = Field(nullable=False) # Cantidad absoluta
    reference_id: Optional[str] = Field(default=None, index=True) # ID de Sale, Purchase o Shrinkage
    user_id: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AuditLog(SQLModel, table=True):
    """
    Modelo para la bitácora y auditoría inmutable de eventos.
    Almacena información detallada del Quién, Qué, Cuándo, Dónde, Cómo y Por qué de cada acción crítica.
    """
    __tablename__: str = "audit_logs"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, nullable=False, index=True)
    user_id: Optional[str] = Field(default=None, index=True)
    username: str = Field(default="SYSTEM", nullable=False)
    user_role: Optional[str] = Field(default=None)
    module: str = Field(nullable=False, index=True)              # 'sales', 'inventory', 'cash_register', 'users', 'system'
    action: str = Field(nullable=False, index=True)              # 'CREATE', 'UPDATE', 'DELETE', 'AUTH', 'OVERRIDE', 'EXPORT'
    severity: str = Field(default="INFO", nullable=False, index=True)  # 'INFO', 'WARNING', 'CRITICAL'
    entity_name: Optional[str] = Field(default=None, index=True)  # 'sale', 'product', 'cash_session', 'system_config'
    entity_id: Optional[str] = Field(default=None, index=True)
    ip_address: Optional[str] = Field(default=None)
    endpoint: Optional[str] = Field(default=None)
    http_method: Optional[str] = Field(default=None)
    description: str = Field(nullable=False)
    old_values: Optional[str] = Field(default=None)              # JSON serializado a string para SQLite
    new_values: Optional[str] = Field(default=None)              # JSON serializado a string para SQLite
    metadata_json: Optional[str] = Field(default=None)           # JSON serializado a string (evita colisión con metadata de SQLModel)


class SupervisorAuthCode(SQLModel, table=True):
    """
    Guarda los códigos de autorización de supervisor de forma cifrada (hash SHA-256 + salt).
    Permite asociar a un supervisor con un prefijo público para identificación en UI y auditorías.
    """
    __tablename__: str = "supervisor_auth_codes"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(nullable=False, unique=True, foreign_key="user.id", index=True)
    code_hash: str = Field(nullable=False)                       # Hash seguro (code + salt)
    salt: str = Field(nullable=False)                            # Salt aleatorio único
    code_prefix: str = Field(max_length=4, nullable=False)           # Primeros 3 caracteres legibles
    qr_payload_version: str = Field(default="v1", max_length=10)
    is_active: bool = Field(default=True, index=True)
    max_uses: Optional[int] = Field(default=None, nullable=True) # Límite de usos opcional
    times_used: int = Field(default=0, nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    expires_at: Optional[datetime] = Field(default=None, nullable=True)
    last_used_at: Optional[datetime] = Field(default=None, nullable=True)
    revoked_at: Optional[datetime] = Field(default=None, nullable=True)


class PaymentMethodModel(SQLModel, table=True):
    __tablename__: str = "payment_methods"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    name: str = Field(unique=True, index=True, nullable=False)
    code: str = Field(unique=True, index=True, nullable=False)
    currency: str = Field(nullable=False)
    allow_decimals: bool = Field(default=True, nullable=False)
    is_system: bool = Field(default=False, nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    image_url: Optional[str] = Field(default=None, nullable=True)
