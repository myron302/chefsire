import { Store, Product } from '../types/store';

// Mock data for development
let mockStores: Store[] = [];
let mockProducts: Product[] = [];
let nextStoreId = 1;
let nextProductId = 1;

export const createStore = async (storeData: Omit<Store, 'id' | 'created_at' | 'updated_at'>): Promise<Store> => {
  // In a real app, this would be an API call
  const newStore: Store = {
    ...storeData,
    id: `store_${nextStoreId++}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  mockStores.push(newStore);
  return newStore;
};

export const getStoreByHandle = async (handle: string): Promise<Store> => {
  const store = mockStores.find(s => s.handle === handle);
  if (!store) {
    throw new Error('Store not found');
  }
  return store;
};

export const getStoreById = async (id: string): Promise<Store> => {
  const store = mockStores.find(s => s.id === id);
  if (!store) {
    throw new Error('Store not found');
  }
  return store;
};

export const updateStore = async (id: string, updates: Partial<Store>): Promise<Store> => {
  const index = mockStores.findIndex(s => s.id === id);
  if (index === -1) {
    throw new Error('Store not found');
  }
  
  mockStores[index] = {
    ...mockStores[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  
  return mockStores[index];
};

export const getStoresByOwner = async (ownerId: string): Promise<Store[]> => {
  return mockStores.filter(store => store.owner_id === ownerId);
};
