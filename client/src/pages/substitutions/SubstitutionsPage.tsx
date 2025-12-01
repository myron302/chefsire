// client/src/pages/substitutions/SubstitutionsPage.tsx
import React, { useState, useEffect } from "react";
import { Search, ListChecks, AlertTriangle, Copy, Check, Filter, X } from "lucide-react";
import { GROUPS } from "@/data/ingredient-substitutions";

type ApiSubstitution = {
  id: string;
  ingredientId: string;
  ingredient: string;
  aliases: string[];
  text: string;
  components: { item: string; amount?: number; unit?: string; note?: string }[];
  method: { action?: string; time_min?: number; time_max?: number; temperature?: string };
  ratio: string;
  context: string;
  dietTags: string[];
  allergenFlags: string[];
};

type ApiResponse = {
  items: ApiSubstitution[];
  total: number;
  limit: number;
  offset: number;
};

const DIET_FILTERS = [
  { id: "vegan", label: "Vegan", color: "green" },
  { id: "vegetarian", label: "Vegetarian", color: "emerald" },
  { id: "gluten-free", label: "Gluten-Free", color: "amber" },
  { id: "dairy-free", label: "Dairy-Free", color: "blue" },
  { id: "keto", label: "Keto", color: "purple" },
  { id: "paleo", label: "Paleo", color: "orange" },
];

export default function SubstitutionsPage() {
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState<string>("");
  const [selectedDiets, setSelectedDiets] = useState<string[]>([]);
  const [results, setResults] = useState<ApiSubstitution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchSubstitutions();
    }, 300);

    return () => clearTimeout(timer);
  }, [query, groupId]);

  const searchSubstitutions = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (groupId) params.set("groupId", groupId);
      params.set("limit", "50");

      const res = await fetch(`/api/substitutions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch substitutions");

      const data: ApiResponse = await res.json();
      setResults(data.items);
    } catch (err) {
      console.error("Search error:", err);
      setError("Unable to load substitutions. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleDiet = (dietId: string) => {
    setSelectedDiets((prev) =>
      prev.includes(dietId)
        ? prev.filter((d) => d !== dietId)
        : [...prev, dietId]
    );
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Filter results by selected diets
  const filteredResults = selectedDiets.length > 0
    ? results.filter((r) =>
        selectedDiets.every((diet) =>
          r.dietTags?.includes(diet)
        )
      )
    : results;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Ingredient Substitutions
          </h1>
          <p className="text-slate-600 mt-2">
            Find smart swaps for any ingredient in your recipes
          </p>
        </header>

        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for an ingredient (e.g., buttermilk, egg, butter)..."
                className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              />
            </div>

            {/* Group Filter */}
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              title="Filter by group"
            >
              <option value="">All Categories</option>
              {GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-3 rounded-lg border transition flex items-center gap-2 ${
                selectedDiets.length > 0
                  ? "bg-purple-100 border-purple-300 text-purple-700"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
              title="Toggle dietary filters"
            >
              <Filter className="w-5 h-5" />
              <span className="hidden sm:inline">Filters</span>
              {selectedDiets.length > 0 && (
                <span className="bg-purple-600 text-white text-xs rounded-full px-2 py-0.5">
                  {selectedDiets.length}
                </span>
              )}
            </button>
          </div>

          {/* Dietary Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Dietary Preferences</h3>
                {selectedDiets.length > 0 && (
                  <button
                    onClick={() => setSelectedDiets([])}
                    className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {DIET_FILTERS.map((diet) => (
                  <button
                    key={diet.id}
                    onClick={() => toggleDiet(diet.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      selectedDiets.includes(diet.id)
                        ? `bg-${diet.color}-100 text-${diet.color}-700 border-2 border-${diet.color}-400`
                        : "bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200"
                    }`}
                  >
                    {diet.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status Info */}
          {query && (
            <div className="mt-3 text-sm text-slate-500">
              {loading && "Searching..."}
              {!loading && filteredResults.length > 0 && (
                <>
                  Found {filteredResults.length} substitution{filteredResults.length !== 1 ? "s" : ""}
                  {selectedDiets.length > 0 && (
                    <span className="text-purple-600 font-medium">
                      {" "}(filtered by {selectedDiets.length} diet{selectedDiets.length !== 1 ? "s" : ""})
                    </span>
                  )}
                </>
              )}
              {!loading && query && filteredResults.length === 0 && !error && (
                selectedDiets.length > 0
                  ? "No results match your dietary filters. Try removing some filters."
                  : "No substitutions found. Try a different search term."
              )}
            </div>
          )}

          {error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {!query ? (
          <div className="text-center py-12 text-slate-500">
            <Search className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg mb-2">Search for any ingredient</p>
            <p className="text-sm">Try: buttermilk, egg, brown sugar, heavy cream, butter...</p>
          </div>
        ) : filteredResults.length === 0 && !loading ? (
          <div className="text-center py-12 text-slate-500">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-300" />
            <p className="text-lg">No substitutions found</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filteredResults.map((item) => (
              <article
                key={item.id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition p-5 border border-slate-100"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">{item.ingredient}</h3>
                    {item.context && (
                      <span className="text-xs text-slate-500 italic">Best for: {item.context}</span>
                    )}
                  </div>
                </div>

                {/* Dietary Tags */}
                {item.dietTags && item.dietTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.dietTags.map((tag) => {
                      const dietInfo = DIET_FILTERS.find((d) => d.id === tag);
                      return (
                        <span
                          key={tag}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            dietInfo
                              ? `bg-${dietInfo.color}-100 text-${dietInfo.color}-700`
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Allergen Warnings */}
                {item.allergenFlags && item.allergenFlags.length > 0 && (
                  <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-amber-800">
                        <span className="font-semibold">Contains allergens:</span>{" "}
                        {item.allergenFlags.join(", ")}
                      </div>
                    </div>
                  </div>
                )}

                {/* Substitution Text */}
                <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-700 leading-relaxed">{item.text}</p>
                </div>

                {/* Ratio with Copy */}
                {item.ratio && (
                  <div className="flex items-center justify-between mb-3 p-2 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-semibold text-purple-900">Ratio: {item.ratio}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(item.ratio, item.id)}
                      className="p-1.5 hover:bg-purple-100 rounded transition"
                      title="Copy ratio"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-purple-600" />
                      )}
                    </button>
                  </div>
                )}

                {/* Components */}
                {item.components && item.components.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Ingredients:
                    </p>
                    <ul className="space-y-1">
                      {item.components.map((comp, idx) => (
                        <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                          <span className="text-purple-500 mt-1">•</span>
                          <span>
                            {comp.amount && comp.unit ? `${comp.amount} ${comp.unit} ` : ""}
                            {comp.item}
                            {comp.note && <span className="text-slate-500 italic"> ({comp.note})</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Method */}
                {item.method?.action && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Method:</p>
                    <p className="text-sm text-blue-800">{item.method.action}</p>
                    {(item.method.time_min || item.method.temperature) && (
                      <p className="text-xs text-blue-600 mt-1">
                        {item.method.time_min && `${item.method.time_min} minutes`}
                        {item.method.temperature && ` at ${item.method.temperature}`}
                      </p>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
