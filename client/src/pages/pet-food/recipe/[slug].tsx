import React, { useEffect } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Clock, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCanonicalPetFoodRecipeBySlug } from "@/data/pet-food/canonical";
import { addRecentlyViewedPetFoodSlug } from "@/components/pet-food/RecentlyViewedPetFood";
import { postEngagementEvent } from "@/lib/engagement-events";

export default function PetFoodRecipePage() {
  const [, params] = useRoute("/pet-food/recipe/:slug");
  const slug = params?.slug ?? "";
  const recipe = getCanonicalPetFoodRecipeBySlug(slug);

  useEffect(() => {
    if (!slug || !recipe) return;

    addRecentlyViewedPetFoodSlug(slug);

    void postEngagementEvent("/api/pet-food/events", { slug, eventType: "view" });
  }, [slug, recipe]);

  if (!recipe) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-4">Recipe not found</h1>
        <p className="text-muted-foreground mb-6">We couldn't find that pet food recipe.</p>
        <Link href="/pet-food">
          <Button>Back to Pet Food</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href={recipe.sourceRoute}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to {recipe.sourceTitle}
          </Button>
        </Link>
        <Badge variant="secondary">Canonical Pet Food Recipe</Badge>
      </div>

      <Card>
        {recipe.image ? <img src={recipe.image} alt={recipe.name} className="w-full h-72 object-cover rounded-t-lg" /> : null}
        <CardHeader>
          <CardTitle className="text-3xl">{recipe.name}</CardTitle>
          <div className="text-sm text-muted-foreground">Source: {recipe.sourceTitle}</div>
          <div className="flex flex-wrap gap-2 pt-2">
            {recipe.metadata.category ? <Badge variant="outline">{recipe.metadata.category}</Badge> : null}
            {recipe.metadata.difficulty ? <Badge variant="outline">{recipe.metadata.difficulty}</Badge> : null}
            {recipe.metadata.prepTime ? <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />{recipe.metadata.prepTime} min</Badge> : null}
            {recipe.metadata.rating ? <Badge variant="outline" className="gap-1"><Star className="w-3 h-3" />{recipe.metadata.rating}</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-3">Ingredients</h2>
            <ul className="space-y-2 list-disc pl-5">
              {recipe.ingredients.map((ingredient) => (
                <li key={ingredient}>{ingredient}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-3">Instructions</h2>
            <ol className="space-y-2 list-decimal pl-5">
              {recipe.instructions.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
