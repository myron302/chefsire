import React from 'react';
import { ShoppingCart, Heart, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    inventory?: number;
    category?: string;
    is_active?: boolean;
  };
  onView?: (id: string) => void;
  onAddToCart?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  showActions?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onView,
  onAddToCart,
  onToggleFavorite,
  showActions = true,
}) => {
  const isOutOfStock = product.inventory !== undefined && product.inventory <= 0;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
      {/* Product Image */}
      <div className="relative h-48 bg-gray-200">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <ShoppingCart size={48} />
          </div>
        )}

        {/* Status Badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {isOutOfStock && (
            <Badge variant="destructive" className="bg-red-500">
              Out of Stock
            </Badge>
          )}
          {product.category && (
            <Badge variant="secondary" className="bg-gray-800 text-white">
              {product.category}
            </Badge>
          )}
        </div>

        {/* Quick Actions */}
        {showActions && (
          <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onToggleFavorite && (
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full w-8 h-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(product.id);
                }}
              >
                <Heart size={16} />
              </Button>
            )}
            {onView && (
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full w-8 h-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onView(product.id);
                }}
              >
                <Eye size={16} />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-1 truncate">{product.name}</h3>
        {product.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Price and Actions */}
        <div className="flex items-center justify-between mt-4">
          <span className="text-2xl font-bold text-orange-600">
            ${product.price.toFixed(2)}
          </span>

          {showActions && onAddToCart && (
            <Button
              size="sm"
              disabled={isOutOfStock}
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(product.id);
              }}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <ShoppingCart size={16} className="mr-1" />
              Add
            </Button>
          )}
        </div>

        {/* Inventory Info */}
        {product.inventory !== undefined && product.inventory > 0 && product.inventory <= 5 && (
          <p className="text-xs text-orange-600 mt-2">
            Only {product.inventory} left in stock!
          </p>
        )}
      </div>
    </Card>
  );
};

export default ProductCard;
