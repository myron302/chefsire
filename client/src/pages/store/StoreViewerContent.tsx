import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreHeader } from "@/components/store/StoreHeader";
import { ProductCard } from "@/components/store/ProductCard";
import { ShoppingBag, Eye, Heart, MapPin, Clock } from "lucide-react";
import { THEMES } from "@/components/store/ThemeSelector";
import { normalizeStoreLayout } from "@shared/store/storeLayout";

export interface StoreData {
  id: string | number;
  userId: string | number;
  handle: string;
  name: string;
  bio?: string | null;
  theme?: string | null;
  layout?: Record<string, any> | null;
  published?: boolean;
  viewCount?: number;
}

export interface StoreProduct {
  id: number;
  sellerId: number;
  name: string;
  description: string;
  price: string;
  images: string[];
  category: string;
  inventory: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deliveryMethods: string[];
  viewCount?: number;
  favoriteCount?: number;
}

interface StoreViewerContentProps {
  store: StoreData;
  products: StoreProduct[];
  productsLoading?: boolean;
  isOwner?: boolean;
  previewMode?: boolean;
  onNavigate?: (path: string) => void;
}

export default function StoreViewerContent({
  store,
  products,
  productsLoading = false,
  isOwner = false,
  previewMode = false,
  onNavigate,
}: StoreViewerContentProps) {
  const navigate = previewMode ? () => {} : (onNavigate ?? (() => {}));

  const layout = normalizeStoreLayout(store.layout).customization;

  const preset = THEMES.find((t) => t.id === store.theme)?.colors ?? THEMES[0].colors;
  const themeColors = {
    primary: layout.colors?.primary || preset.primary,
    secondary: layout.colors?.secondary || preset.secondary,
    accent: layout.colors?.accent || preset.accent,
  };

  const storeForHeader = {
    ...store,
    banner_url: layout.bannerImage || (store as any).banner_url || null,
    logo_url: layout.logo || (store as any).logo_url || null,
    bio: store.bio || layout.aboutContent || null,
  };

  const gridCols: number = layout.layout?.gridColumns ?? 3;
  const gridClass =
    gridCols === 2
      ? "grid-cols-1 md:grid-cols-2"
      : gridCols === 4
        ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
        : "grid-cols-1 md:grid-cols-3";

  return (
    <div className="min-h-screen" style={{ backgroundColor: themeColors.accent + "22" }}>
      {layout.announcementEnabled && layout.announcementBar && (
        <div
          className="text-white text-center py-2 px-4 text-sm font-medium"
          style={{ backgroundColor: themeColors.primary }}
        >
          {layout.announcementBar}
        </div>
      )}

      <StoreHeader store={storeForHeader} isOwner={isOwner} themeColors={themeColors} />

      {layout.aboutEnabled && layout.aboutContent && (
        <div className="max-w-6xl mx-auto px-4 pt-10 pb-2">
          <h2 className="text-xl font-bold mb-3" style={{ color: themeColors.secondary }}>
            {layout.aboutTitle || "About Us"}
          </h2>
          <p className="text-gray-700 leading-relaxed">{layout.aboutContent}</p>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-1" style={{ color: themeColors.secondary }}>
              Products
            </h2>
            <p className="text-gray-600">{products.length} items available</p>
          </div>
          {!previewMode && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/marketplace")}>
                Browse Marketplace
              </Button>
              {isOwner && (
                <Button
                  onClick={() => navigate("/store/dashboard")}
                  style={{ backgroundColor: themeColors.primary }}
                  className="text-white hover:opacity-90"
                >
                  Manage Store
                </Button>
              )}
            </div>
          )}
        </div>

        {productsLoading ? (
          <div className={`grid ${gridClass} gap-6`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-48 w-full mb-4" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No products yet</h3>
              <p className="text-gray-600 mb-4">
                {isOwner
                  ? "Start adding products to your store to begin selling."
                  : "This store hasn't listed any products yet."}
              </p>
              {isOwner && !previewMode && (
                <Button onClick={() => navigate("/store/dashboard")}>Add Products</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className={`grid ${gridClass} gap-6`}>
            {products.map((product) => (
              <div
                key={product.id}
                className={`relative ${previewMode ? "pointer-events-none" : "cursor-pointer"}`}
                onClick={previewMode ? undefined : () => navigate(`/product/${product.id}`)}
              >
                <ProductCard product={product as any} onAddToCart={() => {}} />
                <div className="absolute top-3 right-3 flex gap-2">
                  {typeof product.viewCount === "number" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {product.viewCount}
                    </Badge>
                  )}
                  {typeof product.favoriteCount === "number" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {product.favoriteCount}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(layout.contactInfo?.address || layout.contactInfo?.hours) && (
        <div className="border-t mt-8">
          <div className="max-w-6xl mx-auto px-4 py-8 flex flex-wrap gap-6 text-sm text-gray-600">
            {layout.contactInfo?.address && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: themeColors.primary }} />
                <span>{layout.contactInfo.address}</span>
              </div>
            )}
            {layout.contactInfo?.hours && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 flex-shrink-0" style={{ color: themeColors.primary }} />
                <span>{layout.contactInfo.hours}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
