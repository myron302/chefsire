import { Product } from '../types/store';

let mockProducts: Product[] = [];
let nextProductId = 1;

export const createProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> => {
  const newProduct: Product = {
    ...productData,
    id: `product_${nextProductId++}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  mockProducts.push(newProduct);
  return newProduct;
};

export const getStoreProducts = async (storeId: string): Promise<Product[]> => {
  return mockProducts.filter(product => product.store_id === storeId && product.is_available);
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product> => {
  const index = mockProducts.findIndex(p => p.id === id);
  if (index === -1) {
    throw new Error('Product not found');
  }
  
  mockProducts[index] = {
    ...mockProducts[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  
  return mockProducts[index];
};

export const deleteProduct = async (id: string): Promise<void> => {
  mockProducts = mockProducts.filter(p => p.id !== id);
};

export const getProductById = async (id: string): Promise<Product> => {
  const product = mockProducts.find(p => p.id === id);
  if (!product) {
    throw new Error('Product not found');
  }
  return product;
};
