import React from 'react';
import { AlertCircle, CheckCircle, Clock, ListChecks, ShoppingCart, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ChecklistStatus = 'ready' | 'attention';
type PrepExecutionState = 'not_planned' | 'blocked' | 'in_progress' | 'complete';

type WeeklyReadinessChecklistProps = {
  unplannedMealSlots: number;
  unplannedDaysCount: number;
  totalSlots: number;
  groceryListCreated: boolean;
  groceryPendingCount: number;
  groceryCompletedCount: number;
  prepPlanMissing: boolean;
  prepRecommendationsAvailable: boolean;
  prepSessionPlanned: boolean;
  prepSessionCompleted: boolean;
  prepExecutionState: PrepExecutionState;
  prepActiveBlockersCount: number;
  prepGroceryBlockersCount: number;
  prepCarryoverCount: number;
  weekReadyNow: boolean;
  onGoToPlanner: () => void;
  onGoToGrocery: () => void;
  onGoToPrep: () => void;
};

const statusLabel = (status: ChecklistStatus) => status === 'ready' ? 'Ready' : 'Needs attention';

const prepStateMessage = (
  prepExecutionState: PrepExecutionState,
  prepActiveBlockersCount: number,
  prepCarryoverCount: number,
) => {
  if (prepExecutionState === 'complete') {
    return 'Prep session completed for this week.';
  }

  if (prepExecutionState === 'blocked') {
    const blockerLabel = prepActiveBlockersCount === 1 ? 'blocker' : 'blockers';
    const carryoverText = prepCarryoverCount > 0 ? ` ${prepCarryoverCount} carryover tasks still need attention.` : '';
    return `Prep session is planned but blocked by ${prepActiveBlockersCount} ${blockerLabel}.${carryoverText}`;
  }

  if (prepExecutionState === 'in_progress') {
    const carryoverText = prepCarryoverCount > 0 ? ` ${prepCarryoverCount} tasks were carried in.` : '';
    return `Prep is in progress.${carryoverText}`;
  }

  return 'Prep is not scheduled yet for this week.';
};

const WeeklyReadinessChecklist = ({
  unplannedMealSlots,
  unplannedDaysCount,
  totalSlots,
  groceryListCreated,
  groceryPendingCount,
  groceryCompletedCount,
  prepPlanMissing,
  prepRecommendationsAvailable,
  prepSessionPlanned,
  prepSessionCompleted,
  prepExecutionState,
  prepActiveBlockersCount,
  prepGroceryBlockersCount,
  prepCarryoverCount,
  weekReadyNow,
  onGoToPlanner,
  onGoToGrocery,
  onGoToPrep,
}: WeeklyReadinessChecklistProps) => {
  const plannerStatus: ChecklistStatus = unplannedMealSlots === 0 ? 'ready' : 'attention';
  const groceryStatus: ChecklistStatus = groceryListCreated && groceryPendingCount === 0 ? 'ready' : 'attention';
  const prepStatus: ChecklistStatus = prepExecutionState === 'complete' ? 'ready' : 'attention';
  const overallStatus: ChecklistStatus = weekReadyNow ? 'ready' : 'attention';

  return (
    <Card className="border-orange-200 bg-gradient-to-r from-orange-50 via-white to-blue-50">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-orange-600" />
              Weekly Readiness Checklist
            </CardTitle>
            <CardDescription>
              See what is still missing across Planner, Grocery, and Prep before the week starts.
            </CardDescription>
          </div>
          <Badge variant={weekReadyNow ? 'default' : 'secondary'} className={weekReadyNow ? 'bg-green-600 hover:bg-green-600' : ''}>
            {weekReadyNow ? 'Week Ready' : 'In Progress'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border bg-white p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-orange-500" />
                Plan all meal slots
              </p>
              <Badge variant="outline">{statusLabel(plannerStatus)}</Badge>
            </div>
            <p className="text-xs text-gray-600">
              {unplannedMealSlots === 0
                ? `All ${totalSlots} weekly slots are planned.`
                : `${unplannedMealSlots} slots and ${unplannedDaysCount} days still need meals.`}
            </p>
            {unplannedMealSlots > 0 && (
              <Button variant="outline" size="sm" className="mt-2" onClick={onGoToPlanner}>
                Go to Planner
              </Button>
            )}
          </div>

          <div className="rounded-lg border bg-white p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-500" />
                Complete grocery list
              </p>
              <Badge variant="outline">{statusLabel(groceryStatus)}</Badge>
            </div>
            <p className="text-xs text-gray-600">
              {!groceryListCreated
                ? 'No grocery list yet for this week.'
                : groceryPendingCount > 0
                  ? `${groceryPendingCount} items still need to be bought.`
                  : `Shopping complete with ${groceryCompletedCount} items checked off.`}
            </p>
            {prepGroceryBlockersCount > 0 && (
              <p className="text-xs text-amber-700 mt-2">
                {prepGroceryBlockersCount === 1
                  ? '1 prep blocker can be resolved from this grocery flow.'
                  : `${prepGroceryBlockersCount} prep blockers can be resolved from this grocery flow.`}
              </p>
            )}
            {(groceryPendingCount > 0 || !groceryListCreated) && (
              <Button variant="outline" size="sm" className="mt-2" onClick={onGoToGrocery}>
                {prepGroceryBlockersCount > 0 ? 'Resolve in Grocery' : 'Go to Grocery'}
              </Button>
            )}
          </div>

          <div className="rounded-lg border bg-white p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                Prep session planned
              </p>
              <Badge variant="outline">{statusLabel(prepStatus)}</Badge>
            </div>
            <p className="text-xs text-gray-600">
              {prepStateMessage(prepExecutionState, prepActiveBlockersCount, prepCarryoverCount)}
            </p>
            {(prepRecommendationsAvailable || prepPlanMissing) && (
              <Button variant="outline" size="sm" className="mt-2" onClick={onGoToPrep}>
                {prepSessionCompleted ? 'Review Prep Session' : prepSessionPlanned ? 'Open Prep Session' : 'Go to Prep'}
              </Button>
            )}
          </div>

          <div className="rounded-lg border bg-white p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                {overallStatus === 'ready' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                )}
                Ready right now
              </p>
              <Badge variant="outline">{statusLabel(overallStatus)}</Badge>
            </div>
            <p className="text-xs text-gray-600">
              {weekReadyNow
                ? 'Planner, grocery, and prep are aligned for this week.'
                : 'Finish remaining checklist items to make this week execution-ready.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyReadinessChecklist;
