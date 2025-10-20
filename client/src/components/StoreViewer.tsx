import React, { useState, useEffect } from 'react';
import { Frame } from '@craftjs/core';
import { Container, Text, Banner, ProductCard } from './Marketplace'; // Reuse from Marketplace
import { useLocation } from 'wouter';

const resolver = { Container, Text, Banner, ProductCard }; // Same as builder

export default function StoreViewer() {
  const [username] = useLocation(); // Extract from path (e.g., /store/johnchef → 'johnchef')
  const [, params] = useLocation();
  const storeUsername = params?.username || 'demo';
  const [layout, setLayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch store layout from backend (replace with real API)
    const fetchStore = async () => {
      try {
        const response = await fetch(`/api/store/${storeUsername}`);
        if (response.ok) {
          const data = await response.json();
          setLayout(data.layout); // Assume { layout: JSON from builder }
        } else {
          setError('Store not found');
        }
      } catch (err) {
        setError('Error loading store');
      } finally {
        setLoading(false);
      }
    };

    fetchStore();
  }, [storeUsername]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading store...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Store Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{storeUsername}'s Culinary Store</h1>
          <p className="text-gray-600">Unique recipes, ingredients, and tools from a fellow chef</p>
        </header>

        {/* Render the saved layout */}
        <Frame resolver={resolver} json={layout}>
          <Container className="min-h-[600px]">
            <Text text={`Welcome to ${storeUsername}'s store! (No layout yet—build one in your dashboard)`} />
          </Container>
        </Frame>

        {/* Footer CTA */}
        <div className="text-center mt-8 p-6 bg-white rounded-lg shadow">
          <p className="text-gray-600 mb-4">Ready to shop? All payments secure via [Stripe/Square].</p>
          <button className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600">
            Contact Seller
          </button>
        </div>
      </div>
    </div>
  );
}
