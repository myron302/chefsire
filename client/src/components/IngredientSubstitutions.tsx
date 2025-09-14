import * as React from "react";
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
  const examples = [
    "milk",
    "2% milk",
    "sour cream",
    "buttermilk",
    "heavy cream",
    "yogurt",
    "eggs",
    "butter",
  ];

  // --- Fetch Helpers (robust JSON parse, encodes query) ---
  async function fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
      const body = ct.includes("application/json")
        ? await res.json().catch(() => ({}))
        : await res.text().catch(() => "");
      const msg =
        typeof body === "string" && body
          ? body
          : (body && (body.error || body.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    if (ct.includes("application/json")) return (await res.json()) as T;
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
        const data = await fetchJSON<{ results: string[] }>(
          `/api/ingredients/substitutions/search?q=${enc}`
        );
        setSuggestions(Array.isArray(data.results) ? data.results : []);
      } catch {
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
      // Encode the path segment too — fixes "%" etc.
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Ingredient Substitutions
          </h1>
          <p className="text-gray-600">
            Find reliable swaps and ratios for common ingredients. Tip: you can
            search for <span className="font-medium">“2% milk”</span> now—
            percent signs are handled.
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
              {fetchingSugg && (
                <div className="text-xs text-gray-500">Looking for suggestions…</div>
              )}
              {!fetchingSugg && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.slice(0, 8).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setQuery(s);
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
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
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
