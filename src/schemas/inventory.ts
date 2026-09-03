import { z } from "zod";

// El IVA es solo un flag. El calculo del % se hace en la caja basándose en config global.
export const productSchema = z.object({
  barcode: z.string().min(3, "Código muy corto").max(50),
  name: z.string().min(3, "Nombre muy corto"),
  categoryId: z.string().uuid("Categoría inválida").optional(),

  // The Anchor Currency: Siempre en USD
  priceUsd: z.number().min(0.01, "El precio debe ser mayor a 0"),
  costUsd: z.number().min(0, "El costo no puede ser negativo"),
  wholesalePriceUsd: z.number().min(0, "El precio mayorista no puede ser negativo").default(0),
  packageQuantity: z.number().min(1, "El paquete debe ser al menos de 1 unidad").default(1),

  currentStock: z.number().default(0),
  minStock: z.number().min(0).default(0),

  type: z.enum(["physical", "combo", "service"]),
  hasVat: z.boolean().default(false),

  // Si es combo, necesitamos sus componentes
  comboItems: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().min(0.001, "Cantidad inválida")
  })).default([])
}).refine((data) => {
  // Validación de Dominio: Un combo no puede estar vacío
  if (data.type === "combo" && data.comboItems.length === 0) {
    return false;
  }
  return true;
}, {
  message: "Un combo requiere al menos un producto asociado",
  path: ["comboItems"]
});

export type ProductFormValues = z.infer<typeof productSchema>;
