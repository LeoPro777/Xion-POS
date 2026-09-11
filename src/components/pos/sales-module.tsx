"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  Search,
  Minus,
  Plus,
  Receipt,
  Percent,
  Settings,
  CreditCard,
  User,
  Lock,
  Unlock,
  PauseCircle,
  Archive,
  Clock,
  Trash2,
  LayoutGrid,
  List
} from "lucide-react"
import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useProducts, Product } from "@/hooks/queries/use-inventory"
import { useCreateSale, SaleCreateDTO, SalePaymentDTO } from "@/hooks/queries/use-sales"
import { useSystemStatus } from "@/hooks/queries/use-system"
import { useClients, Client } from "@/hooks/queries/use-clients"
import { useCreateDeliveryNote, DeliveryNoteCreateDTO } from "@/hooks/queries/use-delivery-notes"
import { PaymentModal } from "./payment-modal"
import { QuickClientModal } from "./quick-client-modal"
import { ProductImage } from "./product-image"
import { ProductGridList } from "./product-grid-list"
import { PreInvoiceModal } from "./pre-invoice-modal"
import { toast } from "sonner"

// Helper para formatear números al estilo local (1.000.000,00)
const formatLocalNumber = (num: number): string => {
  return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface CartItem extends Product {
  cart_quantity: number
}

interface HoldSale {
  id: string
  name: string
  cart: CartItem[]
  clientIdentifier: string
  selectedClient: Client | null
  timestamp: Date
}

const categories = [
  { id: "todo", label: "Todo" },
  { id: "bebidas", label: "Bebidas" },
  { id: "snacks", label: "Snacks" },
  { id: "limpieza", label: "Limpieza" },
  { id: "comida", label: "Comida" },
  { id: "varios", label: "Varios" },
]

// --- Ticket Components ---
function TicketHeader({ ticketNumber, currentDate, currentTime, heldSalesCount, onShowHold, onHoldSale }: any) {
  return (
    <div className="flex items-center justify-between pb-1">
      <div className="flex flex-col">
        <h2 className="text-base font-black text-foreground leading-none">
          Ticket #{ticketNumber}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {currentDate} - {currentTime}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={onShowHold} className="h-7 text-xs relative border-primary/30 bg-primary/5 text-primary font-black px-2 py-0">
          <PauseCircle className="h-3 w-3 mr-1" />
          ESPERA
          {heldSalesCount > 0 && (
            <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground text-[0.6rem] border border-background">
              {heldSalesCount}
            </Badge>
          )}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-primary/10" onClick={onHoldSale}>
          <Archive className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function ClientSelector({ selectedClient, clientIdentifier, onIdentifierChange, onSearch, onClear, clientInputRef }: any) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 rounded-lg border-2 border-border bg-muted/40 px-2 py-0.5 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary">
        {selectedClient ? <Lock className="h-3 w-3 text-emerald-600 shrink-0" /> : <User className="h-3 w-3 text-muted-foreground shrink-0" />}
        <Input
          ref={clientInputRef}
          placeholder="Cédula/RIF..."
          value={clientIdentifier}
          onChange={(e) => onIdentifierChange(e.target.value)}
          onKeyDown={onSearch}
          readOnly={!!selectedClient}
          className={`h-7 border-0 bg-transparent px-1 text-xs font-bold focus-visible:ring-0 w-full ${selectedClient ? 'text-emerald-800 font-black' : ''}`}
        />
        {selectedClient && (
          <Button variant="ghost" size="icon" className="h-5 w-5 text-emerald-700 hover:bg-emerald-100" onClick={onClear}>
            <Unlock className="h-3 w-3" />
          </Button>
        )}
      </div>
      {selectedClient && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-black text-emerald-700 truncate">{selectedClient.name}</p>
          {selectedClient.current_debt > 0 && (
            <Badge variant="destructive" className="h-4 text-[0.65rem] px-1 font-black">DEUDA: ${formatLocalNumber(selectedClient.current_debt)}</Badge>
          )}
        </div>
      )}
    </div>
  )
}

