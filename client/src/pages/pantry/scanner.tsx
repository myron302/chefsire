import React, { useState } from "react";
import { useLocation } from "wouter";
import BarcodeScanner from "@/components/BarcodeScanner";
import { useToast } from "@/hooks/use-toast";

type LookupResult = {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  brand?: string;
  upc?: string;
  imageUrl?: string;
};

export default function PantryScanner() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLookingUp, setIsLookingUp] = useState(false);

  const handleBarcodeDetected = async (barcode: string) => {
    if (!barcode || isLookingUp) return;

    setIsLookingUp(true);

    toast({
      title: "Barcode scanned",
      description: "Looking up product info…",
    });

    try {
      const res = await fetch(`/api/lookup/${encodeURIComponent(barcode)}`, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Lookup failed (${res.status})`);
      }

      const data = (await res.json()) as LookupResult | null;

      if (!data?.name) {
        throw new Error("No product info found for that barcode");
      }

      // Send everything to Pantry page so it can auto-add the item
      const params = new URLSearchParams();
      params.set("barcode", barcode);
      params.set("name", data.name);
      if (data.category) params.set("category", data.category);
      if (data.quantity != null) params.set("quantity", String(data.quantity));
      if (data.unit) params.set("unit", data.unit);
      if (data.brand) params.set("brand", data.brand);
      if (data.imageUrl) params.set("imageUrl", data.imageUrl);

      setLocation(`/pantry?${params.toString()}`);
    } catch (err) {
      console.warn("Barcode lookup error:", err);
      toast({
        variant: "destructive",
        title: "Couldn’t find that product",
        description: "Try scanning again or add the item manually in Pantry.",
      });

      // Back to pantry (no auto-add)
      setLocation("/pantry");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleClose = () => {
    setLocation("/pantry");
  };

  return <BarcodeScanner onDetected={handleBarcodeDetected} onClose={handleClose} />;
}
