// client/src/components/Pantry.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  X,
  Clock,
  Search,
  ChefHat,
  Barcode,
  Check,
  Minus,
  Plus as PlusIcon,
  Trash2,
  ShoppingCart,
  Settings,
} from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";
import { fetchOpenFoodFactsByBarcode, type PantryCandidate } from "@/lib/openFoodFacts";

// ---------- helpers ----------
function formatQty(qty: number | null | undefined, unit: string | null | undefined) {
  if (qty == null || !isFinite(qty)) return null;
  const u = (unit || "").toLowerCase();
  if (u === "ml") return qty >= 1000 ? `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 1)} L` : `${qty} ml`;
  if (u === "g") return qty >= 1000 ? `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 1)} kg` : `${qty} g`;
  if (u === "l" || u === "kg") return `${qty} ${u}`;
  if (["piece", "pcs", "count"].includes(u)) {
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

type ShoppingItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  checked?: boolean;
  // optional metadata
  brand?: string;
  upc?: string;
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

type ActiveTab = "pantry" | "suggestions" | "shopping";

export default function Pantry() {
  const [pantryItems, setPantryItems] = useState<APIPantryItem[]>([]);
  const [recipeSuggestions, setRecipeSuggestions] = useState<RecipeSuggestion[]>([]);
  const [newItem, setNewItem] = useState({ ...defaultNewItem });
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("pantry");

  // Scanner UI
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  // Scanner mode: prefill or autosave
  const [scannerMode, setScannerMode] = useState<"prefill" | "autosave">("prefill");

  // Prefill meta (optional fields we pass through)
  const [prefillMeta, setPrefillMeta] = useState<{ brand?: string; upc?: string } | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // --- Shopping list state ---
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [shoppingError, setShoppingError] = useState<string | null>(null);

  useEffect(() => {
    fetchPantryItems();
    fetchRecipeSuggestions();
    loadShopping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Pantry + Suggestions ----------
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

  // ---------- Shopping List (API w/ localStorage fallback) ----------
  const LS_KEY = "shoppingList_v1";

  async function loadShopping() {
    setShoppingLoading(true);
    setShoppingError(null);
    try {
      const res = await fetch("/api/shopping-list", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) {
        const list = (await res.json()) as ShoppingItem[];
        setShopping(list);
        localStorage.setItem(LS_KEY, JSON.stringify(list));
        return;
      }
      // If 404 or not ok, fallback
      const raw = localStorage.getItem(LS_KEY);
      setShopping(raw ? JSON.parse(raw) : []);
    } catch (e) {
      const raw = localStorage.getItem(LS_KEY);
      setShopping(raw ? JSON.parse(raw) : []);
    } finally {
      setShoppingLoading(false);
    }
  }

  function persistLocal(list: ShoppingItem[]) {
    setShopping(list);
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  }

  async function upsertShopping(list: ShoppingItem[]) {
    // Try API; if it fails, persist locally
    try {
      const res = await fetch("/api/shopping-list", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(list),
      });
      if (res.ok) {
        const saved = (await res.json()) as ShoppingItem[];
        setShopping(saved);
        localStorage.setItem(LS_KEY, JSON.stringify(saved));
        return;
      }
      persistLocal(list);
    } catch {
      persistLocal(list);
    }
  }

  function addToShopping(item: Omit<ShoppingItem, "id">) {
    const newItem: ShoppingItem = { ...item, id: crypto.randomUUID() };
    const next = [...shopping, newItem];
    upsertShopping(next);
  }

  function toggleShoppingChecked(id: string) {
    const next = shopping.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i));
    upsertShopping(next);
  }

  function removeShopping(id: string) {
    const next = shopping.filter((i) => i.id !== id);
    upsertShopping(next);
  }

  function updateShoppingQty(id: string, delta: number) {
    const next = shopping.map((i) =>
      i.id === id ? { ...i, quantity: Math.max(0, (i.quantity ?? 0) + delta) } : i
    );
    upsertShopping(next);
  }

  // Add missing ingredient from suggestion
  function addMissingToShopping(name: string) {
    addToShopping({ name, quantity: 1, unit: "piece" });
  }

  // Add pantry row to shopping list (for restock)
  function restockPantryItem(item: APIPantryItem) {
    addToShopping({
      name: item.name,
      quantity: Math.max(1, Math.round(item.quantity ?? 1)),
      unit: item.unit || "piece",
      category: item.category,
    });
  }

  // ---------- Scan handling ----------
  async function handleBarcodeDetected(code: string) {
    setScanError(null);
    try {
      const candidate = await fetchOpenFoodFactsByBarcode(code);
      if (!candidate) {
        setScanError("Couldn’t recognize that barcode. Try again or add manually.");
        return;
      }

      if (scannerMode === "prefill") {
        // Prefill form for manual confirmation
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
        setTimeout(() => nameInputRef.current?.focus(), 0);
      } else {
        // Autosave directly to pantry
        const payload = {
          name: candidate.name || "Unknown product",
          category: candidate.category || "pantry",
          quantity: candidate.quantity ?? 1,
          unit: candidate.unit || "piece",
          expirationDate: null,
          brand: candidate.brand,
          upc: candidate.upc,
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
          setPantryItems((prev) => [item, ...prev]);
          fetchRecipeSuggestions();
          setScanning(false);
        } else {
          // fallback to prefill if autosave fails
          setNewItem({
            name: payload.name,
            category: payload.category,
            quantity: payload.quantity,
            unit: payload.unit,
            expirationDate: "",
          });
          setPrefillMeta({ brand: candidate.brand, upc: candidate.upc });
          setShowAddForm(true);
          setScanning(false);
          setTimeout(() => nameInputRef.current?.focus(), 0);
        }
      }
    } catch (e) {
      console.error(e);
      setScanError("We hit a snag reading that code. Try again.");
    }
  }

  // ---------- UI ----------
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
        <div className="mb-8 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">My Pantry</h1>
            <p className="text-gray-600">Manage your ingredients, plan groceries, and discover recipes</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Scanner mode switch */}
            <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
              <Settings className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">Scanner mode</span>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => setScannerMode("prefill")}
                  className={`px-2 py-1 rounded ${scannerMode === "prefill" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
                  aria-pressed={scannerMode === "prefill"}
                >
                  Prefill form
                </button>
                <button
                  onClick={() => setScannerMode("autosave")}
                  className={`px-2 py-1 rounded ${scannerMode === "autosave" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
                  aria-pressed={scannerMode === "autosave"}
                >
                  Autosave
                </button>
              </div>
            </div>

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
          <button
            onClick={() => setActiveTab("shopping")}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "shopping" ? "bg-orange-500 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <ShoppingCart className="w-4 h-4 inline mr-2" />
            Shopping List ({shopping.filter((i) => !i.checked).length})
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
                    <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900 capitalize">
                        {category} ({items.length})
                      </h3>
                      <button
                        className="text-sm text-gray-600 hover:text-gray-900 underline"
                        onClick={() =>
                          items.forEach((i) =>
                            addToShopping({
                              name: i.name,
                              quantity: Math.max(1, Math.round(i.quantity ?? 1)),
                              unit: i.unit || "piece",
                              category: i.category,
                            })
                          )
                        }
                        title="Add all to shopping list"
                      >
                        Add all to shopping
                      </button>
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
                              <p className="text-sm text-gray-600 mb-3">{qtyStr ? qtyStr : "—"}</p>
                              {pill && (
                                <div
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${pill.cls}`}
                                >
                                  <Clock className="w-3 h-3 mr-1" />
                                  {pill.text}
                                </div>
                              )}

                              <div className="mt-4 flex gap-2">
                                <button
                                  onClick={() => restockPantryItem(item)}
                                  className="px-3 py-1.5 text-sm rounded bg-gray-900 text-white hover:bg-black"
                                  title="Add to shopping list"
                                >
                                  Restock
                                </button>
                                <button
                                  onClick={() =>
                                    addToShopping({
                                      name: item.name,
                                      quantity: 1,
                                      unit: item.unit || "piece",
                                      category: item.category,
                                    })
                                  }
                                  className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50"
                                >
                                  Add 1 to shopping
                                </button>
                              </div>
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
                            {recipe.missingIngredients.slice(0, 6).map((ingredient, i) => (
                              <button
                                key={i}
                                onClick={() => addMissingToShopping(ingredient)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs rounded-full"
                                title="Add to shopping"
                              >
                                <Plus className="w-3 h-3" />
                                {ingredient}
                              </button>
                            ))}
                            {recipe.missingIngredients.length > 6 && (
                              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                +{recipe.missingIngredients.length - 6} more
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

        {/* SHOPPING LIST */}
        {activeTab === "shopping" && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Shopping List</h3>
              <div className="text-sm text-gray-600">
                {shopping.filter((i) => !i.checked).length} to buy • {shopping.length} total
              </div>
            </div>

            <div className="p-4">
              {/* quick add row */}
              <QuickAdd onAdd={(name) => addToShopping({ name, quantity: 1, unit: "piece" })} />

              {shoppingLoading ? (
                <div className="text-center py-8 text-gray-500">Loading list…</div>
              ) : shopping.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  Your list is empty. Add items from pantry/suggestions or use Quick Add.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {shopping.map((item) => (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-3 flex items-center justify-between ${
                        item.checked ? "bg-gray-50 opacity-70" : "bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleShoppingChecked(item.id)}
                          className={`w-5 h-5 rounded border flex items-center justify-center ${
                            item.checked ? "bg-green-500 border-green-500 text-white" : "border-gray-300"
                          }`}
                          aria-label={item.checked ? "Uncheck" : "Check"}
                          title="Toggle purchased"
                        >
                          {item.checked && <Check className="w-3 h-3" />}
                        </button>
                        <div>
                          <div className="font-medium">
                            {item.name}
                            {item.brand && <span className="ml-2 text-xs text-gray-500">({item.brand})</span>}
                          </div>
                          <div className="text-xs text-gray-600">
                            {formatQty(item.quantity, item.unit) || "—"}
                            {item.category && ` • ${item.category}`}
                            {item.upc && ` • UPC: ${item.upc}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateShoppingQty(item.id, -1)}
                          className="p-1 rounded border hover:bg-gray-50"
                          title="Decrease"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => updateShoppingQty(item.id, +1)}
                          className="p-1 rounded border hover:bg-gray-50"
                          title="Increase"
                        >
                          <PlusIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeShopping(item.id)}
                          className="p-1 rounded border text-red-600 hover:bg-red-50"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

/** Quick Add inline component */
function QuickAdd({ onAdd }: { onAdd: (name: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <form
      className="mb-4 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!val.trim()) return;
        onAdd(val.trim());
        setVal("");
      }}
    >
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Quick add item (e.g., milk)"
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
      <button
        type="submit"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white hover:bg-black"
      >
        <Plus className="w-4 h-4" />
        Add
      </button>
    </form>
  );
}
