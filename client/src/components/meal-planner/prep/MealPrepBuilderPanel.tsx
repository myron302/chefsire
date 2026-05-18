import React from 'react';
import { CalendarClock, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PrepOrchestration } from '@/components/meal-planner/prepOrchestrationUtils';
import MealPrepBatchOpportunities from './MealPrepBatchOpportunities';
import MealPrepEmptyState from './MealPrepEmptyState';
import MealPrepMetrics from './MealPrepMetrics';
import MealPrepSessionCard from './MealPrepSessionCard';
import MealPrepStorageGuidance from './MealPrepStorageGuidance';
import MealPrepTimeline from './MealPrepTimeline';

type MealPrepBuilderPanelProps = {
  prepOrchestration: PrepOrchestration;
  onToggleGeneratedPrepTask: (taskId: string) => void;
};

const MealPrepBuilderPanel = ({ prepOrchestration, onToggleGeneratedPrepTask }: MealPrepBuilderPanelProps) => {
  const prepSummary = prepOrchestration.summary;
  const hasGeneratedPrep = prepOrchestration.sessions.length > 0;

  return (
    <Card className="border-violet-200 bg-gradient-to-r from-violet-50 via-white to-orange-50">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-violet-600" />Meal Prep Session Builder</CardTitle>
            <CardDescription>ChefSire analyzes planned meal items, recipe-linked ingredients, and overlaps to suggest batch prep workflows.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-white">{prepSummary.batchOpportunitiesFound} opportunities</Badge>
            <Badge variant="outline" className="bg-white">{prepSummary.mealsCoveredByPrep}/{prepSummary.plannedMealCount} meals covered</Badge>
            <Badge variant="outline" className="bg-white">{prepSummary.estimatedWeeklyPrepSavingsMinutes} min saved</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <MealPrepMetrics prepSummary={prepSummary} />

        {!hasGeneratedPrep ? <MealPrepEmptyState /> : (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2"><CalendarClock className="h-4 w-4 text-violet-600" />Suggested Prep Sessions</p>
                <Badge variant="secondary">Frontend-derived</Badge>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {prepOrchestration.sessions.map((session) => (
                  <MealPrepSessionCard key={session.id} session={session} onToggleGeneratedPrepTask={onToggleGeneratedPrepTask} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <MealPrepBatchOpportunities batchOpportunities={prepOrchestration.batchOpportunities} sharedIngredients={prepOrchestration.sharedIngredients} />
              <MealPrepTimeline timeline={prepOrchestration.timeline} />
              <MealPrepStorageGuidance storageGuidance={prepOrchestration.storageGuidance} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MealPrepBuilderPanel;
