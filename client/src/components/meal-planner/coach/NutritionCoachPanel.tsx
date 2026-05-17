import { Activity, AlertTriangle, Brain, Lightbulb, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { NutritionCoachAnalysis, NutritionCoachInsight } from '@/components/meal-planner/nutritionCoachUtils';
import NutritionCoachActionQueue from './NutritionCoachActionQueue';
import NutritionCoachEmptyState from './NutritionCoachEmptyState';
import NutritionCoachInsightCard from './NutritionCoachInsightCard';
import NutritionCoachScoreCards from './NutritionCoachScoreCards';

export interface NutritionCoachPanelProps {
  analysis: NutritionCoachAnalysis;
  visibleInsights: NutritionCoachInsight[];
  dismissedCount: number;
  onDismissInsight: (insightId: string) => void;
  onRestoreInsights: () => void;
  onOpenPlanner: () => void;
  onOpenGrocery: () => void;
  onOpenPrep: () => void;
}

export const NutritionCoachPanel = ({
  analysis,
  visibleInsights,
  dismissedCount,
  onDismissInsight,
  onRestoreInsights,
  onOpenPlanner,
  onOpenGrocery,
  onOpenPrep,
}: NutritionCoachPanelProps) => {
  const topPriority = analysis.summary.topPriority;
  const scoreById = new Map(analysis.scores.map((score) => [score.id, score]));
  const momentum = scoreById.get('weeklyMomentum');
  const primaryActions = [
    { label: 'Review planner', onClick: onOpenPlanner },
    { label: 'Grocery readiness', onClick: onOpenGrocery },
    { label: 'Prep plan', onClick: onOpenPrep },
  ];

  return (
    <Card className="overflow-hidden border-orange-200 bg-gradient-to-br from-orange-50 via-white to-purple-50 shadow-sm">
      <CardHeader className="border-b border-orange-100 bg-white/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-orange-600 text-white">
                <Brain className="w-3.5 h-3.5 mr-1" />
                Derived Intelligence
              </Badge>
              <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-800">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                AI Nutrition Coach
              </Badge>
            </div>
            <CardTitle className="mt-3 flex items-center gap-2 text-2xl text-gray-950">
              <Activity className="w-6 h-6 text-orange-600" />
              AI Nutrition Coach
            </CardTitle>
            <CardDescription className="mt-1 max-w-3xl text-gray-700">
              Insight-driven weekly coaching from your planner, macros, grocery readiness, pantry signals, prep orchestration, hydration, and adherence data. No external AI call is made.
            </CardDescription>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-white/90 p-4 text-center shadow-sm lg:min-w-[190px]">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Weekly Momentum</p>
            <p className="mt-1 text-4xl font-bold text-orange-600">{momentum?.value ?? 0}</p>
            <p className="text-xs text-gray-500">{momentum?.description || 'Momentum unlocks as meals are planned.'}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-6">
        <NutritionCoachScoreCards scores={analysis.scores} />

        {topPriority ? (
          <div className="rounded-2xl border border-orange-200 bg-white/90 p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                {topPriority.severity === 'positive' ? (
                  <ShieldCheck className="mt-1 h-5 w-5 text-emerald-600" />
                ) : topPriority.severity === 'high-priority' ? (
                  <AlertTriangle className="mt-1 h-5 w-5 text-red-600" />
                ) : (
                  <Lightbulb className="mt-1 h-5 w-5 text-orange-600" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Top coaching signal</p>
                  <h3 className="text-lg font-semibold text-gray-950">{topPriority.title}</h3>
                  <p className="text-sm text-gray-600">{topPriority.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {primaryActions.map((action) => (
                  <Button key={action.label} type="button" size="sm" variant="outline" onClick={action.onClick}>
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-gray-950">Coaching insights</h3>
                <p className="text-sm text-gray-600">
                  {analysis.summary.positiveCount} positive • {analysis.summary.warningCount} warning • {analysis.summary.recommendationCount} recommendation
                </p>
              </div>
              {dismissedCount > 0 ? (
                <Button type="button" size="sm" variant="ghost" onClick={onRestoreInsights}>
                  Restore {dismissedCount} dismissed
                </Button>
              ) : null}
            </div>
            {visibleInsights.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {visibleInsights.slice(0, 8).map((insight) => (
                  <NutritionCoachInsightCard key={insight.id} insight={insight} onDismissInsight={onDismissInsight} />
                ))}
              </div>
            ) : (
              <NutritionCoachEmptyState />
            )}
          </div>

          <div className="space-y-3">
            <NutritionCoachActionQueue recommendations={analysis.recommendations} />
            <div className="rounded-xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-950">Coach coverage</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Planned slots</p>
                  <p className="font-semibold text-gray-950">{analysis.summary.plannedSlots}/{analysis.summary.totalSlots}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Active days</p>
                  <p className="font-semibold text-gray-950">{analysis.summary.activeDays}/7</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Repeated meals</p>
                  <p className="font-semibold text-gray-950">{analysis.summary.repeatedMealCount}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Visible insights</p>
                  <p className="font-semibold text-gray-950">{visibleInsights.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NutritionCoachPanel;
