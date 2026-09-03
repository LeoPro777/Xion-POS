"use client"

import { useState, useEffect } from "react"
import { z } from "zod"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as XLSX from "xlsx"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Search, Plus, Edit, Trash2, Tag, Box, Layers, DollarSign, Info, ListChecks, ShoppingBag, FileSpreadsheet, Download, AlertCircle, TrendingDown, LayoutGrid, List, ImagePlus, Upload, X } from "lucide-react"
import { ProductImage } from "./product-image"
import { CategoryCombobox } from "./inventory/category-combobox"

import { localApiClient } from "@/lib/api-client"
import { useQueryClient, useMutation } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  Product,
} from "@/hooks/queries/use-inventory"
import { useSystemStatus } from "@/hooks/queries/use-system"
import { toast } from "sonner"

// Esquema Zod de validación alineado con Backend
const productSchema = z.object({
  sku: z.string().min(3, "El SKU debe tener al menos 3 caracteres"),
  name: z.string().min(2, "El nombre es obligatorio"),
  barcode: z.string().optional(),
  description: z.string().optional(),
  category_id: z.string().optional(),
  cost_usd: z.coerce.number().min(0, "Debe ser mayor o igual a 0"),
  price_usd: z.coerce.number().min(0, "Debe ser mayor o igual a 0"),
  wholesale_price_usd: z.coerce.number().min(0, "Debe ser mayor o igual a 0").default(0),
  package_quantity: z.coerce.number().int().min(1, "Debe ser al menos 1").default(1),
  min_stock_alert: z.coerce.number().min(0, "No puede ser negativo"),
  product_type: z.enum(["physical", "service", "virtual"]),
  tax_type: z.enum(["none", "vat", "islr"]),
  unit_measure: z.string().min(1, "Obligatorio (ej: UND)"),
  combo_items: z.array(z.object({
    product_id: z.string().min(1, "Debe seleccionar un producto"),
    quantity: z.coerce.number().min(0.001, "Mínimo 0.001")
  })).optional().default([]),
})

type ProductFormValues = z.infer<typeof productSchema>

