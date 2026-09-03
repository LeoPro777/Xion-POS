import React, { useState } from 'react';
import { Package } from 'lucide-react';

interface ProductImageProps {
  imageId?: string | null;
  productName: string;
  categoryName?: string;
  size?: 'thumb' | 'medium';
  className?: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  imageId,
  productName,
  categoryName = 'GEN',
  size = 'thumb',
  className = 'w-full h-full'
}) => {
  const [hasError, setHasError] = useState(false);
  const backendBaseUrl = 'http://127.0.0.1:8000';

  // Obtener iniciales de respaldo
  const initials = categoryName.slice(0, 2).toUpperCase();

  // Si no hay imagen o hubo un fallo de carga, renderiza el placeholder local sin disparar 404
  if (!imageId || hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-muted/60 text-muted-foreground select-none ${className}`}>
        <Package className="w-1/3 h-1/3 opacity-30 mb-0.5" />
        <span className="text-[10px] font-bold tracking-wider opacity-60">{initials}</span>
      </div>
    );
  }

  const imageUrl = `${backendBaseUrl}/static/products/${size === 'thumb' ? 'thumb_' : 'medium_'}${imageId}.webp`;

  return (
    <img
      src={imageUrl}
      alt={productName}
      loading="lazy"
      decoding="async"
      onError={() => setHasError(true)}
      className={`object-cover ${className}`}
    />
  );
};
