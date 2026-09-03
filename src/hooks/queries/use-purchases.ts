import { useMutation, useQueryClient } from '@tanstack/react-query';
import { localApiClient } from '@/lib/api-client';

export interface PurchaseItemDTO {
  product_id: string;
  quantity: number;
  unit_cost_usd: number;
  total_cost_usd: number;
}

export interface CreatePurchaseDTO {
  supplier_name: string;
  total_amount_usd: number;
  total_amount_bs: number;
  items: PurchaseItemDTO[];
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (purchaseData: CreatePurchaseDTO) => {
      const { data } = await localApiClient.post('/purchases', purchaseData);
      return data;
    },
    onSuccess: () => {
      // Invalidate inventory so stock levels update on the UI instantly
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
