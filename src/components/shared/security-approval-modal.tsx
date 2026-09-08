// filepath: src/components/shared/security-approval-modal.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Contact, ShieldCheck, KeyRound, Camera, QrCode, RefreshCw } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Label } from "@/components/ui/label";
import { localApiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Html5QrcodeScanner } from "html5-qrcode";

interface SecurityApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApproved: (supervisorName?: string) => void;
  requiredRole?: string;
  actionDescription?: string;
  actionRequired?: 'VOID_SALE' | 'PRICE_OVERRIDE' | 'DRAWER_OPEN' | 'CANCEL_ITEM';
  entityId?: string | number;
}

export function SecurityApprovalModal({
  isOpen,
  onClose,
  onApproved,
  requiredRole = "manager",
  actionDescription = "Esta acción requiere autorización.",
  actionRequired = "VOID_SALE",
  entityId = "SYSTEM",
}: SecurityApprovalModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeValue, setCodeValue] = useState("");
  const [formattedValue, setFormattedValue] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setCodeValue("");
      setFormattedValue("");
      setCameraOpen(false);
    }
  }, [isOpen]);

  // 1. Escuchar por lecturas rápidas de escáner USB HID (teclado rápido)
  useEffect(() => {
    if (!isOpen) return;

    let keyBuffer = "";
    let lastKeyTime = Date.now();
    let timeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      
      // Si el tiempo entre teclas es lento (más de 50ms), asumimos que es tipeo manual
      // y limpiamos el búfer, excepto si estamos capturando ráfaga HID
      if (now - lastKeyTime > 50) {
        keyBuffer = "";
      }
      
      lastKeyTime = now;

      if (e.key === "Enter") {
        if (keyBuffer.length > 0) {
          // Intentar verificar el código leído por escáner
          verifyAccess(keyBuffer);
          keyBuffer = "";
          e.preventDefault();
        }
        return;
      }

      // Filtrar sólo caracteres legibles alfanuméricos o llaves de JSON
      if (e.key.length === 1) {
        keyBuffer += e.key;
      }

      clearTimeout(timeout);
      timeout = setTimeout(() => {
        keyBuffer = "";
      }, 60); // 60ms liveness
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timeout);
    };
  }, [isOpen]);

  // 2. Escáner QR por cámara web (html5-qrcode)
  useEffect(() => {
    if (!cameraOpen || !isOpen) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Error clearing scanner on stop", err));
        scannerRef.current = null;
      }
      return;
    }

    // Instanciar el escáner
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 200, height: 200 },
        aspectRatio: 1.0,
      },
      /* verbose= */ false
    );
    
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        // Escaneo exitoso
        scanner.clear()
          .then(() => {
            scannerRef.current = null;
            setCameraOpen(false);
            verifyAccess(decodedText);
          })
          .catch((err) => {
            console.error("Error clearing scanner on success", err);
            setCameraOpen(false);
            verifyAccess(decodedText);
          });
      },
      (error) => {
        // Error silencioso para no contaminar consola
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Error cleaning up scanner", err));
        scannerRef.current = null;
      }
    };
  }, [cameraOpen, isOpen]);

  const verifyAccess = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      let isPin = false;
      let cleanCode = code.trim();
      
      // Determinar si es JSON de carnet QR
      if (cleanCode.startsWith("{") && cleanCode.endswith("}")) {
        try {
          const parsed = JSON.parse(cleanCode);
          if (parsed.app === "xion_pos" && parsed.type === "SUPERVISOR_KEY") {
            cleanCode = parsed.code;
          }
        } catch (e) {}
      }

      // Si tiene longitud 4 y son solo dígitos, es PIN (Retrocompatibilidad)
      if (cleanCode.length === 4 && /^\d+$/.test(cleanCode)) {
        isPin = true;
      }

      if (isPin) {
        // Verificación heredada por PIN
        const response = await localApiClient.post("/users/verify-access", {
          pin: cleanCode,
          required_role: requiredRole,
        });
        
        toast.success("Autorizado correctamente con PIN de Supervisor");
        onApproved(response.data.username || "Supervisor");
        onClose();
      } else {
        // Verificación moderna por código de 10 caracteres Crockford Base32
        const response = await localApiClient.post("/supervisor-auth/verify", {
          code: cleanCode,
          actionRequired: actionRequired,
          entityId: entityId,
        });

        if (response.data.valid) {
          toast.success(`Autorizado por ${response.data.supervisor.name}`);
          onApproved(response.data.supervisor.name);
          onClose();
        }
      }
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail || "Código de autorización inválido o expirado";
      setError(detail);
      setCodeValue("");
      setFormattedValue("");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.toUpperCase().replace(/-/g, "");
    
    // Validar contra el charset Crockford Base32 + dígitos para soportar PINs
    const VALID_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ2345678901"; // Crockford + 0,1 para PINs
    const cleaned = rawVal.split("").filter(c => VALID_CHARSET.includes(c)).join("").substring(0, 10);
    
    setCodeValue(cleaned);

    // Formatear visualmente con guiones si es código supervisor (10 caracteres)
    let formatted = cleaned;
    // No aplicar guiones si son solo dígitos (asumiendo flujo PIN)
    if (!/^\d+$/.test(cleaned)) {
      if (cleaned.length > 4 && cleaned.length <= 8) {
        formatted = `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
      } else if (cleaned.length > 8) {
        formatted = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
      }
    }
    setFormattedValue(formatted);

    // Auto-validar si tiene 10 caracteres
    if (cleaned.length === 10) {
      verifyAccess(cleaned);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (codeValue.length === 4 || codeValue.length === 10) {
        verifyAccess(codeValue);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-md shadow-2xl border-primary/20 bg-card">
        <DialogHeader className="space-y-3 pb-2 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <ShieldCheck className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <DialogTitle className="text-2xl font-bold text-foreground">
            Autorización Requerida
          </DialogTitle>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            {actionDescription}
          </p>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center space-y-6 py-4">
          {/* Lector de Cámara */}
          {cameraOpen && (
            <div className="w-full flex flex-col items-center space-y-2">
              <div className="w-full max-w-[280px] aspect-square rounded-xl overflow-hidden border border-border shadow-inner bg-slate-950 relative">
                <div id="qr-reader" className="w-full h-full"></div>
              </div>
              <span className="text-[10px] text-muted-foreground animate-pulse">
                Coloque el QR de su credencial frente a la cámara
              </span>
            </div>
          )}

          {/* Formulario Manual */}
          {!cameraOpen && (
            <div className="space-y-3 flex flex-col items-center w-full">
              <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" />
                Ingrese Código (10 caracteres) o PIN (4 dígitos)
              </Label>
              
              <Input
                type="text"
                placeholder="K7X9-M2W4-PQ"
                value={formattedValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="h-14 font-mono text-center text-xl font-bold uppercase tracking-widest border-2 rounded-xl focus-visible:ring-primary/20 bg-background"
                autoFocus
              />
            </div>
          )}

          <div className="w-full flex items-center gap-4 text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-40">
            <div className="h-px flex-1 bg-border"></div>
            O
            <div className="h-px flex-1 bg-border"></div>
          </div>

          {/* Entrada Alternativa (Cámara) */}
          <div className="w-full flex flex-col gap-2">
            <Button
              variant="outline"
              type="button"
              disabled={loading}
              onClick={() => setCameraOpen(!cameraOpen)}
              className="w-full h-11 flex items-center justify-center gap-2 border-border/80"
            >
              <Camera className="h-4 w-4" />
              {cameraOpen ? "Cancelar Escaneo" : "Escanear Credencial QR"}
            </Button>
          </div>

          {/* Estado de validación */}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
              Validando credencial con el servidor...
            </div>
          )}

          {error && (
            <div className="w-full flex items-center gap-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-3 text-xs font-medium border border-red-500/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
