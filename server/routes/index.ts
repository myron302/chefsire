// client/src/constants/recipeFilters.ts

/** Basic flat filters */
export const MEAL_TYPES: string[] = [
  "Breakfast",
  "Brunch",
  "Lunch",
  "Dinner",
  "Snack",
  "Dessert",
  "Drink",
];

export const DIETS: string[] = [
  "Vegan",
  "Vegetarian",
  "Pescatarian",
  "Gluten-Free",
  "Keto",
  "Paleo",
  "Dairy-Free",
  "Low-Carb",
  "Low-Fat",
];

/** Dietary compliance / faith-based */
export const COMPLIANCE: string[] = ["Halal", "Kosher"];

/** Hierarchical cuisine tree
 *  Each node can have either "items" (leaf cuisines) or "children" (subgroups), or both.
 */
export type CuisineNode = {
  name: string;
  items?: string[];
  children?: CuisineNode[];
};

export const CUISINE_TREE: CuisineNode[] = [
  {
    name: "Africa",
    items: [
      "Moroccan",
      "Ethiopian",
      "Nigerian",
      "South African",
      "Tunisian",
      "Egyptian",
      "Ghanaian",
      "Kenyan",
    ],
  },
  {
    name: "The Americas",
    children: [
      {
        name: "United States",
        items: [
          "Alaskan",
          "New England",
          "Midwestern",
          "Southern",
          "Cajun",
          "Creole",
          "Soul Food",
          "Tex-Mex",
          "Southwestern",
          "Californian",
          "Pacific Northwest",
          "Hawaiian",
          "Barbecue",
        ],
      },
      {
        name: "Canada",
        items: ["Canadian", "Québécois", "Acadian", "First Nations"],
      },
      {
        name: "Mexico",
        items: ["Mexican", "Yucatán", "Oaxacan", "Jalisco", "Baja"],
      },
      {
        name: "Central America",
        items: [
          "Guatemalan",
          "Salvadoran",
          "Honduran",
          "Nicaraguan",
          "Costa Rican",
          "Panamanian",
        ],
      },
      {
        name: "Caribbean",
        items: [
          "Jamaican",
          "Cuban",
          "Puerto Rican",
          "Dominican",
          "Haitian",
          "Trinidadian",
          "Barbadian",
        ],
      },
      {
        name: "South America",
        items: [
          "Colombian",
          "Venezuelan",
          "Ecuadorian",
          "Peruvian",
          "Bolivian",
          "Chilean",
          "Argentine",
          "Brazilian",
          "Uruguayan",
          "Paraguayan",
        ],
      },
    ],
  },
  {
    name: "Asia",
    items: [
      "Chinese",
      "Japanese",
      "Korean",
      "Taiwanese",
      "Mongolian",
      "Thai",
      "Vietnamese",
      "Indonesian",
      "Malaysian",
      "Singaporean",
      "Filipino",
      "Burmese",
      "Cambodian",
      "Laotian",
      "Indian",
      "Pakistani",
      "Bangladeshi",
      "Sri Lankan",
      "Nepalese",
      "Tibetan",
    ],
  },
  {
    name: "Middle East",
    items: [
      "Turkish",
      "Persian",
      "Lebanese",
      "Syrian",
      "Jordanian",
      "Iraqi",
      "Israeli",
      "Palestinian",
      "Armenian",
      "Georgian",
      "Azerbaijani",
    ],
  },
  {
    name: "Europe",
    items: [
      "British",
      "Irish",
      "Scottish",
      "Welsh",
      "Swedish",
      "Norwegian",
      "Danish",
      "Finnish",
      "Icelandic",
      "Dutch",
      "German",
      "Austrian",
      "Swiss",
      "French",
      "Belgian",
      "Luxembourgish",
      "Italian",
      "Spanish",
      "Portuguese",
      "Greek",
      "Maltese",
      "Polish",
      "Czech",
      "Slovak",
      "Hungarian",
      "Romanian",
      "Bulgarian",
      "Croatian",
      "Bosnian",
      "Serbian",
      "Slovenian",
      "Montenegrin",
      "Albanian",
      "Ukrainian",
      "Lithuanian",
      "Latvian",
      "Estonian",
    ],
  },
  {
    name: "Oceania",
    items: ["Australian", "New Zealand", "Samoan", "Tongan", "Fijian", "Papua New Guinean"],
  },
  {
    name: "Mediterranean",
    items: ["Mediterranean"],
  },
];
// client/src/pages/Recipes.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MEAL_TYPES,
  DIETS,
  COMPLIANCE,
  CUISINE_TREE,
  type CuisineNode,
} from "@/constants/recipeFilters";

