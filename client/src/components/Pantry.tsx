// client/src/components/Pantry.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Clock, Search, ChefHat, Barcode } from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";
import { fetchOpenFoodFactsByBarcode, type PantryCandidate } from "@/lib/openFoodFacts";

// ---------- helpers: formatting & small utils ----------
function formatQty(qty: number | null | undefined, unit: string | null | undefined) {
  if (qty == null || !isFinite(qty)) return null;
  const u = (unit || "").toLowerCase();

  if (u === "ml") {
    if (qty >= 1000) return `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 1)} L`;
    return `${qty} ml`;
  }
  if (u === "g") {
    if (qty >= 1000) return `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 1)} kg`;
    return `${qty} g`;
  }
  if (u === "l" || u === "kg") return `${qty} ${u}`;
  if (u === "piece" || u === "pcs" || u === "count") {
    const n = Math.round(qty);
    return `${n} ${n === 1 ? "piece" : "pieces"}`;
  }
  return `${qty} ${unit ?? ""}`.trim();
}

type APIPantryItem = {
  id: string;
  name: string;
  category?: string;
  quantity?: number;
  unit?: string;
  expirationDate?: string | null;
};

type RecipeSuggestion = {
  id: string;
  title: string;
  description?: string;
  servings?: number;
  cookTime?: number;
  matchScore?: number;
  ingredientMatches?: number;
  totalIngredients?: number;
  missingCount?: number;
  missingIngredients: string[];
  canMake?: boolean;
  post?: { imageUrl?: string };
};

const CATEGORIES = [
  "produce",
  "dairy",
  "meat",
  "seafood",
  "grains",
  "spices",
  "pantry",
  "frozen",
  "canned",
  "beverages",
  "other",
] as const;

const UNITS = ["piece", "cup", "oz", "lb", "kg", "g", "ml", "l", "tsp", "tbsp"] as const;

const defaultNewItem = {
  name: "",
  category: "produce",
  quantity: 1,
  unit: "piece",
  expirationDate: "",
};

