// client/src/pages/potent-potables/index.tsx
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, LayoutGrid, List, Info } from "lucide-react";

type ViewMode = "grid" | "list";

type DrinkLite = {
  idDrink: string;
  strDrink: string;
  strDrinkThumb: string | null;
};

type DrinkFull = DrinkLite & {
  strAlcoholic?: string | null;
  strCategory?: string | null;
  strGlass?: string | null;
  strInstructions?: string | null;
  [k: string]: any;
};

const API = "https://www.thecocktaildb.com/api/json/v1/1";

// --------- helpers ----------
async function j<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

function normalizeList(arr?: { strCategory?: string; strAlcoholic?: string; strGlass?: string; strIngredient1?: string }[] | null) {
  if (!arr) return [];
  return arr
    .map((o) => o.strCategory ?? o.strAlcoholic ?? o.strGlass ?? o.strIngredient1)
    .filter(Boolean) as string[];
}

function extractIngredients(d: any) {
  const out: { name: string; measure?: string | null }[] = [];
  for (let i = 1; i <= 15; i++) {
    const name = d[`strIngredient${i}`];
    const measure = d[`strMeasure${i}`];
    if (name) out.push({ name, measure });
  }
  return out;
}

function dedupe(list: DrinkLite[]) {
  const seen = new Set<string>();
  return list.filter((d) => (seen.has(d.idDrink) ? false : (seen.add(d.idDrink), true)));
}

// --------- queries ----------
function useOptions() {
  const alcQ = useQuery({
    queryKey: ["pp:alcoholic"],
    queryFn: async () => normalizeList((await j<{ drinks: any[] }>(`${API}/list.php?a=list`)).drinks),
    staleTime: 60_000,
  });
  const catQ = useQuery({
    queryKey: ["pp:category"],
    queryFn: async () => normalizeList((await j<{ drinks: any[] }>(`${API}/list.php?c=list`)).drinks),
    staleTime: 60_000,
  });
  const glassQ = useQuery({
    queryKey: ["pp:glass"],
    queryFn: async () => normalizeList((await j<{ drinks: any[] }>(`${API}/list.php?g=list`)).drinks),
    staleTime: 60_000,
  });
  const ingQ = useQuery({
    queryKey: ["pp:ingredient"],
    queryFn: async () => normalizeList((await j<{ drinks: any[] }>(`${API}/list.php?i=list`)).drinks),
    staleTime: 60_000,
  });

  return {
    alcoholic: alcQ.data ?? [],
    categories: catQ.data ?? [],
    glasses: glassQ.data ?? [],
    ingredients: ingQ.data ?? [],
    loading: alcQ.isLoading || catQ.isLoading || glassQ.isLoading || ingQ.isLoading,
  };
}

function useDrinks(params: { q: string; alcoholic?: string | null; category?: string | null; glass?: string | null; ingredient?: string | null }) {
  const { q, alcoholic, category, glass, ingredient } = params;

  return useQuery({
    queryKey: ["pp:search", q, alcoholic, category, glass, ingredient],
    queryFn: async (): Promise<DrinkLite[]> => {
      const pools: DrinkLite[][] = [];
      const text = q.trim();

      if (text) {
        const r = await j<{ drinks: DrinkLite[] | null }>(`${API}/search.php?s=${encodeURIComponent(text)}`);
        pools.push(r.drinks ?? []);
      }
      if (alcoholic) {
        const r = await j<{ drinks: DrinkLite[] | null }>(`${API}/filter.php?a=${encodeURIComponent(alcoholic)}`);
        pools.push(r.drinks ?? []);
      }
      if (category) {
        const r = await j<{ drinks: DrinkLite[] | null }>(`${API}/filter.php?c=${encodeURIComponent(category)}`);
        pools.push(r.drinks ?? []);
      }
      if (glass) {
        const r = await j<{ drinks: DrinkLite[] | null }>(`${API}/filter.php?g=${encodeURIComponent(glass)}`);
        pools.push(r.drinks ?? []);
      }
      if (ingredient) {
        const r = await j<{ drinks: DrinkLite[] | null }>(`${API}/filter.php?i=${encodeURIComponent(ingredient)}`);
        pools.push(r.drinks ?? []);
      }

      if (pools.length === 0) {
        // default showcase
        const r = await j<{ drinks: DrinkLite[] | null }>(`${API}/search.php?s=margarita`);
        return dedupe(r.drinks ?? []);
      }

      // intersect results by id
      const sets = pools.map((arr) => new Set(arr.map((d) => d.idDrink)));
      const common = sets.reduce((acc, s) => new Set([...acc].filter((x) => s.has(x))));
      const map = new Map<string, DrinkLite>();
      pools.forEach((arr) => arr.forEach((d) => map.set(d.idDrink, d)));
      const result: DrinkLite[] = [];
      common.forEach((id) => {
        const d = map.get(id);
        if (d) result.push(d);
      });
      return dedupe(result);
    },
  });
}

