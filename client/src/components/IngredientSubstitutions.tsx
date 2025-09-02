import React, { useState, useEffect } from 'react';
import { Search, Plus, Book, Lightbulb, ArrowRight, X } from 'lucide-react';

const IngredientSubstitutions = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [substitutions, setSubstitutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubstitution, setNewSubstitution] = useState({
    originalIngredient: '',
    substituteIngredient: '',
    ratio: '',
    notes: '',
    category: ''
  });

  const categories = [
    'baking', 'dairy', 'spices', 'oils', 'sweeteners', 'proteins', 'vegetables', 'herbs', 'other'
  ];

  const commonSearches = [
    'butter', 'eggs', 'milk', 'flour', 'sugar', 'vanilla', 'baking soda', 'oil', 'honey', 'cream'
  ];

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchSubstitutions();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const searchSubstitutions = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/ingredients/substitutions/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Error searching substitutions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIngredientSubstitutions = async (ingredient) => {
    setLoading(true);
    setSelectedIngredient(ingredient);
    try {
      const response = await fetch(`/api/ingredients/${encodeURIComponent(ingredient)}/substitutions`);
      if (response.ok) {
        const data = await response.json();
        setSubstitutions(data.substitutions || []);
      }
    } catch (error) {
      console.error('Error fetching substitutions:', error);
      setSubstitutions([]);
    } finally {
      setLoading(false);
    }
  };

  const addSubstitution = async () => {
    if (!newSubstitution.originalIngredient || !newSubstitution.substituteIngredient || !newSubstitution.ratio) {
      return;
    }

    try {
      const response = await fetch('/api/ingredients/substitutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSubstitution)
      });

      if (response.ok) {
        setNewSubstitution({
          originalIngredient: '',
          substituteIngredient: '',
          ratio: '',
          notes: '',
          category: ''
        });
        setShowAddForm(false);
        // Refresh current substitutions if viewing the same ingredient
        if (selectedIngredient && selectedIngredient.toLowerCase() === newSubstitution.originalIngredient.toLowerCase()) {
          getIngredientSubstitutions(selectedIngredient);
        }
      }
    } catch (error) {
      console.error('Error adding substitution:', error);
    }
  };

  const handleQuickSearch = (ingredient) => {
    setSearchQuery(ingredient);
    getIngredientSubstitutions(ingredient);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Ingredient Substitutions</h1>
          <p className="text-gray-600">Find alternatives for missing ingredients in your recipes</p>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for an ingredient you need to substitute..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Common Searches */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Popular substitutions:</p>
            <div className="flex flex-wrap gap-2">
              {commonSearches.map((ingredient) => (
                <button
                  key={ingredient}
                  onClick={() => handleQuickSearch(ingredient)}
                  className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full hover:bg-orange-200 transition-colors"
                >
                  {ingredient}
                </button>
              ))}
            </div>
          </div>

          {/* Add New Substitution Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Substitution
            </button>
          </div>
        </div>

        {/* Add Substitution Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Substitution</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Original Ingredient</label>
                <input
                  type="text"
                  value={newSubstitution.originalIngredient}
                  onChange={(e) => setNewSubstitution({ ...newSubstitution, originalIngredient: e.target.value })}
                  placeholder="e.g., butter"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Substitute</label>
                <input
                  type="text"
                  value={newSubstitution.substituteIngredient}
                  onChange={(e) => setNewSubstitution({ ...newSubstitution, substituteIngredient: e.target.value })}
                  placeholder="e.g., coconut oil"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ratio</label>
                <input
                  type="text"
                  value={newSubstitution.ratio}
                  onChange={(e) => setNewSubstitution({ ...newSubstitution, ratio: e.target.value })}
                  placeholder="e.g., 1:1 or 3/4 cup for 1 cup"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newSubstitution.category}
                  onChange={(e) => setNewSubstitution({ ...newSubstitution, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={newSubstitution.notes}
                onChange={(e) => setNewSubstitution({ ...newSubstitution, notes: e.target.value })}
                placeholder="Additional cooking tips or notes..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addSubstitution}
                className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
              >
                Add Substitution
              </button>
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && !selectedIngredient && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Results</h3>
            <div className="space-y-2">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => getIngredientSubstitutions(result.originalIngredient)}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{result.originalIngredient}</p>
                    <p className="text-sm text-gray-600">
                      Can substitute with: {result.substituteIngredient}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Substitutions Display */}
        {selectedIngredient && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Substitutions for "{selectedIngredient}"
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {substitutions.length} substitution{substitutions.length !== 1 ? 's' : ''} found
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedIngredient(null);
                  setSubstitutions([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Finding substitutions...</p>
              </div>
            ) : substitutions.length === 0 ? (
              <div className="text-center py-8">
                <Book className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No substitutions found</h4>
                <p className="text-gray-600 mb-4">
                  We don't have any substitutions for "{selectedIngredient}" yet.
                </p>
                <button
                  onClick={() => {
                    setNewSubstitution({ ...newSubstitution, originalIngredient: selectedIngredient });
                    setShowAddForm(true);
                  }}
                  className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors"
                >
                  Add the first substitution
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {substitutions.map((sub, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 text-lg">
                          {sub.substituteIngredient}
                        </h4>
                        {sub.category && (
                          <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full mt-1">
                            {sub.category}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-orange-600">Ratio: {sub.ratio}</p>
                      </div>
                    </div>
                    
                    {sub.notes && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-start">
                          <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                          <p className="text-sm text-blue-800">{sub.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Getting Started */}
        {!selectedIngredient && searchResults.length === 0 && !searchQuery && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Find Ingredient Substitutions</h3>
            <p className="text-gray-600 mb-6">
              Search for any ingredient to find suitable substitutes with proper ratios and cooking tips.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-orange-600" />
                </div>
                <h4 className="font-medium text-gray-900 mb-2">Search</h4>
                <p className="text-sm text-gray-600">Type any ingredient you need to substitute</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Book className="w-6 h-6 text-orange-600" />
                </div>
                <h4 className="font-medium text-gray-900 mb-2">Learn</h4>
                <p className="text-sm text-gray-600">Get ratios and cooking tips for each substitute</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Plus className="w-6 h-6 text-orange-600" />
                </div>
                <h4 className="font-medium text-gray-900 mb-2">Contribute</h4>
                <p className="text-sm text-gray-600">Share your own substitution knowledge</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IngredientSubstitutions;