export default function Pantry() {
  const [pantryItems, setPantryItems] = useState<APIPantryItem[]>([]);
  const [recipeSuggestions, setRecipeSuggestions] = useState<RecipeSuggestion[]>([]);
  const [newItem, setNewItem] = useState({ ...defaultNewItem });
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"pantry" | "suggestions">("pantry");

  // Scanner UI
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Prefill meta (optional fields we pass through)
  const [prefillMeta, setPrefillMeta] = useState<{ brand?: string; upc?: string } | null>(null);

  // Focus name on prefill
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchPantryItems();
    fetchRecipeSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchPantryItems() {
    try {
      const res = await fetch("/api/pantry", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) {
        const items = (await res.json()) as APIPantryItem[];
        setPantryItems(items);
      }
    } catch (e) {
      console.error("Error fetching pantry items:", e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRecipeSuggestions() {
    try {
      const res = await fetch("/api/pantry/recipe-suggestions", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) {
        const suggestions = (await res.json()) as RecipeSuggestion[];
        setRecipeSuggestions(suggestions);
      }
    } catch (e) {
      console.error("Error fetching recipe suggestions:", e);
    }
  }

  async function addPantryItem() {
    try {
      const payload = {
        ...newItem,
        quantity: Number.isFinite(newItem.quantity) ? Number(newItem.quantity) : 1,
        unit: newItem.unit || "piece",
        expirationDate: newItem.expirationDate ? new Date(newItem.expirationDate) : null,
        // pass along prefill meta if present (backend may ignore gracefully)
        ...(prefillMeta ?? {}),
      };
      const res = await fetch("/api/pantry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const item = (await res.json()) as APIPantryItem;
        setPantryItems((prev) => [...prev, item]);
        setNewItem({ ...defaultNewItem });
        setPrefillMeta(null);
        setShowAddForm(false);
        fetchRecipeSuggestions();
      }
    } catch (e) {
      console.error("Error adding pantry item:", e);
    }
  }

  async function deletePantryItem(itemId: string) {
    try {
      const res = await fetch(`/api/pantry/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) {
        setPantryItems((prev) => prev.filter((i) => i.id !== itemId));
        fetchRecipeSuggestions();
      }
    } catch (e) {
      console.error("Error deleting pantry item:", e);
    }
  }

  function getDaysUntilExpiration(expirationDate?: string | null) {
    if (!expirationDate) return null;
    const today = new Date();
    const expiry = new Date(expirationDate);
    const diffTime = expiry.getTime() - today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  function getExpirationPill(days: number | null) {
    if (days == null) return null;
    if (days <= 0) return { text: "Expired", cls: "text-red-600 bg-red-50" };
    if (days === 1) return { text: "Expires tomorrow", cls: "text-orange-600 bg-orange-50" };
    if (days <= 3) return { text: `${days} days left`, cls: "text-orange-600 bg-orange-50" };
    if (days <= 7) return { text: `${days} days left`, cls: "text-yellow-600 bg-yellow-50" };
    return { text: `${days} days left`, cls: "text-gray-600 bg-gray-50" };
  }

  const grouped = useMemo(() => {
    const map = new Map<string, APIPantryItem[]>();
    for (const item of pantryItems) {
      const c = (item.category || "other").toLowerCase();
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [pantryItems]);

  // ---------- scan handling (PREFILL instead of autosave) ----------
  async function handleBarcodeDetected(code: string) {
    setScanError(null);
    try {
      const candidate = await fetchOpenFoodFactsByBarcode(code);
      if (!candidate) {
        setScanError("Couldn’t recognize that barcode. Try again or add manually.");
        return;
      }
      // Prefill the form with editable values
      setNewItem({
        name: candidate.name || "",
        category: candidate.category || "pantry",
        quantity: candidate.quantity ?? 1,
        unit: candidate.unit || "piece",
        expirationDate: "",
      });
      setPrefillMeta({ brand: candidate.brand, upc: candidate.upc });
      setShowAddForm(true);
      setScanning(false);
      // focus name for quick edits
      setTimeout(() => nameInputRef.current?.focus(), 0);
    } catch (e) {
      console.error(e);
      setScanError("We hit a snag reading that code. Try again.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading your pantry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Pantry</h1>
            <p className="text-gray-600">Manage your ingredients and discover recipes you can make</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setScanning(true);
                setScanError(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white hover:bg-black/90"
              title="Scan a barcode"
            >
              <Barcode className="w-4 h-4" />
              Scan barcode
            </button>
            <button
              onClick={() => {
                setPrefillMeta(null);
                setShowAddForm((v) => !v);
                setTimeout(() => nameInputRef.current?.focus(), 0);
              }}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors inline-flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add ingredient
            </button>
          </div>
        </div>

        {/* tabs */}
        <div className="flex space-x-1 mb-8 bg-white rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setActiveTab("pantry")}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "pantry" ? "bg-orange-500 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Search className="w-4 h-4 inline mr-2" />
            Pantry Items ({pantryItems.length})
          </button>
          <button
            onClick={() => setActiveTab("suggestions")}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "suggestions" ? "bg-orange-500 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <ChefHat className="w-4 h-4 inline mr-2" />
            Recipe Suggestions ({recipeSuggestions.length})
          </button>
        </div>

        {/* add form */}
        {activeTab === "pantry" && showAddForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            {/* Prefill badge */}
            {prefillMeta?.upc && (
              <div className="mb-4 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                <div className="text-emerald-800">
                  Prefilled from scan {prefillMeta.brand ? `(${prefillMeta.brand})` : ""} • UPC:{" "}
                  <span className="font-semibold">{prefillMeta.upc}</span>
                </div>
                <button
                  className="text-emerald-800/70 hover:text-emerald-900 underline"
                  onClick={() => setPrefillMeta(null)}
                >
                  detach
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ingredient Name</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g., Tomatoes"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newItem.quantity}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        quantity: Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={newItem.expirationDate}
                  onChange={(e) => setNewItem({ ...newItem, expirationDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="md:col-span-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setPrefillMeta(null);
                    setNewItem({ ...defaultNewItem });
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addPantryItem}
                  className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
                >
                  Save Item
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PANTRY LIST */}
        {activeTab === "pantry" && (
          <>
            {grouped.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Your pantry is empty</h3>
                <p className="text-gray-600">Add ingredients or scan barcodes to get started.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {grouped.map(([category, items]) => (
                  <div key={category} className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b">
                      <h3 className="text-lg font-medium text-gray-900 capitalize">
                        {category} ({items.length})
                      </h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map((item) => {
                          const days = getDaysUntilExpiration(item.expirationDate);
                          const pill = getExpirationPill(days);
                          const qtyStr = formatQty(item.quantity ?? null, item.unit ?? "");
                          return (
                            <div
                              key={item.id}
                              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium text-gray-900">{item.name}</h4>
                                <button
                                  onClick={() => deletePantryItem(item.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                  title="Remove"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{qtyStr ? qtyStr : "—"}</p>
                              {pill && (
                                <div
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${pill.cls}`}
                                >
                                  <Clock className="w-3 h-3 mr-1" />
                                  {pill.text}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* SUGGESTIONS */}
        {activeTab === "suggestions" && (
          <div>
            {recipeSuggestions.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No recipe suggestions yet</h3>
                <p className="text-gray-600">
                  Add more ingredients to your pantry to get personalized suggestions
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recipeSuggestions.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {recipe.post?.imageUrl && (
                      <img
                        src={recipe.post.imageUrl}
                        alt={recipe.title}
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{recipe.title}</h3>
                      {recipe.description && (
                        <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>
                      )}

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          {recipe.servings != null && <span>🍽️ {recipe.servings} servings</span>}
                          {recipe.cookTime != null && <span>⏱️ {recipe.cookTime}min</span>}
                        </div>
                        <div className="text-right">
                          {recipe.matchScore != null && (
                            <div className="text-sm font-medium text-green-600">
                              {recipe.matchScore.toFixed(0)}% match
                            </div>
                          )}
                          {recipe.ingredientMatches != null && recipe.totalIngredients != null && (
                            <div className="text-xs text-gray-500">
                              {recipe.ingredientMatches}/{recipe.totalIngredients} ingredients
                            </div>
                          )}
                        </div>
                      </div>

                      {recipe.missingCount && recipe.missingCount > 0 && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-600 mb-1">Missing ingredients:</p>
                          <div className="flex flex-wrap gap-1">
                            {recipe.missingIngredients.slice(0, 3).map((ingredient, i) => (
                              <span
                                key={i}
                                className="inline-block px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full"
                              >
                                {ingredient}
                              </span>
                            ))}
                            {recipe.missingIngredients.length > 3 && (
                              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                +{recipe.missingIngredients.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex space-x-2">
                        <button className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-600 transition-colors">
                          View Recipe
                        </button>
                        {recipe.canMake && (
                          <button className="px-4 py-2 bg-green-100 text-green-700 rounded-md text-sm font-medium hover:bg-green-200 transition-colors">
                            Can Make!
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scanner modal */}
      {scanning && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => {
            setScanError(null);
            setScanning(false);
          }}
        />
      )}

      {/* Scan status toast-ish */}
      {scanError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-4 py-2 rounded shadow">
          {scanError}
        </div>
      )}
    </div>
  );
}
