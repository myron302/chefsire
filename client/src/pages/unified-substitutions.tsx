import * as React from "react";
import { Search, Lightbulb, Loader2, ArrowRight, Sparkles, Plus, Filter, X, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import SubstitutionCard from "@/components/SubstitutionCard";

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

type NutritionalGoal = "calories" | "fat" | "carbs" | "protein" | "all";

export default function UnifiedSubstitutions() {
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [catalogResults, setCatalogResults] = React.useState<SubstitutionItem[]>([]);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [fetchingSugg, setFetchingSugg] = React.useState(false);
  
  // AI-related state
  const [aiResults, setAiResults] = React.useState<AISubItem[]>([]);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [showAiButton, setShowAiButton] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);

  // Filter and goal state
  const [nutritionalGoal, setNutritionalGoal] = React.useState<NutritionalGoal>("all");
  const [selectedCuisine, setSelectedCuisine] = React.useState<string>("");
  const [dietaryRestrictions, setDietaryRestrictions] = React.useState<string[]>([]);

  // User contribution form state
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [formData, setFormData] = React.useState({
    originalIngredient: "",
    substituteIngredient: "",
    ratio: "",
    notes: "",
    category: ""
  });
  const [submittingForm, setSubmittingForm] = React.useState(false);

  // Quick examples (click to fill)
  const examples = [
    "milk", "2% milk", "sour cream", "buttermilk", "heavy cream",
    "yogurt", "eggs", "butter", "olive oil", "sugar"
  ];

  const cuisines = [
    "Italian", "French", "Asian", "Mexican", "Indian", "Mediterranean", 
    "American", "Thai", "Japanese", "Chinese"
  ];

  const dietaryOptions = [
    "vegan", "vegetarian", "dairy-free", "gluten-free", "nut-free", 
    "low-carb", "keto", "paleo", "kosher", "halal"
  ];

  const categories = [
    "dairy", "oils", "sweeteners", "baking", "vegan", "plant-based dairy", 
    "leavening", "spices", "proteins"
  ];

  // --- Fetch Helpers ---
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

  // --- Main search submit (catalog lookup) ---
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setCatalogResults([]);
    setAiResults([]);
    setAiError(null);
    setShowAiButton(false);
    setHasSearched(true);

    try {
      const pathIng = encodeURIComponent(q);
      const data = await fetchJSON<{ substitutions: SubstitutionItem[] }>(
        `/api/ingredients/${pathIng}/substitutions`
      );
      const results = Array.isArray(data.substitutions) ? data.substitutions : [];
      setCatalogResults(results);
      setShowAiButton(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
      setShowAiButton(true);
    } finally {
      setLoading(false);
    }
  }

  // --- AI search function ---
  async function handleAiSearch() {
    const q = query.trim();
    if (!q) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const pathIng = encodeURIComponent(q);
      const params = new URLSearchParams();
      if (selectedCuisine) params.append("cuisine", selectedCuisine);
      if (dietaryRestrictions.length > 0) {
        dietaryRestrictions.forEach(restriction => params.append("dietary", restriction));
      }
      
      const url = `/api/ingredients/${pathIng}/ai-substitutions${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" }
      });

      if (!res.ok) {
        throw new Error(`AI search failed: HTTP ${res.status}`);
      }

      const json = await res.json();
      const aiSubs = json.aiSubstitutions || json.substitutions || [];
      setAiResults(Array.isArray(aiSubs) ? aiSubs : []);
    } catch (err: any) {
      setAiError(err?.message || "AI search failed.");
    } finally {
      setAiLoading(false);
    }
  }

  // --- User contribution form ---
  async function handleSubmitContribution(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.originalIngredient || !formData.substituteIngredient || !formData.ratio) {
      return;
    }

    setSubmittingForm(true);
    try {
      const res = await fetch("/api/substitutions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        throw new Error(`Failed to submit: HTTP ${res.status}`);
      }

      // Reset form and close dialog
      setFormData({
        originalIngredient: "",
        substituteIngredient: "",
        ratio: "",
        notes: "",
        category: ""
      });
      setShowAddForm(false);
      
      // Optionally refresh results if it matches current search
      if (formData.originalIngredient.toLowerCase().includes(query.toLowerCase())) {
        handleSubmit();
      }
    } catch (err: any) {
      setError(`Failed to add substitution: ${err?.message || "Unknown error"}`);
    } finally {
      setSubmittingForm(false);
    }
  }

  // --- Filter results by nutritional goal ---
  const filterByGoal = (items: (SubstitutionItem | AISubItem)[]) => {
    if (nutritionalGoal === "all") return items;
    
    return items.filter(item => {
      const nutrition = item.nutrition;
      if (!nutrition?.original || !nutrition?.substitute) return true;
      
      const original = nutrition.original;
      const substitute = nutrition.substitute;
      
      switch (nutritionalGoal) {
        case "calories":
          return (substitute.calories || 0) < (original.calories || 0);
        case "fat":
          return (substitute.fat || 0) < (original.fat || 0);
        case "carbs":
          return (substitute.carbs || 0) < (original.carbs || 0);
        case "protein":
          return (substitute.protein || 0) > (original.protein || 0);
        default:
          return true;
      }
    });
  };

  const filteredCatalogResults = filterByGoal(catalogResults);
  const filteredAiResults = filterByGoal(aiResults);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Ingredient Substitutions
          </h1>
          <p className="text-gray-600">
            Find reliable swaps, contribute your own substitutions, and get AI-powered suggestions
            tailored to your dietary needs and nutritional goals.
          </p>
        </div>

        {/* Search and Filters Card */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Main Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for an ingredient to substitute..."
                  aria-label="Ingredient to substitute"
                  className="pl-10"
                />
              </div>

              {/* Suggestions */}
              {(fetchingSugg || suggestions.length > 0) && (
                <div className="space-y-2">
                  {fetchingSugg && (
                    <div className="text-xs text-gray-500">Looking for suggestions…</div>
                  )}
                  {!fetchingSugg && suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {suggestions.slice(0, 8).map((s) => (
                        <Button
                          key={s}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setQuery(s);
                            setTimeout(() => handleSubmit(), 0);
                          }}
                          className="text-xs"
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Nutritional Goal */}
                <div className="space-y-2">
                  <Label>Nutritional Goal</Label>
                  <Select value={nutritionalGoal} onValueChange={(value: NutritionalGoal) => setNutritionalGoal(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All substitutions</SelectItem>
                      <SelectItem value="calories">Save calories</SelectItem>
                      <SelectItem value="fat">Save fat</SelectItem>
                      <SelectItem value="carbs">Save carbs</SelectItem>
                      <SelectItem value="protein">More protein</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Cuisine */}
                <div className="space-y-2">
                  <Label>Cuisine (for AI suggestions)</Label>
                  <Select value={selectedCuisine} onValueChange={setSelectedCuisine}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any cuisine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any cuisine</SelectItem>
                      {cuisines.map(cuisine => (
                        <SelectItem key={cuisine} value={cuisine.toLowerCase()}>{cuisine}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dietary Restrictions */}
                <div className="space-y-2">
                  <Label>Dietary Restrictions</Label>
                  <div className="flex flex-wrap gap-1 min-h-[36px] p-2 border rounded-md">
                    {dietaryRestrictions.length === 0 ? (
                      <span className="text-sm text-gray-500">None selected</span>
                    ) : (
                      dietaryRestrictions.map(restriction => (
                        <Badge key={restriction} variant="secondary" className="text-xs">
                          {restriction}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 ml-1"
                            onClick={() => setDietaryRestrictions(prev => prev.filter(r => r !== restriction))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {dietaryOptions
                      .filter(option => !dietaryRestrictions.includes(option))
                      .slice(0, 5)
                      .map(option => (
                        <Button
                          key={option}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDietaryRestrictions(prev => [...prev, option])}
                          className="text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {option}
                        </Button>
                      ))}
                  </div>
                </div>
              </div>

              {/* Quick example chips */}
              <div className="space-y-2">
                <Label>Quick examples:</Label>
                <div className="flex gap-2 flex-wrap">
                  {examples.map((ex) => (
                    <Button
                      type="button"
                      key={ex}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setQuery(ex);
                        setTimeout(() => handleSubmit(), 0);
                      }}
                      className="text-xs"
                    >
                      {ex}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center">
                <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Substitution
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Your Substitution</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitContribution} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="original">Original Ingredient*</Label>
                        <Input
                          id="original"
                          value={formData.originalIngredient}
                          onChange={(e) => setFormData(prev => ({ ...prev, originalIngredient: e.target.value }))}
                          placeholder="e.g., butter"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="substitute">Substitute Ingredient*</Label>
                        <Input
                          id="substitute"
                          value={formData.substituteIngredient}
                          onChange={(e) => setFormData(prev => ({ ...prev, substituteIngredient: e.target.value }))}
                          placeholder="e.g., olive oil"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ratio">Ratio*</Label>
                        <Input
                          id="ratio"
                          value={formData.ratio}
                          onChange={(e) => setFormData(prev => ({ ...prev, ratio: e.target.value }))}
                          placeholder="e.g., 3/4 cup oil = 1 cup butter"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Tips, cooking notes, flavor changes..."
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={submittingForm}>
                          {submittingForm ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Add Substitution
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                <Button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-6"
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
                <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
                  {error}
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          {!hasSearched ? (
            <CardContent className="py-10 text-center">
              <Lightbulb className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-700">No results yet. Try searching above.</p>
            </CardContent>
          ) : (
            <CardContent className="space-y-6">
              {/* Catalog Results */}
              {filteredCatalogResults.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      From our catalog ({filteredCatalogResults.length} suggestion{filteredCatalogResults.length !== 1 ? "s" : ""})
                    </h3>
                    {nutritionalGoal !== "all" && (
                      <Badge variant="outline">
                        <Filter className="w-3 h-3 mr-1" />
                        Filtered for {nutritionalGoal} savings
                      </Badge>
                    )}
                  </div>
                  {filteredCatalogResults.map((item, idx) => (
                    <SubstitutionCard
                      key={`catalog-${item.substituteIngredient}-${idx}`}
                      substituteIngredient={item.substituteIngredient}
                      ratio={item.ratio}
                      category={item.category}
                      notes={item.notes}
                      nutrition={item.nutrition}
                    />
                  ))}
                </div>
              )}

              {/* AI Button */}
              {showAiButton && filteredAiResults.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-gray-600 mb-4">
                    {filteredCatalogResults.length === 0 
                      ? "No results found in our catalog." 
                      : "Need more ideas?"
                    }
                  </p>
                  <Button
                    onClick={handleAiSearch}
                    disabled={aiLoading}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {aiLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Try AI-powered suggestions
                  </Button>
                </div>
              )}

              {/* AI Error */}
              {aiError && (
                <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
                  AI Search Error: {aiError}
                </div>
              )}

              {/* AI Results */}
              {filteredAiResults.length > 0 && (
                <div className="space-y-4">
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
                        AI-powered suggestions ({filteredAiResults.length} suggestion{filteredAiResults.length !== 1 ? "s" : ""})
                      </h3>
                      {nutritionalGoal !== "all" && (
                        <Badge variant="outline">
                          <Filter className="w-3 h-3 mr-1" />
                          Filtered for {nutritionalGoal} savings
                        </Badge>
                      )}
                    </div>
                    {(selectedCuisine || dietaryRestrictions.length > 0) && (
                      <div className="flex gap-2 mt-2">
                        {selectedCuisine && (
                          <Badge variant="secondary">{selectedCuisine} cuisine</Badge>
                        )}
                        {dietaryRestrictions.map(restriction => (
                          <Badge key={restriction} variant="secondary">{restriction}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {filteredAiResults.map((item, idx) => (
                    <SubstitutionCard
                      key={`ai-${item.substituteIngredient}-${idx}`}
                      substituteIngredient={item.substituteIngredient}
                      ratio={item.ratio}
                      category={item.category}
                      notes={item.notes}
                      nutrition={item.nutrition}
                    />
                  ))}
                </div>
              )}

              {/* No results at all */}
              {filteredCatalogResults.length === 0 && filteredAiResults.length === 0 && !showAiButton && hasSearched && !loading && !aiLoading && (
                <div className="text-center py-10">
                  <Lightbulb className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-700">
                    No substitutions found{nutritionalGoal !== "all" ? ` that match your ${nutritionalGoal} goal` : ""}. 
                    Try searching for a different ingredient or adjusting your filters.
                  </p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}