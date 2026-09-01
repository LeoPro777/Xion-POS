// filepath: src/components/pos/supervisor-badge.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Printer, RefreshCw, KeyRound, QrCode, AlertTriangle, ShieldCheck } from "lucide-react";
import { localApiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { Badge } from "@/components/ui/badge";


interface SupervisorBadgeProps {
  userId: string;
  userName: string;
  userRole: string;
}

export function SupervisorBadge({ userId, userName, userRole }: SupervisorBadgeProps) {
  const [authCode, setAuthCode] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [prefix, setPrefix] = useState<string>("");
  const [showCode, setShowCode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Estados para verificar estado actual en la base de datos
  const [checkingStatus, setCheckingStatus] = useState<boolean>(true);
  const [hasActiveCode, setHasActiveCode] = useState<boolean>(false);
  const [activePrefix, setActivePrefix] = useState<string>("");
  const [activeTimesUsed, setActiveTimesUsed] = useState<number>(0);

  const fetchStatus = async () => {
    setCheckingStatus(true);
    try {
      const { data } = await localApiClient.get("/supervisor-auth/status", {
        headers: {
          "X-User-Id": userId,
          "X-User-Role": userRole
        }
      });
      if (data.hasCode) {
        setHasActiveCode(true);
        setActivePrefix(data.prefix);
        setActiveTimesUsed(data.times_used);
      } else {
        setHasActiveCode(false);
      }
    } catch (err) {
      console.error("Error al obtener estado de credencial:", err);
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [userId, userRole]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data } = await localApiClient.post("/supervisor-auth/generate", {}, {
        headers: {
          "X-User-Id": userId,
          "X-User-Role": userRole
        }
      });
      
      setAuthCode(data.code);
      setPrefix(data.prefix);
      setQrDataUrl(data.qrDataUrl);
      setShowCode(true);

      // Actualizar estados locales indicando que ya tiene código activo
      setHasActiveCode(true);
      setActivePrefix(data.prefix);
      setActiveTimesUsed(0);
      
      toast.success("Código de autorización supervisor generado con éxito");
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail || "No se pudo generar la credencial";
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPDF = () => {
    if (!authCode || !qrDataUrl) return;
    
    toast.info("Generando archivo PDF para impresión...");

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, 120] // Formato carnet PVC / ticket 80mm
    });

    // Encabezado decorativo
    doc.setFillColor(19, 45, 168); // Color corporativo Xion azul
    doc.rect(0, 0, 80, 25, "F");

    // Textos de encabezado
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("XION POS", 40, 10, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("CREDENCIAL DE AUTORIZACIÓN", 40, 16, { align: "center" });

    // Información del usuario
    doc.setTextColor(15, 23, 42); // Negro slate
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(userName.toUpperCase(), 40, 36, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Gris slate
    doc.text(`ROL: ${userRole.toUpperCase()}`, 40, 42, { align: "center" });

    // Línea divisoria
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(10, 45, 70, 45);

    // Añadir código QR
    try {
      doc.addImage(qrDataUrl, "PNG", 18, 48, 44, 44);
    } catch (e) {
      console.error(e);
    }

    // Código en texto plano formateado segmentado
    const formattedCode = `${authCode.slice(0, 4)}-${authCode.slice(4, 8)}-${authCode.slice(8)}`;
    
    doc.setFont("courier", "bold");
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.text(formattedCode, 40, 102, { align: "center" });

    // Advertencia al pie
    doc.setFont("helvetica", "oblique");
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text("Esta credencial es de uso estrictamente personal.", 40, 112, { align: "center" });

    doc.save(`credencial_${userName.toLowerCase().replace(/\s+/g, "_")}.pdf`);
    toast.success("Credencial PDF descargada correctamente");
  };

  const getFormattedCode = () => {
    if (!authCode) return "";
    if (showCode) {
      return `${authCode.slice(0, 4)}-${authCode.slice(4, 8)}-${authCode.slice(8)}`;
    }
    return `${prefix}X-****-**`;
  };

  if (checkingStatus) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Verificando estado de credencial...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {authCode ? (
        /* Caso A: Credencial recién generada en esta sesión (Muestra el QR para imprimir) */
        <div className="space-y-6 w-full max-w-sm">
          {/* Carnet PVC Visual */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-slate-950 text-white shadow-2xl transition-all duration-300 hover:shadow-primary/5 hover:border-primary/40">
            {/* Cabecera del Carnet */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-900 px-6 py-4 text-center border-b border-white/10">
              <div className="flex items-center justify-center gap-2">
                <ShieldCheck className="h-5 w-5 text-sky-400" />
                <span className="font-extrabold tracking-wider text-sm">XION POS</span>
              </div>
              <p className="text-[9px] tracking-widest text-sky-200 font-semibold uppercase mt-0.5">
                Credencial de Autorización
              </p>
            </div>

            {/* Cuerpo del Carnet */}
            <div className="p-6 flex flex-col items-center space-y-4">
              <div className="text-center">
                <h4 className="font-bold text-base tracking-tight">{userName.toUpperCase()}</h4>
                <Badge className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] font-bold uppercase tracking-widest mt-1">
                  {userRole}
                </Badge>
              </div>

              {/* Imagen del Código QR */}
              <div className="bg-white p-2.5 rounded-xl border border-white/20 shadow-md">
                <img
                  src={qrDataUrl}
                  alt="Código QR del Supervisor"
                  className="w-36 h-36 object-contain"
                />
              </div>

              {/* Código Alfanumérico */}
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full justify-between">
                <span className="font-mono text-sm font-bold tracking-widest text-sky-300">
                  {getFormattedCode()}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setShowCode(!showCode)}
                >
                  {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Botones de Control */}
          <div className="flex gap-2 w-full">
            <Button
              onClick={handlePrintPDF}
              variant="outline"
              className="flex-1 border-border bg-card/60 backdrop-blur-md h-11"
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Carnet
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              variant="destructive"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white h-11"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Regenerar
            </Button>
          </div>

          <div className="flex gap-2 items-start bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs text-amber-500">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              La regeneración del código <b>revocará de forma inmediata</b> el código anterior. Las plantillas y credenciales viejas dejarán de funcionar.
            </p>
          </div>
        </div>
      ) : hasActiveCode ? (
        /* Caso B: Ya posee un código activo en la DB (Previene regeneración obligatoria) */
        <Card className="w-full max-w-sm border-2 border-emerald-500/20 text-center p-6 bg-slate-950/40 backdrop-blur-md shadow-2xl">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
              <ShieldCheck className="h-10 w-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Credencial de Autorización Activa</h3>
              <p className="text-xs text-muted-foreground mt-2 max-w-[270px] mx-auto leading-relaxed">
                Este supervisor ya cuenta con una credencial de aprobación activa y registrada en el sistema de base de datos local.
              </p>
            </div>

            <div className="w-full bg-slate-900/60 border border-border/80 rounded-xl p-4 text-left space-y-2 mt-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Prefijo Público:</span>
                <span className="font-mono font-bold text-sky-400">{activePrefix}***</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Máscara Visual:</span>
                <span className="font-mono font-bold text-sky-400">{activePrefix}X-****-**</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Usos Registrados:</span>
                <span className="font-semibold text-emerald-400">{activeTimesUsed} veces</span>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-[10px] text-amber-500 text-left leading-relaxed">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 inline mr-1 mb-0.5" />
              Por políticas de seguridad defensiva, el código en texto plano y código QR completo <b>solo se muestran al momento de ser generados</b>. Si los ha perdido, puede crear una credencial nueva.
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="mt-2 w-full bg-primary hover:bg-primary/95 text-primary-foreground font-semibold h-11"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Regenerando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerar Credencial
                </>
              )}
            </Button>
          </div>
        </Card>
      ) : (
        /* Caso C: No tiene código de autorización. Primer inicio. */
        <Card className="w-full max-w-sm border-dashed border-2 border-border/80 text-center p-8 bg-card/50 backdrop-blur-md shadow-lg">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-primary/10 text-primary">
              <KeyRound className="h-10 w-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Credencial de Autorización</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[250px] mx-auto">
                Los supervisores requieren un código alfanumérico inmutable y QR para autorizar operaciones especiales de caja o inventario.
              </p>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="mt-2 w-full bg-primary hover:bg-primary/95 text-primary-foreground font-semibold"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 mr-2" />
                  Generar Credencial
                </>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
