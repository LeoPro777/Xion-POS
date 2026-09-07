import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { localApiClient } from "@/lib/api-client"
import { z } from "zod"

export const paymentMethodSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  code: z.string(),
  currency: z.string(),
  allow_decimals: z.boolean(),
  is_system: z.boolean(),
  is_active: z.boolean(),
  image_url: z.string().nullable().optional(),
})

export type PaymentMethod = z.infer<typeof paymentMethodSchema>

export type CreatePaymentMethodDTO = Omit<PaymentMethod, "id" | "is_system">

export function usePaymentMethods(activeOnly: boolean = false) {
  return useQuery({
    queryKey: ["payment_methods", { activeOnly }],
    queryFn: async (): Promise<PaymentMethod[]> => {
      const endpoint = activeOnly ? "/payment-methods/?active=true" : "/payment-methods/"
      const response = await localApiClient.get(endpoint)
      return response.data
    },
  })
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreatePaymentMethodDTO) => {
      const response = await localApiClient.post("/payment-methods/", data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] })
    },
  })
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PaymentMethod> }) => {
      const response = await localApiClient.put(`/payment-methods/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] })
    },
  })
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await localApiClient.delete(`/payment-methods/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] })
    },
  })
}

export function useUploadPaymentMethodImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, oldImageId }: { file: File, oldImageId?: string | null }) => {
      const formData = new FormData()
      formData.append("file", file)
      
      const url = oldImageId 
        ? `/payment-methods/image?old_image_id=${oldImageId}`
        : `/payment-methods/image`

      const response = await localApiClient.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      return response.data as { image_id: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] })
    },
  })
}
