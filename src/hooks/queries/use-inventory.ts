import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localApiClient } from '@/lib/api-client';

export type ProductType = 'physical' | 'service' | 'virtual';
export type TaxType = 'none' | 'vat' | 'islr';

export interface Category {
  id: string;
  name: string;
  full_path: string;
  google_taxonomy_id?: number;
  parent_id?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category_id?: string;
  cost_usd: number;
  price_usd: number;
  product_type: ProductType;
  tax_type: TaxType;
  unit_measure: string;
  wholesale_price_usd: number;
  package_quantity: number;
  cached_stock_quantity: number;
  min_stock_alert: number;
  is_synced: boolean;
  is_deleted: boolean;
}

export interface CreateProductDTO {
  sku: string;
  name: string;
  barcode?: string;
  description?: string;
  category_id?: string;
  cost_usd: number;
  price_usd: number;
  product_type: ProductType;
  tax_type: TaxType;
  unit_measure: string;
  wholesale_price_usd: number;
  package_quantity: number;
  min_stock_alert: number;
  combo_items?: { product_id: string; quantity: number }[];
}

export function useProducts() {
  return useQuery<Product[], Error>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await localApiClient.get<Product[]>('/inventory/products');
      return data;
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newProduct: CreateProductDTO) => {
      const { data } = await localApiClient.post<Product>('/inventory/products', newProduct);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateProductDTO> }) => {
      const response = await localApiClient.put<Product>(`/inventory/products/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await localApiClient.delete(`/inventory/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useInfiniteCategoriesQuery(search?: string, parentId?: string) {
  return useInfiniteQuery({
    queryKey: ['categories', search, parentId],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: pageParam.toString(),
        limit: '15'
      });
      if (search) params.append('q', search);
      if (parentId) params.append('parent_id', parentId);
      
      const { data } = await localApiClient.get<PaginatedResponse<Category>>(`/inventory/categories?${params.toString()}`);
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.pages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategoryQuery(id?: string) {
  return useQuery({
    queryKey: ['category', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await localApiClient.get<Category>(`/inventory/categories/${id}`);
      return data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}
