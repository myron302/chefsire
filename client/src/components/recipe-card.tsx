import * as React from “react”;
import { Card } from “@/components/ui/card”;
import { Badge } from “@/components/ui/badge”;
import { Clock } from “lucide-react”;
import { RecipeCardData } from “./useRecipesData”;

// Spoon Icon
export function SpoonIcon({ className }: { className?: string }) {
return (
<svg 
className={className} 
width="16" 
height="16" 
viewBox="0 0 24 24" 
fill="none" 
stroke="currentColor" 
strokeWidth="2" 
strokeLinecap="round" 
strokeLinejoin="round"
>
<path d="M3 11v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3" />
<path d="M12 1v10" />
<path d="m8 5 4-2 4 2" />
<path d="M4 15s1 1 4 1 5-1 8-1 4 1 4 1" />
</svg>
);
}

interface RecipeCardProps {
recipe: RecipeCardData;
onClick?: () => void;
}

export function RecipeCard({ recipe, onClick }: RecipeCardProps) {
return (
<Card 
className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
onClick={onClick}
>
<div className="relative">
{recipe.image ? (
<img 
src={recipe.image} 
alt={recipe.title}
className="w-full h-48 object-cover"
/>
) : (
<div className="w-full h-48 bg-gray-200 flex items-center justify-center">
<SpoonIcon className="w-8 h-8 text-gray-400" />
</div>
)}
</div>

```
  <div className="p-4">
    <div className="flex items-start justify-between mb-2">
      <h3 className="font-semibold text-lg line-clamp-2 flex-1">
        {recipe.title}
      </h3>
      {recipe.cuisine && (
        <Badge variant="secondary" className="ml-2 flex-shrink-0">
          {recipe.cuisine}
        </Badge>
      )}
    </div>

    {recipe.author && (
      <p className="text-sm text-gray-600 mb-2">by {recipe.author}</p>
    )}

    <div className="flex items-center text-sm text-gray-600 space-x-4">
      {recipe.ratingSpoons !== null && (
        <div className="flex items-center">
          <SpoonIcon className="w-4 h-4 mr-1" />
          <span>{recipe.ratingSpoons}</span>
        </div>
      )}
      
      {recipe.cookTime && (
        <div className="flex items-center">
          <Clock className="w-4 h-4 mr-1" />
          <span>{recipe.cookTime} min</span>
        </div>
      )}

      {recipe.servings && (
        <div className="text-xs">
          Serves {recipe.servings}
        </div>
      )}
    </div>

    {recipe.dietTags && recipe.dietTags.length > 0 && (
      <div className="flex flex-wrap gap-1 mt-2">
        {recipe.dietTags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="outline" className="text-xs">
            {tag}
          </Badge>
        ))}
        {recipe.dietTags.length > 3 && (
          <span className="text-xs text-gray-500">+{recipe.dietTags.length - 3} more</span>
        )}
      </div>
    )}
  </div>
</Card>
```

);
}

export function EmptyState() {
return (
<div className="flex flex-col items-center justify-center py-12 text-center">
<SpoonIcon className="w-12 h-12 text-gray-400 mb-4" />
<p className="text-lg text-gray-600">No recipes match these filters.</p>
</div>
);
}
