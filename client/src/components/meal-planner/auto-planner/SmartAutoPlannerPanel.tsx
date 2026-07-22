import React from 'react';
import { Sparkles, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buildAssistantOperations, parsePlannerCommand, type PlannerAssistantOperation, type PlannerCommand } from './aiPlanAssistant';
import { type AutoPlannerMode, type AutoPlannerPriorities } from './autoPlannerTypes';
import { generateAdaptiveMealPlan } from './autoPlannerEngine';
import { deriveWeeklyOptimizationSuggestions } from './autoPlannerRecommendationUtils';
import { derivePlanningSnapshotFromResult, persistLongitudinalPlanningSnapshot } from '../planner-adaptation/longitudinalHistory';

const modes: Array<{ value: AutoPlannerMode; label: string }> = [
  { value: 'balanced', label: 'Balanced' }, { value: 'high-protein', label: 'High Protein' },
  { value: 'budget-friendly', label: 'Lower Cost' }, { value: 'minimal-prep', label: 'Minimal Prep' },
  { value: 'pantry-reuse', label: 'Pantry First' }, { value: 'variety-focused', label: 'Maximum Variety' },
];

/** A review-first adapter around the deterministic auto-planner; it never mutates the plan itself. */
export default function SmartAutoPlannerPanel({ weeklyMeals, weekDays, mealTypes, proteinGoal, onApplyPreview }: any) {
  const [mode, setMode] = React.useState<AutoPlannerMode>('balanced');
  const [fillEmptyOnly, setFillEmptyOnly] = React.useState(true);
  const [command, setCommand] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [operations, setOperations] = React.useState<PlannerAssistantOperation[]>([]);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [plannerInsights, setPlannerInsights] = React.useState<string[]>([]);
  const priorities: AutoPlannerPriorities = { proteinPriority: mode === 'high-protein' ? 2 : 1, budgetPriority: mode === 'budget-friendly' ? 2 : 1, prepSimplicity: mode === 'minimal-prep' ? 2 : 1, varietyPriority: mode === 'variety-focused' ? 2 : 1, pantryReusePriority: mode === 'pantry-reuse' ? 2 : 1, groceryEfficiencyPriority: 1, fillEmptyOnly };

  const preview = (parsed: PlannerCommand = { mode, fillEmptyOnly }) => {
    if (parsed.unsupported) { setNotice(parsed.unsupported); setOperations([]); return; }
    const next = buildAssistantOperations({ weeklyMeals, weekDays, mealTypes, proteinGoal, mode: parsed.mode, priorities, fillEmptyOnly: parsed.fillEmptyOnly, target: parsed.target });
    // Preserve the original Smart Auto-Plan insight/history behavior. This is
    // intentionally separate from applying a proposal; it records no command text.
    const result = generateAdaptiveMealPlan(weeklyMeals, weekDays, mealTypes, proteinGoal, parsed.mode, { ...priorities, fillEmptyOnly: parsed.fillEmptyOnly });
    const insights = deriveWeeklyOptimizationSuggestions(result);
    persistLongitudinalPlanningSnapshot(derivePlanningSnapshotFromResult({ weekDays, mealTypes, beforeScores: result.beforeScores, afterScores: result.afterScores, changes: result.changes, suggestionMessages: insights.map((entry: any) => entry.message) }));
    setPlannerInsights(insights.map((entry: any) => entry.message));
    setMode(parsed.mode); setFillEmptyOnly(parsed.fillEmptyOnly); setOperations(next); setSelected(Object.fromEntries(next.map((entry) => [entry.id, true])));
    setNotice(next.length ? `Interpreted action: ${parsed.target ? `optimize ${parsed.target.day} ${parsed.target.mealType}` : parsed.fillEmptyOnly ? 'fill empty slots only' : 'regenerate unlocked slots'}. Review changes before applying.` : 'No matching, resolvable ChefSire meals are available. Nothing was changed.');
  };
  const chosen = operations.filter((operation) => selected[operation.id] && operation.constraintValidation.valid);
  const estimated = chosen.reduce((sum, operation) => ({ calories: sum.calories + operation.expectedNutritionDelta.calories, protein: sum.protein + operation.expectedNutritionDelta.protein, prep: sum.prep + operation.expectedPrepDelta }), { calories: 0, protein: 0, prep: 0 });

  return <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-white">
    <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-600" />AI Plan Assistant</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <div className="flex flex-wrap gap-2">{modes.map((item) => <Button key={item.value} size="sm" variant={mode === item.value ? 'default' : 'outline'} onClick={() => setMode(item.value)}>{item.label}</Button>)}</div>
      <div className="flex flex-col gap-2 sm:flex-row"><input aria-label="Planner command" className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="e.g. Fill only my empty dinner slots" /><Button size="sm" onClick={() => preview(parsePlannerCommand(command))}><WandSparkles className="mr-1 h-4 w-4" />Interpret</Button></div>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant={fillEmptyOnly ? 'default' : 'outline'} onClick={() => setFillEmptyOnly(true)}>Empty slots only</Button><Button size="sm" variant={!fillEmptyOnly ? 'default' : 'outline'} onClick={() => setFillEmptyOnly(false)}>Full unlocked week</Button><Button size="sm" variant="outline" onClick={() => preview()}>Build My Week</Button><Button size="sm" variant="outline" onClick={() => preview({ mode, fillEmptyOnly: false })}>Repair This Week</Button></div>
      {notice && <p role="status" className="rounded bg-white/70 p-2 text-xs text-gray-700">{notice}</p>}
      {plannerInsights.length > 0 && <details className="rounded border bg-white p-2 text-xs text-gray-700"><summary className="cursor-pointer font-medium">Planner insights ({plannerInsights.length})</summary><ul className="mt-2 list-disc space-y-1 pl-4">{plannerInsights.slice(0, 8).map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul></details>}
      {operations.length > 0 && <div className="space-y-2 rounded-lg border bg-white p-3">
        <div className="flex flex-wrap gap-2"><Badge variant="secondary">{chosen.length} selected</Badge><Badge variant="outline">~{estimated.calories} kcal</Badge><Badge variant="outline">~{estimated.protein}g protein</Badge><Badge variant="outline">Prep load {estimated.prep}</Badge></div>
        <div className="max-h-64 space-y-2 overflow-y-auto">{operations.map((operation) => <label key={operation.id} className="block rounded border p-2 text-xs"><div className="flex gap-2"><input type="checkbox" checked={Boolean(selected[operation.id])} disabled={!operation.constraintValidation.valid} onChange={() => setSelected((current) => ({ ...current, [operation.id]: !current[operation.id] }))} /><span><strong className="capitalize">{operation.type}</strong> {operation.targetDay} {operation.targetMealSlot}: {operation.proposedMeal.name}. {operation.reason}<br /><span className="text-gray-500">{operation.expectedPantryImpact} · {operation.constraintValidation.message}</span></span></div></label>)}</div>
        <div className="flex flex-wrap gap-2"><Button size="sm" disabled={!chosen.length} onClick={() => onApplyPreview({ mode, changes: chosen.map((operation) => ({ slot: { day: operation.targetDay, mealType: operation.targetMealSlot }, meal: operation.proposedMeal, operation })) })}>Apply selected ({chosen.length})</Button><Button size="sm" variant="ghost" onClick={() => setOperations([])}>Cancel</Button></div>
      </div>}
    </CardContent>
  </Card>;
}
