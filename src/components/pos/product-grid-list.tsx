"use client"

import * as React from "react"
import { Product } from "@/hooks/queries/use-inventory"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ProductImage } from "./product-image"

export interface ProductGridListProps {
  products: Product[]
  viewMode: "cards" | "list"
  exchangeRate: number
  priceMode?: "sale" | "cost" // Defaults to "sale"
  showTypeBadge?: boolean

  onProductClick?: (product: Product) => void
  renderCardActions?: (product: Product) => React.ReactNode
  renderListActions?: (product: Product) => React.ReactNode
}

const formatLocalNumber = (num: number): string => {
  return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ProductGridList({
  products,
  viewMode,
  exchangeRate,
  priceMode = "sale",
  showTypeBadge = false,
  onProductClick,
  renderCardActions,
  renderListActions
}: ProductGridListProps) {

  if (viewMode === "list") {
    return (
      <div className="flex flex-col pb-6">
        {/* Table Header */}
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/40 rounded-t-lg border-b-2 border-border text-xs font-bold text-muted-foreground uppercase">
          <div className="w-10 shrink-0"></div>
          <div className="w-20 shrink-0">Código</div>
          <div className="flex-1 min-w-0">Descripción</div>
          {showTypeBadge && <div className="w-20 shrink-0 text-center">Tipo</div>}
          <div className="w-24 shrink-0 text-right">USD</div>
          <div className="w-24 shrink-0 text-right">VES</div>
          <div className="w-20 shrink-0 text-center">Stock</div>
          <div className="w-auto shrink-0 flex-1 max-w-[120px] text-right pr-4">Acciones</div>
        </div>

        {/* Table Body */}
        <div className="flex flex-col">
          {products.map(product => {
            const priceUsd = priceMode === "sale" ? product.price_usd : product.cost_usd;
            const priceBs = priceUsd * exchangeRate;
            const isLowStock = product.cached_stock_quantity <= (product.min_stock_alert || 0) && product.product_type !== 'service';

            return (
              <div
                key={product.id}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 bg-card border-b border-border/40 hover:bg-muted/30 hover:border-primary/50 transition-colors group",
                  onProductClick && "cursor-pointer"
                )}
                onClick={() => onProductClick && onProductClick(product)}
              >
                <div className="w-10 h-10 shrink-0 rounded overflow-hidden border border-border/50 bg-background">
                  <ProductImage imageId={product.image_id as any} productName={product.name} categoryName={product.category_id || 'GEN'} size="thumb" />
                </div>

                <div className="w-20 shrink-0 text-xs font-mono font-medium text-muted-foreground truncate">{product.sku}</div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <span className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{product.name}</span>
                </div>

                {showTypeBadge && (
                  <div className="w-20 shrink-0 flex justify-center">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 shadow-sm font-bold text-[10px] px-1.5 py-0">
                      {product.product_type === 'physical' ? 'Físico' : product.product_type === 'virtual' ? 'Combo' : 'Serv'}
                    </Badge>
                  </div>
                )}

                <div className="w-24 shrink-0 text-right text-[13px] font-black text-primary">
                  ${formatLocalNumber(priceUsd)}
                </div>

                <div className="w-24 shrink-0 text-right text-xs font-bold text-muted-foreground">
                  Bs {formatLocalNumber(priceBs)}
                </div>

                <div className="w-20 shrink-0 text-center">
                  {product.product_type === "service" ? (
                    <span className="text-[11px] font-black text-muted-foreground">∞</span>
                  ) : (
                    <Badge className={cn(
                      "font-black font-mono shadow-sm px-2 py-0.5 text-[11px]",
                      product.cached_stock_quantity === 0
                        ? "bg-muted text-muted-foreground shadow-none border-0"
                        : isLowStock
                          ? "bg-destructive text-destructive-foreground border-0"
                          : "bg-primary text-primary-foreground border-0"
                    )}>
                      {product.cached_stock_quantity}
                    </Badge>
                  )}
                </div>

                <div className="w-auto shrink-0 flex-1 max-w-[120px] flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  {renderListActions && renderListActions(product)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Cards View
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pb-6">
      {products.map(product => {
        const priceUsd = priceMode === "sale" ? product.price_usd : product.cost_usd;
        const priceBs = priceUsd * exchangeRate;
        const isLowStock = product.cached_stock_quantity <= (product.min_stock_alert || 0) && product.product_type !== 'service';

        return (
          <Card
            key={product.id}
            className={cn(
              "group relative border-2 border-border/60 bg-card overflow-hidden rounded-xl hover:shadow-lg hover:border-primary/50 flex flex-col transition-all",
              onProductClick && "cursor-pointer"
            )}
            onClick={() => onProductClick && onProductClick(product)}
          >
            {/* Top Left Badge: Stock or Type */}
            <div className="absolute top-1.5 left-1.5 z-10 pointer-events-none">
              {product.product_type === "service" ? (
                <span className="px-2 py-0.5 text-[10px] font-black font-mono tracking-tighter bg-primary text-primary-foreground rounded shadow-sm border-0 uppercase">
                  SERV
                </span>
              ) : (
                <span className={cn(
                  "px-2 py-0.5 text-[10px] font-black font-mono tracking-tighter rounded shadow-sm",
                  product.cached_stock_quantity === 0
                    ? "bg-transparent border-2 border-foreground text-foreground shadow-none"
                    : isLowStock
                      ? "bg-destructive text-destructive-foreground border-0"
                      : "bg-primary text-primary-foreground border-0"
                )}>
                  {product.cached_stock_quantity}
                </span>
              )}
            </div>

            {/* Top Right Actions (Hover) */}
            {renderCardActions && (
              <div
                className="absolute top-1.5 right-1.5 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()} // Prevent card click when clicking actions
              >
                {renderCardActions(product)}
              </div>
            )}

            {/* Image & Main Price */}
            <div className="flex-1 bg-muted/20 w-full aspect-square flex items-center justify-center relative border-b border-border/40 p-0 overflow-hidden">
              <ProductImage
                imageId={product.image_id as any}
                productName={product.name}
                categoryName={product.category_id || 'GEN'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                size="medium"
              />
              <div className="absolute bottom-1.5 right-1.5 bg-primary text-primary-foreground text-[11px] font-black px-2.5 py-1 rounded-md shadow-md border-0 pointer-events-none">
                ${formatLocalNumber(priceUsd)}
              </div>
            </div>

            {/* Footer Content */}
            <CardContent className="p-2.5 shrink-0 bg-card flex flex-col gap-1">
              <div>
                <p className="text-[9px] font-mono text-muted-foreground leading-none mb-0.5">{product.sku}</p>
                <h3 className="line-clamp-2 text-[11px] font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
              </div>

              <div className="mt-1 pt-1.5 border-t border-border/30 flex items-center justify-between">
                <div>
                  <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">VES</p>
                  <p className="text-[12px] font-black text-primary font-mono tracking-tight leading-none">
                    Bs {formatLocalNumber(priceBs)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
