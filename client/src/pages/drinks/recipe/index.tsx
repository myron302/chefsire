import { Link, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import RequireAgeGate from "@/components/RequireAgeGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCanonicalDrinkRecipeBySlug } from "@/data/drinks/canonical";

function CanonicalDrinkRecipeContent({ slug }: { slug: string }) {
  const canonicalRecipe = getCanonicalDrinkRecipeBySlug(slug);

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

  const { recipe, name, sourceRoute } = canonicalRecipe;
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const tags = Array.isArray(recipe.tags) ? recipe.tags : [];

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
            Source route: <Link href={sourceRoute} className="underline underline-offset-2">{sourceRoute}</Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {ingredients.length > 0 ? (
            <section>
              <h2 className="font-semibold text-lg mb-2">Ingredients</h2>
              <ul className="list-disc pl-5 space-y-1">
                {ingredients.map((ingredient, index) => (
                  <li key={`${String(ingredient)}-${index}`}>{String(ingredient)}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {recipe.instructions ? (
            <section>
              <h2 className="font-semibold text-lg mb-2">Instructions</h2>
              {Array.isArray(recipe.instructions) ? (
                <ol className="list-decimal pl-5 space-y-1">
                  {recipe.instructions.map((step, index) => (
                    <li key={`${String(step)}-${index}`}>{String(step)}</li>
                  ))}
                </ol>
              ) : (
                <p>{String(recipe.instructions)}</p>
              )}
            </section>
          ) : null}

          {tags.length > 0 ? (
            <section>
              <h2 className="font-semibold text-lg mb-2">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={String(tag)} variant="outline">{String(tag)}</Badge>
                ))}
              </div>
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
