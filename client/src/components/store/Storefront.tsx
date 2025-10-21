import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Store, Star, MapPin, Phone, Mail, Globe } from 'lucide-react';
import { getStoreByHandle, getStoreProducts } from '../../lib/stores';
import { Store as StoreType, Product } from '../../types/store';

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
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {store.logo ? (
                <img 
                  src={store.logo} 
                  alt={store.name}
                  className="w-16 h-16 rounded-full object-cover border"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center border">
                  <Store className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{store.name}</h1>
                <p className="text-gray-600 mt-1">{store.bio}</p>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>Serving Worldwide</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span>5.0 (24 reviews)</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                <Phone className="w-4 h-4" />
                Contact
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors">
                <Mail className="w-4 h-4" />
                Message
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-gray-50 to-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Welcome to {store.name}</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {store.bio || 'Discover unique wedding products and services crafted with care and attention to detail.'}
          </p>
        </div>
      </section>

      {/* Products Grid */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Products & Services</h2>
          <span className="text-gray-600">{products.length} items</span>
        </div>
        
        {products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <Store className="mx-auto w-12 h-12 text-gray-400" />
            <h3 className="mt-4 font-medium text-gray-900">No products available yet</h3>
            <p className="text-gray-500 mt-1">Check back later for new items</p>
          </div>
        )}
      </section>

      {/* Store Info Footer */}
      <footer className="bg-gray-50 border-t">
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
              <span className="font-semibold text-gray-900">{store.name}</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Globe className="w-4 h-4" />
                <span>artisana.app/{store.handle}</span>
              </div>
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
    <div className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-xl transition-all duration-300 group">
      <div className="aspect-square bg-gray-100 overflow-hidden">
        {product.images && product.images.length > 0 ? (
          <img 
            src={product.images[0]} 
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Store className="w-12 h-12" />
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-900 mb-1">{product.name}</h3>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2 min-h-[2.5rem]">
          {product.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="font-bold text-lg text-gray-900">${product.price}</span>
          <button className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 transition-colors font-medium">
            View Details
          </button>
        </div>
        {product.inventory < 10 && product.inventory > 0 && (
          <p className="text-xs text-orange-600 mt-2">Only {product.inventory} left in stock!</p>
        )}
        {product.inventory === 0 && (
          <p className="text-xs text-red-600 mt-2">Out of stock</p>
        )}
      </div>
    </div>
  );
};
