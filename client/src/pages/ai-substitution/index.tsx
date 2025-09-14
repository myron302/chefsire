// client/src/pages/ai-substitution/index.tsx
import React, { useState } from "react";
import { Search, Lightbulb, ShoppingCart, Loader2 } from "lucide-react";

type Nutrition = { calories: number; fat: number; carbs: number; protein: number };
type AISubItem = {
  substituteIngredient: string;
  ratio: string;
  category?: string;
  notes?: string;
  nutrition?: { original: Nutrition; substitute: Nutrition };
};

export default function AISubstitutionPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<AISubItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const term = q.trim();
    if (!term) return;

    setLoading(true);
    setErr(null);
    setItems(null);
    try {
      const url = `/api/ingredients/${encodeURIComponent(term)}/ai-substitutions`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Request failed: ${r.status}`);
      const json = await r.json();
      setItems(json.aiSubstitutions || []);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Ingredient Substitutions</h1>
          <p className="text-gray-600">Ask for a substitute and get smart nutrition comparisons and notes.</p>
        </div>

        <form onSubmit={go} className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Try: butter, sour cream, heavy cream, eggs…"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            {["butter", "eggs", "milk", "flour", "sour cream"].map((ex) => (
              <button
                type="button"
                key={ex}
                onClick={() => {
                  setQ(ex);
                  go();
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
              disabled={loading || !q.trim()}
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-orange-600 text-white font-medium hover:bg-orange-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lightbulb className="w-4 h-4 mr-2" />}
              Get AI Suggestions
            </button>
          </div>

          {err && <div className="mt-4 p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">{err}</div>}
        </form>

        {items && (
          <div className="bg-white rounded-lg shadow-md p-6">
            {items.length === 0 ? (
              <div className="text-center py-10">
                <Lightbulb className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-700">No AI suggestions yet. Try another ingredient.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {items.map((item, idx) => (
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

                    {item.nutrition && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-sm">
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="font-medium text-gray-700 mb-1">Original</p>
                          <p>Calories: {item.nutrition.original.calories}</p>
                          <p>Fat: {item.nutrition.original.fat}g</p>
                          <p>Carbs: {item.nutrition.original.carbs}g</p>
                          <p>Protein: {item.nutrition.original.protein}g</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                          <p className="font-medium text-gray-700 mb-1">Substitute</p>
                          <p>Calories: {item.nutrition.substitute.calories}</p>
                          <p>Fat: {item.nutrition.substitute.fat}g</p>
                          <p>Carbs: {item.nutrition.substitute.carbs}g</p>
                          <p>Protein: {item.nutrition.substitute.protein}g</p>
                        </div>
                      </div>
                    )}

                    {item.notes && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800">{item.notes}</p>
                      </div>
                    )}
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
