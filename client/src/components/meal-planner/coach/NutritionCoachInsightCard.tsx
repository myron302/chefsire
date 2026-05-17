import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { NutritionCoachInsight } from '@/components/meal-planner/nutritionCoachUtils';
import { coachCategoryStyles, coachSeverityStyles } from './nutritionCoachUiUtils';

export interface NutritionCoachInsightCardProps {
  insight: NutritionCoachInsight;
  onDismissInsight: (insightId: string) => void;
}

export const NutritionCoachInsightCard = ({ insight, onDismissInsight }: NutritionCoachInsightCardProps) => (
  <details className={`group rounded-xl border p-4 shadow-sm ${coachSeverityStyles[insight.severity]}`}>
    <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge className={coachCategoryStyles[insight.category]}>{insight.category}</Badge>
          <Badge variant="outline" className="bg-white/70 text-[10px] uppercase tracking-wide">{insight.kind}</Badge>
        </div>
        <h4 className="font-semibold text-gray-950">{insight.title}</h4>
        <p className="mt-1 text-sm text-gray-700">{insight.description}</p>
      </div>
      <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-semibold text-gray-500 group-open:hidden">Details</span>
    </summary>
    <div className="mt-4 space-y-3 rounded-lg bg-white/75 p-3 text-sm text-gray-700">
      {insight.suggestedActions.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suggested actions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {insight.suggestedActions.map((action) => (
              <span key={action} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
                {action}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {insight.relatedMeals.length > 0 ? (
        <p><span className="font-medium">Related meals:</span> {insight.relatedMeals.slice(0, 5).join(', ')}</p>
      ) : null}
      {insight.relatedPrepSessions.length > 0 ? (
        <p><span className="font-medium">Prep links:</span> {insight.relatedPrepSessions.slice(0, 4).join(', ')}</p>
      ) : null}
      {insight.evidence.length > 0 ? (
        <p><span className="font-medium">Evidence:</span> {insight.evidence.slice(0, 4).join(' • ')}</p>
      ) : null}
      <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => onDismissInsight(insight.id)}>
        Dismiss for this week
      </Button>
    </div>
  </details>
);

export default NutritionCoachInsightCard;
