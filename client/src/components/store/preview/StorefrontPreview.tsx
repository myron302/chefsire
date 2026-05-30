import React, { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import StoreViewerContent, {
  type StoreData,
  type StoreProduct,
} from "@/pages/store/StoreViewerContent";
import type { StoreLayoutCustomizationConfig } from "@shared/store/storeLayout";

type Viewport = "desktop" | "mobile";

interface StorefrontPreviewProps {
  store: StoreData;
  draftName: string;
  draftBio: string;
  draftTheme: string;
  draftCustomization: StoreLayoutCustomizationConfig;
  products: StoreProduct[];
}

export default function StorefrontPreview({
  store,
  draftName,
  draftBio,
  draftTheme,
  draftCustomization,
  products,
}: StorefrontPreviewProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop");

  const previewStore: StoreData = {
    ...store,
    name: draftName,
    bio: draftBio,
    theme: draftTheme,
    layout: { version: 2, customization: draftCustomization },
  };

  return (
    <div className="flex flex-col h-full">
      {/* Viewport toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Live Preview
        </span>
        <div className="flex items-center gap-1 bg-white border rounded-lg p-0.5">
          <button
            onClick={() => setViewport("desktop")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewport === "desktop"
                ? "bg-orange-500 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            Desktop
          </button>
          <button
            onClick={() => setViewport("mobile")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewport === "mobile"
                ? "bg-orange-500 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Mobile
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto bg-gray-100 flex justify-center">
        <div
          className={`bg-white transition-all duration-300 ${
            viewport === "mobile"
              ? "max-w-[390px] w-full shadow-2xl ring-1 ring-gray-200"
              : "w-full"
          }`}
        >
          {viewport === "mobile" && (
            <div className="flex items-center justify-center gap-1.5 py-2 bg-gray-800 rounded-t-xl">
              <div className="w-16 h-1 bg-gray-500 rounded-full" />
            </div>
          )}
          <StoreViewerContent
            store={previewStore}
            products={products}
            productsLoading={false}
            isOwner={false}
            previewMode={true}
          />
        </div>
      </div>
    </div>
  );
}
