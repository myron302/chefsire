import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

type Drink = {
  id: string;
  sourceId: string;
  source: "cocktaildb";
  title: string;
  imageUrl?: string | null;
  instructions?: string | null;
  category?: string | null;
  alcoholic?: string | null;
  glass?: string | null;
  ingredients?: string[];
};

type Meta = {
  categories: string[];
  alcoholic: string[];
  glasses: string[];
  ingredients: string[];
};

export default function PotentPotablesPage() {
  const [q, setQ] = React.useState("");
  const [meta, setMeta] = React.useState<Meta | null>(null);
  const [category, setCategory] = React.useState<string>("");
  const [alcoholic, setAlcoholic] = React.useState<string>("");
  const [ingredient, setIngredient] = React.useState<string>("");
  const [items, setItems] = React.useState<Drink[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/drinks/meta");
        const j = await r.json();
        if (j?.ok) setMeta({ categories: j.categories, alcoholic: j.alcoholic, glasses: j.glasses, ingredients: j.ingredients });
      } catch {
        // ignore
      }
    })();
  }, []);

  async function runSearch() {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (ingredient) params.set("ingredient", ingredient);
      if (!q && ingredient === "" && category) params.set("category", category); // category only if no q/ingredient (CocktailDB limitation)
      if (!q && ingredient === "" && alcoholic) params.set("alcoholic", alcoholic);

      const r = await fetch(`/api/drinks/search?${params.toString()}`);
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      const arr = Array.isArray(j?.items) ? j.items : [];
      setItems(arr);
    } catch (e: any) {
      setErr(e?.message || "Search failed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    runSearch(); // initial (empty results until user searches or chooses a filter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Potent Potables</h1>
        <div className="flex gap-2">
          <div className="w-64">
            <Input
              placeholder="Search cocktails by name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              aria-label="Search cocktails"
            />
          </div>
          <Button onClick={runSearch} disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="w-56">
          <Select value={ingredient} onValueChange={setIngredient}>
            <SelectTrigger><SelectValue placeholder="Filter by ingredient" /></SelectTrigger>
            <SelectContent className="max-h-72 overflow-auto">
              {(meta?.ingredients || []).slice(0, 400).map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-56">
          <Select value={category} onValueChange={setCategory} disabled={!!q || !!ingredient}>
            <SelectTrigger><SelectValue placeholder="Category (no search active)" /></SelectTrigger>
            <SelectContent>
              {(meta?.categories || []).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-56">
          <Select value={alcoholic} onValueChange={setAlcoholic} disabled={!!q || !!ingredient}>
            <SelectTrigger><SelectValue placeholder="Alcoholic (no search active)" /></SelectTrigger>
            <SelectContent>
              {(meta?.alcoholic || []).map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={() => { setQ(""); setCategory(""); setAlcoholic(""); setIngredient(""); runSearch(); }}>
          Clear
        </Button>
      </div>

      {/* Error */}
      {err && (
        <div className="p-3 text-sm rounded-md bg-red-50 text-red-700 border border-red-200">
          {err}
        </div>
      )}

      {/* Results */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading &&
          [...Array(6)].map((_, i) => <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />)}

        {!loading && items.length === 0 && !err && (
          <div className="col-span-full text-muted-foreground">
            No drinks found. Try a different search or filter.
          </div>
        )}

        {!loading &&
          items.map((d) => (
            <Card key={d.id} className="overflow-hidden">
              {d.imageUrl ? (
                <a
                  href={`https://www.thecocktaildb.com/lookup.php?i=${encodeURIComponent(d.sourceId)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src={d.imageUrl} alt={d.title} className="w-full h-48 object-cover" loading="lazy" />
                </a>
              ) : (
                <div className="w-full h-48 bg-muted" />
              )}
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-snug line-clamp-2">{d.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    {d.alcoholic || ""}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {[d.category, d.glass].filter(Boolean).join(" • ")}
                </div>

                {Array.isArray(d.ingredients) && d.ingredients.length > 0 && (
                  <div className="text-sm">
                    <div className="font-semibold mb-1">Ingredients</div>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {d.ingredients.slice(0, 6).map((ing, i) => (
                        <li key={`${d.id}-ing-${i}`}>{ing}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {d.instructions && (
                  <div className="text-sm">
                    <div className="font-semibold mb-1">Instructions</div>
                    <p className="text-muted-foreground line-clamp-5">{d.instructions}</p>
                  </div>
                )}

                <div className="pt-1">
                  <a
                    href={`https://www.thecocktaildb.com/lookup.php?i=${encodeURIComponent(d.sourceId)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline"
                  >
                    View on TheCocktailDB
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
