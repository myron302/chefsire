import React, { useState, useEffect } from "react";
import { Search, Plus, Book, Lightbulb, ArrowRight, X, ShoppingCart } from "lucide-react";

const IngredientSubstitutions = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [substitutions, setSubstitutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubstitution, setNewSubstitution] = useState({
    originalIngredient: "",
    substituteIngredient: "",
    ratio: "",
    notes: "",
    category: ""
  });

  const categories = [
    "baking", "dairy", "spices", "oils", "sweeteners", 
    "proteins", "vegetables", "herbs", "other"
  ];

  const commonSearches = [
    "butter", "eggs", "milk", "flour", "sugar", 
    "vanilla", "baking soda", "oil", "honey", "cream"
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
      console.error("Error searching substitutions:", error);
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
        // if no results, fallback to AI suggestion
        if (!data.substitutions || data.substitutions.length === 0) {
          const aiResponse = await fetch(`/api/ingredients/ai-substitution?q=${encodeURIComponent(ingredient)}`);
          const aiData = await aiResponse.json();
          setSubstitutions(aiData.substitutions || []);
        } else {
          setSubstitutions(data.substitutions || []);
        }
      }
    } catch (error) {
      console.error("Error fetching substitutions:", error);
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
      const response = await fetch("/api/ingredients/substitutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSubstitution)
      });

      if (response.ok) {
        setNewSubstitution({
          originalIngredient: "",
          substituteIngredient: "",
          ratio: "",
          notes: "",
          category: ""
        });
        setShowAddForm(false);
        if (selectedIngredient && selectedIngredient.toLowerCase() === newSubstitution.originalIngredient.toLowerCase()) {
          getIngredientSubstitutions(selectedIngredient);
        }
      }
    } catch (error) {
      console.error("Error adding substitution:", error);
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
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Smart Ingredient Substitutions</h1>
          <p className="text-gray-600">Find healthier, cheaper, or faster alternatives for your recipes 🍴</p>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
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
        </div>

        {/* Substitutions Display */}
        {selectedIngredient && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Substitutions for "{selectedIngredient}"
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {substitutions.length} substitution{substitutions.length !== 1 ? "s" : ""} found
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
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
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

                    {/* Nutrition Comparison */}
                    {sub.nutrition && (
                      <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="font-medium text-gray-700 mb-1">Original</p>
                          <p>Calories: {sub.nutrition.original.calories}</p>
                          <p>Fat: {sub.nutrition.original.fat}g</p>
                          <p>Carbs: {sub.nutrition.original.carbs}g</p>
                          <p>Protein: {sub.nutrition.original.protein}g</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                          <p className="font-medium text-gray-700 mb-1">Substitute</p>
                          <p>Calories: {sub.nutrition.substitute.calories}</p>
                          <p>Fat: {sub.nutrition.substitute.fat}g</p>
                          <p>Carbs: {sub.nutrition.substitute.carbs}g</p>
                          <p>Protein: {sub.nutrition.substitute.protein}g</p>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {sub.notes && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-start">
                          <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                          <p className="text-sm text-blue-800">{sub.notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Instacart placeholder */}
                    <div className="mt-4 flex justify-end">
                      <button className="flex items-center px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Buy on Instacart
                      </button>
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

export default IngredientSubstitutions;
