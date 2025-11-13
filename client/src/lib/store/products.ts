import { Product } from '../types/store';

export const createProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> => {
  const response = await fetch('/api/marketplace/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      name: productData.name,
      description: productData.description || '',
      price: productData.price.toString(),
      inventory: productData.inventory || 0,
      category: productData.category || 'other',
      imageUrl: productData.images?.[0] || null,
      productCategory: 'physical',
      deliveryMethods: ['shipped'],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create product');
  }

  const data = await response.json();
  return data.product;
};

export const getStoreProducts = async (storeId: string): Promise<Product[]> => {
  const response = await fetch(`/api/marketplace/sellers/${storeId}/products`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }

  const data = await response.json();
  return data.products || [];
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product> => {
  const response = await fetch(`/api/marketplace/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      name: updates.name,
      description: updates.description,
      price: updates.price?.toString(),
      inventory: updates.inventory,
      category: updates.category,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update product');
  }

  const data = await response.json();
  return data.product;
};

export const deleteProduct = async (id: string): Promise<void> => {
  const response = await fetch(`/api/marketplace/products/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete product');
  }
};

export const getProductById = async (id: string): Promise<Product> => {
  const response = await fetch(`/api/marketplace/products/${id}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Product not found');
  }

  return response.json();
};
