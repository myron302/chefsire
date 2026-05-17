import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { NutritionCoachScore } from '@/components/meal-planner/nutritionCoachUtils';
import { coachScoreGradient, coachTrendLabel } from './nutritionCoachUiUtils';

export interface NutritionCoachScoreCardsProps {
  scores: NutritionCoachScore[];
}

export const NutritionCoachScoreCards = ({ scores }: NutritionCoachScoreCardsProps) => (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
    {scores.map((score) => (
      <div key={score.id} className="rounded-xl border border-white/70 bg-white/90 p-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-gray-500">{score.label}</p>
            <p className="text-2xl font-bold text-gray-950">{score.value}</p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {coachTrendLabel(score.trend)}
          </Badge>
        </div>
        <Progress value={score.value} className="mt-3 h-2" />
        <div className={`mt-2 h-1 rounded-full bg-gradient-to-r ${coachScoreGradient(score.value)}`} style={{ width: `${Math.max(8, score.value)}%` }} />
        <p className="mt-2 text-xs text-gray-600">{score.description}</p>
      </div>
    ))}
  </div>
);

export default NutritionCoachScoreCards;
