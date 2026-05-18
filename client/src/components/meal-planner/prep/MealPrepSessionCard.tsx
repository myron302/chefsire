import React from 'react';
import { Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DerivedPrepSession } from '@/components/meal-planner/prepOrchestrationUtils';
import MealPrepTaskCard from './MealPrepTaskCard';

type MealPrepSessionCardProps = {
  session: DerivedPrepSession;
  onToggleGeneratedPrepTask: (taskId: string) => void;
};

const MealPrepSessionCard = ({ session, onToggleGeneratedPrepTask }: MealPrepSessionCardProps) => (
  <div className="rounded-xl border bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h4 className="font-semibold text-gray-900">{session.title}</h4>
        <p className="text-xs text-gray-600">{session.summary}</p>
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline"><Timer className="mr-1 h-3 w-3" />{session.estimatedMinutes} min</Badge>
        <Badge variant="outline">{session.complexity}</Badge>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-1.5">
      {session.linkedIngredients.slice(0, 5).map((ingredient) => (
        <Badge key={ingredient} variant="secondary" className="text-[11px]">{ingredient}</Badge>
      ))}
    </div>
    <div className="mt-3 space-y-2">
      {session.tasks.map((task) => (
        <MealPrepTaskCard key={task.id} task={task} onToggleGeneratedPrepTask={onToggleGeneratedPrepTask} />
      ))}
    </div>
  </div>
);

export default MealPrepSessionCard;
