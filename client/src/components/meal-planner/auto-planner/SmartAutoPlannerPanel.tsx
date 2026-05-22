import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { deriveWeeklyOptimizationSuggestions } from './autoPlannerRecommendationUtils';
import { generateAdaptiveMealPlan } from './autoPlannerEngine';
import { persistLongitudinalPlanningSnapshot, derivePlanningSnapshotFromResult } from '../planner-adaptation/longitudinalHistory';
import { type AutoPlannerMode, type AutoPlannerPriorities } from './autoPlannerTypes';

export default function SmartAutoPlannerPanel({ weeklyMeals, weekDays, mealTypes, proteinGoal, onApplyPreview }: any) {
  const [mode, setMode] = React.useState<AutoPlannerMode>('balanced');
  const [preview, setPreview] = React.useState<any>(null);
  const [priorities, setPriorities] = React.useState<AutoPlannerPriorities>({ proteinPriority: 1, budgetPriority: 1, prepSimplicity: 1, varietyPriority: 1, pantryReusePriority: 1, groceryEfficiencyPriority: 1, fillEmptyOnly: true });
  const modes: AutoPlannerMode[] = ['balanced', 'high-protein', 'budget-friendly', 'minimal-prep', 'pantry-reuse', 'variety-focused', 'grocery-efficient', 'recovery-focused'];

  const generate = () => {
    const result = generateAdaptiveMealPlan(weeklyMeals, weekDays, mealTypes, proteinGoal, mode, priorities);
    const derivedSuggestions = deriveWeeklyOptimizationSuggestions(result);
    const snapshot = derivePlanningSnapshotFromResult({ weekDays, mealTypes, beforeScores: result.beforeScores, afterScores: result.afterScores, changes: result.changes, suggestionMessages: derivedSuggestions.map((entry: any) => entry.message) });
    persistLongitudinalPlanningSnapshot(snapshot);
    setPreview({ ...result, suggestions: derivedSuggestions });
  };

  return <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-white">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-violet-600" />Smart Auto-Plan</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex flex-wrap gap-2">{modes.map((m) => <Button key={m} size="sm" variant={mode === m ? 'default' : 'outline'} onClick={() => setMode(m)}>{m}</Button>)}</div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={priorities.fillEmptyOnly ? 'default' : 'outline'} onClick={() => setPriorities((p) => ({ ...p, fillEmptyOnly: !p.fillEmptyOnly }))}>Quick-fill empty slots</Button>
        <Button size="sm" variant="outline" onClick={generate}>Generate Preview</Button>
      </div>
      {preview && <div className="space-y-2 rounded-lg border bg-white p-3">
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline">Relationship Notes {preview.suggestions.filter((s: any) => s.id.startsWith('relationship-')).length}</Badge>
          <Badge variant="secondary">Changes: {preview.changes.length}</Badge>
          <Badge variant="outline">Readiness Δ {preview.afterScores.readinessScore - preview.beforeScores.readinessScore}</Badge>
          <Badge variant="outline">Protein Δ {preview.afterScores.proteinCoverageScore - preview.beforeScores.proteinCoverageScore}</Badge>
          {typeof preview?.lifestyleContext?.energyLoad === 'number' && <Badge variant="outline">Lifestyle Load {preview.lifestyleContext.energyLoad}</Badge>}
        </div>
        <ul className="text-xs text-gray-700 list-disc pl-4">{preview.suggestions.map((s: any) => <li key={s.id}>{s.message}</li>)}</ul>
        {!!preview?.lifestyleContext?.freshnessPriority && <p className="text-xs text-gray-600">Why this week flows better: fragile-ingredient pressure is front-loaded ({preview.lifestyleContext.freshnessPriority.fragileEarlyWeek} early-week vs {preview.lifestyleContext.freshnessPriority.fragileLateWeek} late-week slots).</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onApplyPreview(preview)}>Apply All</Button>
          <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Discard</Button>
        </div>
      </div>}
    </CardContent>
  </Card>;
}
