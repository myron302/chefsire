import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Store, Instagram, Facebook, Mail } from 'lucide-react';
import { getStoreByHandle, getStoreProducts } from '../lib/stores';
import { Store as StoreType } from '../types/store';
import { Product } from '../types/store';
import { Vendor } from '../types/vendor'; // Your existing Vendor type

interface StorefrontData {
  store: StoreType;
  vendor: Vendor; // Your existing vendor info
  products: Product[];
}

export const Storefront: React.FC = () => {
  const { handle } = useParams<{ handle: string }>();
  const [storefrontData, setStorefrontData] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoreData();
  }, [handle]);

  const loadStoreData = async () => {
    if (!handle) return;
    
    try {
      // This function would fetch both store and vendor data
      const storeData = await getStoreByHandle(handle);
      const storeProducts = await getStoreProducts(storeData.id);
      const vendorData = await getVendorByStoreId(storeData.owner_id); // You might need this function
      
      setStorefrontData({
        store: storeData,
        vendor: vendorData,
        products: storeProducts
      });
    } catch (error) {
      console.error('Failed to load store:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!storefrontData) {
    return <div>Store not found</div>;
  }

  const { store, vendor, products } = storefrontData;

  return (
    <div className="min-h-screen bg-white">
      {/* Store Header with Vendor Info */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {store.logo ? (
                <img src={store.logo} alt={store.name} className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <Store className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{store.name}</h1>
                <p className="text-gray-600">{vendor.businessName}</p>
                <p className="text-gray-600">{store.bio}</p>
              </div>
            </div>
            
            {/* Vendor-specific info */}
            <div className="text-right">
              <div className="flex items-center gap-2">
                <span className="text-yellow-500">★</span>
                <span>{vendor.rating} ({vendor.reviewCount} reviews)</span>
              </div>
              <p className="text-gray-600">{vendor.location.city}, {vendor.location.state}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Products Section */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-8">Products & Services</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Vendor Services from existing Vendor data */}
        <div className="mt-12">
          <h3 className="text-xl font-bold mb-4">Services</h3>
          <div className="flex flex-wrap gap-2">
            {vendor.amenities.map((amenity, index) => (
              <span key={index} className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                {amenity}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

// Product Card component remains similar
