import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle } from "lucide-react";

// Spoon + Knife SVG to keep your brand consistent
export function SpoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M7 2c2.5 0 4.5 2 4.5 4.5S9.5 11 7 11 2.5 9 2.5 6.5 4.5 2 7 2zm1 10v8a2 2 0 1 1-4 0v-8h4z" />
      <path d="M15 3h2v18h-2z" />
    </svg>
  );
}

type DemoPost = {
  id: string | number;
  isRecipe?: boolean;
  image: string;
  title?: string;
  likes?: number;
  comments?: number;
  user?: { displayName?: string; avatar?: string };
  recipe?: {
    title: string;
    cookTime?: number;
    servings?: number;
    difficulty?: "Easy" | "Medium" | "Hard";
    cuisine?: string;
    ingredients: string[];
    instructions: string[];
    ratingSpoons?: number;
    dietTags?: string[];
    allergens?: string[];
  };
};

export function RecipeTile({ post }: { post: DemoPost }) {
  const r = post.recipe!;
  const imageUrl = post.image || "/placeholder-recipe.jpg"; // fallback image
  const cookTime = r.cookTime ?? 0;
  const ratingSpoons = r.ratingSpoons ?? 0;
  
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square overflow-hidden">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={r.title || "Recipe"} 
            className="h-full w-full object-cover" 
            loading="lazy"
            onError={(e) => {
              // Fallback if image fails to load
              const target = e.target as HTMLImageElement;
              target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%236b7280'%3ENo Image%3C/text%3E%3C/svg%3E";
            }}
          />
        ) : (
          <div className="h-full w-full bg-muted flex items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold line-clamp-1">{r.title || "Untitled Recipe"}</h3>
          {r.cuisine && <Badge variant="outline" className="text-xs">{r.cuisine}</Badge>}
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <SpoonIcon className="h-4 w-4" />
            {ratingSpoons}
          </span>
          <span>{cookTime} min</span>
        </div>
      </div>
    </Card>
  );
}

export function NonRecipeTile({ post }: { post: DemoPost }) {
  return (
    <Card className="relative overflow-hidden group">
      <div className="aspect-square">
        <img
          src={post.image}
          alt={post.title || "post"}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      <div className="absolute bottom-2 left-2 flex gap-3 text-white drop-shadow">
        <span className="inline-flex items-center gap-1 text-sm">
          <Heart className="h-4 w-4 fill-current" /> {post.likes ?? 0}
        </span>
        <span className="inline-flex items-center gap-1 text-sm">
          <MessageCircle className="h-4 w-4" /> {post.comments ?? 0}
        </span>
      </div>
    </Card>
  );
}

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
      <p className="text-sm text-muted-foreground">No recipes match these filters.</p>
    </div>
  );
}
