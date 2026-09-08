// filepath: src/hooks/queries/use-delivery-notes.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { localApiClient } from "@/lib/api-client"

export interface DeliveryNoteItemDTO {
  product_id: string
  product_name: string
  quantity: number
  unit_price_usd: number
  total_price_usd: number
}

export interface DeliveryNoteCreateDTO {
  document_type: "PREFACTURA" | "NOTA_ENTREGA"
  client_id?: string
  client_name: string
  subtotal_usd: number
  discount_usd: number
  total_amount_usd: number
  total_amount_bs: number
  exchange_rate: number
  items: DeliveryNoteItemDTO[]
}

export interface DeliveryNote {
  id: string
  document_type: string
  document_number: number
  client_name: string
  subtotal_usd: number
  total_amount_usd: number
  total_amount_bs: number
  exchange_rate: number
  status: string
  pdf_path?: string
  created_at: string
}

export function useDeliveryNotes() {
  return useQuery({
    queryKey: ["delivery-notes"],
    queryFn: async () => {
      const { data } = await localApiClient.get<DeliveryNote[]>("/delivery-notes")
      return data
    },
  })
}

export function useCreateDeliveryNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: DeliveryNoteCreateDTO) => {
      const { data } = await localApiClient.post<{id: string, document_number: number, pdf_path: string}>("/delivery-notes", payload)
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] })
      if (variables.document_type === "NOTA_ENTREGA") {
          queryClient.invalidateQueries({ queryKey: ["products"] })
      }
    },
  })
}

export function useCancelDeliveryNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await localApiClient.post(`/delivery-notes/${id}/cancel`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })
}
