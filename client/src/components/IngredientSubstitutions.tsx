import React, { useEffect, useState } from "react";
import { Search, Book, Lightbulb, X, ShoppingCart, ArrowRight, Loader2 } from "lucide-react";

type Nutrition = {
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
};

type SubRow = {
  originalIngredient: string;
  substituteIngredient: string;
  ratio: string;
  notes?: string;
  category?: string;
  nutrition?: {
    original: Nutrition;
    substitute: Nutrition;
  };
};

export default function IngredientSubstitutions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);
  const [substitutions, setSubstitutions] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const common = ["butter", "eggs", "milk", "heavy cream", "sour cream", "sugar"];

  useEffect(() => {
    let active = true;
    const run = async () => {
      const q = searchQuery.trim();
      if (q.length < 2) {
        setSuggestions([]);
        return;
      }
      setLoadingList(true);
      setErr(null);
      try {
        const res = await fetch(`/api/ingredients/substitutions/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || `Search failed (${res.status})`);
        if (active) setSuggestions(json.results || []);
      } catch (e: any) {
        if (active) setErr(e?.message || "Failed to search.");
      } finally {
        if (active) setLoadingList(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [searchQuery]);

  async function loadSubs(ingredient: string) {
    setSelectedIngredient(ingredient);
    setLoading(true);
    setErr(null);
    setSubstitutions([]);
    try {
      const res = await fetch(`/api/ingredients/${encodeURIComponent(ingredient)}/substitutions`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
      setSubstitutions(json.substitutions || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to get substitutions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Smart Ingredient Substitutions</h1>
          <p className="text-gray-600">Find healthier, cheaper, or faster alternatives for your recipes 🍴</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const term = searchQuery.trim();
              if (term) void loadSubs(term);
            }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for an ingredient you need to substitute..."
                className="w-full pl-10 pr-28 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center px-3 py-2 rounded-md bg-orange-600 text-white text-sm font-medium hover:bg-orange-700"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                Search
              </button>
            </div>
          </form>

          {/* Quick picks */}
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Popular:</p>
            <div className="flex flex-wrap gap-2">
              {common.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setSearchQuery(item);
                    void loadSubs(item);
                  }}
                  className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full hover:bg-orange-200 transition-colors"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Suggestions */}
          {searchQuery.length >= 2 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Matches</p>
              <div className="border rounded-md max-h-40 overflow-auto">
                {loadingList ? (
                  <div className="p-3 text-sm text-gray-600">Searching…</div>
                ) : suggestions.length === 0 ? (
                  <div className="p-3 text-sm text-gray-600">No matches.</div>
                ) : (
                  suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => void loadSubs(s)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                    >
                      {s}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {err && (
            <div className="mt-4 p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
              {err}
            </div>
          )}
        </div>

        {/* Details */}
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
              <div className="text-center py-10">
                <Book className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No substitutions found</h4>
                <p className="text-gray-600 mb-4">
                  We don&apos;t have any substitutions for "{selectedIngredient}" yet.
                </p>
                <button
                  onClick={() => alert("Add-substitution form coming soon")}
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

                    {sub.notes && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-start">
                          <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                          <p className="text-sm text-blue-800">{sub.notes}</p>
                        </div>
                      </div>
                    )}

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
}
