import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CalendarDays, ShoppingCart, ShieldCheck, Activity, Globe, ArrowRight } from 'lucide-react';

type SharedBrowseItem = {
  token: string;
  weekAnchor: string;
  weekStart: string;
  weekEnd: string;
  sharedAt: string | null;
  sharer: {
    displayName: string | null;
    username: string | null;
  };
  readiness: {
    status: string;
    plannedSlots: number;
    totalSlots: number;
    plannedCoveragePct: number;
  };
  grocery: {
    totalItems: number;
    purchasedItems: number;
    completionPct: number;
  };
  nutritionHighlights: {
    plannedMealsCount: number;
    totalCalories: number;
    totalProtein: number;
    avgCaloriesPerPlannedDay: number;
    avgProteinPerPlannedDay: number;
  };
};

export default function MealPlannerSharedBrowsePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SharedBrowseItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/meal-planner/week/shared');
        if (!response.ok) {
          throw new Error(`Failed to load public shared weeks (HTTP ${response.status}).`);
        }

        const payload = await response.json();
        if (!cancelled) {
          setItems(Array.isArray(payload?.items) ? payload.items : []);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.message || 'Unable to load public shared weeks.');
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading public shared meal-planner weeks…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Globe className="h-5 w-5" />
            Public Meal Plan Inspiration
          </CardTitle>
          <CardDescription>
            Browse recently shared public weekly plans for meal-planning and nutrition ideas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="secondary">Read-only public snapshots</Badge>
          <Badge variant="outline">Recent public shares</Badge>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load public shares</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {!error && items.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No public shared weeks yet</CardTitle>
            <CardDescription>
              Once users set a week to public, it will appear here for discovery.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => {
          const byline = item.sharer.displayName
            ? `Shared by ${item.sharer.displayName}`
            : item.sharer.username
              ? `Shared by @${item.sharer.username}`
              : 'Shared by Chefsire member';

          return (
            <Card key={item.token}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base">Week of {item.weekStart} to {item.weekEnd}</CardTitle>
                <CardDescription>{byline}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-2 font-medium">
                      <ShieldCheck className="h-4 w-4" /> Readiness
                    </div>
                    <div className="text-muted-foreground">
                      {item.readiness.plannedSlots}/{item.readiness.totalSlots} slots planned • {item.readiness.status}
                    </div>
                    <Progress value={item.readiness.plannedCoveragePct} className="mt-2" />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center gap-2 font-medium">
                      <ShoppingCart className="h-4 w-4" /> Grocery
                    </div>
                    <div className="text-muted-foreground">
                      {item.grocery.purchasedItems}/{item.grocery.totalItems} purchased • {item.grocery.completionPct}% complete
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center gap-2 font-medium">
                      <Activity className="h-4 w-4" /> Nutrition highlights
                    </div>
                    <div className="text-muted-foreground">
                      {item.nutritionHighlights.plannedMealsCount} planned meals • Avg/day {item.nutritionHighlights.avgCaloriesPerPlannedDay} kcal • {item.nutritionHighlights.avgProteinPerPlannedDay}g protein
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {item.sharedAt ? `Updated ${new Date(item.sharedAt).toLocaleDateString()}` : 'Recently shared'}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/meal-planner/shared/${item.token}`}>
                      View week <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
