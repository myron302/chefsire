export type PantryItem = {
  id: string;
  name: string;
  category: string | null;
  quantity: string | null;
  unit: string | null;
  location: string | null;
  expirationDate: string | null;
  purchaseDate: string | null;
  openedDate: string | null;
  estimatedCost: string | null;
  store: string | null;
  notes: string | null;
  imageUrl: string | null;
  isRunningLow: boolean;
  householdId: string | null;
  createdAt: string;
  barcodeData?: {
    productName: string;
    brand?: string;
    imageUrl?: string;
  } | null;
};

export type PantryFormData = {
  name: string;
  category: string;
  quantity: string;
  unit: string;
  location: string;
  expirationDate: string;
  notes: string;
  isRunningLow?: boolean;
};
