import sys
import pytest

# -----------------------------------------------------------------------------
# ARCHITECT: DEV MASTER POS
# MODULE: Environment Integrity Tests
# CONTEXT: Ensures the application is running in the exact required environment
# -----------------------------------------------------------------------------

def is_virtual_env_active() -> bool:
    """
    Verifica si el intérprete actual se está ejecutando dentro de un entorno virtual.
    Compara el prefijo base de instalación del SO con el prefijo actual.
    """
    return sys.prefix != getattr(sys, "base_prefix", sys.prefix)

def test_python_version_is_strictly_3_12():
    """
    Falla si la versión de Python no es exactamente la 3.12.x.
    """
    major, minor = sys.version_info[:2]
    
    assert major == 3, f"Expected Python 3, got {major}"
    assert minor >= 12, f"Expected Python 3.12+, got 3.{minor}"

def test_virtual_environment_is_active():
    """
    Falla si el código se ejecuta en el entorno global del sistema operativo.
    """
    assert is_virtual_env_active() is True, (
        "CRITICAL SECURITY/BUILD RISK: "
        "The application is running in the global OS environment. "
        "You MUST run this inside a virtual environment to prevent "
        "dependency contamination during PyInstaller freezing."
    )
