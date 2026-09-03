// filepath: src/hooks/queries/use-sales.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { localApiClient } from "@/lib/api-client"

// ----------------------------
// DTOs (espejo del contrato backend)
// ----------------------------

export interface SaleItemDTO {
  product_id: string
  product_name: string
  quantity: number
  unit_price_usd: number
  tax_amount_usd: number
  total_price_usd: number
}

/** Un pago individual dentro de una venta (split-tender) */
export interface SalePaymentDTO {
  /** ID del método definido en SystemConfig.payment_methods_json */
  payment_method_id: string
  /** Nombre del método (snapshot inmutable al momento de la venta) */
  payment_method_label: string
  /** Moneda: 'USD' o 'VES' */
  currency: "USD" | "VES"
  /** Monto entregado en la moneda original del método */
  amount_tendered: number
  /** Contravalor en USD calculado con la tasa del momento */
  amount_usd: number
  reference_code?: string
}

/** Payload principal de creación de venta — multi-pago */
export interface SaleCreateDTO {
  client_id?: string
  client_name: string
  subtotal_usd: number
  tax_amount_usd: number
  total_amount_usd: number
  total_amount_bs: number
  exchange_rate: number
  /** Lista de pagos (mínimo 1) — reemplaza el campo único payment_method */
  payments: SalePaymentDTO[]
  items: SaleItemDTO[]
}

/** Modelo de lectura de una venta (cabecera) */
export interface Sale {
  id: string
  client_name: string
  total_amount_usd: number
  total_amount_bs: number
  exchange_rate: number
  created_at: string
}

/** Modelo de lectura de un pago asociado a una venta */
export interface SalePayment {
  id: string
  sale_id: string
  payment_method_id: string
  payment_method_label: string
  currency: string
  amount_tendered: number
  amount_usd: number
  reference_code?: string
}

// ----------------------------
// Hooks
// ----------------------------

export function useSales() {
  return useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data } = await localApiClient.get<Sale[]>("/sales")
      return data
    },
  })
}

export function useSalePayments(saleId: string | undefined) {
  return useQuery({
    queryKey: ["sale-payments", saleId],
    queryFn: async () => {
      const { data } = await localApiClient.get<SalePayment[]>(`/sales/${saleId}/payments`)
      return data
    },
    enabled: !!saleId,
  })
}

export function useCreateSale() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: SaleCreateDTO) => {
      const { data } = await localApiClient.post("/sales", payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] })
      queryClient.invalidateQueries({ queryKey: ["products"] }) // El stock baja
    },
  })
}
