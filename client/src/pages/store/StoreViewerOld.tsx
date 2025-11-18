// client/src/pages/store/StoreViewer.tsx
import * as React from "react";
import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Button as UIButton } from "@/components/ui/button";
import { Package, Edit as EditIcon } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { THEMES } from "@/components/store/ThemeSelector";

type Store = {
  id: string;
  userId: string;
  handle: string;
  name: string;
  bio: string;
  theme: Record<string, unknown>;
  layout: unknown | null;
  published: boolean;
};

export default function StoreViewer() {
  const { user } = useUser();
  const [, params] = useRoute("/store/:handle");
  const handle = params?.handle ?? "";
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Get theme colors based on store's theme setting
  const getThemeColors = () => {
    const themeId = (store?.theme as any) || 'modern';
    const theme = THEMES.find(t => t.id === themeId);
    return theme?.colors || THEMES[0].colors; // Default to modern if not found
  };

  const themeColors = store ? getThemeColors() : THEMES[0].colors;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/stores/${handle}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setStore(data.store ?? null);
            // Load products for this store
            if (data.store?.userId) {
              const productsRes = await fetch(`/api/marketplace/sellers/${data.store.userId}/products`);
              if (productsRes.ok) {
                const productsData = await productsRes.json();
                setProducts(productsData.products || []);
              }
            }
          }
        } else {
          if (mounted) setStore(null);
        }
      } catch (e) {
        console.error("load store", e);
        if (mounted) setStore(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [handle]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Loading store…
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-600 p-6">
        <Package className="w-12 h-12 mb-4 text-gray-400" />
        <p>This store was not found.</p>
      </div>
    );
  }

  const isOwner = user && user.id === store.userId;

  // Only show unpublished stores to the owner
  if (!store.published && !isOwner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-600 p-6">
        <Package className="w-12 h-12 mb-4 text-gray-400" />
        <p>This store is not available.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: themeColors.accent }}>
      <header className="border-b" style={{
        background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%)`
      }}>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-bold text-white">{store.name}</h1>
              {store.bio && <p className="text-white/90 mt-1">{store.bio}</p>}
              {!store.published && isOwner && (
                <Badge variant="secondary" className="mt-2">Draft - Not Published</Badge>
              )}
            </div>
            {isOwner && (
              <Link href="/store/dashboard">
                <UIButton variant="outline" className="w-full md:w-auto bg-white hover:bg-white/90">
                  <EditIcon className="w-4 h-4 mr-2" />
                  Manage Store
                </UIButton>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Products Section */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Our Products</h2>
              <p className="text-gray-600">Discover our collection of premium culinary products</p>
            </div>
            {isOwner && products.length > 0 && (
              <Link href="/store/products/new">
                <UIButton style={{ backgroundColor: themeColors.primary }}>
                  Add Product
                </UIButton>
              </Link>
            )}
          </div>

          {products.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-300">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6" style={{ backgroundColor: `${themeColors.primary}20` }}>
                <Package className="w-10 h-10" style={{ color: themeColors.primary }} />
              </div>
              <h3 className="text-xl font-semibold mb-2">No products yet</h3>
              <p className="text-gray-600 mb-6">This store hasn't added any products yet. Check back soon!</p>
              {isOwner && (
                <Link href="/store/products/new">
                  <UIButton className="mt-4" style={{ backgroundColor: themeColors.primary }}>
                    Add Your First Product
                  </UIButton>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100"
                >
                  <div className="relative">
                    {product.images?.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-56 object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-56 flex items-center justify-center"
                        style={{ backgroundColor: `${themeColors.secondary}20` }}
                      >
                        <Package className="w-16 h-16 text-gray-300" />
                      </div>
                    )}
                    {!product.isActive && isOwner && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary">Draft</Badge>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-lg mb-2 line-clamp-1">{product.name}</h3>
                    {product.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2 min-h-[40px]">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-2xl font-bold" style={{ color: themeColors.primary }}>
                        ${parseFloat(product.price).toFixed(2)}
                      </span>
                      <Link href={`/marketplace/product/${product.id}`}>
                        <UIButton
                          size="sm"
                          className="text-white hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: themeColors.primary }}
                        >
                          View
                        </UIButton>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
