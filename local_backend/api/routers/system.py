import json
import asyncio
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select, func

from local_backend.core.database import get_session, get_system_config
from local_backend.core.models import SystemConfig, CashSession, SalePayment
from local_backend.api.utils.audit_service import log_event, fire_audit_log

router = APIRouter(prefix="/system", tags=["System"])


class OfflineSyncError(Exception):
    """Excepción personalizada para fallos críticos de integridad local."""


class SystemConfigUpdate(BaseModel):
    anchor_currency: str | None = None
    current_exchange_rate_bs: float | None = None
    lockdown_mode: bool | None = None
    store_name: str | None = None
    store_rif: str | None = None
    store_address: str | None = None
    store_phone: str | None = None
    tax_rate: float | None = None
    enable_taxes: bool | None = None
    wholesale_enabled: bool | None = None
    wholesale_min_qty: int | None = None
    auto_print: bool | None = None
    print_logo: bool | None = None
    ticket_size: str | None = None
    ticket_message: str | None = None
    theme_mode: str | None = None
    font_size: int | None = None
    primary_color: str | None = None
    compact_mode: bool | None = None
    animations: bool | None = None
    high_contrast: bool | None = None
    interface_density: str | None = None
    payment_methods_json: str | None = None

class ExchangeRateUpdate(BaseModel):
    anchor_currency: str
    current_exchange_rate_bs: float
    lockdown_mode: bool = False


@router.get("/status")
def get_system_status(session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Devuelve el estado del motor local y la tasa de cambio ancla."""
    try:
        config = get_system_config(session)
        is_cash_session_open = session.exec(select(CashSession).where(CashSession.status == "open")).first() is not None

        return {
            "status": "online",
            "database": "connected",
            "is_cash_session_open": is_cash_session_open,
            "anchor_currency": config.anchor_currency,
            "current_exchange_rate_bs": config.current_exchange_rate_bs,
            "lockdown_mode": config.lockdown_mode,
            "store_name": config.store_name,
            "store_rif": config.store_rif,
            "store_address": config.store_address,
            "store_phone": config.store_phone,
            "tax_rate": config.tax_rate,
            "enable_taxes": config.enable_taxes,
            "wholesale_enabled": config.wholesale_enabled,
            "wholesale_min_qty": config.wholesale_min_qty,
            "auto_print": config.auto_print,
            "print_logo": config.print_logo,
            "ticket_size": config.ticket_size,
            "ticket_message": config.ticket_message,
            "theme_mode": config.theme_mode,
            "font_size": config.font_size,
            "primary_color": config.primary_color,
            "compact_mode": config.compact_mode,
            "animations": config.animations,
            "high_contrast": config.high_contrast,
            "interface_density": config.interface_density,
            "payment_methods_json": config.payment_methods_json,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(exc)}")


@router.post("/exchange-rate")
def update_exchange_rate(
    body: ExchangeRateUpdate,
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    try:
        config = get_system_config(session)
        
        # Guardar snapshots previos
        old_rate = config.current_exchange_rate_bs
        old_lock = config.lockdown_mode
        old_curr = config.anchor_currency
        
        config.anchor_currency = body.anchor_currency
        config.current_exchange_rate_bs = body.current_exchange_rate_bs
        config.lockdown_mode = body.lockdown_mode
        session.add(config)
        session.commit()
        session.refresh(config)

        # Auditamos el cambio de tasa de cambio
        fire_audit_log(
            module="system",
            action="UPDATE",
            description=f"Cambio de tasa de cambio de Bs. {old_rate:.2f} a Bs. {config.current_exchange_rate_bs:.2f}",
            severity="CRITICAL",
            entity_name="system_config",
            entity_id=str(config.id),
            old_values={"exchange_rate": old_rate, "lockdown_mode": old_lock, "anchor_currency": old_curr},
            new_values={"exchange_rate": config.current_exchange_rate_bs, "lockdown_mode": config.lockdown_mode, "anchor_currency": config.anchor_currency}
        )

        return {
            "status": "updated",
            "anchor_currency": config.anchor_currency,
            "current_exchange_rate_bs": config.current_exchange_rate_bs,
            "lockdown_mode": config.lockdown_mode,
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update exchange rate: {str(exc)}")

@router.patch("/config")
def update_system_config(
    body: SystemConfigUpdate,
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    try:
        config = get_system_config(session)
        
        # Validación de eliminación de métodos de pago
        if body.payment_methods_json is not None:
            old_methods = json.loads(config.payment_methods_json or "[]")
            new_methods = json.loads(body.payment_methods_json)
            
            old_ids = {m["id"] for m in old_methods}
            new_ids = {m["id"] for m in new_methods}
            
            removed_ids = old_ids - new_ids
            
            for rid in removed_ids:
                # Verificar si el método tiene transacciones (suma > 0)
                total_usage = session.exec(
                    select(func.coalesce(func.sum(SalePayment.amount_usd), 0.0))
                    .where(SalePayment.payment_method_id == rid)
                ).one()
                
                # Usamos un pequeño margen de error para flotantes (0.01 USD)
                if total_usage > 0.01:
                    label = next((m["label"] for m in old_methods if m["id"] == rid), rid)
                    print(f"DEBUG: Intento de eliminar '{label}' (ID: {rid}) con balance: {total_usage}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"No se puede eliminar '{label}': El método tiene un balance acumulado de ${total_usage:.2f}. Primero debe estar en 0."
                    )
                else:
                    print(f"DEBUG: Eliminación permitida para ID: {rid} (Balance: {total_usage})")

        update_data = body.dict(exclude_unset=True)
        
        # Guardar snapshots previos
        old_values = {k: getattr(config, k) for k in update_data.keys() if hasattr(config, k)}
        
        for key, value in update_data.items():
            setattr(config, key, value)
            
        session.add(config)
        session.commit()
        session.refresh(config)

        new_values = {k: getattr(config, k) for k in update_data.keys() if hasattr(config, k)}
        
        # Determinar severidad crítica si se activa modo confinamiento o se altera tasa de cambio
        severity = "INFO"
        if "lockdown_mode" in update_data or "current_exchange_rate_bs" in update_data or "allow_negative_stock" in update_data:
            severity = "CRITICAL"
            
        fire_audit_log(
            module="system",
            action="UPDATE",
            description="Actualización de configuración del sistema",
            severity=severity,
            entity_name="system_config",
            entity_id=str(config.id),
            old_values=old_values,
            new_values=new_values
        )

        return {
            "status": "updated",
            "detail": "System configuration updated successfully."
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update system config: {str(exc)}")
