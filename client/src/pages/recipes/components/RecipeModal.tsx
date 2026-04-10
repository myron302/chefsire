import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SpoonRating } from "@/components/SpoonRating";
import { RecipeReviews } from "@/components/RecipeReviews";
import { Clock, ExternalLink, Users } from "lucide-react";
import type { RecipeItem } from "../lib/recipeList.types";
import { extractInstructions, getImage, getSourceLabel, getSourceUrl } from "../lib/recipeDisplay";

export function RecipeModal({ r, isOpen, onClose }: { r: RecipeItem | null; isOpen: boolean; onClose: () => void }) {
  if (!isOpen || !r) return null;
  const fullInstructions = extractInstructions(r);
  const img = getImage(r);
  const sourceHref = getSourceUrl(r);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold">{r.title}</h2>
            <Button variant="ghost" onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </Button>
          </div>
          {img && <img src={img} alt={r.title} className="w-full h-64 object-cover rounded-lg mb-4" />}
          <div className="flex items-center gap-4 mb-4">
            <SpoonRating value={r.averageRating ?? r.ratingSpoons ?? null} />
            {r.cookTime && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                {r.cookTime} min
              </span>
            )}
            {r.servings && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                {r.servings} servings
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {r.cuisine && <Badge variant="secondary">{r.cuisine}</Badge>}
            {r.mealType && <Badge variant="outline">{r.mealType}</Badge>}
            <Badge variant="secondary">{getSourceLabel(r)}</Badge>
            {(r.dietTags || []).map((t) => (
              <Badge key={t} variant="outline" className="capitalize">
                {t}
              </Badge>
            ))}
          </div>
          {fullInstructions && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Instructions:</h3>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{fullInstructions}</p>
            </div>
          )}
          {sourceHref && (
            <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:underline">
              View Original Source <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <div className="mt-8 border-t pt-6">
            <RecipeReviews
              recipeId={r.id}
              averageRating={r.averageRating ? Number(r.averageRating) : undefined}
              reviewCount={undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
