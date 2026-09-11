import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Printer, X } from "lucide-react"
import { useSystemStatus } from "@/hooks/queries/use-system"

// Helper para formatear números
const formatLocalNumber = (num: number): string => {
  return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface PreInvoiceModalProps {
  open: boolean
  onClose: () => void
  clientName: string
  clientIdentifier: string
  cart: any[]
  subtotal: number
  tax: number
  total: number
  totalBs: number
  exchangeRate: number
  wholesaleEnabled: boolean
  wholesaleMinQty: number
}

export function PreInvoiceModal({
  open,
  onClose,
  clientName,
  clientIdentifier,
  cart,
  subtotal,
  tax,
  total,
  totalBs,
  exchangeRate,
  wholesaleEnabled,
  wholesaleMinQty
}: PreInvoiceModalProps) {
  const { data: config } = useSystemStatus()

  // Determinar ancho según configuración de impresora térmica (58mm u 80mm/carta)
  const ticketSize = config?.ticket_size || "80mm"
  const is58mm = ticketSize.includes("58")
  
  // Clases CSS dinámicas para el contenedor del ticket según el ancho de papel configurado
  const paperWidthClass = is58mm ? "w-[280px]" : "w-[360px]"
  const paperPrintWidth = is58mm ? "58mm" : "80mm"

  const getItemActivePrice = (item: any, quantity: number = 1): number => {
    if (wholesaleEnabled && quantity >= wholesaleMinQty && item.wholesale_price_usd > 0) {
      return item.wholesale_price_usd;
    }
    return item.price_usd;
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className={`max-w-[95vw] sm:${paperWidthClass} p-0 overflow-hidden shadow-2xl rounded-2xl border-2 border-border flex flex-col max-h-[90vh]`}>
        <DialogHeader className="p-3.5 bg-primary/10 border-b border-border shrink-0">
          <DialogTitle className="text-base font-black text-foreground flex items-center justify-between">
            <span>PRE-FACTURA</span>
            <span className="text-xs font-bold text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
              {is58mm ? "58mm Térmico" : "80mm Térmico"} (NO FISCAL)
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Modal content - Vista previa espejo de la factura térmica con UN SOLO SCROLL GLOBAL */}
        <div className="flex-1 overflow-y-auto p-4 bg-white text-black dark:bg-white dark:text-black font-mono select-none" id="pre-invoice-print-area">
          <div className="text-center mb-4 border-b-2 border-dashed border-black pb-3">
            <h2 className="text-xl font-black tracking-tight uppercase leading-none mb-1">{config?.store_name || "XION POS"}</h2>
            {config?.store_rif && <p className="text-[11px] font-bold">RIF: {config.store_rif}</p>}
            {config?.store_address && <p className="text-[10px] leading-tight opacity-90 my-0.5">{config.store_address}</p>}
            {config?.store_phone && <p className="text-[10px]">TELF: {config.store_phone}</p>}
            
            <div className="mt-2 pt-2 border-t border-dotted border-black/40">
              <p className="text-xs font-black uppercase tracking-wider">PRE-FACTURA / COTIZACIÓN</p>
              <p className="text-[10px] font-bold opacity-80 mt-0.5">Fecha: {new Date().toLocaleDateString('es-VE')} {new Date().toLocaleTimeString('es-VE')}</p>
            </div>
          </div>

          <div className="mb-3 p-2 bg-zinc-50 rounded border border-zinc-300 text-xs">
            <p className="truncate"><strong>Cliente:</strong> {clientName || 'Cliente Final'}</p>
            {clientIdentifier && <p className="truncate"><strong>CI/RIF:</strong> {clientIdentifier}</p>}
          </div>

          {/* Lista de productos sin scrolls internos (reflejo de papel continuo) */}
          <div className="space-y-2 mb-3">
            <div className="flex justify-between text-[11px] font-black border-b border-black pb-1 mb-1">
              <span className="flex-1">DESCRIPCIÓN</span>
              <span className="w-10 text-center">CANT</span>
              <span className="w-16 text-right">TOTAL</span>
            </div>
            {cart.map((item) => {
              const activePrice = getItemActivePrice(item, item.cart_quantity)
              const lineTotalUsd = activePrice * item.cart_quantity
              return (
                <div key={item.id} className="text-xs leading-tight border-b border-dotted border-zinc-200 pb-1">
                  <div className="font-bold truncate">{item.name}</div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="opacity-80">${formatLocalNumber(activePrice)} x {item.cart_quantity}</span>
                    <span className="font-black">${formatLocalNumber(lineTotalUsd)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-t-2 border-dashed border-black pt-2 space-y-1 text-xs">
            <div className="flex justify-between font-bold">
              <span>SUBTOTAL:</span>
              <span>${formatLocalNumber(subtotal)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>IVA ({config?.tax_rate || 16}%):</span>
              <span>${formatLocalNumber(tax)}</span>
            </div>
            
            <div className="flex justify-between items-center pt-1 mt-1 border-t border-black font-black text-sm">
              <span>TOTAL USD:</span>
              <span>${formatLocalNumber(total)}</span>
            </div>
            
            <div className="flex justify-between items-center font-black text-sm">
              <span>TOTAL BS:</span>
              <span>Bs {formatLocalNumber(totalBs)}</span>
            </div>
            
            <div className="text-right text-[10px] font-bold opacity-70">
              Tasa Ref: Bs {formatLocalNumber(exchangeRate)}
            </div>
          </div>

          {/* Código QR Autenticador & Leyenda Térmica de Documento No Fiscal */}
          <div className="mt-4 pt-3 border-t-2 border-dashed border-black flex flex-col items-center gap-1.5 text-center">
            {(() => {
              const qrPayload = JSON.stringify({
                doc: "XION-POS-PREFACTURA",
                type: "NO_FISCAL",
                client: clientName || "Cliente Final",
                rif: clientIdentifier || "N/A",
                date: new Date().toISOString(),
                items: cart.map(i => ({ name: i.name, qty: i.cart_quantity, price: getItemActivePrice(i, i.cart_quantity) })),
                total_usd: total,
                total_bs: totalBs
              });
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrPayload)}`;

              return (
                <div className="flex flex-col items-center gap-1">
                  <div className="bg-white p-1 rounded border border-black">
                    <img src={qrUrl} alt="QR Autenticación Factura" className="w-24 h-24 object-contain" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-tight">
                    CÓDIGO DE AUTENTICIDAD DE DOCUMENTO
                  </span>
                </div>
              );
            })()}

            <div className="mt-1 px-2 py-1 bg-zinc-100 rounded border border-black text-[9px] font-black text-black uppercase tracking-tight">
              *** DOCUMENTO NO FISCAL / SIN VALIDEZ TRIBUTARIA ***
            </div>
            {config?.ticket_message && (
              <p className="text-[9px] font-bold italic mt-1">{config.ticket_message}</p>
            )}
          </div>
        </div>

        <DialogFooter className="p-3 bg-muted/30 border-t border-border flex gap-2 sm:justify-between shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5 font-bold">
            <X className="w-4 h-4" /> Cerrar
          </Button>
          <Button size="sm" onClick={handlePrint} className="gap-1.5 font-black">
            <Printer className="w-4 h-4" /> Imprimir Ticket
          </Button>
        </DialogFooter>
      </DialogContent>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: ${paperPrintWidth} auto;
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          #pre-invoice-print-area, #pre-invoice-print-area * {
            visibility: visible;
          }
          #pre-invoice-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: ${paperPrintWidth} !important;
            padding: 4mm !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
          [role="dialog"] {
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}} />
    </Dialog>
  )
}
