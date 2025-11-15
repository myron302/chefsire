// client/src/pages/store/StoreViewer.tsx
import * as React from "react";
import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Editor, Frame, Element } from "@craftjs/core";
import { Button as UIButton } from "@/components/ui/button";
import { Card as UICard } from "@/components/ui/card";
import { Package, Edit as EditIcon } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { THEMES } from "@/components/store/ThemeSelector";

// --- Public read-only resolver (same parts as builder) ---
const Container = ({ children }) => (
  <div className="p-4 border border-gray-200 rounded">{children}</div>
);
const Text = ({ text }) => <p className="text-gray-800">{text}</p>;
const Banner = () => (
  <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-lg">
    <h3>Welcome to My Culinary Store!</h3>
  </div>
);
const ProductCard = ({ product }) => (
  <UICard className="w-64">
    <div className="p-4">
      <h4 className="font-semibold">{product?.name ?? "Sample Product"}</h4>
      <p className="text-gray-600">${product?.price ?? 9.99}</p>
      <UIButton className="mt-3">Add to Cart</UIButton>
    </div>
  </UICard>
);
const resolver = { Container, Text, Banner, ProductCard };

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
        {/* Store Layout */}
        {store.layout ? (
          <div className="mb-8">
            <Editor enabled={false} resolver={resolver}>
              <Frame json={store.layout}>
                <Element is={Container} canvas className="min-h-[200px]">
                  <Text text="Store layout loading..." />
                </Element>
              </Frame>
            </Editor>
          </div>
        ) : (
          <div className="mb-8 p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
            <p className="text-gray-500">No custom layout yet</p>
            {isOwner && (
              <Link href="/store/dashboard">
                <UIButton className="mt-4">Customize Store</UIButton>
              </Link>
            )}
          </div>
        )}

        {/* Products Section */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Products</h2>
          {products.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No products yet</p>
              {isOwner && (
                <Link href="/store/products/new">
                  <UIButton className="mt-4" style={{ backgroundColor: themeColors.primary }}>
                    Add Your First Product
                  </UIButton>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <div key={product.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
                  {product.images?.length > 0 ? (
                    <img src={product.images[0]} alt={product.name} className="w-full h-48 object-cover" />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                      <Package className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
                    {product.description && (
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold" style={{ color: themeColors.primary }}>
                        ${parseFloat(product.price).toFixed(2)}
                      </span>
                      <Link href={`/marketplace/product/${product.id}`}>
                        <UIButton size="sm" style={{ backgroundColor: themeColors.primary }}>
                          View Details
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
