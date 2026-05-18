import React from 'react';
import { Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { DerivedPrepTask } from '@/components/meal-planner/prepOrchestrationUtils';
import { formatPrepTypeLabel } from './prepUiUtils';

type MealPrepTaskCardProps = {
  task: DerivedPrepTask;
  onToggleGeneratedPrepTask: (taskId: string) => void;
};

const MealPrepTaskCard = ({ task, onToggleGeneratedPrepTask }: MealPrepTaskCardProps) => (
  <details className="rounded-lg border border-gray-100 bg-gray-50 p-2">
    <summary className="cursor-pointer list-none">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800" onClick={(event) => event.stopPropagation()}>
          <Checkbox checked={task.completed} onCheckedChange={() => onToggleGeneratedPrepTask(task.id)} />
          <span className={task.completed ? 'line-through text-gray-500' : ''}>{task.name}</span>
        </label>
        <Badge variant="outline" className="text-[10px]">{formatPrepTypeLabel(task.prepType)}</Badge>
      </div>
    </summary>
    <div className="mt-2 space-y-2 pl-7">
      <div className="flex flex-wrap gap-1">
        {task.linkedMeals.slice(0, 4).map((meal) => (
          <Badge key={meal} variant="outline" className="bg-white text-[10px]">{meal}</Badge>
        ))}
      </div>
      <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600">
        {task.checklist.map((step) => <li key={step}>{step}</li>)}
      </ul>
      <p className="text-xs text-gray-600"><Package className="mr-1 inline h-3.5 w-3.5" />{task.recommendedContainers}</p>
    </div>
  </details>
);

export default MealPrepTaskCard;
