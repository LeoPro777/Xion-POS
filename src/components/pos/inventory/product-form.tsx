import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ProductFormValues, productSchema } from "@/schemas/inventory";
import { localApiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Button, Input, Checkbox, Select } from "@/components/ui"; // Asume exportaciones limpias
import { Plus, Trash2 } from "lucide-react";
import { CategoryCombobox } from "./category-combobox";

export function ProductForm({ onSuccess }: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      type: "physical",
      hasVat: false,
      priceUsd: 0,
      costUsd: 0,
      wholesalePriceUsd: 0,
      packageQuantity: 1,
      comboItems: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "comboItems",
  });

  const watchType = form.watch("type");

  // Mutación Offline-First: Dispara al backend local
  const createProduct = useMutation({
    mutationFn: async (payload: any) => {
      const response = await localApiClient.post("/inventory/products", payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Producto creado con éxito (Local)");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      form.reset();
      if (onSuccess) onSuccess();
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d: any) => `${d.loc.slice(-1)[0]}: ${d.msg}`).join(', ') : (detail || error.message);
      toast.error(`Error de creación: ${msg}`);
    },
  });

  const onSubmit = (data: ProductFormValues) => {
    // Generate SKU if not barcode exists and map camelCase to snake_case
    const generatedSku = data.barcode || `${data.name.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const payload = {
      sku: generatedSku,
      name: data.name,
      barcode: data.barcode || null,
      category_id: data.categoryId || null,
      price_usd: data.priceUsd,
      cost_usd: data.costUsd,
      wholesale_price_usd: data.wholesalePriceUsd,
      package_quantity: data.packageQuantity,
      product_type: data.type,
      tax_type: data.hasVat ? "vat" : "none",
      unit_measure: "UND",
      min_stock_alert: data.minStock || 0,
      combo_items: data.comboItems.map(i => ({
        product_id: i.productId,
        quantity: i.quantity
      }))
    };

    createProduct.mutate(payload);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {/* Identificación */}
        <div>
          <label className="text-sm font-medium">Barcode</label>
          <Input {...form.register("barcode")} placeholder="Ej. 759123456" autoFocus />
          {form.formState.errors.barcode && <span className="text-red-500 text-xs">{form.formState.errors.barcode.message}</span>}
        </div>
        <div>
          <label className="text-sm font-medium">Name</label>
          <Input {...form.register("name")} placeholder="Nombre del producto" />
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium">Category</label>
          <CategoryCombobox 
            value={form.watch("categoryId")} 
            onChange={(val) => form.setValue("categoryId", val)} 
          />
        </div>

        {/* The Anchor Currency - USD */}
        <div>
          <label className="text-sm font-medium">Cost (USD)</label>
          <Input type="number" step="0.01" {...form.register("costUsd", { valueAsNumber: true })} />
        </div>
        <div>
          <label className="text-sm font-medium">Sale Price (USD)</label>
          <Input type="number" step="0.01" {...form.register("priceUsd", { valueAsNumber: true })} />
        </div>
        <div>
          <label className="text-sm font-medium">Wholesale Price (USD)</label>
          <Input type="number" step="0.01" {...form.register("wholesalePriceUsd", { valueAsNumber: true })} />
        </div>
        <div>
          <label className="text-sm font-medium">Units per Package (e.g. 6, 12, 24)</label>
          <Input type="number" step="1" {...form.register("packageQuantity", { valueAsNumber: true })} />
          {form.formState.errors.packageQuantity && <span className="text-red-500 text-xs">{form.formState.errors.packageQuantity.message}</span>}
        </div>
      </div>

      {/* Tipo e Impuestos */}
      <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg border">
        <div className="flex-1">
          <label className="text-sm font-medium">Inventory Type</label>
          <select
            {...form.register("type")}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value="physical">Physical</option>
            <option value="service">Service</option>
            <option value="combo">Combo / Recipe</option>
          </select>
        </div>
        <div className="flex items-center space-x-2 pt-6">
          <Checkbox
            id="hasVat"
            checked={form.watch("hasVat")}
            onCheckedChange={(val) => form.setValue("hasVat", val as boolean)}
          />
          <label htmlFor="hasVat" className="text-sm font-medium leading-none">
            Charge VAT (IVA)
          </label>
        </div>
      </div>

      {/* UI Dinámica para COMBOS (Estética mejorada) */}
      {watchType === "combo" && (
        <div className="border rounded-lg p-4 space-y-4 bg-card">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold text-sm">Combo Components</h4>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1 })}>
              <Plus className="w-4 h-4 mr-2" /> Add Component
            </Button>
          </div>
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs">Product ID (Searchable)</label>
                {/* Aquí idealmente va un Combobox/Command de Shadcn para buscar el producto */}
                <Input {...form.register(`comboItems.${index}.productId`)} placeholder="UUID del producto" />
              </div>
              <div className="w-24">
                <label className="text-xs">Qty</label>
                <Input type="number" step="0.001" {...form.register(`comboItems.${index}.quantity`, { valueAsNumber: true })} />
              </div>
              <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {form.formState.errors.comboItems && <span className="text-red-500 text-xs">Error: {form.formState.errors.comboItems.message}</span>}
        </div>
      )}

      <Button type="submit" disabled={createProduct.isPending} className="w-full">
        {createProduct.isPending ? "Saving..." : "Create Product"}
      </Button>
    </form>
  );
}
