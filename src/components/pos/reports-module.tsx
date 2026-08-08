"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { localApiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Download,
  Calendar,
  Building2,
  UserCircle,
  Truck,
  Banknote,
  FileText,
} from "lucide-react"

export function ReportsModule() {
  const [dateRange, setDateRange] = useState("month")
  const [reportType, setReportType] = useState("")

  // Fetch real dashboard stats from the backend
  const { data: dashboardData, isLoading, isError } = useQuery({
    queryKey: ["reports-dashboard", dateRange],
    queryFn: async () => {
      const { data } = await localApiClient.get(`/reports/dashboard?period=${dateRange}`)
      return data
    },
    refetchInterval: 30000,
  })

  // We assign defaults in case data is loading or missing
  const dashboardStats = dashboardData?.stats || {
    totalSales: 0,
    totalSalesBs: 0,
    salesGrowth: 0,
    totalPurchases: 0,
    totalPurchasesBs: 0,
    purchasesChange: 0,
    inventoryValue: 0,
    inventoryValueBs: 0,
    lowStockItems: 0,
    activeClients: 0,
    newClients: 0,
    totalDebt: 0,
    totalSuppliers: 0,
    activeSuppliers: 0,
  }

  const topProducts = dashboardData?.topProducts || []

  const reportCategories = [
    {
      id: "sales",
      title: "Reportes de Ventas",
      icon: ShoppingCart,
      color: "text-primary",
      bgColor: "bg-primary/10",
      reports: [
        { id: "sales_daily", name: "Ventas Diarias", description: "Resumen de ventas por día" },
        { id: "sales_monthly", name: "Ventas Mensuales", description: "Consolidado mensual de ventas" },
        { id: "sales_by_product", name: "Ventas por Producto", description: "Detalle de ventas por producto" },
        { id: "sales_by_category", name: "Ventas por Categoría", description: "Análisis por categoría" },
        { id: "sales_by_payment", name: "Ventas por Método de Pago", description: "Distribución por método de pago" },
      ],
    },
    {
      id: "purchases",
      title: "Reportes de Compras",
      icon: Truck,
      color: "text-primary",
      bgColor: "bg-primary/10",
      reports: [
        { id: "purchases_daily", name: "Compras Diarias", description: "Detalle de compras diarias" },
        { id: "purchases_monthly", name: "Compras Mensuales", description: "Consolidado mensual" },
        { id: "purchases_by_supplier", name: "Compras por Proveedor", description: "Análisis por proveedor" },
        { id: "purchases_by_category", name: "Compras por Categoría", description: "Distribución por categoría" },
      ],
    },
    {
      id: "inventory",
      title: "Reportes de Inventario",
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
      reports: [
        { id: "inventory_current", name: "Inventario Actual", description: "Estado actual del inventario" },
        { id: "inventory_low_stock", name: "Productos con Bajo Stock", description: "Alertas de stock mínimo" },
        { id: "inventory_movement", name: "Movimientos de Inventario", description: "Entradas y salidas" },
        { id: "inventory_valuation", name: "Valoración de Inventario", description: "Valor total del inventario" },
        { id: "inventory_shrinkage", name: "Registro de Mermas", description: "Productos dañados o vencidos" },
      ],
    },
    {
      id: "clients",
      title: "Reportes de Clientes",
      icon: UserCircle,
      color: "text-primary",
      bgColor: "bg-primary/10",
      reports: [
        { id: "clients_list", name: "Lista de Clientes", description: "Directorio completo de clientes" },
        { id: "clients_debt", name: "Cuentas por Cobrar", description: "Deuda de clientes" },
        { id: "clients_purchases", name: "Historial de Compras por Cliente", description: "Análisis de compras" },
        { id: "clients_inactive", name: "Clientes Inactivos", description: "Clientes sin compras recientes" },
      ],
    },
    {
      id: "suppliers",
      title: "Reportes de Proveedores",
      icon: Building2,
      color: "text-primary",
      bgColor: "bg-primary/10",
      reports: [
        { id: "suppliers_list", name: "Lista de Proveedores", description: "Directorio completo" },
        { id: "suppliers_purchases", name: "Compras por Proveedor", description: "Análisis de compras" },
        { id: "suppliers_payment_terms", name: "Términos de Pago", description: "Condiciones de pago" },
        { id: "suppliers_performance", name: "Evaluación de Proveedores", description: "Desempeño de proveedores" },
      ],
    },
    {
      id: "users",
      title: "Reportes de Usuarios",
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
      reports: [
        { id: "users_list", name: "Lista de Usuarios", description: "Usuarios del sistema" },
        { id: "users_activity", name: "Actividad de Usuarios", description: "Log de actividades" },
        { id: "users_sales", name: "Ventas por Usuario", description: "Desempeño de cajeros" },
        { id: "users_roles", name: "Usuarios por Rol", description: "Distribución de roles" },
      ],
    },
    {
      id: "cash",
      title: "Reportes de Caja",
      icon: Banknote,
      color: "text-primary",
      bgColor: "bg-primary/10",
      reports: [
        { id: "cash_history", name: "Historial de Turnos", description: "Listado de aperturas y cierres" },
        { id: "cash_summary", name: "Resumen de Caja", description: "Totales agrupados" },
      ],
    },
  ]

  const downloadReport = async (reportId: string) => {
    try {
      // 1. Fetch data from backend using the current period
      const { data } = await localApiClient.get(`/reports/download/${reportId}?period=${dateRange}`)
      
      if (!data || !data.length) {
        alert("El reporte no contiene datos para el período seleccionado.")
        return
      }

      // 2. Convert JSON to CSV dynamically
      const headers = Object.keys(data[0])
      const csvRows = []
      
      // Add header row
      csvRows.push(headers.join(","))
      
      // Add data rows
      for (const row of data) {
        const values = headers.map(header => {
          const val = row[header]
          // Escape quotes and commas
          const escaped = ("" + val).replace(/"/g, '""')
          return `"${escaped}"`
        })
        csvRows.push(values.join(","))
      }
      
      const csvString = csvRows.join("\n")
      
      // 3. Trigger Download
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `reporte_${reportId}_${dateRange}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
    } catch (error) {
      console.error("Error al descargar el reporte", error)
      alert("Hubo un error al generar el reporte.")
    }
  }

  const downloadPDFReport = async (reportId: string, reportName: string) => {
    try {
      const { data } = await localApiClient.get(`/reports/download/${reportId}?period=${dateRange}`)
      
      if (!data || !data.length) {
        alert("El reporte no contiene datos para el período seleccionado.")
        return
      }

      const { jsPDF } = await import("jspdf")
      const autoTable = (await import("jspdf-autotable")).default

      const doc = new jsPDF()
      
      // Header
      doc.setFontSize(22)
      doc.setTextColor(40, 40, 40)
      doc.text("XionPOS", 14, 20)
      
      doc.setFontSize(14)
      doc.setTextColor(100, 100, 100)
      doc.text(`Reporte: ${reportName}`, 14, 30)
      
      doc.setFontSize(10)
      const periodLabels: Record<string, string> = {
        today: "Hoy", week: "Esta Semana", month: "Este Mes", quarter: "Este Trimestre", year: "Este Año", custom: "Personalizado"
      }
      doc.text(`Período: ${periodLabels[dateRange] || dateRange}`, 14, 36)
      doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 42)

      // Format headers
      const headers = Object.keys(data[0])
      const formattedHeaders = headers.map(h => 
        h.replace(/_/g, ' ')
         .split(' ')
         .map(word => word.charAt(0).toUpperCase() + word.slice(1))
         .join(' ')
      )

      // Extract rows
      const rows = data.map((row: any) => headers.map(header => {
        const val = row[header]
        if (typeof val === 'number') {
          return Number.isInteger(val) ? val.toString() : val.toFixed(2)
        }
        return val ? String(val) : ''
      }))

      autoTable(doc, {
        head: [formattedHeaders],
        body: rows,
        startY: 50,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 4,
          textColor: [40, 40, 40],
          lineColor: [226, 232, 240], // slate-200
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [15, 23, 42], // slate-900
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252], // slate-50
        },
      })

      doc.save(`reporte_${reportId}_${dateRange}.pdf`)

    } catch (error) {
      console.error("Error al descargar el reporte PDF", error)
      alert("Hubo un error al generar el reporte PDF.")
    }
  }

  return (
    <div className="flex h-full flex-col overflow-auto bg-background/50">
      <Tabs defaultValue="dashboard" className="h-full">
        <div className="border-b border-border bg-card/50 p-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="reports">Descargar Reportes</TabsTrigger>
          </TabsList>
        </div>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="flex-1 p-6">
          <div className="space-y-6">
            {/* Date Range Selector */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Dashboard de Reportes</h2>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-48 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="week">Esta Semana</SelectItem>
                    <SelectItem value="month">Este Mes</SelectItem>
                    <SelectItem value="quarter">Este Trimestre</SelectItem>
                    <SelectItem value="year">Este Año</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sales & Purchases Stats */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/50 shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Ventas Totales
                    </CardTitle>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
                      <DollarSign className="h-5 w-5 text-primary-foreground" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    ${dashboardStats.totalSales.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Bs {dashboardStats.totalSalesBs.toLocaleString()}
                  </p>
                  <div className="mt-3 flex items-center gap-1 text-primary">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-black">+{dashboardStats.salesGrowth}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Compras Totales
                    </CardTitle>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
                      <Truck className="h-5 w-5 text-primary-foreground" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    ${dashboardStats.totalPurchases.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Bs {dashboardStats.totalPurchasesBs.toLocaleString()}
                  </p>
                  <div className="mt-3 flex items-center gap-1 text-red-600">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-sm font-semibold">{dashboardStats.purchasesChange}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Valor Inventario
                    </CardTitle>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
                      <Package className="h-5 w-5 text-primary-foreground" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    ${dashboardStats.inventoryValue.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Bs {dashboardStats.inventoryValueBs.toLocaleString()}
                  </p>
                  <p className="mt-3 text-sm text-amber-600 font-semibold">
                    {dashboardStats.lowStockItems} productos bajo stock
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Clientes Activos
                    </CardTitle>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
                      <Users className="h-5 w-5 text-primary-foreground" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    {dashboardStats.activeClients}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {dashboardStats.newClients} nuevos este mes
                  </p>
                  <p className="mt-3 text-sm font-semibold text-foreground">
                    Deuda: ${dashboardStats.totalDebt.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Top Products */}
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Top 5 Productos Más Vendidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground shadow-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.sales} unidades vendidas</p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-foreground">
                        ${product.revenue.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className="border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                    Proveedores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Proveedores:</span>
                      <span className="font-bold text-foreground">{dashboardStats.totalSuppliers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Proveedores Activos:</span>
                      <span className="font-bold text-emerald-600">{dashboardStats.activeSuppliers}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    Resumen Financiero
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ingresos:</span>
                      <span className="font-bold text-emerald-600">
                        ${dashboardStats.totalSales.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gastos:</span>
                      <span className="font-bold text-red-600">
                        ${dashboardStats.totalPurchases.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3">
                      <span className="font-bold text-foreground">Utilidad Estimada:</span>
                      <span className="text-xl font-black text-primary">
                        ${(dashboardStats.totalSales - dashboardStats.totalPurchases).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Reports Download Tab */}
        <TabsContent value="reports" className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Descargar Reportes</h2>
              <div className="flex items-center gap-3">
                <Label>Período:</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-48 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="week">Esta Semana</SelectItem>
                    <SelectItem value="month">Este Mes</SelectItem>
                    <SelectItem value="quarter">Este Trimestre</SelectItem>
                    <SelectItem value="year">Este Año</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {reportCategories.map((category) => (
                <Card key={category.id} className="border-border/50 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-xl font-bold">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${category.bgColor}`}>
                        <category.icon className={`h-6 w-6 ${category.color}`} />
                      </div>
                      {category.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {category.reports.map((report) => (
                        <div
                          key={report.id}
                          className="flex items-center justify-between rounded-lg border border-border p-3 transition-all hover:border-primary/50 hover:bg-accent/30"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-foreground">{report.name}</p>
                            <p className="text-xs text-muted-foreground">{report.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadReport(report.id)}
                              className="gap-2 rounded-lg hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              title="Descargar Excel (CSV)"
                            >
                              <Download className="h-4 w-4" />
                              Excel
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => downloadPDFReport(report.id, report.name)}
                              className="gap-2 rounded-lg shadow-sm"
                              title="Descargar PDF Vistoso"
                            >
                              <FileText className="h-4 w-4" />
                              PDF
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
