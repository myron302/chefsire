import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useToast } from '@/hooks/use-toast';

export default function PantryScanner() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  const handleBarcodeDetected = async (barcode: string) => {
    console.log('Barcode scanned:', barcode);
    setScannedCode(barcode);

    // Show success message
    toast({
      title: "Barcode Scanned!",
      description: `Product code: ${barcode}`,
    });

    // TODO: In production, look up product by barcode from API
    // For now, redirect back to pantry with the barcode
    setTimeout(() => {
      navigate(`/pantry?barcode=${barcode}`);
    }, 1500);
  };

  const handleClose = () => {
    navigate('/pantry');
  };

  return (
    <BarcodeScanner
      onDetected={handleBarcodeDetected}
      onClose={handleClose}
    />
  );
}
