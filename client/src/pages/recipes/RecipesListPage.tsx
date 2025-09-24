import * as React from "react";
import { Link } from "wouter";
import { useRecipesFilters } from "./useRecipesFilters";
import { useRecipesData, type RecipeCardData } from "./useRecipesData";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, Users } from "lucide-react";

/** Uniform “spoon” icon (SVG) */
function SpoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}>
      <path
        d="M10.5 2c2.485 0 4.5 2.015 4.5 4.5 0 1.61-.828 3.028-2.082 3.86l-.418.275V14a4.5 4.5 0 0 1-1.5 3.366V22h-3v-4.634A4.5 4.5 0 0 1 6 14V10.635l-.418-.275A4.5 4.5 0 0 1 3.5 6.5C3.5 4.015 5.515 2 8 2h2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Display 0–5 spoons (whole spoons only for now) */
function SpoonRating({ value }: { value: number | null | undefined }) {
  const v = Math.max(0, Math.min(5, Math.round(value ?? 0)));
  return (
    <div className="flex items-center gap-1 text-orange-600">
      {Array.from({ length: 5 }).map((_, i) => (
        <SpoonIcon key={i} className={i < v ? "w-4 h-4" : "w-4 h-4 opacity-30"} />
      ))}
    </div>
  );
}

function RecipeCard({ r }: { r: RecipeCardData }) {
  return (
    <Card className="overflow-hidden bg-card border border-border hover:shadow-md transition-shadow">
      {r.image ? (
        <img src={r.image} alt={r.title} className="w-full h-48 object-cover" />
      ) : (
        <div className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground">
          No image
        </div>
      )}

      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug line-clamp-2">{r.title}</h3>
          <SpoonRating value={r.ratingSpoons ?? null} />
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
          {(r.dietTags || []).slice(0, 3).map((t) => (
            <Badge key={t} variant="outline" className="capitalize">
              {t}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function RecipesListPage() {
  const { state, setQ } = useRecipesFilters();
  const { recipes, loading, err } = useRecipesData();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Recipes</h1>
        <Link href="/recipes/filters">
          <Button variant="outline">Filters</Button>
        </Link>
      </div>

      {/* Quick search (binds to filters state.q) */}
      <div className="mb-4 flex items-center gap-2">
        <Input
          placeholder="Quick search (title/keywords)…"
          value={state.q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
        <Link href="/recipes/filters">
          <Button variant="ghost">Advanced filters</Button>
        </Link>
      </div>

      {/* Loading / error states */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading recipes…
        </div>
      ) : err ? (
        <div className="text-destructive">Error: {err}</div>
      ) : recipes.length === 0 ? (
        <div className="text-muted-foreground">No recipes found. Try adjusting filters.</div>
      ) : (
        <div className="grid gap-4 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {recipes.map((r) => (
            <RecipeCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}
