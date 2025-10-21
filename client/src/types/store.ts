export interface Store {
  id: string;
  owner_id: string;
  handle: string;
  name: string;
  bio: string;
  logo: string | null;
  theme: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  inventory: number;
  is_available: boolean;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface StoreTheme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
}
