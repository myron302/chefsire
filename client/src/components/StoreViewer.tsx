// src/components/StoreViewer.tsx
import React, { useState, useEffect } from 'react';
import { Frame } from '@craftjs/core';
import { useLocation } from 'wouter';
import { useUser } from '@/contexts/UserContext'; // For seller details if needed
import { Container, Text, Banner, ProductCard } from './Marketplace'; // Reuse from Marketplace

const resolver = { Container, Text, Banner, ProductCard }; // Same as builder

export default function StoreViewer() {
  const [, params] = useLocation(); // Extract username from path (e.g., /store/johnchef)
  const storeUsername = params?.username || 'demo';
  const { user } = useUser(); // Optional: For current user context (e.g., if owner viewing own store)
  const [layout, setLayout] = useState(null);
  const [sellerInfo, setSellerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        // Fetch layout and seller info from backend
        const [layoutRes, sellerRes] = await Promise.all([
          fetch(`/api/store/${storeUsername}/layout`), // Assume endpoint for layout JSON
          fetch(`/api/store/${storeUsername}/seller`), // Optional: For bio, avatar, etc.
        ]);

        if (!layoutRes.ok) throw new Error('Store layout not found');
        if (!sellerRes.ok) throw new Error('Seller info not found');

        const layoutData = await layoutRes.json();
        const sellerData = await sellerRes.json();

        setLayout(layoutData.layout); // { root: { ... } } from Craft.js serialize
        setSellerInfo(sellerData); // { username, avatar, bio, subscription }
      } catch (err) {
        setError(err.message || 'Error loading store');
      } finally {
        setLoading(false);
      }
    };

    if (storeUsername) fetchStore();
  }, [storeUsername]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading {storeUsername}'s store...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{error}</h3>
          <p className="text-gray-600 mb-4">The store may not exist or is private.</p>
          <button 
            onClick={() => window.history.back()} 
            className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Store Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {sellerInfo?.avatar && (
                <img 
                  src={sellerInfo.avatar} 
                  alt={storeUsername} 
                  className="w-12 h-12 rounded-full" 
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{storeUsername}'s Culinary Store</h1>
                {sellerInfo?.bio && <p className="text-gray-600">{sellerInfo.bio}</p>}
                {sellerInfo?.subscription && (
                  <Badge variant="secondary" className="mt-1">
                    {sellerInfo.subscription} Seller
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              <button className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 flex items-center">
                <ShoppingCart className="w-4 h-4 mr-2" />
                View Cart
              </button>
              {user?.username === storeUsername && (
                <button 
                  onClick={() => {/* Navigate to dashboard */}} 
                  className="border px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  Edit Store
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Render the saved layout */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {layout ? (
          <Frame resolver={resolver} json={layout}>
            {/* Fallback if no layout */}
            <Container className="min-h-[600px] border border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <Text text={`${storeUsername} hasn't built their store yet. Check back soon!`} />
            </Container>
          </Frame>
        ) : (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No products yet—{storeUsername} is just getting started.</p>
          </div>
        )}
      </div>

      {/* Store Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p className="text-gray-600 mb-2">Secure payments via [Stripe/Square]. 30-day returns on most items.</p>
          <div className="flex justify-center space-x-4 text-sm text-gray-500">
            <a href="/privacy" className="hover:underline">Privacy</a>
            <a href="/terms" className="hover:underline">Terms</a>
            <a href="/contact" className="hover:underline">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
