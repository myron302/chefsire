// Store types
export interface Store {
  id: string;
  owner_id: string;
  handle: string;
  name: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  theme?: {
    primary_color?: string;
    secondary_color?: string;
    background_color?: string;
  };
  layout?: any; // Craft.js serialized layout
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  price: number;
  compare_at_price?: number;
  images: string[];
  category?: string;
  tags?: string[];
  inventory_count?: number;
  is_available: boolean;
  variants?: ProductVariant[];
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku?: string;
  price?: number;
  inventory_count?: number;
  options: Record<string, string>;
}

export interface StoreAnalytics {
  total_sales: number;
  total_orders: number;
  total_revenue: number;
  views: number;
  conversion_rate: number;
}
