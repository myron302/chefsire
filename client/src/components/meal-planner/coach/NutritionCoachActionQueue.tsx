import { Lightbulb } from 'lucide-react';

export interface NutritionCoachActionQueueProps {
  recommendations: string[];
}

export const NutritionCoachActionQueue = ({ recommendations }: NutritionCoachActionQueueProps) => (
  <div className="rounded-xl border border-white/80 bg-white/90 p-4 shadow-sm">
    <h3 className="flex items-center gap-2 font-semibold text-gray-950">
      <Lightbulb className="h-4 w-4 text-orange-600" />
      Action queue
    </h3>
    {recommendations.length > 0 ? (
      <div className="mt-3 flex flex-wrap gap-2">
        {recommendations.map((recommendation) => (
          <span key={recommendation} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-800">
            {recommendation}
          </span>
        ))}
      </div>
    ) : (
      <p className="mt-2 text-sm text-gray-600">No urgent action queue yet. Add meals and prep details to unlock more coaching.</p>
    )}
  </div>
);

export default NutritionCoachActionQueue;
