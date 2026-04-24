import React, { useEffect, useMemo, useState } from 'react';
import { useRoute } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CalendarDays, ShoppingCart, ShieldCheck, Utensils, Activity } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';

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
type CopyMergeMode = 'replace' | 'append' | 'skip-duplicates';
type CopyImpactSummary = {
  mergeMode: CopyMergeMode;
  targetWeekStart: string;
  targetWeekMealsCount: number;
  sourceEntriesCount: number;
  estimatedAddedCount: number;
  estimatedSkippedDuplicatesCount: number;
  willReplaceExisting: boolean;
  impactSummary: string;
  affectedSlots?: Array<{
    day: string;
    mealType: string;
    label: string;
    addCount: number;
    skipDuplicateCount: number;
    replaceCount: number;
    existingCount: number;
    incomingCount: number;
    summary: string;
  }>;
  affectedSlotsPreviewCount?: number;
};
type CopyAppliedSummary = {
  mergeMode?: CopyMergeMode;
  targetWeekStart: string;
  sourceEntriesCount?: number;
  copiedEntriesCount: number;
  skippedDuplicatesCount: number;
  targetWeekMealsBeforeCount?: number;
  targetWeekMealsAfterCount?: number;
  appliedSummary?: string;
  appliedAffectedSlots?: Array<{
    day: string;
    mealType: string;
    label: string;
    addCount: number;
    skipDuplicateCount: number;
    replaceCount: number;
    existingCount: number;
    incomingCount: number;
    summary: string;
  }>;
  appliedAffectedSlotsPreviewCount?: number;
};

