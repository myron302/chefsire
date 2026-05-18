import React from 'react';
import { ListChecks, Utensils } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BatchPrepIngredientGroup, DerivedPrepTask } from '@/components/meal-planner/prepOrchestrationUtils';

type MealPrepBatchOpportunitiesProps = {
  batchOpportunities: DerivedPrepTask[];
  sharedIngredients: BatchPrepIngredientGroup[];
};

const MealPrepBatchOpportunities = ({ batchOpportunities, sharedIngredients }: MealPrepBatchOpportunitiesProps) => (
  <>
    <div className="rounded-lg border bg-white p-3">
      <p className="mb-2 text-sm font-semibold text-gray-900 flex items-center gap-2"><Utensils className="h-4 w-4 text-orange-500" />Batch Opportunities</p>
      <div className="space-y-2">
        {batchOpportunities.slice(0, 5).map((task) => (
          <div key={task.id} className="flex items-center justify-between gap-2 rounded-md bg-orange-50 p-2">
            <p className="text-xs text-orange-900">{task.name}</p>
            <Badge variant="outline" className="bg-white">{task.linkedMeals.length} meals</Badge>
          </div>
        ))}
      </div>
    </div>
    <div className="rounded-lg border bg-white p-3">
      <p className="mb-2 text-sm font-semibold text-gray-900 flex items-center gap-2"><ListChecks className="h-4 w-4 text-green-500" />Shared Ingredients</p>
      <div className="flex flex-wrap gap-2">
        {sharedIngredients.slice(0, 10).map((ingredient) => (
          <Badge key={ingredient.id} variant="outline" className="bg-green-50 text-green-800">{ingredient.name} • {ingredient.mealCount}</Badge>
        ))}
      </div>
    </div>
  </>
);

export default MealPrepBatchOpportunities;
