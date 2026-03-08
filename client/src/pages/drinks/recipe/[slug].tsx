import { useEffect } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import RequireAgeGate from "@/components/RequireAgeGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCanonicalDrinkRecipeBySlug } from "@/data/drinks/canonical";

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

function CanonicalDrinkRecipeContent({ slug }: { slug: string }) {
  const canonicalRecipe = getCanonicalDrinkRecipeBySlug(slug);

  useEffect(() => {
    if (!canonicalRecipe?.slug) return;

    fetch("/api/drinks/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        slug: canonicalRecipe.slug,
        eventType: "view",
      }),
    }).catch(() => {
      // Non-blocking analytics event.
    });
  }, [canonicalRecipe?.slug]);

  if (!canonicalRecipe) {
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

  const { recipe, name, sourceRoute, sourceTitle } = canonicalRecipe;
  const imageUrl = typeof recipe.image === "string" ? recipe.image : typeof recipe.imageUrl === "string" ? recipe.imageUrl : "";
  const ingredients = asList(recipe.ingredients);
  const instructionSteps = asList(recipe.instructions);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={sourceRoute}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to category
          </Button>
        </Link>
        <Badge variant="secondary">Canonical Recipe</Badge>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl">{name}</CardTitle>
          {recipe.description ? <p className="text-muted-foreground">{recipe.description}</p> : null}
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
              alt={name}
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
