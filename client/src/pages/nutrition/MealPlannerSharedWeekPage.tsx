import React, { useEffect, useMemo, useState } from 'react';
import { useRoute } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CalendarDays, ShoppingCart, ShieldCheck, Utensils, Activity } from 'lucide-react';

type SharedMeal = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servings: number;
};

type SharedWeekPayload = {
  weekStart: string;
  weekEnd: string;
  weekAnchor: string;
  plannedMeals: Record<string, Record<string, SharedMeal[]>>;
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
  prep: {
    status: string;
    note: string;
  };
  nutritionHighlights: {
    plannedMealsCount: number;
    totalCalories: number;
    totalProtein: number;
    avgCaloriesPerPlannedDay: number;
    avgProteinPerPlannedDay: number;
  };
};

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function MealPlannerSharedWeekPage() {
  const [match, params] = useRoute('/meal-planner/shared/:token');
  const token = match ? params?.token : undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SharedWeekPayload | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Missing share token.');
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/meal-planner/week/shared/${encodeURIComponent(token)}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('This shared meal-planner week was not found or is no longer public.');
          }
          throw new Error(`Failed to load shared week (HTTP ${response.status}).`);
        }

        const payload = await response.json();
        if (!cancelled) {
          setData(payload);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.message || 'Unable to load shared week.');
          setData(null);
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
  }, [token]);

  const orderedDays = useMemo(() => {
    if (!data?.plannedMeals) return DAY_ORDER;
    const existingDays = new Set(Object.keys(data.plannedMeals));
    const extraDays = Object.keys(data.plannedMeals).filter((day) => !DAY_ORDER.includes(day));
    return [...DAY_ORDER.filter((day) => existingDays.has(day)), ...extraDays];
  }, [data?.plannedMeals]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading shared meal planner week…</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Shared week unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <CalendarDays className="h-5 w-5" />
            Public Weekly Meal Plan Snapshot
          </CardTitle>
          <CardDescription>
            Week of <strong>{data.weekStart}</strong> to <strong>{data.weekEnd}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="secondary">Read-only public view</Badge>
          <Badge variant="outline">Token shared</Badge>
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <a href="/meal-planner/shared">Browse more public weeks</a>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>{data.readiness.plannedSlots}/{data.readiness.totalSlots} planned slots</div>
            <Progress value={data.readiness.plannedCoveragePct} />
            <div className="text-muted-foreground">Status: {data.readiness.status}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><ShoppingCart className="h-4 w-4" /> Grocery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>{data.grocery.purchasedItems}/{data.grocery.totalItems} purchased</div>
            <Progress value={data.grocery.completionPct} />
            <div className="text-muted-foreground">Completion: {data.grocery.completionPct}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Nutrition highlights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Planned meals: {data.nutritionHighlights.plannedMealsCount}</div>
            <div>Total calories: {Math.round(data.nutritionHighlights.totalCalories)}</div>
            <div>Total protein: {Math.round(data.nutritionHighlights.totalProtein)}g</div>
            <div className="text-muted-foreground">Avg/day: {data.nutritionHighlights.avgCaloriesPerPlannedDay} kcal • {data.nutritionHighlights.avgProteinPerPlannedDay}g protein</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Utensils className="h-4 w-4" /> Planned meals snapshot</CardTitle>
          <CardDescription>{data.prep.note}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orderedDays.map((day) => {
            const mealsByType = data.plannedMeals[day] || {};
            const mealTypes = Object.keys(mealsByType);
            return (
              <div key={day} className="rounded-md border p-3">
                <div className="mb-2 font-medium">{day}</div>
                {mealTypes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No meals shared for this day.</div>
                ) : (
                  <div className="space-y-2">
                    {mealTypes.map((mealType) => (
                      <div key={`${day}-${mealType}`}>
                        <div className="text-sm font-semibold capitalize">{mealType}</div>
                        <ul className="ml-5 list-disc text-sm text-muted-foreground">
                          {(mealsByType[mealType] || []).map((meal, index) => (
                            <li key={`${day}-${mealType}-${index}`}>
                              {meal.name} • {meal.calories} kcal • P {meal.protein}g / C {meal.carbs}g / F {meal.fat}g
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
