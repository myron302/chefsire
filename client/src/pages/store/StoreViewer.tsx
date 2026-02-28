// client/src/pages/store/StoreViewer.tsx
import * as React from "react";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreHeader } from "@/components/store/StoreHeader";
import { ProductCard } from "@/components/store/ProductCard";
import { ShoppingBag, Eye, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";

interface StoreData {
  id: number;
  userId: number;
  handle: string;
  name: string;
  bio: string;
  theme: string;
  customization: any;
  published: boolean;
  subscriptionTier: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
}

interface StoreProduct {
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

export default function StoreViewer() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/store/:handle");
  const { toast } = useToast();
  const { user } = useUser();

  const [store, setStore] = useState<StoreData | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);

  const storeHandle = params?.handle;

  const fetchStore = async () => {
    if (!storeHandle) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/stores/${storeHandle}`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Before giving up, check if the current user owns a store with this handle
          // (unpublished stores return 404 to non-owners)
          try {
            const ownerRes = await fetch(`/api/stores/check-handle/${storeHandle}`);
            if (ownerRes.ok) {
              const checkData = await ownerRes.json();
              // available=false means store EXISTS (just not published)
              if (checkData.available === false) {
                toast({
                  title: "Store not published",
                  description: "This store exists but isn't published yet.",
                  variant: "destructive",
                });
                setLocation("/store/dashboard");
                return;
              }
            }
          } catch {}
          toast({
            title: "Store not found",
            description: "This store doesn't exist or isn't published yet.",
            variant: "destructive",
          });
          setLocation("/store");
          return;
        }
        throw new Error("Failed to fetch store");
      }

      const storeData = await response.json();
      const storeObj = storeData.store ?? storeData; // handle both { store: {...} } and raw store
      setStore(storeObj);

      // Track store view
      if (storeObj?.id) {
        fetch(`/api/stores/${storeObj.id}/increment-view`, { method: "PATCH" }).catch(() => {});
      }
    } catch (error) {
      console.error("Error fetching store:", error);
      toast({
        title: "Error",
        description: "Failed to load store. Please try again.",
        variant: "destructive",
      });
      setLocation("/marketplace");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (sellerId: string | number) => {
    try {
      setProductsLoading(true);
      const response = await fetch(`/api/marketplace/sellers/${sellerId}/products`);

      if (!response.ok) {
        console.error('[StoreViewer] fetchProducts failed:', response.status, sellerId);
        throw new Error("Failed to fetch products");
      }

      const data = await response.json();
      console.log('[StoreViewer] products response:', { sellerId, count: data.products?.length, data });
      setProducts(data.products || []);
    } catch (error) {
      console.error("Error fetching store products:", error);
      toast({
        title: "Error",
        description: "Failed to load store products.",
        variant: "destructive",
      });
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    fetchStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeHandle]);

  useEffect(() => {
    if (store?.userId) {
      fetchProducts(store.userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.userId]);

  if (!match) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Skeleton className="h-32 w-full mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-48 w-full mb-4" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!store) return null;

  const isOwner = user?.id === store.userId;

  return (
    <div className="min-h-screen bg-gray-50">
      <StoreHeader store={store} isOwner={isOwner} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-1">Products</h2>
            <p className="text-gray-600">{products.length} items available</p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setLocation("/marketplace")}>
              Browse Marketplace
            </Button>
            {isOwner && (
              <Button onClick={() => setLocation("/store/dashboard")}>
                Manage Store
              </Button>
            )}
          </div>
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-48 w-full mb-4" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
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
              {isOwner && (
                <Button onClick={() => setLocation("/store/dashboard")}>
                  Add Products
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="relative cursor-pointer"
                onClick={() => setLocation(`/product/${product.id}`)}
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
    </div>
  );
}
