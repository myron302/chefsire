import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SpoonRating } from "@/components/SpoonRating";
import { Clock, Users } from "lucide-react";
import type { RecipeItem } from "../lib/recipeList.types";
import { getImage, getInstructionPreview, getSourceLabel } from "../lib/recipeDisplay";

export function RecipeCard({ r, onCardClick }: { r: RecipeItem; onCardClick: (recipe: RecipeItem) => void }) {
  const img = getImage(r);
  const preview = getInstructionPreview(r);
  const ImageEl = img ? (
    <img
      src={img}
      alt={r.title}
      className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
      loading="lazy"
      onClick={() => onCardClick(r)}
    />
  ) : (
    <div
      className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={() => onCardClick(r)}
    >
      No image
    </div>
  );
  const TitleEl = (
    <h3 className="font-semibold leading-snug line-clamp-2 cursor-pointer hover:underline" onClick={() => onCardClick(r)}>
      {r.title}
    </h3>
  );
  return (
    <Card className="overflow-hidden bg-card border border-border hover:shadow-md transition-shadow">
      {ImageEl}
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          {TitleEl}
          <SpoonRating value={r.averageRating ?? r.ratingSpoons ?? null} />
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {r.cookTime ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {r.cookTime} min
            </span>
          ) : null}
          {r.servings ? (
            <span className="inline-flex items-center gap-1">
              <Users className="w-4 h-4" />
              {r.servings} servings
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {r.cuisine ? <Badge variant="secondary">{r.cuisine}</Badge> : null}
          {r.mealType ? <Badge variant="outline">{r.mealType}</Badge> : null}
          <Badge variant="secondary">{getSourceLabel(r)}</Badge>
          {(r.dietTags || []).slice(0, 3).map((t) => (
            <Badge key={t} variant="outline" className="capitalize">
              {t}
            </Badge>
          ))}
        </div>
        {preview && <p className="text-sm text-muted-foreground mt-2 line-clamp-4">{preview}</p>}
        <div className="pt-1">
          <Button variant="outline" size="sm" onClick={() => onCardClick(r)} className="w-full">
            View Full Recipe
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
