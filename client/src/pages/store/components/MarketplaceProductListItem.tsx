import { Heart, MapPin, Star, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketplaceProduct } from "@/lib/store/marketplaceTypes";

interface MarketplaceProductListItemProps {
  product: MarketplaceProduct;
  onSelect: (productId: number) => void;
  onFavorite: (productName: string) => void;
}

export function MarketplaceProductListItem({
  product,
  onSelect,
  onFavorite,
}: MarketplaceProductListItemProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onSelect(product.id)}
    >
      <CardContent className="p-4 flex gap-4">
        <img
          src={product.images?.[0] || "/placeholder-product.jpg"}
          alt={product.name}
          className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
        />

        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-lg">{product.name}</h3>
            <span className="font-bold text-lg text-green-600">${product.price}</span>
          </div>

          <p className="text-sm text-gray-600 line-clamp-2 mb-2">{product.description}</p>

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Store className="w-4 h-4" />
              <span>{product.sellerName}</span>
            </div>

            {product.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{product.location}</span>
              </div>
            )}

            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
              <span>{product.rating || 0}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex flex-wrap gap-1">
              {product.deliveryMethods?.slice(0, 3).map((method, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {method.replace("_", " ")}
                </Badge>
              ))}
            </div>

            <Button size="sm" variant="outline">
              View Details
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                onFavorite(product.name);
              }}
            >
              <Heart className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
