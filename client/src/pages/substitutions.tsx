import React, { useState } from "react";
import { Search, Lightbulb, ShoppingCart, Loader2, ArrowRight, Sparkles } from "lucide-react";

type Nutrition = {
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
};

type SubstitutionItem = {
  substituteIngredient: string;
  ratio: string;
  category?: string;
  notes?: string;
  source: "spoonacular" | "database" | "ai";
  nutrition?: {
    original: Nutrition;
    substitute: Nutrition;
  };
};

type ApiResponse = {
  ingredient: string;
  substitutions: SubstitutionItem[];
  total: number;
  source: string;
  categories?: string[];
};

export default function SubstitutionsPage() {
  const [query, setQuery] = useState("");
  const [subs, setSubs] = useState<SubstitutionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  
  // AI specific state
  const [aiSubs, setAiSubs] = useState<SubstitutionItem[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiResults, setShowAiResults] = useState(false);

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setErr(null);
    setSubs([]);
    setAiSubs([]);
    setAiError(null);
    setShowAiResults(false);

    try {
      const url = `/api/ingredients/${encodeURIComponent(q)}/substitutions`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });

      if (res.status === 404) {
        throw new Error("Endpoint not found (404). Make sure your server mounts the substitutions route.");
      }
      if (!res.ok) throw new Error(`Request failed: HTTP ${res.status}`);

      const json = (await res.json()) as ApiResponse;
      setSubs(json.substitutions || []);
      setSource(json.source || "unknown");
    } catch (error: any) {
      setErr(error?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAiSearch() {
    const q = query.trim();
    if (!q) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const url = `/api/ingredients/${encodeURIComponent(q)}/ai-substitutions`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });

      if (!res.ok) throw new Error(`AI search failed: HTTP ${res.status}`);

      const json = await res.json();
      const aiSubstitutions = json.aiSubstitutions || json.substitutions || [];
      setAiSubs(Array.isArray(aiSubstitutions) ? aiSubstitutions : []);
      setShowAiResults(true);
    } catch (error: any) {
      setAiError(error?.message || "AI search failed.");
    } finally {
      setAiLoading(false);
    }
  }

  const hasNutrition = (item: SubstitutionItem) =>
    !!item.nutrition?.original && !!item.nutrition?.substitute;

  const delta = (orig: number, sub: number) => {
    const diff = orig - sub;
    const sign = diff > 0 ? "-" : diff < 0 ? "+" : "±";
    return { diff, label: `${sign}${Math.abs(diff)}` };
  };

  const statBadge = (
    label: string,
    value: string | number,
    tone: "neutral" | "positive" | "negative" = "neutral"
  ) => {
    const tones: Record<typeof tone, string> = {
      neutral: "bg-gray-100 text-gray-800",
      positive: "bg-green-100 text-green-800",
      negative: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${tones[tone]} mr-2 mb-2`}
      >
        {label}: {value}
      </span>
    );
  };

  const getSourceBadge = (itemSource: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      spoonacular: { color: "bg-blue-100 text-blue-800", label: "Spoonacular" },
      database: { color: "bg-green-100 text-green-800", label: "Database" },
      ai: { color: "bg-purple-100 text-purple-800", label: "AI" },
    };
    const badge = badges[itemSource] || { color: "bg-gray-100 text-gray-800", label: "Unknown" };
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const renderSubstitutionCard = (item: SubstitutionItem, idx: number) => {
    const original = item.nutrition?.original;
    const substitute = item.nutrition?.substitute;

    const calDelta = original && substitute ? delta(original.calories, substitute.calories) : null;
    const fatDelta = original && substitute ? delta(original.fat, substitute.fat) : null;
    const carbDelta = original && substitute ? delta(original.carbs, substitute.carbs) : null;
    const proteinDelta = original && substitute ? delta(original.protein, substitute.protein) : null;

    const toneFor = (d?: { diff: number; label: string }) =>
      !d ? "neutral" : d.diff > 0 ? "positive" : d.diff < 0 ? "negative" : "neutral";

    return (
      <div
        key={`${item.substituteIngredient}-${idx}`}
        className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{item.substituteIngredient}</h3>
              {getSourceBadge(item.source)}
            </div>
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

          <div className="mt-2 md:mt-0">
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
              onClick={() => alert("Instacart integration coming soon!")}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Buy on Instacart
            </button>
          </div>
        </div>

        {original && substitute && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-sm">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-700 mb-1">Original</p>
                <p>Calories: {original.calories}</p>
                <p>Fat: {original.fat}g</p>
                <p>Carbs: {original.carbs}g</p>
                <p>Protein: {original.protein}g</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="font-medium text-gray-700 mb-1">Substitute</p>
                <p>Calories: {substitute.calories}</p>
                <p>Fat: {substitute.fat}g</p>
                <p>Carbs: {substitute.carbs}g</p>
                <p>Protein: {substitute.protein}g</p>
              </div>
            </div>

            <div className="mt-3">
              {calDelta && statBadge("Cal Δ", `${calDelta.label}`, toneFor(calDelta))}
              {fatDelta && statBadge("Fat Δ(g)", `${fatDelta.label}`, toneFor(fatDelta))}
              {carbDelta && statBadge("Carb Δ(g)", `${carbDelta.label}`, toneFor(carbDelta))}
              {proteinDelta && statBadge("Protein Δ(g)", `${proteinDelta.label}`, toneFor(proteinDelta))}
            </div>
          </>
        )}

        {item.notes && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start">
              <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-blue-800">{item.notes}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Ingredient Substitutions</h1>
          <p className="text-gray-600">
            Find reliable ingredient substitutions with smart ratios and cooking notes.
          </p>
        </div>

        <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try: butter, eggs, milk, sour cream…"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              aria-label="Ingredient to substitute"
            />
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            {["butter", "eggs", "milk", "sour cream", "heavy cream"].map((ex) => (
              <button
                type="button"
                key={ex}
                onClick={() => setQuery(ex)}
                className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full hover:bg-orange-200 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-orange-600 text-white font-medium hover:bg-orange-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Find Substitutes
            </button>
          </div>

          {err && (
            <div className="mt-4 p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
              {err}
            </div>
          )}
        </form>

        {/* Primary Results */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          {subs.length === 0 && !loading ? (
            <div className="text-center py-10">
              <Lightbulb className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-700">No suggestions yet. Try searching above.</p>
            </div>
          ) : (
            <>
              {subs.length > 0 && (
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Substitutions for "{query}"
                  </h2>
                  <p className="text-sm text-gray-600">
                    Source: {source === "spoonacular" ? "Spoonacular API" : 
                             source === "database" ? "Our Database" : 
                             source === "ai" ? "AI Generated" : "Multiple Sources"}
                  </p>
                </div>
              )}
              <div className="space-y-5">
                {subs.map(renderSubstitutionCard)}
              </div>
            </>
          )}

          {/* AI Search Button */}
          {subs.length > 0 && !showAiResults && (
            <div className="mt-6 text-center">
              <button
                onClick={handleAiSearch}
                disabled={aiLoading || !query.trim()}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {aiLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Get Creative AI Suggestions
              </button>
            </div>
          )}
        </div>

        {/* AI Results */}
        {showAiResults && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
                Creative AI Suggestions
              </h2>
              <p className="text-sm text-gray-600">
                AI-generated creative alternatives and substitutions
              </p>
            </div>

            {aiError && (
              <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
                {aiError}
              </div>
            )}

            {aiSubs.length === 0 && !aiLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No AI suggestions available.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {aiSubs.map(renderSubstitutionCard)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