function getWeekStartIso(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function getNextWeekStartIso(weekStartIso: string) {
  const parsed = new Date(`${weekStartIso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return getWeekStartIso(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  parsed.setDate(parsed.getDate() + 7);
  return getWeekStartIso(parsed);
}

function modePreview(mode: CopyMergeMode) {
  if (mode === 'append') return 'Append mode keeps your current meals and adds all copied meals into this week.';
  if (mode === 'skip-duplicates') return 'Merge safely mode keeps your current meals and skips copied meals that look like duplicates in the same day + meal slot.';
  return 'Replace mode clears existing meals in the target week, then copies this shared week.';
}

export default function MealPlannerSharedWeekPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [match, params] = useRoute('/meal-planner/shared/:token');
  const token = match ? params?.token : undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SharedWeekPayload | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [copySummary, setCopySummary] = useState<string | null>(null);
  const [targetWeekStart, setTargetWeekStart] = useState(() => getWeekStartIso(new Date()));
  const [mergeMode, setMergeMode] = useState<CopyMergeMode>('replace');
  const [impactSummary, setImpactSummary] = useState<CopyImpactSummary | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [copyAppliedSummary, setCopyAppliedSummary] = useState<CopyAppliedSummary | null>(null);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [templateSavedName, setTemplateSavedName] = useState<string | null>(null);
  const [templateBridgeTargetWeekStart, setTemplateBridgeTargetWeekStart] = useState(() => getWeekStartIso(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));

  const fetchCopyImpactSummary = async (opts?: { silent?: boolean; targetWeek?: string; mode?: CopyMergeMode }) => {
    if (!token || !user) return null;
    const nextTargetWeek = opts?.targetWeek ?? targetWeekStart;
    const nextMode = opts?.mode ?? mergeMode;

    try {
      if (!opts?.silent) setImpactLoading(true);
      const params = new URLSearchParams({
        targetWeekStart: nextTargetWeek,
        mergeMode: nextMode,
      });
      const response = await fetch(`/api/meal-planner/week/shared/${encodeURIComponent(token)}/copy-impact?${params.toString()}`, {
        credentials: 'include',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || `Failed to load copy impact (HTTP ${response.status}).`);
      }
      setImpactSummary(payload);
      return payload as CopyImpactSummary;
    } catch {
      if (!opts?.silent) {
        setImpactSummary(null);
      }
      return null;
    } finally {
      if (!opts?.silent) setImpactLoading(false);
    }
  };

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

  useEffect(() => {
    if (!user || !token) {
      setImpactSummary(null);
      return;
    }
    fetchCopyImpactSummary();
  }, [user, token, targetWeekStart, mergeMode]);

  const orderedDays = useMemo(() => {
    if (!data?.plannedMeals) return DAY_ORDER;
    const existingDays = new Set(Object.keys(data.plannedMeals));
    const extraDays = Object.keys(data.plannedMeals).filter((day) => !DAY_ORDER.includes(day));
    return [...DAY_ORDER.filter((day) => existingDays.has(day)), ...extraDays];
  }, [data?.plannedMeals]);

  const handleCopyWeek = async () => {
    if (!token || !user || isCopying) return;

    const preview = await fetchCopyImpactSummary({ silent: true });
    const previewText = preview?.impactSummary || modePreview(mergeMode);
    const confirmed = window.confirm(`Copy this shared week into your planner for the week of ${targetWeekStart}? ${previewText}`);
    if (!confirmed) return;

    try {
      setIsCopying(true);
      const response = await fetch(`/api/meal-planner/week/shared/${encodeURIComponent(token)}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetWeekStart, mergeMode, replaceExisting: mergeMode === 'replace' }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || `Failed to copy shared week (HTTP ${response.status}).`);
      }

      const skipped = Number(payload?.skippedDuplicatesCount || 0);
      const summary = `Copied ${payload?.copiedEntriesCount ?? 0} meals to your week of ${payload?.targetWeekStart ?? targetWeekStart}${skipped > 0 ? ` (${skipped} duplicates skipped)` : ''}.`;
      setCopyAppliedSummary({
        mergeMode: payload?.mergeMode || mergeMode,
        targetWeekStart: payload?.targetWeekStart ?? targetWeekStart,
        sourceEntriesCount: Number(payload?.sourceEntriesCount || 0),
        copiedEntriesCount: Number(payload?.copiedEntriesCount || 0),
        skippedDuplicatesCount: skipped,
        targetWeekMealsBeforeCount: Number(payload?.targetWeekMealsBeforeCount || 0),
        targetWeekMealsAfterCount: Number(payload?.targetWeekMealsAfterCount || 0),
        appliedSummary: String(payload?.appliedSummary || ''),
        appliedAffectedSlots: Array.isArray(payload?.appliedAffectedSlots) ? payload.appliedAffectedSlots : [],
        appliedAffectedSlotsPreviewCount: Number(payload?.appliedAffectedSlotsPreviewCount || 12),
      });
      setCopySummary(summary);
      const defaultTemplateName = `Imported week ${payload?.targetWeekStart ?? targetWeekStart}`;
      setTemplateNameDraft(defaultTemplateName);
      setTemplateSavedName(null);
      setTemplateBridgeTargetWeekStart(getNextWeekStartIso(payload?.targetWeekStart ?? targetWeekStart));
      toast({ title: 'Week copied to your planner', description: summary });
    } catch (copyError: any) {
      toast({
        variant: 'destructive',
        title: 'Unable to copy week',
        description: copyError?.message || 'Please try again.',
      });
    } finally {
      setIsCopying(false);
    }
  };

  const handleSaveImportedWeekAsTemplate = () => {
    if (!data?.plannedMeals) return;

    const normalizedName = templateNameDraft.trim() || `Imported week ${copyAppliedSummary?.targetWeekStart ?? targetWeekStart}`;
    const storageKey = `meal-template-${normalizedName}`;
    const hasExisting = localStorage.getItem(storageKey);

    if (hasExisting) {
      const confirmed = window.confirm(`Template "${normalizedName}" already exists. Replace it with this imported week?`);
      if (!confirmed) return;
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(data.plannedMeals));
      setTemplateSavedName(normalizedName);
      setTemplateNameDraft(normalizedName);
      toast({
        title: 'Template saved',
        description: `Saved "${normalizedName}". You can load it anytime from your planner templates.`,
      });
    } catch (error) {
      console.error('Error saving imported week template:', error);
      toast({
        variant: 'destructive',
        title: 'Unable to save template',
        description: 'Please try again.',
      });
    }
  };

  const handleUseSavedTemplateOnAnotherWeek = () => {
    if (!templateSavedName) return;

    const normalizedTargetWeek = templateBridgeTargetWeekStart || getWeekStartIso(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const bridgePayload = {
      templateName: templateSavedName,
      targetWeekStart: normalizedTargetWeek,
      requestedAt: new Date().toISOString(),
      source: 'shared-week-import-success',
    };

    try {
      localStorage.setItem('meal-planner-template-bridge-v1', JSON.stringify(bridgePayload));
      toast({
        title: 'Template ready to apply',
        description: `Opening your planner to apply "${templateSavedName}" to week ${normalizedTargetWeek}.`,
      });
      window.location.href = '/nutrition';
    } catch (error) {
      console.error('Error preparing template bridge handoff:', error);
      toast({
        variant: 'destructive',
        title: 'Unable to open template bridge',
        description: 'Please open your planner and load the template manually.',
      });
    }
  };

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
          {user ? (
            <Button size="sm" onClick={handleCopyWeek} disabled={isCopying}>
              {isCopying ? 'Copying…' : 'Copy This Week to My Planner'}
            </Button>
          ) : (
            <Button asChild size="sm">
              <a href="/auth/login">Sign in to copy this week</a>
            </Button>
          )}
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <a href="/meal-planner/shared">Browse more public weeks</a>
          </Button>
        </CardContent>
      </Card>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Copy options</CardTitle>
            <CardDescription>Pick a target week and merge behavior before importing this shared plan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <div className="font-medium">Target week (Monday)</div>
              <input
                type="date"
                value={targetWeekStart}
                onChange={(event) => setTargetWeekStart(event.target.value || getWeekStartIso(new Date()))}
                className="w-full rounded-md border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <div className="font-medium">Merge mode</div>
              <select
                value={mergeMode}
                onChange={(event) => setMergeMode(event.target.value as CopyMergeMode)}
                className="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="replace">Replace existing week meals</option>
                <option value="append">Append copied meals</option>
                <option value="skip-duplicates">Merge safely (skip duplicates)</option>
              </select>
            </label>
            <div className="text-sm text-muted-foreground md:col-span-2">
              {modePreview(mergeMode)}
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-sm md:col-span-2">
              <div className="font-medium">Pre-copy impact</div>
              <div className="mt-1 text-muted-foreground">
                {impactLoading
                  ? 'Calculating impact preview…'
                  : impactSummary?.impactSummary || 'Impact preview unavailable right now. Copy still works with your selected mode.'}
              </div>
              {!impactLoading && impactSummary && (
                <>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Target week meals: {impactSummary.targetWeekMealsCount} • Shared meals: {impactSummary.sourceEntriesCount} • Estimated add: {impactSummary.estimatedAddedCount}
                    {impactSummary.estimatedSkippedDuplicatesCount > 0 ? ` • Estimated skip: ${impactSummary.estimatedSkippedDuplicatesCount}` : ''}
                  </div>
                  {Array.isArray(impactSummary.affectedSlots) && impactSummary.affectedSlots.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-medium text-foreground">Affected slots (mini diff)</div>
                      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {impactSummary.affectedSlots
                          .slice(0, impactSummary.affectedSlotsPreviewCount || 12)
                          .map((slot) => (
                            <li key={`${slot.label}-${slot.summary}`}>
                              {slot.label}: {slot.summary}
                            </li>
                          ))}
                      </ul>
                      {(impactSummary.affectedSlotsPreviewCount || 12) < impactSummary.affectedSlots.length && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          +{impactSummary.affectedSlots.length - (impactSummary.affectedSlotsPreviewCount || 12)} more affected slots
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {copySummary && (
        <Card>
          <CardContent className="p-4 text-sm">
            <div className="font-medium">Saved to your planner</div>
            <div className="text-muted-foreground">{copySummary}</div>
            {copyAppliedSummary && (
              <div className="mt-3 rounded-md border bg-muted/40 p-3">
                <div className="font-medium">Post-copy reconciliation</div>
                <div className="mt-1 text-muted-foreground">
                  {copyAppliedSummary.appliedSummary || `Applied ${copyAppliedSummary.copiedEntriesCount} imported meals.`}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Week {copyAppliedSummary.targetWeekStart}
                  {typeof copyAppliedSummary.targetWeekMealsBeforeCount === 'number' ? ` • Before: ${copyAppliedSummary.targetWeekMealsBeforeCount}` : ''}
                  {typeof copyAppliedSummary.targetWeekMealsAfterCount === 'number' ? ` • After: ${copyAppliedSummary.targetWeekMealsAfterCount}` : ''}
                  {copyAppliedSummary.sourceEntriesCount ? ` • Incoming: ${copyAppliedSummary.sourceEntriesCount}` : ''}
                  {' • Added: '} {copyAppliedSummary.copiedEntriesCount}
                  {copyAppliedSummary.skippedDuplicatesCount > 0 ? ` • Duplicates skipped: ${copyAppliedSummary.skippedDuplicatesCount}` : ''}
                </div>
                {Array.isArray(copyAppliedSummary.appliedAffectedSlots) && copyAppliedSummary.appliedAffectedSlots.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-foreground">Applied slot deltas</div>
                    <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                      {copyAppliedSummary.appliedAffectedSlots
                        .slice(0, copyAppliedSummary.appliedAffectedSlotsPreviewCount || 12)
                        .map((slot) => (
                          <li key={`${slot.label}-${slot.summary}`}>
                            {slot.label}: {slot.summary}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="mt-3 rounded-md border bg-muted/30 p-3">
              <div className="text-sm font-medium">Save this imported week as a reusable template</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Keep this structure for future weeks without re-importing.
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={templateNameDraft}
                  onChange={(event) => setTemplateNameDraft(event.target.value)}
                  placeholder={`Imported week ${copyAppliedSummary?.targetWeekStart ?? targetWeekStart}`}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <Button size="sm" variant="secondary" onClick={handleSaveImportedWeekAsTemplate}>
                  Save This Week as Template
                </Button>
              </div>
              {templateSavedName && (
                <div className="mt-3 rounded-md border bg-emerald-50/60 p-3">
                  <div className="text-xs font-medium text-emerald-700">Saved as "{templateSavedName}".</div>
                  <div className="mt-1 text-xs text-emerald-700/90">
                    Use it right away on another week without browsing away first.
                  </div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="space-y-1 text-xs">
                      <div className="font-medium text-foreground">Apply template to week (Monday)</div>
                      <input
                        type="date"
                        value={templateBridgeTargetWeekStart}
                        onChange={(event) => setTemplateBridgeTargetWeekStart(event.target.value || getWeekStartIso(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)))}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:w-56"
                      />
                    </label>
                    <Button size="sm" onClick={handleUseSavedTemplateOnAnotherWeek}>
                      Use This Template on Another Week
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <Button asChild size="sm" className="mt-3">
              <a href="/nutrition">Open My Planner</a>
            </Button>
          </CardContent>
        </Card>
      )}

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
