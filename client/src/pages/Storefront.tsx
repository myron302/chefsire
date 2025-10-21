import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Store, Instagram, Facebook, Mail } from 'lucide-react';
import { getStoreByHandle, getStoreProducts } from '../lib/stores';
import { Store as StoreType, Product } from '../types';

export const Storefront: React.FC = () => {
  const { handle } = useParams<{ handle: string }>();
  const [store, setStore] = useState<StoreType | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoreData();
  }, [handle]);

  const loadStoreData = async () => {
    if (!handle) return;
    
    try {
      const storeData = await getStoreByHandle(handle);
      setStore(storeData);
      
      const storeProducts = await getStoreProducts(storeData.id);
      setProducts(storeProducts);
    } catch (error) {
      console.error('Failed to load store:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Store className="mx-auto w-8 h-8 text-gray-400 animate-pulse" />
          <p className="mt-2 text-gray-600">Loading store...</p>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Store className="mx-auto w-12 h-12 text-gray-400" />
          <h1 className="text-2xl font-bold mt-4">Store not found</h1>
          <p className="text-gray-600 mt-2">This store doesn't exist or may have been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Store Header */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {store.logo ? (
                <img 
                  src={store.logo} 
                  alt={store.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <Store className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{store.name}</h1>
                <p className="text-gray-600">{store.bio}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Social links would go here */}
              <button className="px-4 py-2 bg-black text-white rounded-lg">
                Contact
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Welcome to {store.name}</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {store.bio || 'Discover unique products crafted with care.'}
          </p>
        </div>
      </section>

      {/* Products Grid */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-8">Products</h2>
        
        {products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Store className="mx-auto w-12 h-12 text-gray-400" />
            <h3 className="mt-4 font-medium">No products available</h3>
            <p className="text-gray-500 mt-1">Check back later for new items</p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {store.logo && (
                <img 
                  src={store.logo} 
                  alt={store.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              )}
              <span className="font-semibold">{store.name}</span>
            </div>
            
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-600">
                Powered by Artisana
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Product Card Component
interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-square bg-gray-100">
        {product.images && product.images.length > 0 ? (
          <img 
            src={product.images[0]} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Store className="w-12 h-12" />
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
        <p className="text-gray-600 text-sm mb-2 line-clamp-2">
          {product.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="font-bold text-lg">${product.price}</span>
          <button className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 transition-colors">
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
};
