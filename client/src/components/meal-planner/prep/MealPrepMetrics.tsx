import React from 'react';
import { Progress } from '@/components/ui/progress';
import type { PrepOrchestrationSummary } from '@/components/meal-planner/prepOrchestrationUtils';

type MealPrepMetricsProps = { prepSummary: PrepOrchestrationSummary };

const MealPrepMetrics = ({ prepSummary }: MealPrepMetricsProps) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <div className="rounded-lg border bg-white p-3"><p className="text-xs text-gray-500">Prep readiness</p><p className="text-2xl font-semibold text-violet-700">{prepSummary.readinessScore}%</p><Progress value={prepSummary.readinessScore} className="mt-2 h-2" /></div>
    <div className="rounded-lg border bg-white p-3"><p className="text-xs text-gray-500">Generated tracking</p><p className="text-2xl font-semibold text-green-700">{prepSummary.completedGeneratedTasks}/{prepSummary.totalGeneratedTasks}</p><p className="text-xs text-gray-500">tasks complete</p></div>
    <div className="rounded-lg border bg-white p-3"><p className="text-xs text-gray-500">Prep estimate</p><p className="text-2xl font-semibold text-orange-700">{prepSummary.estimatedWeeklyPrepMinutes}</p><p className="text-xs text-gray-500">minutes</p></div>
    <div className="rounded-lg border bg-white p-3"><p className="text-xs text-gray-500">Efficiency score</p><p className="text-2xl font-semibold text-blue-700">{prepSummary.prepEfficiencyScore}%</p><p className="text-xs text-gray-500">batch leverage</p></div>
  </div>
);

export default MealPrepMetrics;