function useDetails(idDrink: string | null) {
  return useQuery({
    enabled: !!idDrink,
    queryKey: ["pp:details", idDrink],
    queryFn: async (): Promise<DrinkFull | null> => {
      if (!idDrink) return null;
      const r = await j<{ drinks: DrinkFull[] | null }>(`${API}/lookup.php?i=${idDrink}`);
      return r.drinks?.[0] ?? null;
    },
  });
}
// --------- page ----------
export default function PotentPotablesPage() {
  const [view, setView] = React.useState<ViewMode>("grid");
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [alcoholic, setAlcoholic] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<string | null>(null);
  const [glass, setGlass] = React.useState<string | null>(null);
  const [ingredient, setIngredient] = React.useState<string | null>(null);
  const [openDetailsId, setOpenDetailsId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const opts = useOptions();
  const { data: results = [], isLoading, isError, error } = useDrinks({
    q: debouncedQ,
    alcoholic,
    category,
    glass,
    ingredient,
  });
  const { data: details } = useDetails(openDetailsId);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold">Potent Potables</h1>
        <Badge variant="secondary" className="text-xs">21+ only</Badge>
      </div>

      <Card className="mb-4">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            Browse cocktails, mocktails, and more. Use filters to narrow by alcoholic type, category, glass, or ingredient.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by drink name (e.g., Margarita)"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant={view === "grid" ? "default" : "outline"} onClick={() => setView("grid")}>
            <LayoutGrid className="h-4 w-4 mr-2" /> Grid
          </Button>
          <Button variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}>
            <List className="h-4 w-4 mr-2" /> List
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {["Alcoholic", "Non_Alcoholic", "Optional_alcohol"].map((label) => {
          const active = alcoholic === label;
          return (
            <Badge
              key={label}
              variant={active ? "default" : "outline"}
              onClick={() => setAlcoholic(active ? null : label)}
              className="cursor-pointer"
            >
              {label.replace("_", " ")}
            </Badge>
          );
        })}
        {alcoholic && (
          <Button size="sm" variant="ghost" onClick={() => setAlcoholic(null)}>
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Select value={category ?? ""} onValueChange={(v) => setCategory(v || null)}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any</SelectItem>
            {opts.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={glass ?? ""} onValueChange={(v) => setGlass(v || null)}>
          <SelectTrigger><SelectValue placeholder="Glass" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any</SelectItem>
            {opts.glasses.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={ingredient ?? ""} onValueChange={(v) => setIngredient(v || null)}>
          <SelectTrigger><SelectValue placeholder="Ingredient" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="">Any</SelectItem>
            {opts.ingredients.slice(0, 200).map((ing) => <SelectItem key={ing} value={ing}>{ing}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isError && <Card className="mb-4"><CardContent className="py-6 text-red-600">Error loading drinks: {(error as Error)?.message}</CardContent></Card>}

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square rounded-md bg-muted animate-pulse" />)}
        </div>
      ) : results.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No drinks match your filters.</CardContent></Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {results.map((d) => (
            <button key={d.idDrink} onClick={() => setOpenDetailsId(d.idDrink)} className="text-left">
              <Card className="h-full">
                <CardContent className="p-0">
                  <div className="aspect-square overflow-hidden rounded-t-md bg-muted">
                    {d.strDrinkThumb ? <img src={d.strDrinkThumb} alt={d.strDrink} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-muted-foreground"><Info className="h-6 w-6" /></div>}
                  </div>
                </CardContent>
                <CardHeader className="py-3"><CardTitle className="text-sm line-clamp-2">{d.strDrink}</CardTitle></CardHeader>
              </Card>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((d) => (
            <button key={d.idDrink} onClick={() => setOpenDetailsId(d.idDrink)} className="w-full text-left">
              <Card><CardContent className="p-3 flex items-center gap-3">
                <div className="w-16 h-16 overflow-hidden rounded bg-muted flex-shrink-0">
                  {d.strDrinkThumb && <img src={d.strDrinkThumb} alt={d.strDrink} className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{d.strDrink}</div>
                  <div className="text-xs text-muted-foreground truncate">Tap for details</div>
                </div>
              </CardContent></Card>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!openDetailsId} onOpenChange={(v) => !v && setOpenDetailsId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>{details?.strDrink ?? "Drink Details"}</SheetTitle></SheetHeader>
          {!details ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="p-4 space-y-4">
              {details.strDrinkThumb && <div className="w-full overflow-hidden rounded-md"><img src={details.strDrinkThumb} alt={details.strDrink} className="w-full h-auto" /></div>}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {details.strAlcoholic && <div><span className="text-muted-foreground">Alcoholic:</span> {details.strAlcoholic}</div>}
                {details.strCategory && <div><span className="text-muted-foreground">Category:</span> {details.strCategory}</div>}
                {details.strGlass && <div><span className="text-muted-foreground">Glass:</span> {details.strGlass}</div>}
              </div>
              <div>
                <div className="font-semibold mb-1 text-sm">Ingredients</div>
                <ul className="list-disc pl-5 text-sm space-y-0.5">
                  {details && extractIngredients(details).map((it, i) => <li key={i}>{it.name}{it.measure ? ` — ${it.measure}` : ""}</li>)}
                </ul>
              </div>
              {details?.strInstructions && (
                <div>
                  <div className="font-semibold mb-1 text-sm">Instructions</div>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{details.strInstructions}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}


