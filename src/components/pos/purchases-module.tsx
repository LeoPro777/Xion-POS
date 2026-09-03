"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  PackageSearch,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  FileText,
  Building2,
  Box,
  LayoutGrid,
  List
} from "lucide-react"

import { ProductImage } from "./product-image"

import { useProducts, Product } from "@/hooks/queries/use-inventory"
import { useSuppliers, Supplier } from "@/hooks/queries/use-suppliers"
import { useCreatePurchase } from "@/hooks/queries/use-purchases"
import { useSystemStatus } from "@/hooks/queries/use-system"
import { toast } from "sonner"
import { GenericSelector } from "@/components/shared/generic-selector"
import { cn } from "@/lib/utils"

// Helper para parsear números locales (Ej: "1.000.500,50" -> 1000500.5)
const parseLocalFloat = (val: string): number => {
  if (!val) return 0;
  const cleanStr = val.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  return parseFloat(cleanStr) || 0;
}

// Helper para blindar la vista local de números
const formatLocalNumber = (num: number): string => {
  return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface PurchaseItem extends Product {
  quantity: number
  lotsInput: string
  costInputUSD: string // String crudo sin formatear agresivo para permitir escritura fluida
  costInputBS: string
  internalCostUSD: number // Número matemático real
}

export function PurchasesModule() {
  const [searchTerm, setSearchTerm] = useState("")
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
  const [supplierName, setSupplierName] = useState("")

  const [viewMode, setViewMode] = useState<"cards" | "list">("cards")

  useEffect(() => {
    const saved = localStorage.getItem("purchases_view_preference")
    if (saved === "list" || saved === "cards") {
      setViewMode(saved)
    }
  }, [])

  const toggleViewMode = (mode: "cards" | "list") => {
    setViewMode(mode)
    localStorage.setItem("purchases_view_preference", mode)
  }

  const { data: dbProducts = [], isLoading: isLoadingProducts } = useProducts()
  const { data: dbSuppliers = [], isLoading: isLoadingSuppliers } = useSuppliers()
  const { data: config } = useSystemStatus()
  const createPurchase = useCreatePurchase()

  const exchangeRate = config?.current_exchange_rate_bs || 36.5

  // Lista de proveedores con la opción genérica incluida por defecto
  const suppliers = [
    { 
      id: "generic-1", 
      name: "Proveedor Genérico Externo", 
      category: "GENÉRICO", 
      identification_type: "RIF", 
      identification_number: "00000000", 
      phone: "000-0000000",
      is_active: true,
      is_synced: false,
      email: ""
    } as Supplier,
    ...dbSuppliers
  ]

  // En Compras/Recepción solo se muestran y procesan productos físicos reales.
  const physicalProducts = dbProducts.filter(p => p.product_type === "physical")

  const filteredProducts = physicalProducts.filter((product) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      product.name.toLowerCase().includes(term) ||
      product.sku.toLowerCase().includes(term) ||
      (product.barcode || "").toLowerCase().includes(term) ||
      (product.tags || "").split(',').some(tag => tag.trim().toLowerCase().includes(term))
    
    return matchesSearch
  })

  const addToPurchase = (product: Product) => {
    const defaultQty = product.package_quantity || 1;
    const existingItem = purchaseItems.find((item) => item.id === product.id)
    if (existingItem) {
      setPurchaseItems(
        purchaseItems.map((item) => {
          if (item.id === product.id) {
             const newQty = item.quantity + defaultQty;
             return { ...item, quantity: newQty, lotsInput: (newQty / defaultQty).toString() }
          }
          return item
        }
        )
      )
    } else {
      setPurchaseItems([...purchaseItems, { 
        ...product, 
        quantity: defaultQty,
        lotsInput: "1",
        costInputUSD: formatLocalNumber(product.cost_usd),
        costInputBS: formatLocalNumber(product.cost_usd * exchangeRate),
        internalCostUSD: product.cost_usd
      }])
    }
  }

  const updateQuantity = (id: string, delta: number) => {
    setPurchaseItems(
      purchaseItems
        .map((item) => {
           if (item.id === id) {
             const newQty = item.quantity + delta;
             const pq = item.package_quantity || 1;
             return { ...item, quantity: newQty, lotsInput: Number((newQty / pq).toFixed(2)).toString() }
           }
           return item
        })
        .filter((item) => item.quantity > 0)
    )
  }

  const updateLots = (id: string, value: string) => {
    setPurchaseItems(
      purchaseItems.map(item => {
        if (item.id === id) {
           const pq = item.package_quantity || 1;
           const numericLots = parseFloat(value) || 0;
           return {
             ...item,
             lotsInput: value, // Mantener string para que pueda escribir decimal exacto si quiere
             quantity: Math.max(0, Math.floor(numericLots * pq))
           }
        }
        return item;
      })
    )
  }

  const updateCostUSD = (id: string, value: string) => {
    const numericUSD = parseLocalFloat(value)
    const numericBS = numericUSD * exchangeRate
    
    setPurchaseItems(
      purchaseItems.map(item => 
        item.id === id ? { 
          ...item, 
          costInputUSD: value, // Permite escritura alocada (e.g "1.000,")
          costInputBS: formatLocalNumber(numericBS), // Autocalcula estricto el otro campo
          internalCostUSD: numericUSD 
        } : item
      )
    )
  }

  const updateCostBS = (id: string, value: string) => {
    const numericBS = parseLocalFloat(value)
    const numericUSD = numericBS / exchangeRate

    setPurchaseItems(
      purchaseItems.map(item => 
        item.id === id ? { 
          ...item, 
          costInputBS: value, // Permite escritura fluida sin saltos restrictivos
          costInputUSD: formatLocalNumber(numericUSD), 
          internalCostUSD: numericUSD 
        } : item
      )
    )
  }

  const handleBlur = (id: string, field: "USD" | "BS") => {
    // Cuando el usuario sale del input, re-formateamos la celda para que quede limpia.
    setPurchaseItems(items => items.map(item => {
      if (item.id === id) {
         if (field === "USD") {
            return { ...item, costInputUSD: formatLocalNumber(item.internalCostUSD) }
         } else {
            return { ...item, costInputBS: formatLocalNumber(item.internalCostUSD * exchangeRate) }
         }
      }
      return item;
    }))
  }

  const removeItem = (id: string) => {
    setPurchaseItems(purchaseItems.filter((item) => item.id !== id))
  }

  const subtotal = purchaseItems.reduce(
    (sum, item) => sum + item.internalCostUSD * item.quantity,
    0
  )
  const totalBs = subtotal * exchangeRate

  const handleRegisterPurchase = async () => {
    if (purchaseItems.length === 0) {
      toast.error("Agregue al menos un producto a la orden")
      return
    }
    if (!supplierName.trim()) {
      toast.error("Seleccione o ingrese un proveedor válido")
      return
    }

    try {
      await createPurchase.mutateAsync({
        supplier_name: supplierName,
        total_amount_usd: subtotal,
        total_amount_bs: totalBs,
        items: purchaseItems.map(item => ({
          product_id: item.id!,
          quantity: item.quantity,
          unit_cost_usd: item.internalCostUSD,
          total_cost_usd: item.internalCostUSD * item.quantity
        }))
      })

      toast.success("Compra procesada y costos actualizados exitosamente.")
      setPurchaseItems([])
      setSupplierName("")
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Error al procesar recepción de inventario")
    }
  }

  return (
    <div className="flex-1 flex gap-6 p-6 overflow-hidden bg-background/50 font-sans text-sm">
      {/* Panel Izquierdo - Catálogo Minimalista */}
      <div className="flex flex-1 flex-col overflow-hidden bg-card border border-border/50 rounded-xl shadow-md">
        
        {/* Búsqueda y Filtros Compactos */}
        <div className="bg-background border-b-2 border-border/80 p-3 shrink-0 flex items-center justify-between gap-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] z-10 w-full relative">
          <div className="relative w-full max-w-md shrink-0">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar (código, SKU, nombre)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 rounded-md border-2 border-border/60 bg-muted/40 pl-9 text-xs focus-visible:ring-primary/40 shadow-none transition-colors hover:bg-muted/60"
            />
          </div>
          <div className="flex bg-muted rounded p-0.5 border border-border/50">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7 rounded-sm"
              onClick={() => toggleViewMode("cards")}
            >
              <LayoutGrid className="h-3 w-3" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7 rounded-sm"
              onClick={() => toggleViewMode("list")}
            >
              <List className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Grilla de Productos */}
        <div className="flex-1 overflow-y-auto p-3 no-scrollbar pb-10">
          {isLoadingProducts ? (
            <div className="flex items-center justify-center h-full opacity-50">
               <div className="animate-pulse flex flex-col items-center gap-2">
                  <Box className="w-8 h-8 text-primary" />
                  <p className="text-xs font-semibold text-muted-foreground tracking-wide">Sincronizando maestro...</p>
               </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
              <PackageSearch className="h-8 w-8 text-muted-foreground" />
              <p className="text-xs font-semibold tracking-wide">Búsqueda sin resultados</p>
            </div>
          ) : viewMode === "cards" ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  onClick={() => addToPurchase(product)}
                  className="group relative cursor-pointer border-2 border-border/60 bg-background overflow-hidden rounded-lg hover:shadow-md hover:border-primary/50 flex flex-col h-[130px] transition-all"
                >
                  <div className="absolute top-1 left-1 z-10">
                    <span className={cn(
                      "px-1.5 py-0.5 text-[9px] font-bold font-mono tracking-tighter rounded shadow-sm",
                      product.cached_stock_quantity === 0 
                        ? "bg-transparent border-2 border-foreground text-foreground shadow-none" 
                        : product.cached_stock_quantity <= (product.min_stock_alert || 0)
                          ? "bg-destructive text-destructive-foreground border-0" 
                          : "bg-foreground/90 text-background border border-foreground/50"
                    )}>
                      STK: {product.cached_stock_quantity}
                    </span>
                  </div>

                  <div className="flex-1 bg-muted/10 w-full flex items-center justify-center relative border-b border-border/40 p-0 overflow-hidden">
                     <ProductImage imageId={product.image_id as any} productName={product.name} categoryName={product.category_id || 'GEN'} className="w-full h-full object-cover rounded-t-lg group-hover:scale-105 transition-transform duration-300" size="thumb" />
                     <div className="absolute bottom-1 right-1 bg-primary text-primary-foreground text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">
                        ${product.cost_usd.toFixed(2)}
                     </div>
                  </div>

                  <CardContent className="p-2 shrink-0">
                     <h3 className="line-clamp-2 text-[10px] font-bold text-foreground leading-tight group-hover:text-primary">
                        {product.name}
                     </h3>
                     <p className="text-[9px] text-muted-foreground font-mono mt-0.5 truncate uppercase">
                        {product.sku}
                     </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredProducts.map(product => (
                <div key={product.id} onClick={() => addToPurchase(product)} className="flex items-center gap-2 p-1.5 bg-card border border-border/50 rounded-lg hover:border-primary/50 cursor-pointer">
                  <div className="w-8 h-8 rounded bg-muted/30 overflow-hidden shrink-0 border border-border/50">
                    <ProductImage imageId={product.image_id as any} productName={product.name} categoryName={product.category_id || 'GEN'} size="thumb" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-bold truncate leading-none">{product.name}</h4>
                    <p className="text-[9px] font-mono text-muted-foreground">{product.sku}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[10px] font-black">${product.cost_usd.toFixed(2)}</span>
                    <span className={cn("text-[9px] font-bold", product.cached_stock_quantity <= product.min_stock_alert ? "text-destructive" : "text-muted-foreground")}>STK: {product.cached_stock_quantity}</span>
                  </div>
                  <div className="shrink-0 w-5 flex justify-end">
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-primary hover:bg-primary/10 rounded-full"><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Panel Derecho - Recepción Detallada */}
      <div className="w-[550px] xl:w-[600px] flex flex-col bg-card border border-border/50 shadow-xl rounded-xl overflow-hidden shrink-0">
        
        {/* Cabecera Proveedor */}
        <div className="p-3 border-b-2 border-border/70 bg-secondary/15 shrink-0">
          <div className="flex justify-between items-center mb-2">
             <h2 className="text-sm font-black text-foreground flex items-center gap-1.5 uppercase tracking-tight">
               <ShoppingBag className="w-4 h-4 text-primary" /> Entrada de Lote
             </h2>
             <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                Ref: {new Date().toLocaleDateString("es-VE").replace(/\//g, '')}
             </span>
          </div>

          <div className="flex items-center gap-2">
            <GenericSelector
              title="Seleccionar Proveedor"
              description="Directorio Maestro de Proveedores de Xion POS"
              placeholder="Buscar por nombre, RIF o categoría..."
              items={suppliers}
              isLoading={isLoadingSuppliers}
              selectedValue={supplierName}
              onSelect={(s) => setSupplierName(s.name)}
              getItemValue={(s) => s.name}
              emptyMessage="No se encontró el proveedor."
              trigger={
                <Button 
                  variant="outline" 
                  className={cn(
                    "h-9 text-xs font-bold rounded-md bg-background border-2 border-border/60 shadow-sm flex-1 justify-start px-2.5 transition-all",
                    "hover:border-primary/50 hover:bg-secondary/10",
                    supplierName ? "text-foreground" : "text-muted-foreground/60"
                  )}
                >
                  <Building2 className="w-4 h-4 mr-2 text-primary shrink-0" />
                  <span className="truncate">{supplierName || "Seleccionar Proveedor u Origen..."}</span>
                </Button>
              }
              renderItem={(s) => (
                <div className="flex flex-col gap-0.5">
                   <div className="flex items-center justify-between">
                      <span className="font-black text-sm tracking-tight text-foreground">{s.name}</span>
                      <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0 h-4">{s.category}</Badge>
                   </div>
                   <div className="flex items-center gap-3 text-muted-foreground font-mono text-[10px]">
                      <span>{s.identification_type}: {s.identification_number}</span>
                      <span className="opacity-50">•</span>
                      <span>{s.phone}</span>
                   </div>
                </div>
              )}
            />
          </div>
        </div>

        {/* Cesta de Compras */}
        <div className="flex-1 overflow-y-auto p-2 bg-background">
          {purchaseItems.length === 0 ? (
             <div className="flex h-full flex-col items-center justify-center gap-2 opacity-30">
                <FileText className="w-10 h-10" />
                <p className="text-[11px] font-bold text-center px-8 uppercase tracking-wide">
                  Pulse en los ítems para construir el lote
                </p>
             </div>
          ) : (
            <div className="space-y-1.5">
               <div className="flex gap-1.5 px-2 py-1 text-[9px] font-black text-muted-foreground uppercase tracking-widest border-b-2 border-border/40">
                   <div className="flex-1">Producto</div>
                   <div className="w-14 text-center shrink-0 text-[8px]">Lots</div>
                   <div className="w-20 text-center shrink-0">Cant.</div>
                   <div className="w-24 text-right shrink-0">Costo ($)</div>
                   <div className="w-24 text-right shrink-0">Costo (Bs)</div>
                   <div className="w-16 text-right shrink-0">Sub. ($)</div>
                   <div className="w-6 shrink-0"></div>
               </div>

              {purchaseItems.map((item) => (
                <div
                  key={item.id}
                  className="group flex flex-col bg-card border-2 border-border/50 hover:border-primary/50 hover:shadow-sm rounded-md overflow-visible transition-colors"
                >
                  <div className="flex items-center gap-2 p-1.5">
                     {/* Info Básica */}
                     <div className="flex-1 min-w-0 pr-1 select-none">
                        <h4 className="text-[11px] font-bold text-foreground leading-tight truncate">
                           {item.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                           <span className="text-[9px] text-muted-foreground font-mono bg-muted/50 px-1 py-px rounded truncate">
                              {item.sku}
                           </span>
                           <span className="text-[9px] text-primary/70 font-medium whitespace-nowrap">Ant: ${item.cost_usd.toFixed(2)}</span>
                        </div>
                     </div>
                     
                     {/* Lotes Input */}
                     <div className="flex items-center justify-center shrink-0 w-14 pr-1">
                          <div className="relative flex items-center w-full">
                            <span className="absolute left-1 text-[8px] text-muted-foreground font-black pointer-events-none">Lx</span>
                            <Input 
                              type="text" 
                              value={item.lotsInput} 
                              onChange={(e) => updateLots(item.id!, e.target.value)}
                              className="w-full text-center text-[10px] font-black font-mono pl-3 pr-1 py-0 h-6 bg-muted/20 border-2 border-border/50 focus-visible:ring-1 focus-visible:border-primary transition-all"
                            />
                         </div>
                     </div>

                     {/* Cantidad Input Editable */}
                     <div className="flex items-center justify-center shrink-0 w-20">
                         <div className="flex w-full overflow-hidden rounded bg-muted/20 border-2 border-border/50 text-foreground transition-all hover:border-border/80 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
                            <button onClick={() => updateQuantity(item.id!, -1)} className="w-5 flex items-center justify-center hover:bg-muted font-bold transition-colors">
                               -
                            </button>
                            <Input 
                              type="text" 
                              value={item.quantity === 0 ? "" : item.quantity} 
                              onChange={(e) => {
                                const val = parseInt(e.target.value.replace(/\D/g, ''), 10);
                                const parsedQty = isNaN(val) ? 0 : val;
                                setPurchaseItems(purchaseItems.map(i => i.id === item.id ? { 
                                   ...i, 
                                   quantity: parsedQty,
                                   lotsInput: Number((parsedQty / (i.package_quantity || 1)).toFixed(2)).toString()
                                } : i))
                              }}
                              onBlur={() => setPurchaseItems(items => items.filter(i => i.quantity > 0))}
                              className="flex-1 text-center text-[11px] font-black font-mono border-x-2 border-y-0 border-border/50 p-0 h-6 bg-background rounded-none shadow-none focus-visible:ring-0 focus-visible:outline-none"
                            />
                            <button onClick={() => updateQuantity(item.id!, 1)} className="w-5 flex items-center justify-center hover:bg-muted font-bold transition-colors">
                               +
                            </button>
                         </div>
                     </div>

                     {/* Modificar Costo USD (Ampliado) */}
                     <div className="w-24 shrink-0 px-1">
                         <div className="relative flex items-center">
                            <span className="absolute left-1.5 text-[10px] text-muted-foreground font-black pointer-events-none">$</span>
                            <Input 
                              type="text" 
                              value={item.costInputUSD || ""} 
                              onChange={(e) => updateCostUSD(item.id!, e.target.value)}
                              onBlur={() => handleBlur(item.id!, "USD")}
                              className="h-7 text-[11px] font-black font-mono text-right pl-4 pr-1.5 py-0 rounded bg-background border-2 border-border/60 shadow-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all"
                            />
                         </div>
                     </div>

                     {/* Modificar Costo BS (Ampliado) */}
                     <div className="w-24 shrink-0">
                         <div className="relative flex items-center">
                            <span className="absolute left-1 text-[10px] text-emerald-600/70 font-black pointer-events-none">Bs</span>
                            <Input 
                              type="text" 
                              value={item.costInputBS || ""} 
                              onChange={(e) => updateCostBS(item.id!, e.target.value)}
                              onBlur={() => handleBlur(item.id!, "BS")}
                              className="h-7 text-[11px] font-black font-mono text-right pl-5 pr-1.5 py-0 rounded bg-emerald-50/50 border-2 border-emerald-200/80 shadow-none focus-visible:ring-1 focus-visible:ring-emerald-400 focus-visible:border-emerald-400 transition-all text-emerald-950"
                            />
                         </div>
                     </div>
                     
                     {/* Total por item */}
                     <div className="w-16 text-right shrink-0">
                        <p className="text-[12px] font-black text-foreground tracking-tight font-mono whitespace-nowrap">
                           ${(item.internalCostUSD * item.quantity).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                     </div>

                     {/* Botón Borrar */}
                     <div className="w-6 flex justify-end shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-6 w-6 bg-transparent hover:bg-destructive hover:text-white rounded" onClick={() => removeItem(item.id!)}>
                           <Trash2 className="h-3 w-3" />
                        </Button>
                     </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zona Inferior: Action Call */}
        <div className="p-3 border-t-2 border-border/80 bg-secondary/10 shrink-0 shadow-inner">
          <div className="flex justify-between items-end mb-3">
             <div className="space-y-0 text-left">
                 <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Inversión Lote</p>
                 <p className="text-[12px] text-muted-foreground font-mono font-semibold">Bs {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
             </div>
             <p className="text-3xl font-black text-primary tracking-tighter leading-none tabular-nums">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>

          <Button
            onClick={handleRegisterPurchase}
            disabled={purchaseItems.length === 0 || !supplierName.trim() || createPurchase.isPending}
            className="w-full h-10 rounded-md bg-primary text-xs font-black uppercase tracking-wider shadow-sm transition-all disabled:opacity-50"
          >
            {createPurchase.isPending ? "Validando Transacción..." : "Liquidar Recepción de Ingreso"}
          </Button>
        </div>
      </div>
    </div>
  )
}
