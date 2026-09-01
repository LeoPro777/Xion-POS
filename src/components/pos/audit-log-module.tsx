// filepath: src/components/pos/audit-log-module.tsx
import { useState } from "react";
import { useAuditLogs, AuditLog } from "@/hooks/queries/use-audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar as CalendarIcon,
  Search,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  User as UserIcon,
  Globe,
  Tag,
  AlertTriangle,
  Info,
  Flame,
} from "lucide-react";
import { toast } from "sonner";

export function AuditLogModule() {
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [datePreset, setDatePreset] = useState<string>("all");
  
  // Detalle del log seleccionado para inspección
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mapear filtros a la query
  const filters = {
    page,
    limit,
    start_date: startDate ? new Date(startDate).toISOString() : undefined,
    end_date: endDate ? new Date(endDate).toISOString() : undefined,
    module: selectedModule !== "all" ? [selectedModule] : undefined,
    severity: selectedSeverity !== "all" ? selectedSeverity : undefined,
    search: search.trim() || undefined,
  };

  const { data, isLoading, isError, refetch } = useAuditLogs(filters);

  // Presets de fecha
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    setPage(1);
    
    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      setStartDate(todayStart.toISOString().split("T")[0]);
      setEndDate(now.toISOString().split("T")[0]);
    } else if (preset === "week") {
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(lastWeek.toISOString().split("T")[0]);
      setEndDate(now.toISOString().split("T")[0]);
    } else if (preset === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(startOfMonth.toISOString().split("T")[0]);
      setEndDate(now.toISOString().split("T")[0]);
    }
  };

  // Descarga directa a CSV / PDF
  const handleExport = (format: "csv" | "pdf") => {
    const params = new URLSearchParams();
    params.append("format", format);
    if (startDate) params.append("start_date", new Date(startDate).toISOString());
    if (endDate) params.append("end_date", new Date(endDate).toISOString());
    if (selectedModule !== "all") params.append("module", selectedModule);
    if (selectedSeverity !== "all") params.append("severity", selectedSeverity);
    if (search.trim()) params.append("search", search.trim());

    // Se asume sesión en localStorage inyectada por interceptor
    const storedUser = localStorage.getItem("xion_user");
    const headers: Record<string, string> = {};
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.id) headers["X-User-Id"] = user.id;
        if (user.name) headers["X-Username"] = user.name;
        if (user.role) headers["X-User-Role"] = user.role;
      } catch (e) {
        console.error(e);
      }
    }

    toast.info(`Generando reporte de auditoría en formato ${format.toUpperCase()}...`);
    
    fetch(`http://localhost:8000/api/v1/audit-logs/export?${params.toString()}`, {
      headers: headers
    })
      .then((res) => {
        if (!res.ok) throw new Error("Error exportando registros");
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bitacora_auditoria_${new Date().toISOString().split("T")[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success("Archivo descargado correctamente");
      })
      .catch((err) => {
        toast.error("No se pudo exportar la bitácora: " + err.message);
      });
  };

  // Formateadores estéticos
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return (
          <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/20 border-red-500/30 flex items-center gap-1 w-fit font-bold">
            <Flame className="h-3 w-3" />
            CRITICAL
          </Badge>
        );
      case "WARNING":
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30 flex items-center gap-1 w-fit font-semibold">
            <AlertTriangle className="h-3 w-3" />
            WARNING
          </Badge>
        );
      case "INFO":
      default:
        return (
          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border-blue-500/30 flex items-center gap-1 w-fit font-normal">
            <Info className="h-3 w-3" />
            INFO
          </Badge>
        );
    }
  };

  const getModuleBadge = (moduleName: string) => {
    const colors: Record<string, string> = {
      sales: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      inventory: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
      cash_register: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      users: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
      system: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
    };
    const labels: Record<string, string> = {
      sales: "Ventas",
      inventory: "Inventario",
      cash_register: "Caja",
      users: "Usuarios",
      system: "Sistema",
    };
    return (
      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${colors[moduleName] || colors.system}`}>
        {labels[moduleName] || moduleName}
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header and Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Bitácora de Auditoría</h1>
          <p className="text-muted-foreground text-sm">
            Auditoría de eventos inmutable (Append-Only) y trazabilidad del sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-1.5 h-10">
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="flex items-center gap-1.5 h-10">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="default" size="sm" onClick={() => handleExport("pdf")} className="flex items-center gap-1.5 h-10 bg-primary">
            <Download className="h-4 w-4" />
            Reporte PDF
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      <Card className="border-border/50 shadow-md bg-card/60 backdrop-blur-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Filtros Avanzados</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Preset Temporal */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Rango de Fecha</label>
            <Select value={datePreset} onValueChange={handleDatePresetChange}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Seleccione preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el Histórico</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Últimos 7 Días</SelectItem>
                <SelectItem value="month">Este Mes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fecha Inicio (Personalizado) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Desde</label>
            <div className="relative">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setDatePreset("custom"); setPage(1); }}
                className="h-10 pr-8"
              />
              <CalendarIcon className="absolute right-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Fecha Fin (Personalizado) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Hasta</label>
            <div className="relative">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setDatePreset("custom"); setPage(1); }}
                className="h-10 pr-8"
              />
              <CalendarIcon className="absolute right-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Módulo */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Módulo</label>
            <Select value={selectedModule} onValueChange={(val) => { setSelectedModule(val); setPage(1); }}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Módulos</SelectItem>
                <SelectItem value="sales">Ventas</SelectItem>
                <SelectItem value="inventory">Inventario</SelectItem>
                <SelectItem value="cash_register">Caja</SelectItem>
                <SelectItem value="users">Usuarios</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Severidad */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Severidad</label>
            <Select value={selectedSeverity} onValueChange={(val) => { setSelectedSeverity(val); setPage(1); }}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="INFO">INFO</SelectItem>
                <SelectItem value="WARNING">WARNING</SelectItem>
                <SelectItem value="CRITICAL">CRITICAL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Búsqueda libre */}
          <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-5 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Búsqueda Rápida</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Busca por descripción del evento, ID de recurso (ej. SKU, ID Venta) o cajero..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10 h-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card className="border-border/50 shadow-md">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground font-medium">Cargando registros de auditoría...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertTriangle className="h-10 w-10 text-red-500" />
              <p className="text-sm font-semibold text-red-400">Error cargando logs.</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>Reintentar</Button>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              No se encontraron eventos coincidentes en el rango seleccionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/40">
                  <TableRow>
                    <TableHead className="w-[180px] font-bold">Fecha / Hora (Local)</TableHead>
                    <TableHead className="w-[120px] font-bold">Severidad</TableHead>
                    <TableHead className="w-[180px] font-bold">Usuario (Rol)</TableHead>
                    <TableHead className="w-[110px] font-bold">Módulo</TableHead>
                    <TableHead className="w-[120px] font-bold">Acción</TableHead>
                    <TableHead className="font-bold">Descripción del Evento</TableHead>
                    <TableHead className="w-[80px] text-right font-bold pr-6">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((log) => {
                    const localTime = new Date(log.timestamp).toLocaleString();
                    return (
                      <TableRow key={log.id} className="hover:bg-secondary/10 transition-colors">
                        <TableCell className="font-mono text-xs">{localTime}</TableCell>
                        <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase">
                              {log.username.slice(0, 2)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-foreground">{log.username}</span>
                              <span className="text-[10px] text-muted-foreground capitalize">{log.user_role || "Sistema"}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getModuleBadge(log.module)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px] uppercase font-bold tracking-wider">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md truncate text-xs font-medium" title={log.description}>
                          {log.description}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-primary/15 hover:text-primary transition-colors"
                            onClick={() => {
                              setSelectedLog(log);
                              setIsModalOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Inspeccionar</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination controls */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between border-t border-border/40 pt-4">
          <p className="text-xs text-muted-foreground">
            Mostrando <b>{data.items.length}</b> de <b>{data.total}</b> registros
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="h-9 px-3 flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              Página <b>{page}</b> de <b>{data.pages}</b>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === data.pages}
              onClick={() => setPage((p) => Math.min(p + 1, data.pages))}
              className="h-9 px-3 flex items-center gap-1"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* INSPECTION MODAL / DIFF VIEWER */}
      {selectedLog && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto border-border/50 shadow-2xl">
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Detalle del Evento #{selectedLog.id}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 pt-4">
              {/* Metadatos de la Petición */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-secondary/20 p-4 rounded-xl border border-border/50 text-xs">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">Cajero / Operador</span>
                    <span className="font-bold">{selectedLog.username} ({selectedLog.user_role || "SYSTEM"})</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">Petición HTTP</span>
                    <span className="font-mono font-bold">
                      {selectedLog.http_method || "N/A"} {selectedLog.endpoint || "SYSTEM/JOB"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">IP Origen</span>
                    <span className="font-mono font-bold">{selectedLog.ip_address || "Localhost"}</span>
                  </div>
                </div>
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-foreground/80">Descripción</h3>
                <p className="text-sm bg-card p-4 rounded-lg border font-medium text-foreground">
                  {selectedLog.description}
                </p>
              </div>

              {/* JSON Diff Viewer (Antes vs. Después) */}
              {(selectedLog.old_values || selectedLog.new_values) && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground/80 flex items-center gap-2">
                    <span>Estado y Snapshots (Antes vs. Después)</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Snapshot ANTES */}
                    <div className="flex flex-col space-y-1">
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-1">
                        ● Estado Anterior (Snapshot)
                      </span>
                      <div className="bg-red-500/5 dark:bg-red-950/10 border border-red-500/20 p-4 rounded-xl overflow-auto max-h-[300px] text-xs font-mono">
                        {selectedLog.old_values ? (
                          <pre className="text-red-600 dark:text-red-400">
                            {JSON.stringify(selectedLog.old_values, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-muted-foreground italic">N/A (Acción no destructiva/Creación)</span>
                        )}
                      </div>
                    </div>

                    {/* Snapshot DESPUÉS */}
                    <div className="flex flex-col space-y-1">
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest px-1">
                        ● Estado Nuevo / Datos Enviados
                      </span>
                      <div className="bg-emerald-500/5 dark:bg-emerald-950/10 border border-emerald-500/20 p-4 rounded-xl overflow-auto max-h-[300px] text-xs font-mono">
                        {selectedLog.new_values ? (
                          <pre className="text-emerald-600 dark:text-emerald-400">
                            {JSON.stringify(selectedLog.new_values, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-muted-foreground italic">N/A (Acción no generativa/Eliminación)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Metadatos Extra */}
              {selectedLog.metadata_json && (
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-foreground/80">Metadatos de la Transacción / Justificación</h3>
                  <div className="bg-secondary/20 p-4 rounded-xl border border-border/50 text-xs font-mono max-h-[150px] overflow-auto">
                    <pre className="text-foreground/80">
                      {JSON.stringify(selectedLog.metadata_json, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
