import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Clock, Search, ChefHat, QrCode, ShoppingCart, Trash2, Download, ExternalLink } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';

type PantryItem = {
  id: string | number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  expirationDate?: string | null;
};

type RecipeSuggestion = {
  id: string | number;
  title: string;
  description?: string;
  servings?: number;
  cookTime?: number;
  matchScore?: number;
  ingredientMatches?: number;
  totalIngredients?: number;
  missingCount?: number;
  missingIngredients?: string[];
  canMake?: boolean;
  post?: { imageUrl?: string };
};

type NewItem = {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  expirationDate: string;
};

const CATEGORIES = [
  'produce', 'dairy', 'meat', 'seafood', 'grains', 'spices',
  'pantry', 'frozen', 'canned', 'beverages', 'other'
];

const UNITS = ['piece', 'cup', 'oz', 'lb', 'kg', 'g', 'ml', 'l', 'tsp', 'tbsp'];

const tokenHeader = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
});

// --- Helpers ---
const getDaysUntilExpiration = (expirationDate?: string | null) => {
  if (!expirationDate) return null;
  const today = new Date();
  const expiry = new Date(expirationDate);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const end = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate()).getTime();
  const diffTime = end - start;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getExpirationPill = (days: number | null) => {
  if (days === null) return { text: 'No expiry', cls: 'text-gray-600 bg-gray-50' };
  if (days <= 0) return { text: 'Expired', cls: 'text-red-600 bg-red-50' };
  if (days === 1) return { text: 'Expires tomorrow', cls: 'text-orange-600 bg-orange-50' };
  if (days <= 3) return { text: `${days} days left`, cls: 'text-orange-600 bg-orange-50' };
  if (days <= 7) return { text: `${days} days left`, cls: 'text-yellow-600 bg-yellow-50' };
  return { text: `${days} days left`, cls: 'text-gray-600 bg-gray-50' };
};

