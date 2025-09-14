import React, { useEffect, useState } from "react";
import { Search, Book, Lightbulb, X, ShoppingCart, ArrowRight, Loader2 } from "lucide-react";

type Nutrition = {
  calories: number;import * as React from "react";
import { Search, Lightbulb, Loader2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Nutrition = {
  calories?: number;
  fat?: number;
  carbs?: number;
  protein?: number;
};

type SubstitutionItem = {
  substituteIngredient: string;
  ratio: string;
  category?: string;
  notes?: string;
  nutrition?: {
    original?: Nutrition;
    substitute?: Nutrition;
  };
};

export default function IngredientSubstitutions() {
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<SubstitutionItem[]>([]);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [fetchingSugg, setFetchingSugg] = React.useState(false);

  // Quick examples (click to fill)
  const examples = ["milk", "2% milk", "sour cream", "buttermilk", "heavy cream", "yogurt", "eggs", "butter"];

  // --- Fetch Helpers (robust JSON parse, encodes query) ---
  async function fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
      // Try to read error body for better message
      const body = ct.includes("application/json") ? await res.json().catch(() => ({})) : await res.text().catch(() => "");
      const msg =
        typeof body === "string" && body
          ? body
          : (body && (body.error || body.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    if (ct.includes("application/json")) return (await res.json()) as T;
    // Some environments may return text on errors; try to parse anyway
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(text || "Unexpected response from server");
    }
  }

  // --- Suggestions (debounced) ---
  React.useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      setFetchingSugg(true);
      try {
        const enc = encodeURIComponent(query.trim());
        // Always encode the query string so values like "2% milk" work
        const data = await fetchJSON<{ results: string[] }>(
          `/api/ingredients/substitutions/search?q=${enc}`
        );
        setSuggestions(Array.isArray(data.results) ? data.results : []);
      } catch (e: any) {
        // Don’t surface suggestion errors too loudly; just clear them
        setSuggestions([]);
      } finally {
        setFetchingSugg(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  // --- Main search submit (regular catalog lookup) ---
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      // Encode the path segment too — this is where bare "%" used to break
      const pathIng = encodeURIComponent(q);
      const data = await fetchJSON<{ substitutions: SubstitutionItem[] }>(
        `/api/ingredients/${pathIng}/substitutions`
      );
      setResults(Array.isArray(data.substitutions) ? data.substitutions : []);
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // --- UI ---
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Ingredient Substitutions</h1>
          <p className="text-gray-600">
            Find reliable swaps and ratios for common ingredients. Tip: you can search for
            <span className="font-medium"> “2% milk”</span> now—percent signs are handled.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try: milk, 2% milk, sour cream, heavy cream…"
              aria-label="Ingredient to substitute"
              className="pl-10"
            />
          </div>

          {/* Suggestions */}
          {(fetchingSugg || suggestions.length > 0) && (
            <div className="mt-3">
              {fetchingSugg && <div className="text-xs text-gray-500">Looking for suggestions…</div>}
              {!fetchingSugg && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.slice(0, 8).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setQuery(s);
                        // auto-run lookup for the selected suggestion
                        setTimeout(() => handleSubmit(), 0);
                      }}
                      className="px-3 py-1 bg-orange-100 text-orange-800 text-xs rounded-full hover:bg-orange-200 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick example chips */}
          <div className="mt-4 flex gap-2 flex-wrap">
            {examples.map((ex) => (
              <button
                type="button"
                key={ex}
                onClick={() => {
                  setQuery(ex);
                  setTimeout(() => handleSubmit(), 0);
                }}
                className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full hover:bg-orange-200 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="submit"
              disabled={loading || !query.trim()}
              className="inline-flex items-center px-5"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              Find Substitutes
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
              {error}
            </div>
          )}
        </form>

        {/* Results */}
        <Card>
          {results.length === 0 && !loading ? (
            <CardContent className="py-10 text-center">
              <Lightbulb className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-700">No suggestions yet. Try searching above.</p>
            </CardContent>
          ) : (
            <CardContent className="space-y-4">
              {results.map((item, idx) => (
                <div
                  key={`${item.substituteIngredient}-${idx}`}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {item.substituteIngredient}
                      </h3>
                      <div className="mt-1 text-sm text-gray-700">
                        <span className="font-medium">Ratio:</span> {item.ratio}
                      </div>
                      {item.category && (
                        <div className="mt-2">
                          <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                            {item.category}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {item.notes && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-start">
                        <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                        <p className="text-sm text-blue-800">{item.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
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
