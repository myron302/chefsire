import * as React from "react";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import StoreViewerContent, { type StoreData, type StoreProduct } from "./StoreViewerContent";
import type { StoreSocialProof } from "@shared/store/storeSocialProof";

export default function StoreViewer() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/store/:handle");
  const { toast } = useToast();
  const { user } = useUser();

  const [store, setStore] = useState<StoreData | null>(null);
  const [socialProof, setSocialProof] = useState<StoreSocialProof | undefined>(undefined);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);

  const storeHandle = params?.handle;

  useEffect(() => {
    if (!storeHandle) return;
    let cancelled = false;

    const fetchStore = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/stores/${storeHandle}`, { credentials: "include" });

        if (!response.ok) {
          if (response.status === 404) {
            try {
              const ownerRes = await fetch(`/api/stores/check-handle/${storeHandle}`);
              if (ownerRes.ok) {
                const checkData = await ownerRes.json();
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
        const storeObj = storeData.store ?? storeData;
        if (cancelled) return;
        setStore(storeObj);
        if (storeData.socialProof) setSocialProof(storeData.socialProof);

        if (storeObj?.id) {
          fetch(`/api/stores/${storeObj.id}/increment-view`, { method: "PATCH" }).catch(() => {});
        }
      } catch {
        toast({ title: "Error", description: "Failed to load store.", variant: "destructive" });
        setLocation("/marketplace");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStore();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeHandle]);

  useEffect(() => {
    const sellerId = store?.userId ?? (store as any)?.user_id;
    if (!sellerId) return;
    let cancelled = false;

    setProductsLoading(true);
    fetch(`/api/marketplace/sellers/${sellerId}/products`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setProducts(data.products || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setProductsLoading(false); });

    return () => { cancelled = true; };
  }, [store?.userId, (store as any)?.user_id]);

  if (!match) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Skeleton className="h-64 w-full mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>
      </div>
    );
  }

  if (!store) return null;

  const isOwner = user?.id === store.userId || String(user?.id) === String(store.userId);

  return (
    <StoreViewerContent
      store={store}
      products={products}
      productsLoading={productsLoading}
      isOwner={isOwner}
      previewMode={false}
      onNavigate={setLocation}
      socialProof={socialProof}
    />
  );
}
