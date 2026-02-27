import React, { useState, useEffect } from "react";
import { Editor, Frame, Element, useEditor } from "@craftjs/core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

// ── Draggable building-block components ────────────────────────────────────────
const Container = ({ children }: { children?: React.ReactNode }) => (
  <div className="p-4 border border-gray-200 rounded min-h-[60px]">{children}</div>
);

const TextBlock = ({ text }: { text: string }) => (
  <p className="text-gray-800">{text}</p>
);

const Banner = () => (
  <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-lg">
    <h3 className="text-xl font-bold">Welcome to My Culinary Store!</h3>
  </div>
);

const ProductCardBlock = ({ product }: { product: { name: string; price: number } }) => (
  <Card className="w-64">
    <div className="p-4 font-semibold">{product.name}</div>
    <div className="px-4 pb-4 text-gray-700">${product.price}</div>
    <Button className="m-4">Add to Cart</Button>
  </Card>
);

const resolver = { Container, TextBlock, Banner, ProductCardBlock };

// Hover overlay on each node in edit mode
const EditOverlay = ({ render }: { render: React.ReactElement }) => (
  <div className="relative group">
    {render}
    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded shadow">drag</span>
    </div>
  </div>
);

// ── Save button — must live inside <Editor> to access the query context ────────
const SaveButton = ({
  onSave,
  saving,
}: {
  onSave: (json: string) => void;
  saving: boolean;
}) => {
  const { query } = useEditor();
  return (
    <Button
      onClick={() => onSave(query.serialize())}
      className="bg-orange-500 hover:bg-orange-600 text-white"
      disabled={saving}
    >
      {saving ? "Saving…" : "Save & Publish"}
    </Button>
  );
};

// ── Main StoreBuilder component ────────────────────────────────────────────────
interface StoreBuilderProps {
  storeId: string;
  onBack: () => void;
}

export default function StoreBuilder({ storeId, onBack }: StoreBuilderProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [initialLayout, setInitialLayout] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load saved layout on mount
  useEffect(() => {
    if (!storeId) return;
    (async () => {
      try {
        const res = await fetch(`/api/stores-crud/${storeId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.store?.layout) setInitialLayout(data.store.layout);
        }
      } catch (err) {
        console.error("Error loading layout:", err);
      }
    })();
  }, [storeId]);

  const handleSave = async (editorState: string) => {
    if (!storeId || !user) {
      toast({ title: "No store found", description: "Please create a store first.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/stores-crud/${storeId}/layout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ layout: editorState }),
      });
      if (res.ok) {
        toast({ description: "Store layout saved!" });
      } else {
        const err = await res.json();
        toast({ title: "Save failed", description: err.error || "Please try again.", variant: "destructive" });
      }
    } catch (err) {
      console.error("Save error:", err);
      toast({ title: "Save failed", description: "An error occurred.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Editor resolver={resolver} onRender={EditOverlay}>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 mb-3 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Store Builder</h1>
              <p className="text-gray-500 text-sm mt-1">
                Drag and drop elements to customise your storefront layout
              </p>
            </div>
            <SaveButton onSave={handleSave} saving={saving} />
          </div>

          <div className="flex gap-5">
            {/* Element Palette */}
            <div className="w-56 bg-white p-4 rounded-xl shadow-sm flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Elements
              </h2>
              <div className="space-y-2">
                <Element is={Container} canvas>
                  <Button variant="outline" className="w-full justify-start text-sm">
                    📦 Container
                  </Button>
                </Element>
                <Element is={TextBlock} text="Your text here" canvas>
                  <Button variant="outline" className="w-full justify-start text-sm">
                    📝 Text Block
                  </Button>
                </Element>
                <Element is={Banner} canvas>
                  <Button variant="outline" className="w-full justify-start text-sm">
                    🎨 Banner
                  </Button>
                </Element>
                <Element is={ProductCardBlock} product={{ name: "Sample Product", price: 9.99 }} canvas>
                  <Button variant="outline" className="w-full justify-start text-sm">
                    🛍 Product Card
                  </Button>
                </Element>
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 bg-white p-4 rounded-xl shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Preview Canvas
              </h2>
              <Frame json={initialLayout ?? undefined}>
                <Element
                  is={Container}
                  canvas
                  className="min-h-[500px] border-2 border-dashed border-gray-200 rounded-lg"
                >
                  <TextBlock text="Drop elements here to build your store layout" />
                </Element>
              </Frame>
            </div>
          </div>
        </Editor>
      </div>
    </div>
  );
}
