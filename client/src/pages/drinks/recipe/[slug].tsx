import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import RequireAgeGate from "@/components/RequireAgeGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { addItemsToShoppingList } from "@/lib/shopping-list";
import { addRecentlyViewedDrinkSlug } from "@/components/drinks/RecentlyViewedDrinks";
import { getCanonicalDrinkRecipeBySlug } from "@/data/drinks/canonical";
import { postEngagementEvent } from "@/lib/engagement-events";

type UserDrinkRecipe = {
  slug: string;
  name: string;
  description?: string | null;
  ingredients: string[];
  instructions: string[];
  image?: string | null;
  category: string;
  subcategory?: string | null;
};

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|\./)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}


function logDrinkEvent(slug: string, eventType: "view" | "remix" | "grocery_add") {
  return postEngagementEvent(
    "/api/drinks/events",
    { slug, eventType },
    true
  );
}

function CanonicalDrinkRecipeContent({ slug }: { slug: string }) {
  const { toast } = useToast();
  const canonicalRecipe = getCanonicalDrinkRecipeBySlug(slug);
  const [userRecipe, setUserRecipe] = useState<UserDrinkRecipe | null>(null);
  const [userRecipeLoaded, setUserRecipeLoaded] = useState(false);

  useEffect(() => {
    if (canonicalRecipe) return;

    fetch(`/api/drinks/user/${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        setUserRecipe(payload?.recipe ?? null);
      })
      .catch(() => setUserRecipe(null))
      .finally(() => setUserRecipeLoaded(true));
  }, [canonicalRecipe, slug]);

  useEffect(() => {
    if (!slug) return;

    addRecentlyViewedDrinkSlug(slug);

    logDrinkEvent(slug, "view");
  }, [slug]);

  if (!canonicalRecipe && !userRecipe && userRecipeLoaded) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Recipe not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We couldn&apos;t find that drink recipe. Try browsing from the drinks hub.
            </p>
            <Link href="/drinks">
              <Button>Go to Drinks Hub</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canonicalRecipe && !userRecipe) {
    return <div className="container mx-auto px-4 py-10 max-w-3xl text-muted-foreground">Loading recipe...</div>;
  }

  const displayName = canonicalRecipe?.name ?? userRecipe?.name ?? "Drink Recipe";
  const sourceRoute = canonicalRecipe?.sourceRoute ?? `/drinks/${userRecipe?.category ?? "smoothies"}`;
  const sourceTitle = canonicalRecipe?.sourceTitle ?? "Community Recipes";

  const recipe = canonicalRecipe?.recipe;
  const imageUrl = (typeof recipe?.image === "string" ? recipe.image : typeof recipe?.imageUrl === "string" ? recipe.imageUrl : "") || userRecipe?.image || "";
  const ingredients = asList(recipe?.ingredients ?? userRecipe?.ingredients ?? []);
  const instructionSteps = asList(recipe?.instructions ?? userRecipe?.instructions ?? []);
  const description = recipe?.description ?? userRecipe?.description;
  const remixSourceSlug = canonicalRecipe?.slug ?? userRecipe?.slug;

  const addAllIngredients = async () => {
    const payload = ingredients
      .map((ingredient) => ({ name: ingredient, quantity: "1", unit: "", category: "From Recipe" }))
      .filter((item) => item.name.trim().length > 0);

    if (payload.length === 0) {
      toast({ title: "No ingredients found to add.", variant: "destructive" });
      return;
    }

    const result = await addItemsToShoppingList(payload);
    if (result.addedCount > 0) {
      logDrinkEvent(slug, "grocery_add");
      toast({ title: `Added ${result.addedCount} ingredient${result.addedCount === 1 ? "" : "s"} to shopping list.` });
      return;
    }

    toast({ title: "Ingredients are already in your shopping list." });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={sourceRoute}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to category
          </Button>
        </Link>
        <Badge variant="secondary">{canonicalRecipe ? "Canonical Recipe" : "ChefSire Community Recipe"}</Badge>
      </div>

      {remixSourceSlug ? (
        <div className="flex flex-wrap gap-2">
          <Link href={`/drinks/submit?remix=${encodeURIComponent(remixSourceSlug)}`} onClick={() => void logDrinkEvent(slug, "remix")}>
            <Button>Remix</Button>
          </Link>
          <Button variant="outline" onClick={addAllIngredients}>
            Add Ingredients to Shopping List
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl">{displayName}</CardTitle>
          {description ? <p className="text-muted-foreground">{description}</p> : null}
          <div className="text-sm text-muted-foreground">
            Category:{" "}
            <Link href={sourceRoute} className="underline underline-offset-2">
              {sourceTitle}
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={displayName}
              className="w-full max-h-[360px] object-cover rounded-lg border"
              loading="lazy"
            />
          ) : null}

          {ingredients.length > 0 ? (
            <section>
              <h2 className="font-semibold text-lg mb-2">Ingredients</h2>
              <ul className="list-disc pl-5 space-y-1">
                {ingredients.map((ingredient, index) => (
                  <li key={`${ingredient}-${index}`}>{ingredient}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {instructionSteps.length > 0 ? (
            <section>
              <h2 className="font-semibold text-lg mb-2">Instructions</h2>
              <ol className="list-decimal pl-5 space-y-1">
                {instructionSteps.map((step, index) => (
                  <li key={`${step}-${index}`}>{step}</li>
                ))}
              </ol>
            </section>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CanonicalDrinkRecipePage() {
  const [matched, params] = useRoute<{ slug: string }>("/drinks/recipe/:slug");
  const slug = matched ? String(params.slug ?? "") : "";
  const canonicalRecipe = getCanonicalDrinkRecipeBySlug(slug);
  const needsAgeGate = canonicalRecipe?.sourceRoute.startsWith("/drinks/potent-potables") ?? false;

  if (needsAgeGate) {
    return (
      <RequireAgeGate>
        <CanonicalDrinkRecipeContent slug={slug} />
      </RequireAgeGate>
    );
  }

  return <CanonicalDrinkRecipeContent slug={slug} />;
}
