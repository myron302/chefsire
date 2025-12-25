import React, { useState } from 'react';
import { useLocation } from 'wouter';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useToast } from '@/hooks/use-toast';

export default function PantryScanner() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  const handleBarcodeDetected = async (barcode: string) => {
    console.log('Barcode scanned:', barcode);
    setScannedCode(barcode);
    // Immediately toast the scanned code to let the user know the camera worked
    toast({
      title: 'Barcode scanned',
      description: `Looking up product…`,
    });
    try {
      const res = await fetch(`/api/lookup/${barcode}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.name) {
          // Show a toast with the product name
          toast({
            title: `Found: ${data.name}`,
            description: data.brand ? `Brand: ${data.brand}` : undefined,
          });
          // Redirect to pantry with product details in query params
          setLocation(
            `/pantry?barcode=${barcode}` +
              `&name=${encodeURIComponent(data.name)}` +
              `&category=${encodeURIComponent(data.category || '')}` +
              `&quantity=${data.quantity}` +
              `&unit=${encodeURIComponent(data.unit || '')}` +
              `&brand=${encodeURIComponent(data.brand || '')}` +
              `&imageUrl=${encodeURIComponent(data.imageUrl || '')}`
          );
          return;
        }
      }
      // If lookup fails, just navigate with barcode
      setLocation(`/pantry?barcode=${barcode}`);
    } catch (err) {
      setLocation(`/pantry?barcode=${barcode}`);
    }
  };

  const handleClose = () => {
    setLocation('/pantry');
  };

  return (
    <BarcodeScanner
      onDetected={handleBarcodeDetected}
      onClose={handleClose}
    />
  );
}