function CartItemRow({ item, activePrice, isWholesale, exchangeRate, onUpdateQuantity, onSetQuantity, onBlurQuantity, onRemove }: any) {
  const itemTotalUsd = activePrice * item.cart_quantity;
  const itemTotalBs = itemTotalUsd * exchangeRate;

  return (
    <div className="group flex flex-col bg-card border-2 border-border hover:border-primary hover:shadow-md rounded-md overflow-visible transition-all">
      <div className="flex items-center gap-1.5 p-1.5">
        <div className="flex-1 min-w-0 pr-1 select-none">
          <h4 className="text-xs font-black text-foreground leading-tight truncate">
            {item.name}
          </h4>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[0.65rem] font-bold text-muted-foreground font-mono bg-muted/80 px-1 py-px rounded truncate">
              {item.sku}
            </span>
            <span className={cn("text-xs font-bold whitespace-nowrap", isWholesale ? "text-amber-600" : "text-primary")}>
              ${formatLocalNumber(activePrice)}/u {isWholesale && <span className="font-black text-[0.65rem] uppercase border border-amber-600/50 px-0.5 rounded bg-amber-600/10 ml-0.5" title="Precio Mayorista Activo">MAY</span>}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center shrink-0 w-20">
          <div className="flex w-full overflow-hidden rounded bg-muted/30 border-2 border-border text-foreground transition-all hover:border-primary/80 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <button onClick={() => onUpdateQuantity(item.id, -1)} className="w-5 flex items-center justify-center hover:bg-primary/20 font-black text-sm transition-colors">
              -
            </button>
            <Input
              type="text"
              value={item.cart_quantity === 0 ? "" : item.cart_quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value.replace(/\D/g, ''), 10);
                onSetQuantity(item.id, isNaN(val) ? 0 : val);
              }}
              onBlur={onBlurQuantity}
              className="flex-1 text-center text-xs font-black font-mono border-x-2 border-y-0 border-border p-0 h-6 bg-background rounded-none shadow-none focus-visible:ring-0 focus-visible:outline-none"
            />
            <button onClick={() => onUpdateQuantity(item.id, 1)} className="w-5 flex items-center justify-center hover:bg-primary/20 font-black text-sm transition-colors">
              +
            </button>
          </div>
        </div>

        <div className="w-24 text-right shrink-0">
          <p className="text-xs font-black text-foreground tracking-tight font-mono whitespace-nowrap leading-none">
            ${formatLocalNumber(itemTotalUsd)}
          </p>
          <p className="text-[0.65rem] font-bold text-primary font-mono whitespace-nowrap leading-none mt-0.5">
            Bs. {formatLocalNumber(itemTotalBs)}
          </p>
        </div>

        <div className="w-6 flex justify-end shrink-0">
          <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:bg-destructive hover:text-white rounded transition-colors" onClick={() => onRemove(item.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function CartTotals({ subtotal, taxRatePercent, tax, total, totalBs }: any) {
  return (
    <div className="space-y-0.5 py-0.5">
      <div className="flex justify-between text-xs text-muted-foreground font-black">
        <span>SUBTOTAL</span>
        <span>${formatLocalNumber(subtotal)}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground font-black">
        <span>IVA ({taxRatePercent}%)</span>
        <span>${formatLocalNumber(tax)}</span>
      </div>
      <div className="flex items-end justify-between pt-0.5">
        <div className="flex flex-col">
          <span className="text-[0.7rem] font-black text-foreground tracking-tighter leading-none">TOTAL USD</span>
          <p className="text-xl font-black text-primary leading-none mt-0.5">
            ${formatLocalNumber(total)}
          </p>
        </div>
        <div className="text-right flex flex-col items-end">
          <p className="text-[0.65rem] font-black text-muted-foreground tracking-tighter opacity-80 mb-0.5">MONEDA LOCAL</p>
          <p className="text-sm font-black text-primary-foreground bg-primary px-2.5 py-0.5 rounded shadow-sm border-0">
            <span className="text-[0.65rem] mr-1 opacity-90">BS</span>
            {formatLocalNumber(totalBs)}
          </p>
        </div>
      </div>
    </div>
  )
}

function CartEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 opacity-40">
      <Receipt className="h-10 w-10 text-foreground" />
      <p className="text-xs font-black text-center px-8 uppercase tracking-wide text-foreground">
        No hay productos en el carrito
      </p>
    </div>
  )
}

function CartListHeader() {
  return (
    <div className="flex gap-1.5 px-2 py-1 text-[0.65rem] font-black text-foreground uppercase tracking-widest border-b-2 border-border bg-muted/30">
      <div className="flex-1">Producto</div>
      <div className="w-20 text-center shrink-0">Cant.</div>
      <div className="w-24 text-right shrink-0">Total</div>
      <div className="w-6 shrink-0"></div>
    </div>
  )
}

export function SalesModule() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("todo")
  const [cart, setCart] = useState<CartItem[]>([])
  const [ticketNumber, setTicketNumber] = useState(10492)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [clientIdentifier, setClientIdentifier] = useState("")
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showQuickClient, setShowQuickClient] = useState(false)
  const [heldSales, setHeldSales] = useState<HoldSale[]>([])
  const [showHoldModal, setShowHoldModal] = useState(false)
  const [showPreInvoiceModal, setShowPreInvoiceModal] = useState(false)

  const clientInputRef = useRef<HTMLInputElement>(null)

  const [viewMode, setViewMode] = useState<"cards" | "list">("cards")

  useEffect(() => {
    const saved = localStorage.getItem("sales_view_preference")
    if (saved === "list" || saved === "cards") {
      setViewMode(saved)
    }
  }, [])

  const toggleViewMode = (mode: "cards" | "list") => {
    setViewMode(mode)
    localStorage.setItem("sales_view_preference", mode)
  }

  useEffect(() => {
    // Auto-focus the client input on module load
    const timeout = setTimeout(() => {
      clientInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timeout)
  }, [])

  const { data: config } = useSystemStatus()
  const { data: dbProducts = [] } = useProducts()
  const { data: clients = [] } = useClients()
  const createSale = useCreateSale()
  const createDeliveryNote = useCreateDeliveryNote()

  const handlePreInvoice = () => {
    if (cart.length === 0) return
    setShowPreInvoiceModal(true)
  }

  const handleClientSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && clientIdentifier.trim() !== "") {
      const term = clientIdentifier.trim().toLowerCase()
      const match = clients.find(c => c.identification_number.toLowerCase() === term)
      if (match) {
        setSelectedClient(match)
        toast.success(`Cliente verificado: ${match.name}`)
      } else {
        setShowQuickClient(true)
      }
    }
  }

  const handleHoldSale = () => {
    if (cart.length === 0) {
      toast.error("El carrito está vacío.")
      return
    }

    const holdName = selectedClient ? `Venta de ${selectedClient.name}` : `Ticket en Espera #${ticketNumber}`
    const newHold: HoldSale = {
      id: crypto.randomUUID(),
      name: holdName,
      cart: [...cart],
      clientIdentifier,
      selectedClient,
      timestamp: new Date()
    }

    setHeldSales([...heldSales, newHold])

    // Clean current state
    setCart([])
    setClientIdentifier("")
    setSelectedClient(null)
    setTicketNumber(prev => prev + 1)

    toast.success("Venta pausada exitosamente.")
  }

  const handleResumeSale = (hold: HoldSale) => {
    if (cart.length > 0) {
      if (!confirm("Tienes productos en la venta actual. ¿Deseas reemplazarla? Se perderán los cambios en la pantalla.")) return
    }

    setCart(hold.cart)
    setClientIdentifier(hold.clientIdentifier)
    setSelectedClient(hold.selectedClient)
    setHeldSales(heldSales.filter(h => h.id !== hold.id))
    setShowHoldModal(false)
    toast.info(`Retomando: ${hold.name}`)
  }

  const handleDeleteHold = (id: string) => {
    setHeldSales(heldSales.filter(h => h.id !== id))
    toast.success("Venta en espera descartada.")
  }

  const enableTaxes = config?.enable_taxes ?? true
  const taxRatePercent = config?.tax_rate ?? 16.0
  const exchangeRate = config?.current_exchange_rate_bs || 36.5
  const wholesaleEnabled = config?.wholesale_enabled ?? true
  const wholesaleMinQty = config?.wholesale_min_qty ?? 10

  const getItemActivePrice = (item: CartItem | Product, quantity: number = 1): number => {
    if (wholesaleEnabled && quantity >= wholesaleMinQty && item.wholesale_price_usd > 0) {
      return item.wholesale_price_usd;
    }
    return item.price_usd;
  }

  const filteredProducts = dbProducts.filter((product) => {
    const term = searchQuery.toLowerCase()
    const matchesSearch =
      product.name.toLowerCase().includes(term) ||
      product.sku.toLowerCase().includes(term) ||
      (product.barcode || "").toLowerCase().includes(term) ||
      (product.tags || "").split(',').some(tag => tag.trim().toLowerCase().includes(term))

    // Active category logic can be expanded. For now, match tags with category.
    const matchesCategory = activeCategory === "todo" || (product.tags || "").toLowerCase().includes(activeCategory)

    return matchesSearch && matchesCategory
  })

  const addToCart = (product: Product) => {
    if (!clientIdentifier.trim() && !selectedClient) {
      toast.error("Debe ingresar la Cédula/RIF del cliente antes de cargar productos.")
      clientInputRef.current?.focus()
      return
    }

    const existingItem = cart.find((item) => item.id === product.id)
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.id === product.id ? { ...item, cart_quantity: item.cart_quantity + 1 } : item
        )
      )
    } else {
      setCart([...cart, { ...product, cart_quantity: 1 }])
    }
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.id === productId) {
            const newQuantity = item.cart_quantity + delta
            return newQuantity > 0 ? { ...item, cart_quantity: newQuantity } : null
          }
          return item
        })
        .filter(Boolean) as CartItem[]
    )
  }

  const subtotal = cart.reduce((sum, item) => sum + getItemActivePrice(item, item.cart_quantity) * item.cart_quantity, 0)
  const tax = enableTaxes ? subtotal * (taxRatePercent / 100) : 0
  const total = subtotal + tax
  const totalBs = total * exchangeRate

  const currentDate = new Date().toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const currentTime = new Date().toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })

  return (
    <div className="flex-1 flex gap-4 p-2 sm:p-3 overflow-hidden bg-background">
      {/* Left side - Products */}
      <div className="flex flex-1 flex-col gap-3 min-w-0">
        {/* Search bar and toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground font-bold" />
            <Input
              placeholder="Buscar producto, código de barra o SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 rounded-xl border-2 border-border bg-card pl-12 text-base font-bold text-foreground focus:border-primary focus:ring-primary shadow-sm"
            />
            <kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded bg-muted border border-border px-2 py-1 text-xs font-black text-foreground">
              F1
            </kbd>
          </div>
          <div className="flex bg-muted rounded-xl p-1 border-2 border-border">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="icon"
              className="h-10 w-10 rounded-lg"
              onClick={() => toggleViewMode("cards")}
            >
              <LayoutGrid className="h-5 w-5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              className="h-10 w-10 rounded-lg"
              onClick={() => toggleViewMode("list")}
            >
              <List className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Product grid / list */}
        <div className="flex-1 overflow-y-auto pr-1">
          <ProductGridList
            products={filteredProducts}
            viewMode={viewMode}
            exchangeRate={exchangeRate}
            priceMode="sale"
            onProductClick={(product) => addToCart(product)}
            renderListActions={() => (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/10 rounded-full pointer-events-none">
                <Plus className="h-4 w-4" />
              </Button>
            )}
          />
        </div>
      </div>

      {/* Right side - Ticket/Cart */}
      <Card className="w-[380px] lg:w-[440px] border-2 border-border shadow-xl flex flex-col shrink-0">
        <CardContent className="flex h-full flex-col p-2.5 gap-1.5">
          <TicketHeader
            ticketNumber={ticketNumber}
            currentDate={currentDate}
            currentTime={currentTime}
            heldSalesCount={heldSales.length}
            onShowHold={() => setShowHoldModal(true)}
            onHoldSale={handleHoldSale}
          />

          <ClientSelector
            selectedClient={selectedClient}
            clientIdentifier={clientIdentifier}
            onIdentifierChange={(val: string) => {
              setClientIdentifier(val)
              if (selectedClient) setSelectedClient(null)
            }}
            onSearch={handleClientSearch}
            onClear={() => { setSelectedClient(null); setClientIdentifier("") }}
            clientInputRef={clientInputRef}
          />
          
          <Separator className="bg-border h-[2px]" />

          <div className="flex-1 overflow-y-auto p-1 bg-background border-2 border-border rounded-md min-h-0 flex flex-col">
            {cart.length === 0 ? (
              <CartEmptyState />
            ) : (
              <div className="flex flex-col h-full">
                <CartListHeader />
                <div className="overflow-y-auto flex-1 space-y-1.5 p-1">
                  {cart.map((item) => {
                    const activePrice = getItemActivePrice(item, item.cart_quantity)
                    const isWholesale = wholesaleEnabled && item.cart_quantity >= wholesaleMinQty && item.wholesale_price_usd > 0
                    return (
                      <CartItemRow
                        key={item.id}
                        item={item}
                        activePrice={activePrice}
                        isWholesale={isWholesale}
                        exchangeRate={exchangeRate}
                        onUpdateQuantity={updateQuantity}
                        onSetQuantity={(id: string, qty: number) => {
                          setCart(cart.map(i => i.id === id ? { ...i, cart_quantity: qty } : i))
                        }}
                        onBlurQuantity={() => setCart(c => c.filter(i => i.cart_quantity > 0))}
                        onRemove={(id: string) => setCart(c => c.filter(i => i.id !== id))}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-border h-[2px]" />

          <CartTotals
            subtotal={subtotal}
            taxRatePercent={taxRatePercent}
            tax={tax}
            total={total}
            totalBs={totalBs}
          />

          <div className="grid grid-cols-1 gap-1.5 shrink-0">
            <Button
              variant="outline"
              disabled={cart.length === 0}
              onClick={handlePreInvoice}
              className="h-8 text-xs font-black uppercase rounded-lg border-2 border-border hover:bg-accent hover:border-primary"
            >
              Prefactura / Cotización
            </Button>
            <Button
              disabled={
                cart.length === 0 ||
                (config && !config.is_cash_session_open) ||
                (!clientIdentifier.trim() && !selectedClient)
              }
              onClick={() => setShowPaymentModal(true)}
              className="h-10 w-full gap-2 rounded-xl bg-primary text-sm font-black text-primary-foreground hover:bg-primary/90 shadow-md disabled:bg-slate-500"
            >
              {config && !config.is_cash_session_open ? (
                <>
                  <Lock className="h-4 w-4" />
                  ABRIR CAJA PRIMERO
                </>
              ) : (!clientIdentifier.trim() && !selectedClient) ? (
                <>
                  <User className="h-4 w-4" />
                  INGRESE CÉDULA/RIF
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  COBRAR (F5)
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <PaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={async (payments: SalePaymentDTO[]) => {
          try {
            const payload: SaleCreateDTO = {
              client_id: selectedClient ? selectedClient.id : undefined,
              client_name: selectedClient ? selectedClient.name : (clientIdentifier.trim() || "Cliente Final"),
              subtotal_usd: subtotal,
              tax_amount_usd: tax,
              total_amount_usd: total,
              total_amount_bs: totalBs,
              exchange_rate: exchangeRate,
              payments,
              items: cart.map(i => {
                const activeP = getItemActivePrice(i, i.cart_quantity)
                return {
                  product_id: i.id,
                  product_name: i.name,
                  quantity: i.cart_quantity,
                  unit_price_usd: activeP,
                  tax_amount_usd: enableTaxes ? activeP * (taxRatePercent / 100) * i.cart_quantity : 0,
                  total_price_usd: enableTaxes ? (activeP * (1 + taxRatePercent / 100)) * i.cart_quantity : activeP * i.cart_quantity
                }
              })
            }

            const res = await createSale.mutateAsync(payload)
            toast.success("Venta completada. Imprimiendo Nota de Entrega...")

            // Abrir el ticket / nota de entrega de la venta en una nueva pestaña
            window.open(`http://127.0.0.1:8000/api/v1/sales/${res.sale_id}/ticket`, "_blank")

            setShowPaymentModal(false)
            setCart([])
            setTicketNumber(prev => prev + 1)
            setClientIdentifier("")
            setSelectedClient(null)
          } catch (e: any) {
            const errorMsg = e.response?.data?.detail
              ? (Array.isArray(e.response.data.detail) ? JSON.stringify(e.response.data.detail) : e.response.data.detail)
              : "Error interno procesando la venta.";
            toast.error(errorMsg);
          }
        }}
        totalAmount={total}
        totalAmountBs={totalBs}
        exchangeRate={exchangeRate}
      />

      <QuickClientModal
        open={showQuickClient}
        onClose={() => setShowQuickClient(false)}
        initialIdNumber={clientIdentifier}
        onClientCreated={(newClient) => {
          setSelectedClient(newClient);
          setClientIdentifier(newClient.identification_number);
        }}
      />

      <PreInvoiceModal
        open={showPreInvoiceModal}
        onClose={() => setShowPreInvoiceModal(false)}
        clientName={selectedClient ? selectedClient.name : clientIdentifier}
        clientIdentifier={selectedClient ? selectedClient.identification_number : clientIdentifier}
        cart={cart}
        subtotal={subtotal}
        tax={tax}
        total={total}
        totalBs={totalBs}
        exchangeRate={exchangeRate}
        wholesaleEnabled={wholesaleEnabled}
        wholesaleMinQty={wholesaleMinQty}
      />

      <Dialog open={showHoldModal} onOpenChange={setShowHoldModal}>
        <DialogContent aria-describedby={undefined} className="max-w-[500px] p-0 overflow-hidden shadow-2xl rounded-2xl border-0">
          <DialogHeader className="p-5 bg-primary/10 border-b border-primary/20">
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-primary" />
              Ventas en Espera ({heldSales.length})
            </DialogTitle>
          </DialogHeader>
          <div className="p-2 max-h-[400px] overflow-y-auto bg-muted/10">
            {heldSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 opacity-50 gap-2 text-muted-foreground">
                <Archive className="w-12 h-12" />
                <p className="text-sm font-semibold text-center">No hay ventas pausadas.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {heldSales.map(hold => {
                  const heldTotal = hold.cart.reduce((s, i) => s + (i.price_usd * i.cart_quantity), 0)
                  return (
                    <div key={hold.id} className="flex items-center justify-between p-3 rounded-xl border-2 border-border/50 bg-background hover:border-primary/50 transition-colors group shadow-sm">
                      <div>
                        <p className="font-bold text-sm text-foreground">{hold.name}</p>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-medium mt-1">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {hold.timestamp.toLocaleTimeString("es-VE", { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>Items: {hold.cart.reduce((s, i) => s + i.cart_quantity, 0)}</span>
                          <span className="font-bold text-primary/80">${formatLocalNumber(heldTotal)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="outline" className="h-8 shadow-none" onClick={() => handleResumeSale(hold)}>
                          Retomar
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteHold(hold.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
