// client/src/pages/drinks/potent-potables/index.tsx
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import RequireAgeGate from "@/components/RequireAgeGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Flame, Star, Share2, Heart, RefreshCw, Sparkles, GlassWater } from "lucide-react";

/** --- Types from TheCocktailDB --- */
type Cocktail = {
  idDrink: string;
  strDrink: string;
  strCategory: string | null;
  strAlcoholic: string | null; // "Alcoholic" | "Non alcoholic"
  strGlass: string | null;
  strInstructions: string | null;
  strDrinkThumb: string | null;
  [key: string]: string | null; // to allow strIngredientN / strMeasureN access
};

/** --- API helpers --- */
async function fetchRandomCocktail(): Promise<Cocktail> {
  const r = await fetch("https://www.thecocktaildb.com/api/json/v1/1/random.php");
  if (!r.ok) throw new Error("Failed to fetch random cocktail");
  const data = await r.json();
  if (!data?.drinks?.[0]) throw new Error("No cocktail found");
  return data.drinks[0] as Cocktail;
}

async function fetchNRandomCocktails(n = 3): Promise<Cocktail[]> {
  const arr = await Promise.all(Array.from({ length: n }, () => fetchRandomCocktail()));
  // De-dup by id just in case
  const map = new Map(arr.map((d) => [d.idDrink, d]));
  return Array.from(map.values());
}

/** --- Small helpers --- */
function getIngredients(drink: Cocktail) {
  const items: { name: string; measure?: string }[] = [];
  for (let i = 1; i <= 15; i++) {
    const name = drink[`strIngredient${i}`];
    const measure = drink[`strMeasure${i}`] ?? undefined;
    if (name && name.trim()) items.push({ name, measure });
  }
  return items;
}

export default function PotentPotables() {
  const [batchMode, setBatchMode] = React.useState(false);

  // Single cocktail
  const single = useQuery({
    queryKey: ["randomCocktail"],
    queryFn: fetchRandomCocktail,
    enabled: false, // only when user clicks
    refetchOnWindowFocus: false,
  });

  // Batch cocktails (e.g., 3 at once)
  const batch = useQuery({
    queryKey: ["randomCocktails", 3],
    queryFn: () => fetchNRandomCocktails(3),
    enabled: false,
    refetchOnWindowFocus: false,
  });

  const isLoading = single.isLoading || batch.isLoading || single.isFetching || batch.isFetching;
  const hasData = single.data || batch.data;

  return (
    <RequireAgeGate>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold flex items-center gap-3">
                  <GlassWater className="h-8 w-8" />
                  Potent Potables
                  <Badge className="bg-yellow-400 text-yellow-900 ml-2">21+</Badge>
                </h1>
                <p className="opacity-90">
                  Random cocktail generator backed by TheCocktailDB
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm opacity-80">Shake things up</div>
                <Progress value={hasData ? 100 : 15} className="w-32 h-2 mt-1 bg-white/30" />
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={batchMode ? "outline" : "secondary"}
                onClick={() => setBatchMode(false)}
                className={!batchMode ? "bg-white/20 hover:bg-white/30" : undefined}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Single Drink
              </Button>
              <Button
                size="sm"
                variant={batchMode ? "secondary" : "outline"}
                onClick={() => setBatchMode(true)}
                className={batchMode ? "bg-white/20 hover:bg-white/30" : undefined}
              >
                <Flame className="w-4 h-4 mr-2" />
                3 at Once
              </Button>
              <Button
                size="sm"
                onClick={() => (batchMode ? batch.refetch() : single.refetch())}
                disabled={isLoading}
                className="ml-auto"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="animate-spin w-4 h-4 mr-2" /> Fetching…
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" /> Generate
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Error */}
          {(single.error || batch.error) && (
            <Card className="mb-6 border-red-300 bg-red-50">
              <CardContent className="py-4 text-red-700">
                {single.error instanceof Error
                  ? single.error.message
                  : batch.error instanceof Error
                  ? batch.error.message
                  : "Something went wrong."}
              </CardContent>
            </Card>
          )}

          {/* Single result */}
          {!batchMode && single.data && (
            <CocktailCard drink={single.data} highlight />
          )}

          {/* Batch results */}
          {batchMode && batch.data && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {batch.data.map((d) => (
                <CocktailCard key={d.idDrink} drink={d} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!hasData && !isLoading && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Sparkles className="w-10 h-10 mx-auto mb-3 text-purple-500" />
                <h3 className="text-xl font-semibold mb-2">Ready to mix?</h3>
                <p className="text-muted-foreground mb-4">
                  Click <em>Generate</em> to pull a random cocktail.
                </p>
                <Button onClick={() => single.refetch()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </RequireAgeGate>
  );
}

/** --- Presentational Card --- */
function CocktailCard({ drink, highlight = false }: { drink: Cocktail; highlight?: boolean }) {
  const ingredients = React.useMemo(() => getIngredients(drink), [drink]);

  return (
    <Card className={highlight ? "ring-2 ring-purple-300" : undefined}>
      <div className="relative">
        {drink.strDrinkThumb && (
          <img
            src={drink.strDrinkThumb}
            alt={drink.strDrink ?? "Cocktail"}
            className="w-full h-56 object-cover"
            loading="lazy"
          />
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          {drink.strAlcoholic && (
            <Badge className="bg-purple-600 text-white">{drink.strAlcoholic}</Badge>
          )}
          {drink.strCategory && (
            <Badge variant="secondary">{drink.strCategory}</Badge>
          )}
          {drink.strGlass && <Badge variant="outline">{drink.strGlass}</Badge>}
        </div>
      </div>

      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{drink.strDrink}</span>
          <span className="flex items-center gap-2">
            <Button size="icon" variant="ghost" aria-label="Like">
              <Heart className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Share">
              <Share2 className="w-4 h-4" />
            </Button>
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Instructions */}
        {drink.strInstructions && (
          <div>
            <h4 className="font-semibold mb-1">Instructions</h4>
            <p className="text-sm text-muted-foreground">{drink.strInstructions}</p>
          </div>
        )}

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <div>
            <h4 className="font-semibold mb-1">Ingredients</h4>
            <ul className="list-disc list-inside text-sm">
              {ingredients.map((ing, i) => (
                <li key={i}>
                  {ing.measure ? `${ing.measure} ` : ""}
                  {ing.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tiny meta/footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Star className="w-3 h-3" /> Crowd fave
            </span>
            <span className="inline-flex items-center gap-1">
              <Flame className="w-3 h-3" /> On fire
            </span>
          </div>
          <span>ID: {drink.idDrink}</span>
        </div>
      </CardContent>
    </Card>
  );
}
