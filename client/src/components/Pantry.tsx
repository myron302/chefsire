import React, { useState, useEffect } from 'react';
import { Plus, X, Clock, Search, ChefHat } from 'lucide-react';

const Pantry = () => {
  const [pantryItems, setPantryItems] = useState([]);
  const [recipeSuggestions, setRecipeSuggestions] = useState([]);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'produce',
    quantity: 1,
    unit: 'piece',
    expirationDate: ''
  });
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState('pantry');

  const categories = [
    'produce', 'dairy', 'meat', 'seafood', 'grains', 'spices', 
    'pantry', 'frozen', 'canned', 'beverages', 'other'
  ];

  const units = ['piece', 'cup', 'oz', 'lb', 'kg', 'g', 'ml', 'l', 'tsp', 'tbsp'];

  useEffect(() => {
    fetchPantryItems();
    fetchRecipeSuggestions();
  }, []);

  const fetchPantryItems = async () => {
    try {
      const response = await fetch('/api/pantry', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const items = await response.json();
        setPantryItems(items);
      }
    } catch (error) {
      console.error('Error fetching pantry items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipeSuggestions = async () => {
    try {
      const response = await fetch('/api/pantry/recipe-suggestions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const suggestions = await response.json();
        setRecipeSuggestions(suggestions);
      }
    } catch (error) {
      console.error('Error fetching recipe suggestions:', error);
    }
  };

  const addPantryItem = async () => {
    try {
      const response = await fetch('/api/pantry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...newItem,
          expirationDate: newItem.expirationDate ? new Date(newItem.expirationDate) : null
        })
      });

      if (response.ok) {
        const item = await response.json();
        setPantryItems([...pantryItems, item]);
        setNewItem({
          name: '',
          category: 'produce',
          quantity: 1,
          unit: 'piece',
          expirationDate: ''
        });
        setShowAddForm(false);
        fetchRecipeSuggestions();
      }
    } catch (error) {
      console.error('Error adding pantry item:', error);
    }
  };

  const deletePantryItem = async (itemId) => {
    try {
      const response = await fetch(`/api/pantry/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setPantryItems(pantryItems.filter(item => item.id !== itemId));
        fetchRecipeSuggestions();
      }
    } catch (error) {
      console.error('Error deleting pantry item:', error);
    }
  };

  const getDaysUntilExpiration = (expirationDate) => {
    if (!expirationDate) return null;
    const today = new Date();
    const expiry = new Date(expirationDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpirationColor = (days) => {
    if (days <= 0) return 'text-red-600 bg-red-50';
    if (days <= 3) return 'text-orange-600 bg-orange-50';
    if (days <= 7) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const groupedItems = pantryItems.reduce((acc, item) => {
    const category = item.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Pantry</h1>
          <p className="text-gray-600">Manage your ingredients and discover recipes you can make</p>
        </div>

        <div className="flex space-x-1 mb-8 bg-white rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('pantry')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'pantry'
                ? 'bg-orange-500 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Search className="w-4 h-4 inline mr-2" />
            Pantry Items ({pantryItems.length})
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'suggestions'
                ? 'bg-orange-500 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChefHat className="w-4 h-4 inline mr-2" />
            Recipe Suggestions ({recipeSuggestions.length})
          </button>
        </div>

        {activeTab === 'pantry' && (
          <>
            <div className="mb-6">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Ingredient
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
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
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
                        onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) })}
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
                        {units.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
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

                  <div className="md:col-span-5 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={addPantryItem}
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
                <p className="text-gray-600">Add some ingredients to get personalized recipe suggestions</p>
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
                          const daysUntilExpiry = getDaysUntilExpiration(item.expirationDate);
                          return (
                            <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium text-gray-900">{item.name}</h4>
                                <button
                                  onClick={() => deletePantryItem(item.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                {item.quantity} {item.unit}
                              </p>
                              {daysUntilExpiry !== null && (
                                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getExpirationColor(daysUntilExpiry)}`}>
                                  <Clock className="w-3 h-3 mr-1" />
                                  {daysUntilExpiry <= 0 ? 'Expired' :
                                   daysUntilExpiry === 1 ? 'Expires tomorrow' :
                                   `${daysUntilExpiry} days left`}
                                </div>
                              )}
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
                      <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>
                      
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>🍽️ {recipe.servings} servings</span>
                          <span>⏱️ {recipe.cookTime ? `${recipe.cookTime}min` : "N/A"}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-green-600">
                            {recipe.matchScore?.toFixed(0)}% match
                          </div>
                          <div className="text-xs text-gray-500">
                            {recipe.ingredientMatches}/{recipe.totalIngredients} ingredients
                          </div>
                        </div>
                      </div>

                      {recipe.missingCount > 0 && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-600 mb-1">Missing ingredients:</p>
                          <div className="flex flex-wrap gap-1">
                            {recipe.missingIngredients.slice(0, 3).map((ingredient, index) => (
                              <span key={index} className="inline-block px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                                {ingredient}
                              </span>
                            ))}
                            {recipe.missingIngredients.length > 3 && (
                              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                +{recipe.missingIngredients.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex space-x-2">
                        <button className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-600 transition-colors">
                          View Recipe
                        </button>
                        {recipe.canMake && (
                          <button className="px-4 py-2 bg-green-100 text-green-700 rounded-md text-sm font-medium hover:bg-green-200 transition-colors">
                            Can Make!
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
      </div>
    </div>
  );
};

export default Pantry;
