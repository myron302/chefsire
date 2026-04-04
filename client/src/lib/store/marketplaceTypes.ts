export interface MarketplaceProduct {
  id: number;
  name: string;
  description: string;
  price: string;
  images: string[];
  sellerName?: string;
  sellerId: number;
  storeName?: string;
  storeHandle?: string;
  rating?: number;
  reviewCount?: number;
  location?: string;
  deliveryMethods: string[];
  category: string;
  isFeatured?: boolean;
  isNew?: boolean;
  viewCount?: number;
  favoriteCount?: number;
  inventory?: number;
  isActive?: boolean;
  productCategory?: string;
  digitalFileUrl?: string;
  digitalFileName?: string;
}

export interface MarketplaceProductsResponse {
  products: MarketplaceProduct[];
  total: number;
}

export interface MarketplaceProductPayload {
  name: string;
  description: string;
  price: string;
  inventory: number;
  category: string;
  images: string[];
  productCategory: string;
  deliveryMethods: string[];
  digitalFileUrl: string | null;
  digitalFileName: string | null;
  isDigital: boolean;
  inStoreOnly: boolean;
}
