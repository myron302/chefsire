import { Eye, Heart, MapPin, Star, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketplaceProduct } from "@/lib/store/marketplaceTypes";

interface MarketplaceProductCardProps {
  product: MarketplaceProduct;
  onSelect: (productId: number) => void;
  onFavorite: (productName: string) => void;
}

export function MarketplaceProductCard({
  product,
  onSelect,
  onFavorite,
}: MarketplaceProductCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onSelect(product.id)}
    >
      <div className="relative">
        <img
          src={product.images?.[0] || "/placeholder-product.jpg"}
          alt={product.name}
          className="w-full h-48 object-cover rounded-t-lg"
        />
        <div className="absolute top-2 left-2 flex gap-2">
          {product.isFeatured && <Badge className="bg-yellow-500">Featured</Badge>}
          {product.isNew && <Badge className="bg-green-500">New</Badge>}
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="absolute top-2 right-2"
          onClick={(event) => {
            event.stopPropagation();
            onFavorite(product.name);
          }}
        >
          <Heart className="w-4 h-4" />
        </Button>
      </div>

      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg line-clamp-2">{product.name}</h3>
          <span className="font-bold text-lg text-green-600">${product.price}</span>
        </div>

        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{product.description}</p>

        <div className="flex items-center gap-2 mb-2">
          <Store className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium">{product.sellerName}</span>
        </div>

        {product.location && (
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{product.location}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span className="text-sm font-medium">{product.rating || 0}</span>
            <span className="text-sm text-gray-500">({product.reviewCount || 0})</span>
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              <span>{product.viewCount || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              <span>{product.favoriteCount || 0}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-3">
          {product.deliveryMethods?.slice(0, 2).map((method, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {method.replace("_", " ")}
            </Badge>
          ))}
          {product.deliveryMethods?.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{product.deliveryMethods.length - 2}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
