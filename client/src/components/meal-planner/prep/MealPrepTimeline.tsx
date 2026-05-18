import React from 'react';
import { Clock } from 'lucide-react';
import type { PrepTimelineStep } from '@/components/meal-planner/prepOrchestrationUtils';

type MealPrepTimelineProps = { timeline: PrepTimelineStep[] };

const MealPrepTimeline = ({ timeline }: MealPrepTimelineProps) => (
  <div className="rounded-lg border bg-white p-3">
    <p className="mb-2 text-sm font-semibold text-gray-900 flex items-center gap-2"><Clock className="h-4 w-4 text-blue-500" />Prep Timeline</p>
    <div className="space-y-2">
      {timeline.map((step, index) => (
        <div key={step.id} className="flex gap-2 text-xs text-gray-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">{index + 1}</span>
          <div><p className="font-medium text-gray-900">{step.label} • {step.minutes} min</p><p>{step.detail}</p></div>
        </div>
      ))}
    </div>
  </div>
);

export default MealPrepTimeline;