export default function Pantry() {
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [recipeSuggestions, setRecipeSuggestions] = useState<RecipeSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'pantry'|'suggestions'|'shopping'>('pantry');

  // Add form
  const [newItem, setNewItem] = useState<NewItem>({
    name: '',
    category: 'produce',
    quantity: 1,
    unit: 'piece',
    expirationDate: ''
  });

  // Scanner
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanningBusy, setScanningBusy] = useState(false);

  // Shopping List
  const [shoppingList, setShoppingList] = useState<{name: string; quantity?: number; unit?: string;}[]>([]);

  // --- Initial load ---
  useEffect(() => {
    void fetchPantryItems();
    void fetchRecipeSuggestions();

    // Load pending shopping list items from RecipeKit
    try {
      const pending = JSON.parse(localStorage.getItem('pendingShoppingListItems') || '[]');
      if (pending.length > 0) {
        setShoppingList(prev => [...prev, ...pending]);
        localStorage.removeItem('pendingShoppingListItems');
        // Switch to shopping tab if items were added
        setActiveTab('shopping');
      }
    } catch (err) {
      console.error('Error loading pending shopping items:', err);
    }
  }, []);

  const fetchPantryItems = async () => {
    try {
      const res = await fetch('/api/pantry', { headers: tokenHeader() });
      if (res.ok) {
        const items = await res.json();
        setPantryItems(items);
      }
    } catch (e) {
      console.error('Error fetching pantry items:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipeSuggestions = async () => {
    try {
      const res = await fetch('/api/pantry/recipe-suggestions', { headers: tokenHeader() });
      if (res.ok) {
        const data = await res.json();
        setRecipeSuggestions(data);
      }
    } catch (e) {
      console.error('Error fetching recipe suggestions:', e);
    }
  };

  // --- Pantry CRUD ---
  const addPantryItem = async (payload?: Partial<NewItem>) => {
    const body: NewItem = {
      name: payload?.name ?? newItem.name,
      category: payload?.category ?? newItem.category,
      quantity: Number(payload?.quantity ?? newItem.quantity) || 0,
      unit: payload?.unit ?? newItem.unit,
      expirationDate: payload?.expirationDate ?? newItem.expirationDate
    };

    try {
      const res = await fetch('/api/pantry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...tokenHeader(),
        },
        body: JSON.stringify({
          ...body,
          expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
        }),
      });
      if (res.ok) {
        const item = await res.json();
        setPantryItems((prev) => [...prev, item]);
        setNewItem({ name: '', category: 'produce', quantity: 1, unit: 'piece', expirationDate: '' });
        setShowAddForm(false);
        void fetchRecipeSuggestions();
      }
    } catch (e) {
      console.error('Error adding pantry item:', e);
    }
  };

  const deletePantryItem = async (itemId: string | number) => {
    try {
      const res = await fetch(`/api/pantry/${itemId}`, {
        method: 'DELETE',
        headers: tokenHeader(),
      });
      if (res.ok) {
        setPantryItems((prev) => prev.filter((i) => i.id !== itemId));
        void fetchRecipeSuggestions();
      }
    } catch (e) {
      console.error('Error deleting pantry item:', e);
    }
  };

  // --- Scanner flow ---
  const onBarcodeDetected = async (code: string) => {
    if (scanningBusy) return;
    setScanningBusy(true);
    try {
      const res = await fetch(`/api/lookup/${encodeURIComponent(code)}`, { headers: tokenHeader() });
      if (!res.ok) {
        console.warn('Lookup failed.');
        setScannerOpen(false);
        setScanningBusy(false);
        return;
      }
      const data = await res.json();
      // data: { name, category, quantity, unit, brand?, upc? }
      await addPantryItem({
        name: data?.name || 'Unknown product',
        category: data?.category || 'pantry',
        quantity: data?.quantity || 1,
        unit: data?.unit || 'piece',
        expirationDate: '' // unknown from barcode
      });
    } catch (e) {
      console.error('Scanner lookup error:', e);
    } finally {
      setScannerOpen(false);
      setScanningBusy(false);
    }
  };

  // --- Shopping List logic ---
  const addToShoppingList = (name: string, quantity?: number, unit?: string) => {
    setShoppingList((prev) => {
      const idx = prev.findIndex((i) => i.name.toLowerCase() === name.toLowerCase());
      if (idx >= 0) {
        const clone = [...prev];
        const existing = clone[idx];
        clone[idx] = {
          ...existing,
          quantity: (existing.quantity || 0) + (quantity || 1),
          unit: unit || existing.unit || 'piece'
        };
        return clone;
      }
      return [...prev, { name, quantity: quantity || 1, unit: unit || 'piece' }];
    });
  };

  const removeFromShoppingList = (name: string) => {
    setShoppingList((prev) => prev.filter((i) => i.name !== name));
  };

  const clearShoppingList = () => setShoppingList([]);

  // Add missing ingredients from one recipe card
  const addRecipeMissingToList = (missing?: string[]) => {
    if (!missing?.length) return;
    missing.forEach((m) => addToShoppingList(m));
    setActiveTab('shopping');
  };

  // Bulk export calls (FIXED instacart response shape)
  const exportList = async (type: 'text' | 'csv' | 'instacart') => {
    try {
      const endpoint =
        type === 'text'
          ? '/api/export/text'
          : type === 'csv'
          ? '/api/export/csv'
          : '/api/export/instacart-links';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...tokenHeader() },
        body: JSON.stringify({ items: shoppingList }),
      });

      if (!res.ok) {
        console.error('Export failed');
        return;
      }

      if (type === 'instacart') {
        // Server returns: [{ name, url }]
        const links = (await res.json()) as { name: string; url: string }[];
        links.forEach((l) => window.open(l.url, '_blank'));
        return;
      }

      const blob = await res.blob();
      const fileName = type === 'text' ? 'shopping-list.txt' : 'shopping-list.csv';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      console.error('Export error:', e);
    }
  };

  const groupedItems = useMemo(() => {
    return pantryItems.reduce<Record<string, PantryItem[]>>((acc, item) => {
      const cat = item.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [pantryItems]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your pantry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Scanner Overlay */}
      {scannerOpen && (
        <BarcodeScanner
          onDetected={onBarcodeDetected}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Pantry</h1>
            <p className="text-gray-600">Manage ingredients, scan barcodes, and build a shopping list</p>
          </div>
          <div className="flex gap-2">
            {activeTab !== 'pantry' && (
              <button
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                disabled={scanningBusy}
              >
                <QrCode className="w-4 h-4 mr-2" />
                {scanningBusy ? 'Scanning…' : 'Scan Barcode'}
              </button>
            )}
            <button
              onClick={() => setActiveTab('shopping')}
              className="inline-flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Shopping List ({shoppingList.length})
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-8 bg-white rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('pantry')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'pantry' ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Search className="w-4 h-4 inline mr-2" />
            Pantry Items ({pantryItems.length})
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'suggestions' ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChefHat className="w-4 h-4 inline mr-2" />
            Recipe Suggestions ({recipeSuggestions.length})
          </button>
          <button
            onClick={() => setActiveTab('shopping')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'shopping' ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ShoppingCart className="w-4 h-4 inline mr-2" />
            Shopping List ({shoppingList.length})
          </button>
        </div>

        {/* --- PANTRY TAB --- */}
        {activeTab === 'pantry' && (
          <>
            <div className="mb-6 flex gap-2">
              <button
                onClick={() => setShowAddForm((v) => !v)}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Ingredient
              </button>
              <button
                onClick={() => setScannerOpen(true)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Scan to Add
              </button>
            </div>

            {showAddForm && (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ingredient Name</label>
                    <input
                      type="text"
                      required
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g., Tomatoes"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={newItem.quantity}
                        onChange={(e) =>
                          setNewItem({ ...newItem, quantity: parseFloat(e.target.value) })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                      <select
                        value={newItem.unit}
                        onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={newItem.expirationDate}
                      onChange={(e) => setNewItem({ ...newItem, expirationDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="md:col-span-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => addPantryItem()}
                      className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
                    >
                      Add Item
                    </button>
                  </div>
                </div>
              </div>
            )}

            {Object.keys(groupedItems).length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Your pantry is empty</h3>
                <p className="text-gray-600">Add or scan ingredients to get personalized recipe suggestions</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedItems).map(([category, items]) => (
                  <div key={category} className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b">
                      <h3 className="text-lg font-medium text-gray-900 capitalize">
                        {category} ({items.length})
                      </h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map((item) => {
                          const days = getDaysUntilExpiration(item.expirationDate);
                          const pill = getExpirationPill(days);
                          return (
                            <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium text-gray-900">{item.name}</h4>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => addToShoppingList(item.name, 1, item.unit)}
                                    className="text-indigo-600 hover:text-indigo-800 text-sm"
                                    title="Add to shopping list"
                                  >
                                    + List
                                  </button>
                                  <button
                                    onClick={() => deletePantryItem(item.id)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                    title="Remove"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                {item.quantity} {item.unit}
                              </p>
                              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${pill.cls}`}>
                                <Clock className="w-3 h-3 mr-1" />
                                {pill.text}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* --- SUGGESTIONS TAB --- */}
        {activeTab === 'suggestions' && (
          <div>
            {recipeSuggestions.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No recipe suggestions yet</h3>
                <p className="text-gray-600">Add more ingredients to your pantry to get personalized suggestions</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recipeSuggestions.map((recipe) => (
                  <div key={recipe.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
                    {recipe.post?.imageUrl && (
                      <img
                        src={recipe.post.imageUrl}
                        alt={recipe.title}
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{recipe.title}</h3>
                      {recipe.description && <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>}

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          {recipe.servings ? <span>🍽️ {recipe.servings} servings</span> : <span />}
                          {recipe.cookTime ? <span>⏱️ {recipe.cookTime}min</span> : <span />}
                        </div>
                        <div className="text-right">
                          {typeof recipe.matchScore === 'number' && (
                            <div className="text-sm font-medium text-green-600">
                              {recipe.matchScore.toFixed(0)}% match
                            </div>
                          )}
                          {typeof recipe.ingredientMatches === 'number' && typeof recipe.totalIngredients === 'number' && (
                            <div className="text-xs text-gray-500">
                              {recipe.ingredientMatches}/{recipe.totalIngredients} ingredients
                            </div>
                          )}
                        </div>
                      </div>

                      {recipe.missingCount && recipe.missingCount > 0 && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-600 mb-1">Missing ingredients:</p>
                          <div className="flex flex-wrap gap-1">
                            {recipe.missingIngredients?.slice(0, 3).map((ingredient, i) => (
                              <span key={i} className="inline-block px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                                {ingredient}
                              </span>
                            ))}
                            {recipe.missingIngredients && recipe.missingIngredients.length > 3 && (
                              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                +{recipe.missingIngredients.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-600 transition-colors">
                          View Recipe
                        </button>
                        {recipe.canMake ? (
                          <button className="px-4 py-2 bg-green-100 text-green-700 rounded-md text-sm font-medium hover:bg-green-200 transition-colors">
                            Can Make!
                          </button>
                        ) : (
                          <button
                            className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-200 transition-colors"
                            onClick={() => addRecipeMissingToList(recipe.missingIngredients)}
                          >
                            Add Missing → List
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- SHOPPING LIST TAB --- */}
        {activeTab === 'shopping' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Shopping List
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => exportList('text')}
                  className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                  title="Export as text"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Text
                </button>
                <button
                  onClick={() => exportList('csv')}
                  className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                  title="Export as CSV"
                >
                  <Download className="w-4 h-4 mr-2" />
                  CSV
                </button>
                <button
                  onClick={() => exportList('instacart')}
                  className="inline-flex items-center px-3 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded"
                  title="Open Instacart searches"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Instacart
                </button>
                <button
                  onClick={clearShoppingList}
                  className="inline-flex items-center px-3 py-2 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded"
                  title="Clear list"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </button>
              </div>
            </div>

            {/* Manual add to list */}
            <ShoppingListQuickAdd onAdd={(name) => addToShoppingList(name)} />

            {shoppingList.length === 0 ? (
              <div className="text-center py-10 text-gray-600">
                Your shopping list is empty. Add missing ingredients from a recipe or add items manually.
              </div>
            ) : (
              <div className="divide-y border rounded-md">
                {shoppingList.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          setShoppingList((prev) => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], name };
                            return copy;
                          });
                        }}
                        className="border rounded px-2 py-1 text-sm"
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={item.quantity ?? 1}
                        onChange={(e) => {
                          const quantity = Number(e.target.value);
                          setShoppingList((prev) => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], quantity };
                            return copy;
                          });
                        }}
                        className="w-20 border rounded px-2 py-1 text-sm"
                        title="Quantity"
                      />
                      <input
                        type="text"
                        value={item.unit ?? 'piece'}
                        onChange={(e) => {
                          const unit = e.target.value;
                          setShoppingList((prev) => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], unit };
                            return copy;
                          });
                        }}
                        className="w-24 border rounded px-2 py-1 text-sm"
                        title="Unit"
                      />
                    </div>
                    <button
                      onClick={() => removeFromShoppingList(item.name)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Small inline component for quick manual additions to the list */
function ShoppingListQuickAdd({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="mb-4 flex gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add item (e.g., milk)…"
        className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        onClick={() => {
          if (!name.trim()) return;
          onAdd(name.trim());
          setName('');
        }}
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
      >
        Add
      </button>
    </div>
  );
}
