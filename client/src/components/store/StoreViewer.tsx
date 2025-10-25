// client/src/pages/store/StoreViewer.tsx
import * as React from "react";
import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Editor, Frame, Element } from "@craftjs/core";
import { Button as UIButton } from "@/components/ui/button";
import { Card as UICard } from "@/components/ui/card";
import { Package } from "lucide-react";

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
  const [, params] = useRoute("/store/:handle");
  const handle = params?.handle ?? "";
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/stores/${handle}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) setStore(data.store ?? null);
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

  if (!store || (!store.published && !store.layout)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-600 p-6">
        <Package className="w-12 h-12 mb-4 text-gray-400" />
        <p>This store is not available.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
          {store.bio && <p className="text-gray-600 mt-1">{store.bio}</p>}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Read-only CraftJS render */}
        <Editor enabled={false} resolver={resolver}>
          <Frame json={store.layout}>
            {/* Fallback if no layout */}
            <Element is={Container} canvas className="min-h-[400px] border border-dashed border-gray-300 bg-white">
              <Text text="Store is empty. Check back soon!" />
            </Element>
          </Frame>
        </Editor>
      </main>
    </div>
  );
}
