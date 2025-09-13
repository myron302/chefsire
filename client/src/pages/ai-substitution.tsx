import React, { useEffect, useMemo, useState } from "react";
import { Search, Lightbulb, ShoppingCart, Loader2, ArrowRight } from "lucide-react";

type Nutrition = {
  calories: number;
  fat: number;     // g
  carbs: number;   // g
  protein: number; // g
};

type AISubItem = {
  substituteIngredient: string;
  ratio: string;
  category?: string;
  notes?: string;
  nutrition?: {
    original: Nutrition;
    substitute: Nutrition;
  };
};

type AIResponse = {
  query: string;
  substitutions: AISubItem[];
};

export default function AISubstitutionPage() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Safely read ?q= from the URL (no destructuring from route match)
  const initialQ = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("q") || "";
    } catch {
      return "";
    }
  }, []);

  useEffect(() => {
    if (initialQ) {
      setQuery(initialQ);
      void handleSearch(initialQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ]);

  async function handleSearch(q?: string) {
    const term = (q ?? query).trim();
    if (!term) return;
    setLoading(true);
    setErr(null);
    setData(null);

    try {
      const res = await fetch(`/api/ingredients/ai-substitution?q=${encodeURIComponent(term)}`);
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const json: AIResponse = await res.json();
      setData(json);
      // keep the URL in sync so sharing works
      const sp = new URLSearchParams(window.location.search);
      sp.set("q", term);
      const next = `${window.location.pathname}?${sp.toString()}`;
      window.history.replaceState({}, "", next);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong fetching AI substitutions.");
    } finally {
      setLoading(false);
    }
  }

  const hasNutrition = (item: AISubItem) =>
    !!item.nutrition?.original && !!item.nutrition?.substitute;

  const delta = (orig: number, sub: number) => {
    const diff = orig - sub; // positive => savings
    const sign = diff > 0 ? "-" : diff < 0 ? "+" : "±";
    return { diff, label: `${sign}${Math.abs(diff)}` };
  };

  const tone = (d?: { diff: number }) =>
    !d ? "neutral" : d.diff > 0 ? "positive" : d.diff < 0 ? "negative" : "neutral";

  const badge = (label: string, value: string | number, t: "neutral" | "positive" | "negative" = "neutral") => {
    const tones: Record<typeof t, string> = {
      neutral: "bg-gray-100 text-gray-800",
      positive: "bg-green-100 text-green-800",
      negative: "bg-red-100 text-red-800",
    };
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${tones[t]} mr-2 mb-2`}>
        {label}: {value}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Ingredient Substitutions</h1>
          <p className="text-gray-600">
            Ask for a substitute and get smart nutrition comparisons and cooking notes.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSearch();
          }}
          className="bg-white rounded-lg shadow-md p-6 mb-8"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try: butter, sour cream, heavy cream, eggs…"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            {["butter", "eggs", "milk", "heavy cream", "sour cream", "sugar"].map((ex) => (
              <button
                type="button"
                key={ex}
                onClick={() => {
                  setQuery(ex);
                  void handleSearch(ex);
                }}
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
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              Find Substitutes
            </button>
          </div>

          {err && (
            <div className="mt-4 p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
              {err}
            </div>
          )}
        </form>

        {data && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Substitutions for “{data.query}”
              </h2>
              <p className="text-sm text-gray-600">
                {data.substitutions.length} suggestion{data.substitutions.length !== 1 ? "s" : ""} found
              </p>
            </div>

            {data.substitutions.length === 0 ? (
              <div className="text-center py-10">
                <Lightbulb className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-700">No suggestions yet. Try another ingredient.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {data.substitutions.map((item, idx) => {
                  const original = item.nutrition?.original;
                  const substitute = item.nutrition?.substitute;

                  const calD = original && substitute ? delta(original.calories, substitute.calories) : null;
                  const fatD = original && substitute ? delta(original.fat, substitute.fat) : null;
                  const carbD = original && substitute ? delta(original.carbs, substitute.carbs) : null;
                  const protD = original && substitute ? delta(original.protein, substitute.protein) : null;

                  return (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{item.substituteIngredient}</h3>
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

                      {hasNutrition(item) && original && substitute && (
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
                            {calD && badge("Cal Δ", calD.label, tone(calD) as any)}
                            {fatD && badge("Fat Δ(g)", fatD.label, tone(fatD) as any)}
                            {carbD && badge("Carb Δ(g)", carbD.label, tone(carbD) as any)}
                            {protD && badge("Protein Δ(g)", protD.label, tone(protD) as any)}
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
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