type RecipeItem = {
  id: string;
  title: string;
  imageUrl?: string | null;
  ingredients?: string[];
  instructions?: string[] | string;
  cookTime?: number | null;
  servings?: number | null;
  difficulty?: string | null;
  calories?: number | null;
  protein?: string | number | null;
  carbs?: string | number | null;
  fat?: string | number | null;
  fiber?: string | number | null;
  source?: "local" | "mealdb" | "spoonacular" | string;
};

type SearchResponse = {
  items: RecipeItem[];
  total?: number;
  source?: string;
};

function ensureArray<T>(v: T[] | T | undefined | null): T[] {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null) return [];
  return [v];
}

// Build a unique key from the node's trail for collapse state
function keyForTrail(trail: string[]) {
  return trail.join(" / ");
}

export default function RecipesPage() {
  // ------- UI state
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<RecipeItem[]>([]);

  // Filters
  const [openFilters, setOpenFilters] = useState(false);
  const [mealTypes, setMealTypes] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [compliance, setCompliance] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);

  // expand/collapse state for cuisine tree nodes
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});

  const toggleListValue = (
    list: string[],
    value: string,
    setter: (v: string[]) => void
  ) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const appliedFiltersSummary = useMemo(() => {
    const bits: string[] = [];
    if (mealTypes.length) bits.push(`${mealTypes.length} meal type${mealTypes.length > 1 ? "s" : ""}`);
    if (diets.length) bits.push(`${diets.length} diet${diets.length > 1 ? "s" : ""}`);
    if (compliance.length) bits.push(`${compliance.length} compliance`);
    if (cuisines.length) bits.push(`${cuisines.length} cuisine${cuisines.length > 1 ? "s" : ""}`);
    return bits.join(" • ");
  }, [mealTypes, diets, compliance, cuisines]);

  // ------- Fetch
  async function runSearch() {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (mealTypes.length) params.set("mealTypes", mealTypes.join(","));
      if (diets.length) params.set("diets", diets.join(","));
      if (compliance.length) params.set("compliance", compliance.join(",")); // NEW
      if (cuisines.length) params.set("cuisines", cuisines.join(","));

      const res = await fetch(`/api/recipes/search?${params.toString()}`);
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Request failed (${res.status})`);
      }
      const json: SearchResponse | RecipeItem[] = await res.json();
      const data = Array.isArray(json) ? json : ensureArray(json.items);
      setItems(data);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------- Cuisine tree renderers
  const toggleNodeOpen = (trail: string[]) => {
    const key = keyForTrail(trail);
    setOpenNodes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderCuisineNode = (node: CuisineNode, trail: string[] = []) => {
    const currentTrail = [...trail, node.name];
    const key = keyForTrail(currentTrail);
    const isOpen = !!openNodes[key];

    const hasChildren = ensureArray(node.children).length > 0;
    const hasItems = ensureArray(node.items).length > 0;

    return (
      <div key={key} className="border border-border rounded">
        <button
          type="button"
          onClick={() => toggleNodeOpen(currentTrail)}
          className="w-full text-left px-3 py-2 font-semibold hover:bg-muted flex items-center justify-between"
        >
          <span>{node.name}</span>
          <span aria-hidden>{isOpen ? "▾" : "▸"}</span>
        </button>

        {isOpen && (
          <div className="px-3 pb-3 pt-1 space-y-3">
            {hasItems && (
              <div className="flex flex-wrap gap-2">
                {ensureArray(node.items).map((c) => (
                  <button
                    key={`${key}::${c}`}
                    type="button"
                    onClick={() => toggleListValue(cuisines, c, setCuisines)}
                    className={[
                      "px-3 py-1 rounded border",
                      cuisines.includes(c)
                        ? "bg-primary text-white border-primary"
                        : "bg-background text-foreground border-border",
                    ].join(" ")}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {hasChildren && (
              <div className="space-y-3">
                {ensureArray(node.children).map((child) => renderCuisineNode(child, currentTrail))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ------- Render
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Recipes</h1>

        <div className="flex gap-2">
          <div className="flex w-72">
            <Input
              placeholder="Search recipes..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              aria-label="Search recipes"
            />
          </div>
          <Button onClick={runSearch} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
          <Button variant="outline" onClick={() => setOpenFilters((v) => !v)}>
            Filters {appliedFiltersSummary ? `(${appliedFiltersSummary})` : ""}
          </Button>
        </div>
      </div>

      {/* Filters drawer */}
      {openFilters && (
        <div className="mt-4 border rounded-lg p-4 bg-card border-border">
          {/* Meal types */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              Meal Types
            </div>
            <div className="flex flex-wrap gap-2">
              {ensureArray(MEAL_TYPES).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleListValue(mealTypes, m, setMealTypes)}
                  className={[
                    "px-3 py-1 rounded border",
                    mealTypes.includes(m)
                      ? "bg-primary text-white border-primary"
                      : "bg-background text-foreground border-border",
                  ].join(" ")}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Diets */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Diets</div>
            <div className="flex flex-wrap gap-2">
              {ensureArray(DIETS).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleListValue(diets, d, setDiets)}
                  className={[
                    "px-3 py-1 rounded border",
                    diets.includes(d)
                      ? "bg-primary text-white border-primary"
                      : "bg-background text-foreground border-border",
                  ].join(" ")}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Dietary Compliance */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              Dietary Compliance
            </div>
            <div className="flex flex-wrap gap-2">
              {ensureArray(COMPLIANCE).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleListValue(compliance, c, setCompliance)}
                  className={[
                    "px-3 py-1 rounded border",
                    compliance.includes(c)
                      ? "bg-primary text-white border-primary"
                      : "bg-background text-foreground border-border",
                  ].join(" ")}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Cuisines: regions → (subgroups) → items */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-3">
              Cuisines by Region
            </div>
            <div className="space-y-3">
              {ensureArray(CUISINE_TREE).map((node) => renderCuisineNode(node, []))}
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <Button onClick={runSearch} disabled={loading}>
              Apply
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setMealTypes([]);
                setDiets([]);
                setCompliance([]);
                setCuisines([]);
                setOpenNodes({});
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {err && (
        <div className="mt-4 p-3 text-sm rounded-md bg-red-50 text-red-700 border border-red-200">
          {err}
        </div>
      )}

      {/* Results */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading &&
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-56 rounded-lg bg-muted animate-pulse" />
          ))}

        {!loading && items.length === 0 && !err && (
          <div className="col-span-full text-muted-foreground">
            No recipes found. Try different filters or a broader search.
          </div>
        )}

        {!loading &&
          items.map((r) => (
            <article
              key={r.id}
              className="border border-border rounded-lg overflow-hidden bg-card"
            >
              {r.imageUrl ? (
                <img
                  src={r.imageUrl}
                  alt={r.title}
                  className="w-full h-40 object-cover bg-muted"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-40 bg-muted" />
              )}
              <div className="p-4">
                <h3 className="font-semibold line-clamp-2">{r.title}</h3>
                <div className="mt-2 text-xs text-muted-foreground">
                  {r.source ? `Source: ${r.source}` : ""}
                </div>

                <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
                  {r.cookTime ? <span>⏱ {r.cookTime}m</span> : null}
                  {r.servings ? <span>🍽 {r.servings}</span> : null}
                  {r.difficulty ? <span>⭐ {r.difficulty}</span> : null}
                </div>

                {ensureArray(r.ingredients).length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold mb-1">Ingredients</div>
                    <ul className="list-disc pl-5 text-sm space-y-0.5">
                      {ensureArray(r.ingredients)
                        .slice(0, 6)
                        .map((ing, i) => (
                          <li key={`${r.id}-ing-${i}`}>{String(ing)}</li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </article>
          ))}
      </div>
    </div>
  );
}