export function InventoryModule() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isExcelDialogOpen, setIsExcelDialogOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [alertConfig, setAlertConfig] = useState<{ title: string, description: string, errors: string[] } | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isShrinkageDialogOpen, setIsShrinkageDialogOpen] = useState(false)
  const [shrinkageProduct, setShrinkageProduct] = useState<Product | null>(null)
  const [shrinkageQuantity, setShrinkageQuantity] = useState("")
  const [shrinkageReason, setShrinkageReason] = useState("Dañado/Vencido")

  const [viewMode, setViewMode] = useState<"cards" | "list">("list")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("inventory_view_preference")
    if (saved === "list" || saved === "cards") {
      setViewMode(saved)
    }
  }, [])

  const toggleViewMode = (mode: "cards" | "list") => {
    setViewMode(mode)
    localStorage.setItem("inventory_view_preference", mode)
  }


  const queryClient = useQueryClient()
  const { data: products = [] } = useProducts()
  const { data: systemStatus } = useSystemStatus()
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const deleteMutation = useDeleteProduct()

  const shrinkageMutation = useMutation({
    mutationFn: async (data: { product_id: string; quantity: number; reason: string }) => {
      const res = await localApiClient.post("/inventory/shrinkage", data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      toast.success("Merma registrada exitosamente")
      setIsShrinkageDialogOpen(false)
      setShrinkageQuantity("")
      setShrinkageReason("Dañado/Vencido")
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Error al registrar la merma")
    }
  })

  const exchangeRate = systemStatus?.current_exchange_rate_bs || 1

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.barcode || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      description: "",
      category_id: "",
      cost_usd: 0,
      price_usd: 0,
      wholesale_price_usd: 0,
      package_quantity: 1,
      min_stock_alert: 5,
      product_type: "physical",
      tax_type: "none",
      unit_measure: "UND",
      combo_items: []
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "combo_items"
  })

  const watchProductType = form.watch("product_type")
  const watchComboItems = form.watch("combo_items")
  const watchCost = form.watch("cost_usd") || 0
  const watchPrice = form.watch("price_usd") || 0
  const watchWholesalePrice = form.watch("wholesale_price_usd") || 0

  const isVirtual = watchProductType === "virtual"
  const isService = watchProductType === "service"
  const profitMargin = watchPrice > 0 ? ((watchPrice - watchCost) / watchPrice) * 100 : 0
  const wholesaleProfitMargin = watchWholesalePrice > 0 ? ((watchWholesalePrice - watchCost) / watchWholesalePrice) * 100 : 0

  // Cálculo automático de costo para combos en el formulario
  useEffect(() => {
    if (isVirtual && watchComboItems && watchComboItems.length > 0) {
      const calculatedCost = watchComboItems.reduce((sum, item) => {
        const product = products.find(p => p.id === item.product_id)
        return sum + (product ? product.cost_usd * item.quantity : 0)
      }, 0)
      form.setValue("cost_usd", Number(calculatedCost.toFixed(2)))
    }
  }, [watchComboItems, isVirtual, products, form])

  // Cálculo de stock proyectado para combos (referencia visual)
  const projectedComboStock = isVirtual && watchComboItems && watchComboItems.length > 0
    ? Math.floor(Math.min(...watchComboItems.map(item => {
      const product = products.find(p => p.id === item.product_id)
      if (!product || item.quantity <= 0) return 0
      return product.cached_stock_quantity / item.quantity
    })))
    : 0

  const downloadExcelTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        SKU: "TEST-001",
        CodigoBarras: "759123456",
        Nombre: "Producto Prueba",
        Descripcion: "Descripción breve",
        CategoriasEtiquetas: "Bebida, General",
        Costo_USD: 1.50,
        PrecioVenta_USD: 2.00,
        PrecioMayorista_USD: 1.80,
        UnidadesPaquete: 12,
        TipoProducto: "Fisico", // Fisico | Servicio
        RegimenFiscal: "Exento", // Exento | IVA | ISLR
        UnidadMedida: "UND",
        AlertaStock: 5
      }
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Platilla_Inventario")
    XLSX.writeFile(wb, "Plantilla_Inventario_Xion.xlsx")
  }

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      setIsImporting(true)
      try {
        const data = evt.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet)

        let newErrors: string[] = []
        let validPayloads: any[] = []

        // Fase 1: Validación estricta y preparación
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i] as any
          try {
            if (!row.Nombre) throw new Error("Falta el campo obligatorio: Nombre")
            if (row.PrecioVenta_USD === undefined || isNaN(Number(row.PrecioVenta_USD))) throw new Error("PrecioVenta_USD inválido o vacío")

            const sku = row.SKU ? String(row.SKU) : `EX-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`
            const rawType = String(row.TipoProducto || "Fisico").toLowerCase()
            const mappedType = rawType.includes("serv") ? "service" : "physical"

            const rawTax = String(row.RegimenFiscal || "Exento").toLowerCase()
            const mappedTax = rawTax.includes("iva") ? "vat" : rawTax.includes("islr") ? "islr" : "none"

            validPayloads.push({
              name: String(row.Nombre),
              sku: sku,
              barcode: row.CodigoBarras ? String(row.CodigoBarras) : null,
              description: row.Descripcion ? String(row.Descripcion) : "",
              cost_usd: Number(row.Costo_USD) || 0,
              price_usd: Number(row.PrecioVenta_USD),
              wholesale_price_usd: Number(row.PrecioMayorista_USD) || 0,
              package_quantity: Math.max(1, Math.floor(Number(row.UnidadesPaquete) || 1)),
              min_stock_alert: Number(row.AlertaStock) || 0,
              product_type: mappedType as any,
              tax_type: mappedTax as any,
              unit_measure: row.UnidadMedida ? String(row.UnidadMedida) : "UND"
            })
          } catch (err: any) {
            const rowIndex = row.__rowNum__ || Object.values(row)[0] || `Fila ${i + 1}`
            newErrors.push(`Fila [${rowIndex}]: ${err.message}`)
          }
        }

        // Fase 2: Ejecución Condicionada (Todo o Nada)
        if (newErrors.length > 0) {
          setIsExcelDialogOpen(false) // Cerrar el modal excel
          setAlertConfig({
            title: "Error de Importación",
            description: "El archivo Excel no pudo ser cargado porque presenta irregularidades. Por protección de datos, hemos abortado completamente la importación y ningún producto fue guardado.",
            errors: newErrors
          })
          toast.error(`Importación abortada. Se identificaron ${newErrors.length} errores críticos.`)
          // Al haber errores, NO se procesa la insersión a base de datos.
        } else {
          // Si el archivo es perfecto, procedemos:
          for (const payload of validPayloads) {
            await createMutation.mutateAsync(payload)
          }
          toast.success(`Importación Impecable: ${validPayloads.length} activos registrados.`)
          setIsExcelDialogOpen(false)
        }
      } catch (error) {
        toast.error("El archivo Excel está corrupto o es irreconocible.")
        setAlertConfig({
          title: "Archivo Dañado",
          description: "El documento seleccionado no puede procesarse porque está corrupto o no tiene estructura binaria reconocible.",
          errors: ["Error fatal al intentar leer el buffer Base64/XLSX del archivo."]
        })
      } finally {
        setIsImporting(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleOpenDialog = async (product?: Product) => {
    setImageFile(null)
    setImagePreviewUrl(null)
    setIsDragging(false)
    form.reset()
    if (product) {
      setEditingProduct(product)
      form.setValue("name", product.name)
      form.setValue("sku", product.sku)
      form.setValue("barcode", product.barcode || "")
      form.setValue("description", product.description || "")
      form.setValue("category_id", product.category_id || "")
      form.setValue("cost_usd", product.cost_usd)
      form.setValue("price_usd", product.price_usd)
      form.setValue("wholesale_price_usd", product.wholesale_price_usd || 0)
      form.setValue("package_quantity", product.package_quantity || 1)
      form.setValue("min_stock_alert", product.min_stock_alert)
      form.setValue("product_type", product.product_type)
      form.setValue("tax_type", product.tax_type)
      form.setValue("unit_measure", product.unit_measure)

      if (product.product_type === "virtual") {
        try {
          const { data } = await localApiClient.get<{ child_id: string; quantity_required: number }[]>(`/inventory/products/${product.id}/components`)
          form.setValue("combo_items", data.map(d => ({ product_id: d.child_id, quantity: d.quantity_required })))
        } catch {
          form.setValue("combo_items", [])
        }
      } else {
        form.setValue("combo_items", [])
      }
    } else {
      setEditingProduct(null)
      form.reset({
        name: "",
        sku: "",
        barcode: "",
        description: "",
        category_id: "",
        cost_usd: 0,
        price_usd: 0,
        wholesale_price_usd: 0,
        package_quantity: 1,
        min_stock_alert: 5,
        product_type: "physical",
        tax_type: "none",
        unit_measure: "UND",
        combo_items: []
      })
    }
    setIsAddDialogOpen(true)
  }

  const onSubmit = async (data: ProductFormValues) => {
    try {
      if (isVirtual && data.combo_items && data.combo_items.length === 0) {
        setAlertConfig({
          title: "Validación Incompleta",
          description: "La configuración estructural del Combo / Promoción es inválida.",
          errors: ["Un producto 'Combo' requiere estrictamente especificar al menos un (1) producto físico/servicio como parte de su receta o composición interna."]
        })
        return
      }

      if (editingProduct) {
        const { combo_items, ...updatePayload } = data
        if (updatePayload.product_type === "service") {
          updatePayload.min_stock_alert = 0
          updatePayload.cost_usd = 0
        }
        await updateMutation.mutateAsync({ id: editingProduct.id, data: updatePayload })

        if (isVirtual && combo_items) {
          const normalized = combo_items.map((c) => ({ child_id: c.product_id, quantity_required: c.quantity }))
          await localApiClient.put(`/inventory/products/${editingProduct.id}/components`, normalized)
        }

        if (imageFile) {
          const formData = new FormData();
          formData.append("file", imageFile);
          await localApiClient.post(`/inventory/products/${editingProduct.id}/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        }

        queryClient.invalidateQueries({ queryKey: ["inventory"] })
        toast.success("Producto modificado correctamente")
      } else {
        const payload = {
          ...data,
          combo_items: isVirtual ? data.combo_items : undefined,
          min_stock_alert: isService ? 0 : data.min_stock_alert,
          cost_usd: isService ? 0 : data.cost_usd
        }
        const createdProduct = await createMutation.mutateAsync(payload)
        const newId = createdProduct?.id || createdProduct?.data?.id || (createdProduct as any)?.id

        if (imageFile && newId) {
          const formData = new FormData();
          formData.append("file", imageFile);
          await localApiClient.post(`/inventory/products/${newId}/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        }

        queryClient.invalidateQueries({ queryKey: ["inventory"] })
        toast.success("Producto creado exitosamente")
      }
      setIsAddDialogOpen(false)
    } catch (e: any) {
      const msj = e.response?.data?.detail
      const parsedErrors = Array.isArray(msj) ? msj.map((x: any) => typeof x === 'string' ? x : (x.msg || JSON.stringify(x))) : [msj || "Error catastrófico interno en el servidor"]

      setAlertConfig({
        title: "Integridad de Datos",
        description: "El sistema central de inventario rechazó los datos del formulario debido a que violan las reglas de integridad de la base de datos.",
        errors: parsedErrors
      })
      toast.error("Formulario rechazado por el servidor.")
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este producto?")) {
      try {
        await deleteMutation.mutateAsync(id)
        toast.success("Producto eliminado")
      } catch (e) {
        toast.error("Error al eliminar producto")
      }
    }
  }

  const handleOpenShrinkage = (product: Product) => {
    setShrinkageProduct(product)
    setShrinkageQuantity("")
    setShrinkageReason("Dañado/Vencido")
    setIsShrinkageDialogOpen(true)
  }

  const handleRegisterShrinkage = () => {
    const qty = parseFloat(shrinkageQuantity)
    if (isNaN(qty) || qty <= 0) {
      toast.error("Ingrese una cantidad válida")
      return
    }
    if (!shrinkageProduct) return

    if (qty > shrinkageProduct.cached_stock_quantity) {
      toast.error("La merma no puede ser mayor al stock actual")
      return
    }

    shrinkageMutation.mutate({
      product_id: shrinkageProduct.id,
      quantity: qty,
      reason: shrinkageReason
    })
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6 bg-background/50">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Box className="w-5 h-5 text-primary" /> Total Productos</CardTitle></CardHeader>
          <CardContent><div className="flex items-baseline gap-2"><p className="text-3xl font-bold">{products.length}</p><Badge className="bg-primary text-primary-foreground shadow-sm font-bold border-0">Activos</Badge></div></CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-primary" /> Valor Costo</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">${products.reduce((sum, p) => sum + p.cost_usd * p.cached_stock_quantity, 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p><p className="text-sm text-muted-foreground">Bs {(products.reduce((sum, p) => sum + p.cost_usd * p.cached_stock_quantity, 0) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Layers className="w-5 h-5 text-primary" /> Stock Bajo</CardTitle></CardHeader>
          <CardContent><div className="flex items-baseline gap-2"><p className="text-3xl font-bold">{products.filter((p) => p.cached_stock_quantity <= p.min_stock_alert && p.product_type !== 'service').length}</p><Badge className="bg-primary text-primary-foreground shadow-sm font-bold border-0">Stock bajo</Badge></div></CardContent>
        </Card>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, SKU, etiquetas..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-12 rounded-xl border-border bg-card pr-4 pl-12 text-base shadow-sm focus-visible:ring-primary/20" />
        </div>
        <div className="flex bg-muted rounded-xl p-1 border border-border/50">
          <Button variant={viewMode === "list" ? "default" : "ghost"} size="icon" className="h-10 w-10 rounded-lg" onClick={() => toggleViewMode("list")}>
            <List className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "cards" ? "default" : "ghost"} size="icon" className="h-10 w-10 rounded-lg" onClick={() => toggleViewMode("cards")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsExcelDialogOpen(true)}
            className="h-12 flex items-center justify-center font-bold rounded-xl border-0 bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-all active:scale-95"
          >
            <FileSpreadsheet className="h-5 w-5 mr-2" />
            Excel
          </Button>
          <Button onClick={() => handleOpenDialog()} className="h-12 gap-2 rounded-xl font-bold shadow-md active:scale-95"><Plus className="h-5 w-5" /> Registrar Producto</Button>
        </div>
      </div>

      {viewMode === "list" ? (
        <Card className="flex-1 overflow-hidden border-border/50 shadow-md">
          <div className="overflow-x-auto h-[calc(100vh-320px)] relative">
            <Table>
              <TableHeader className="sticky top-0 bg-secondary/80 backdrop-blur-md z-10">
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-right pr-6">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => {
                  const isLowStock = product.cached_stock_quantity <= product.min_stock_alert && product.product_type !== "service"
                  return (
                    <TableRow key={product.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div className="w-10 h-10 rounded overflow-hidden border border-border/50 bg-background">
                          <ProductImage imageId={product.image_id as any} productName={product.name} categoryName={product.category_id || 'GEN'} size="thumb" />
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{product.name}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {product.barcode && <Badge variant="ghost" className="text-[10px] h-4 px-1 flex items-center gap-1 opacity-70"><Tag className="h-2 w-2" /> {product.barcode}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-primary text-primary-foreground border-0 shadow-sm font-bold">
                          {product.product_type === 'physical' ? 'Físico' : product.product_type === 'virtual' ? 'Combo' : 'Servicio'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-black text-primary text-sm">${product.price_usd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full shadow-sm">Bs {(product.price_usd * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {product.product_type === "service" ? (
                          <span className="text-xs text-muted-foreground">∞ Ilimitado</span>
                        ) : (
                          <Badge
                            className={cn(
                              "font-black shadow-sm px-3",
                              product.cached_stock_quantity === 0
                                ? "bg-transparent border-2 border-foreground text-foreground shadow-none"
                                : isLowStock
                                  ? "bg-destructive text-destructive-foreground border-0"
                                  : "bg-primary text-primary-foreground border-0"
                            )}
                          >
                            {product.cached_stock_quantity} {product.unit_measure}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex justify-end gap-1">
                          {product.product_type !== 'service' && (
                            <Button variant="ghost" size="icon" title="Registrar Merma" onClick={() => handleOpenShrinkage(product)} className="hover:bg-amber-100 hover:text-amber-600">
                              <TrendingDown className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(product)} className="hover:bg-primary/10 hover:text-primary"><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="hover:bg-destructive/10 text-destructive" onClick={() => handleDelete(product.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <div className="flex-1 overflow-y-auto h-[calc(100vh-320px)] relative pb-6 pr-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map(product => (
              <Card key={product.id} className="overflow-hidden border-border/50 hover:border-primary/50 hover:shadow-md transition-all flex flex-col group">
                <div className="aspect-square bg-muted/20 relative border-b border-border/50">
                  <ProductImage imageId={product.image_id as any} productName={product.name} categoryName={product.category_id || 'GEN'} size="medium" />
                  {product.cached_stock_quantity <= product.min_stock_alert && product.product_type !== 'service' && (
                    <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground border-0 shadow-sm">Stock Bajo</Badge>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="secondary" size="icon" className="h-7 w-7 bg-background/80 hover:bg-background backdrop-blur-sm shadow-sm text-primary" onClick={() => handleOpenDialog(product)}><Edit className="h-3 w-3" /></Button>
                    <Button variant="secondary" size="icon" className="h-7 w-7 bg-background/80 hover:bg-background backdrop-blur-sm shadow-sm text-destructive" onClick={() => handleDelete(product.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <CardContent className="p-3 flex-1 flex flex-col gap-1 bg-card">
                  <div>
                    <p className="text-[10px] font-mono text-muted-foreground">{product.sku}</p>
                    <h3 className="font-bold text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">{product.name}</h3>
                  </div>
                  <div className="mt-auto pt-2 flex items-end justify-between border-t border-border/30">
                    <div>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Precio</p>
                      <p className="font-black text-primary text-base leading-none">${product.price_usd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Stock</p>
                      {product.product_type === "service" ? (
                        <p className="font-black text-sm leading-none text-muted-foreground">∞</p>
                      ) : (
                        <p className={cn("font-black text-sm leading-none", product.cached_stock_quantity <= product.min_stock_alert ? "text-destructive" : "text-foreground")}>
                          {product.cached_stock_quantity}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0 shadow-2xl rounded-2xl border-0">
          <DialogHeader className="p-6 bg-primary/5 border-b border-border sticky top-0 z-10 backdrop-blur-sm">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <span className="p-2 rounded-lg bg-primary/10 text-primary">
                {editingProduct ? <Edit className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
              </span>
              {editingProduct ? "Edición de Producto" : "Registro de nuevo producto"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Formulario para {editingProduct ? "editar" : "registrar"} un producto en el inventario.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-8">

              {/* Bloque 0: Imagen de Producto */}
              <div className="mb-6 flex flex-col items-center justify-center pt-2">
                <div
                  className={cn(
                    "w-36 h-36 rounded-2xl border-2 border-dashed flex items-center justify-center relative overflow-hidden transition-all cursor-pointer shadow-sm group",
                    isDragging ? "border-primary bg-primary/10 scale-105" : "border-primary/30 bg-muted/20 hover:bg-primary/5 hover:border-primary/60"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setIsDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file && file.size <= 10 * 1024 * 1024) {
                      setImageFile(file);
                      setImagePreviewUrl(URL.createObjectURL(file));
                    } else { toast.error("La imagen excede los 10MB"); }
                  }}
                  onClick={() => document.getElementById("image-upload-input")?.click()}
                >
                  {imagePreviewUrl ? (
                    <img src={imagePreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (editingProduct as any)?.image_id ? (
                    <ProductImage imageId={(editingProduct as any).image_id} productName={editingProduct!.name} categoryName={editingProduct!.category_id || 'GEN'} size="medium" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-primary/50 group-hover:text-primary transition-colors">
                      <ImagePlus className="w-8 h-8 mb-2" />
                      <span className="text-[11px] font-bold tracking-tight">Añadir Foto</span>
                    </div>
                  )}

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Upload className="w-8 h-8 text-white drop-shadow-md" />
                  </div>

                  <input
                    id="image-upload-input"
                    type="file"
                    accept="image/jpeg, image/png, image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && file.size <= 10 * 1024 * 1024) {
                        setImageFile(file);
                        setImagePreviewUrl(URL.createObjectURL(file));
                      } else if (file) { toast.error("La imagen excede los 10MB"); }
                    }}
                  />
                </div>
                {(imageFile || (editingProduct as any)?.image_id) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[11px] mt-2 text-destructive hover:text-destructive hover:bg-destructive/10 font-bold"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (imageFile) {
                        setImageFile(null);
                        setImagePreviewUrl(null);
                      } else if ((editingProduct as any)?.image_id) {
                        if (confirm("¿Estás seguro de eliminar la imagen del servidor? Esta acción no se puede deshacer.")) {
                          try {
                            await localApiClient.delete(`/inventory/products/${editingProduct!.id}/image`);
                            setEditingProduct({ ...editingProduct!, image_id: null } as any);
                            queryClient.invalidateQueries({ queryKey: ["inventory"] });
                            toast.success("Imagen eliminada");
                          } catch (err) { toast.error("Error al eliminar la imagen"); }
                        }
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Quitar Foto
                  </Button>
                )}
              </div>

              {/* Bloque 1: Identificación Básica */}
              <div className="space-y-4 bg-muted/10 p-5 rounded-2xl border border-border">
                <div className="flex items-center gap-2 text-primary font-bold border-b pb-2 mb-4">
                  <Info className="h-4 w-4" />
                  <h3>Identificación y Categoría</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="sku" render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU / Ref *</FormLabel>
                      <FormControl><Input placeholder="EJ-001" disabled={!!editingProduct} {...field} className="bg-muted/30" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="barcode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código Barras</FormLabel>
                      <FormControl><Input placeholder="Escanear..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Producto *</FormLabel>
                    <FormControl><Input placeholder="Ej. Coca Cola 2L" {...field} className="text-lg font-medium" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="category_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <FormControl>
                      <CategoryCombobox 
                        value={field.value} 
                        onChange={field.onChange} 
                      />
                    </FormControl>
                    <FormDescription>Selecciona la categoría jerárquica del producto.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl><Textarea placeholder="Detalles adicionales..." className="h-20 resize-none" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Bloque 2: Clasificación y Medida (Una debajo de otra) */}
              <div className="bg-muted/20 p-5 rounded-2xl border border-border space-y-4">
                <div className="flex items-center gap-2 text-foreground/80 font-bold border-b pb-2 mb-2">
                  <ListChecks className="h-4 w-4" />
                  <h3>Categorización</h3>
                </div>

                <FormField control={form.control} name="product_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clasificación del Producto</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!editingProduct}>
                      <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="physical">Físico</SelectItem>
                        <SelectItem value="virtual">Combo</SelectItem>
                        <SelectItem value="service">Servicio</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="tax_type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Régimen Fiscal</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">Exento</SelectItem>
                          <SelectItem value="vat">IVA (16%)</SelectItem>
                          <SelectItem value="islr">ISLR</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="unit_measure" render={({ field }) => (
                    <FormItem>
                      <FormLabel>U. Medida</FormLabel>
                      <FormControl><Input placeholder="UND, KG, LT" {...field} className="bg-background" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* Bloque 5: Configuración de Combo (Si es Virtual) */}
              {isVirtual && (
                <div className="p-5 rounded-2xl border-2 border-purple-200 bg-purple-50/30 space-y-6">
                  <div className="flex justify-between items-center border-b border-purple-200 pb-2">
                    <h3 className="font-bold text-purple-700">Contenido del Combo</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ product_id: "", quantity: 1 })} className="border-purple-300 text-purple-700 hover:bg-purple-100">
                      <Plus className="h-4 w-4 mr-1" /> Añadir Producto
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-start bg-background p-2 rounded-lg border border-purple-100 shadow-sm animate-in zoom-in-95 duration-200">
                        <FormField control={form.control} name={`combo_items.${index}.product_id`} render={({ field: selectField }) => (
                          <FormItem className="flex-1">
                            <Select onValueChange={selectField.onChange} value={selectField.value}>
                              <FormControl><SelectTrigger className="border-0 shadow-none focus:ring-0"><SelectValue placeholder="Producto..." /></SelectTrigger></FormControl>
                              <SelectContent>
                                {products.filter(p => p.id !== editingProduct?.id && p.product_type !== 'virtual').map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name} <span className="text-muted-foreground text-[10px] ml-1">({p.unit_measure})</span></SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`combo_items.${index}.quantity`} render={({ field: inputField }) => (
                          <FormItem className="w-16">
                            <FormControl><Input type="number" step="0.001" {...inputField} className="border-0 shadow-none focus:ring-0 text-center p-0" /></FormControl>
                          </FormItem>
                        )} />
                        <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-red-500" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bloque 3: Precios y Margen (Destacado) */}
              <div className="bg-secondary/30 p-5 rounded-2xl border-2 border-primary/10 space-y-4">
                <div className="flex items-center gap-2 text-primary font-bold border-b pb-2 mb-2">
                  <DollarSign className="h-4 w-4" />
                  <h3>Costos y Precios</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="cost_usd" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo ($)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input type="number" step="0.01" {...field} className="pl-7 bg-background" disabled={isService || isVirtual} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="price_usd" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-primary">Precio Venta ($)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold">$</span>
                          <Input type="number" step="0.01" {...field} className="pl-7 font-bold border-primary/30 focus-visible:ring-primary/40 bg-background" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="wholesale_price_usd" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio Mayorista ($)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input type="number" step="0.01" {...field} className="pl-7 bg-background" disabled={isService || isVirtual} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="package_quantity" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidades x Paquete</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" {...field} className="bg-background" disabled={isService} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {!isService && (
                  <div className="flex flex-col gap-2 bg-background/50 p-3 rounded-lg border border-dashed text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Margen Bruto (Detal):</span>
                      <span className={`font-bold ${profitMargin > 30 ? 'text-emerald-600' : profitMargin > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                        {profitMargin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-muted-foreground">Margen Bruto (Mayorista):</span>
                      <span className={`font-bold ${wholesaleProfitMargin > 20 ? 'text-emerald-600' : wholesaleProfitMargin > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                        {wholesaleProfitMargin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bloque 4: Stock / Inventario (Una debajo de otra) */}
              {!isService && (
                <div className="p-5 rounded-2xl border border-border space-y-4">
                  <div className="flex items-center gap-2 text-foreground/80 font-bold border-b pb-2">
                    <Layers className="h-4 w-4" />
                    <h3>Control de Stock</h3>
                  </div>

                  <FormField control={form.control} name="min_stock_alert" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alerta de Umbral Mínimo</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormDescription>Avisar cuando queden pocas existencias.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {(editingProduct || isVirtual) && (
                    <div className="p-4 bg-muted/50 rounded-xl flex items-center justify-between border">
                      <div className="text-sm font-medium opacity-70 uppercase tracking-wider">
                        {isVirtual ? "STOCK PROYECTADO" : "STOCK ACTUAL"}
                      </div>
                      <Badge
                        className={cn(
                          "text-xl font-black font-mono px-4 py-1 shadow-sm",
                          (isVirtual ? projectedComboStock : (editingProduct?.cached_stock_quantity || 0)) === 0
                            ? "bg-transparent border-2 border-foreground text-foreground shadow-none"
                            : (editingProduct?.cached_stock_quantity || 0) <= (editingProduct?.min_stock_alert || 0)
                              ? "bg-destructive text-destructive-foreground border-0"
                              : "bg-primary text-primary-foreground border-0"
                        )}
                      >
                        {isVirtual ? projectedComboStock : editingProduct?.cached_stock_quantity} {form.watch("unit_measure")}
                      </Badge>
                    </div>
                  )}
                </div>
              )}


              <DialogFooter className="pt-4 sticky bottom-0 z-10 bg-background pb-2 mt-4 gap-2">
                <Button type="button" variant="ghost" className="px-6 h-12 rounded-xl" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 h-12 rounded-xl shadow-lg shadow-primary/20 font-bold text-lg">
                  {editingProduct ? "Actualizar Inventario" : "Registrar Producto"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isExcelDialogOpen} onOpenChange={setIsExcelDialogOpen}>
        <DialogContent className="sm:max-w-md shadow-2xl rounded-2xl border-0">
          <DialogHeader className="p-6 bg-primary/10 border-b border-primary/20">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary">
              <FileSpreadsheet className="h-6 w-6" /> Importación Excel
            </DialogTitle>
            <DialogDescription className="sr-only">
              Ventana modal para cargar archivos excel masivos de inventario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 p-6 text-sm text-foreground">
            <div className="space-y-3">
              <p className="font-semibold px-1">Paso 1: Usar Plantilla Validada</p>
              <p className="text-muted-foreground px-1 text-xs">Asegúrese de emplear la estructura correcta para que el sistema procese el lote de activos estrictamente.</p>
              <Button onClick={downloadExcelTemplate} variant="outline" className="w-full border-primary/30 text-primary font-bold hover:bg-primary/20 hover:text-primary"><Download className="h-4 w-4 mr-2" /> Descargar Modelo Autorizado</Button>
            </div>

            <div className="space-y-3">
              <p className="font-semibold px-1">Paso 2: Cargar Registro</p>
              <div className="border-2 border-dashed border-primary/30 bg-primary/5 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-4 hover:bg-primary/10 transition-colors">
                <FileSpreadsheet className={`h-10 w-10 text-primary ${isImporting ? 'animate-bounce' : ''}`} />
                <Input disabled={isImporting} type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="max-w-xs border-primary/50" />
                {isImporting && <p className="text-primary font-bold animate-pulse text-xs bg-primary/20 px-3 py-1.5 rounded-full mt-2">Procesando y validando matriz masiva...</p>}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Shrinkage Modal */}
      <Dialog open={isShrinkageDialogOpen} onOpenChange={setIsShrinkageDialogOpen}>
        <DialogContent className="sm:max-w-md shadow-2xl rounded-2xl border-0">
          <DialogHeader className="p-6 bg-amber-50 border-b border-amber-200">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-amber-700">
              <TrendingDown className="h-6 w-6" /> Registrar Merma
            </DialogTitle>
            <DialogDescription className="text-amber-900/70">
              Descontar inventario por pérdida, daño o vencimiento.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4 bg-background">
            {shrinkageProduct && (
              <div className="p-3 bg-muted rounded-lg border flex justify-between items-center">
                <div>
                  <p className="font-bold text-foreground">{shrinkageProduct.name}</p>
                  <p className="text-xs text-muted-foreground">{shrinkageProduct.sku}</p>
                </div>
                <Badge className="bg-primary text-primary-foreground font-black text-sm">
                  Stock: {shrinkageProduct.cached_stock_quantity}
                </Badge>
              </div>
            )}

            <div className="space-y-2">
              <Label>Cantidad a dar de baja</Label>
              <Input
                type="number"
                step="0.01"
                value={shrinkageQuantity}
                onChange={e => setShrinkageQuantity(e.target.value)}
                placeholder="Ej. 1"
                className="font-bold text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo / Observación</Label>
              <Select value={shrinkageReason} onValueChange={setShrinkageReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dañado/Vencido">Dañado o Vencido</SelectItem>
                  <SelectItem value="Extraviado">Extraviado / Perdido</SelectItem>
                  <SelectItem value="Uso Interno">Uso Interno</SelectItem>
                  <SelectItem value="Defecto de Fábrica">Defecto de Fábrica</SelectItem>
                  <SelectItem value="Otro">Otro (Especificar en notas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="p-4 bg-muted/30 border-t flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsShrinkageDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRegisterShrinkage} disabled={shrinkageMutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md">
              Confirmar Merma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!alertConfig} onOpenChange={(open) => !open && setAlertConfig(null)}>
        <AlertDialogContent className="shadow-2xl border-0 border-t-4 border-t-red-500 rounded-2xl max-w-lg">
          <AlertDialogHeader className="space-y-4">
            <AlertDialogTitle className="flex items-center gap-3 text-2xl text-red-600 font-black">
              <span className="bg-red-100 p-2 rounded-full"><AlertCircle className="w-8 h-8" /></span>
              {alertConfig?.title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-foreground font-medium flex flex-col gap-4">
                <span className="block leading-relaxed">
                  {alertConfig?.description}
                </span>

                {alertConfig && alertConfig.errors.length > 0 && (
                  <>
                    <span className="text-sm font-bold text-red-600">Revise la siguiente tabla de errores ({alertConfig.errors.length}):</span>
                    <div className="bg-red-50/50 p-4 rounded-xl max-h-[30vh] overflow-y-auto w-full font-mono text-xs border border-red-100">
                      <ul className="list-disc pl-4 space-y-2 text-red-800">
                        {alertConfig.errors.map((err, i) => <li key={i} className="font-semibold">{err}</li>)}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white font-bold h-12 rounded-xl text-lg w-full">Entendido, lo corregiré</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
