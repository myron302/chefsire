import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CalendarDays, ShoppingCart, ShieldCheck, Activity, Globe, ArrowRight } from 'lucide-react';

type BrowseReadinessFilter = 'all' | 'not-started' | 'in-progress' | 'week-ready';
type BrowseCoverageFilter = 'all' | 'low' | 'medium' | 'high';
type BrowseSort = 'newest' | 'readiness' | 'coverage';
type BrowsePreset = 'ready-high-coverage' | 'newest-ideas' | 'in-progress' | 'balanced-browse';

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

type SharedBrowseStats = {
  totalVisiblePlans: number;
  readyPlans: number;
  highCoveragePlans: number;
  avgPlannedMealsPerPlan: number;
};

export default function MealPlannerSharedBrowsePage() {
  const resolvePresetConfig = (preset: BrowsePreset) => {
    if (preset === 'ready-high-coverage') {
      return { readiness: 'week-ready' as BrowseReadinessFilter, coverage: 'high' as BrowseCoverageFilter, sort: 'readiness' as BrowseSort };
    }
    if (preset === 'newest-ideas') {
      return { readiness: 'all' as BrowseReadinessFilter, coverage: 'all' as BrowseCoverageFilter, sort: 'newest' as BrowseSort };
    }
    if (preset === 'in-progress') {
      return { readiness: 'in-progress' as BrowseReadinessFilter, coverage: 'all' as BrowseCoverageFilter, sort: 'newest' as BrowseSort };
    }
    return { readiness: 'all' as BrowseReadinessFilter, coverage: 'medium' as BrowseCoverageFilter, sort: 'coverage' as BrowseSort };
  };

  const parsePreset = (value: string | null): BrowsePreset | null => {
    if (value === 'ready-high-coverage' || value === 'newest-ideas' || value === 'in-progress' || value === 'balanced-browse') {
      return value;
    }
    return null;
  };

  const [readinessFilter, setReadinessFilter] = useState<BrowseReadinessFilter>(() => {
    const params = new URLSearchParams(window.location.search);
    const preset = parsePreset(params.get('preset'));
    if (preset) return resolvePresetConfig(preset).readiness;
    const value = params.get('readiness');
    if (value === 'not-started' || value === 'in-progress' || value === 'week-ready') return value;
    return 'all';
  });
  const [coverageFilter, setCoverageFilter] = useState<BrowseCoverageFilter>(() => {
    const params = new URLSearchParams(window.location.search);
    const preset = parsePreset(params.get('preset'));
    if (preset) return resolvePresetConfig(preset).coverage;
    const value = params.get('coverage');
    if (value === 'low' || value === 'medium' || value === 'high') return value;
    return 'all';
  });
  const [sortBy, setSortBy] = useState<BrowseSort>(() => {
    const params = new URLSearchParams(window.location.search);
    const preset = parsePreset(params.get('preset'));
    if (preset) return resolvePresetConfig(preset).sort;
    const value = params.get('sort');
    if (value === 'readiness' || value === 'coverage') return value;
    return 'newest';
  });
  const [activePreset, setActivePreset] = useState<BrowsePreset | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return parsePreset(params.get('preset'));
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SharedBrowseItem[]>([]);
  const [stats, setStats] = useState<SharedBrowseStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (readinessFilter !== 'all') params.set('readiness', readinessFilter);
        if (coverageFilter !== 'all') params.set('coverage', coverageFilter);
        if (sortBy !== 'newest') params.set('sort', sortBy);
        if (activePreset) params.set('preset', activePreset);

        const query = params.toString();
        const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
        window.history.replaceState({}, '', nextUrl);

        const response = await fetch(`/api/meal-planner/week/shared${query ? `?${query}` : ''}`);
        if (!response.ok) {
          throw new Error(`Failed to load public shared weeks (HTTP ${response.status}).`);
        }

        const payload = await response.json();
        if (!cancelled) {
          setItems(Array.isArray(payload?.items) ? payload.items : []);
          setStats(payload?.stats ?? null);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.message || 'Unable to load public shared weeks.');
          setItems([]);
          setStats(null);
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
  }, [readinessFilter, coverageFilter, sortBy, activePreset]);

  const readyPlansCount = stats?.readyPlans ?? items.filter((item) => item.readiness.status === 'week-ready').length;
  const highCoverageCount = stats?.highCoveragePlans ?? items.filter((item) => item.readiness.plannedCoveragePct >= 70).length;
  const avgPlannedMealsPerPlan = stats?.avgPlannedMealsPerPlan ?? (items.length > 0
    ? Math.round(items.reduce((sum, item) => sum + item.nutritionHighlights.plannedMealsCount, 0) / items.length)
    : 0);

  const applyPreset = (preset: BrowsePreset) => {
    const config = resolvePresetConfig(preset);
    setReadinessFilter(config.readiness);
    setCoverageFilter(config.coverage);
    setSortBy(config.sort);
    setActivePreset(preset);
  };

  const handleReadinessChange = (value: BrowseReadinessFilter) => {
    setReadinessFilter(value);
    setActivePreset(null);
  };

  const handleCoverageChange = (value: BrowseCoverageFilter) => {
    setCoverageFilter(value);
    setActivePreset(null);
  };

  const handleSortChange = (value: BrowseSort) => {
    setSortBy(value);
    setActivePreset(null);
  };

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Browse relevance controls</CardTitle>
          <CardDescription>Filter by readiness + coverage and sort for inspiration quality.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 border-b pb-3">
          <Button type="button" size="sm" variant={activePreset === 'ready-high-coverage' ? 'default' : 'outline'} onClick={() => applyPreset('ready-high-coverage')}>
            Ready + High coverage
          </Button>
          <Button type="button" size="sm" variant={activePreset === 'newest-ideas' ? 'default' : 'outline'} onClick={() => applyPreset('newest-ideas')}>
            Newest ideas
          </Button>
          <Button type="button" size="sm" variant={activePreset === 'in-progress' ? 'default' : 'outline'} onClick={() => applyPreset('in-progress')}>
            In progress
          </Button>
          <Button type="button" size="sm" variant={activePreset === 'balanced-browse' ? 'default' : 'outline'} onClick={() => applyPreset('balanced-browse')}>
            Balanced browse
          </Button>
        </CardContent>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Readiness</span>
            <select
              value={readinessFilter}
              onChange={(event) => handleReadinessChange(event.target.value as BrowseReadinessFilter)}
              className="h-9 rounded-md border bg-background px-2"
            >
              <option value="all">All readiness</option>
              <option value="week-ready">Week ready</option>
              <option value="in-progress">In progress</option>
              <option value="not-started">Not started</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Planned coverage</span>
            <select
              value={coverageFilter}
              onChange={(event) => handleCoverageChange(event.target.value as BrowseCoverageFilter)}
              className="h-9 rounded-md border bg-background px-2"
            >
              <option value="all">All coverage</option>
              <option value="high">High (70%+ planned)</option>
              <option value="medium">Medium (40-69%)</option>
              <option value="low">Low (&lt;40%)</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Sort</span>
            <select
              value={sortBy}
              onChange={(event) => handleSortChange(event.target.value as BrowseSort)}
              className="h-9 rounded-md border bg-background px-2"
            >
              <option value="newest">Newest shared</option>
              <option value="readiness">Best readiness</option>
              <option value="coverage">Most planned coverage</option>
            </select>
          </label>
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

      {!error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick browse stats</CardTitle>
            <CardDescription>At-a-glance summary for the currently visible public plans.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            <Badge variant="secondary" className="justify-center py-2 text-sm">
              {stats?.totalVisiblePlans ?? items.length} visible plans
            </Badge>
            <Badge variant="outline" className="justify-center py-2 text-sm">
              {readyPlansCount} week-ready plans
            </Badge>
            <Badge variant="outline" className="justify-center py-2 text-sm">
              {highCoverageCount} high-coverage plans
            </Badge>
            <Badge variant="outline" className="justify-center py-2 text-sm sm:col-span-3">
              Avg planned meals per plan: {avgPlannedMealsPerPlan}
            </Badge>
          </CardContent>
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
