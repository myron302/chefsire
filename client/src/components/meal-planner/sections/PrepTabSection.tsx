import React from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ChefHat, Clock, Lightbulb, ListChecks, MoveRight, Package, Refrigerator, ShoppingCart, Sparkles, Timer, Utensils } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { type PrepOrchestration } from '@/components/meal-planner/prepOrchestrationUtils';

export type PrepTask = {
  id: string;
  label: string;
  done: boolean;
};

export type PrepBlocker = {
  id: string;
  label: string;
  active: boolean;
};

export type PrepSessionState = {
  scheduledAt: string;
  notes: string;
  tasks: PrepTask[];
  blockers: PrepBlocker[];
  blockerNote: string;
  blockerSuggestionLinks: Array<{
    suggestionId: string;
    name: string;
    category: string;
    reason: string;
    addedAt: string;
  }>;
  carryoverTaskIds: string[];
  generatedPrepTaskCompletions?: Record<string, boolean>;
  completedAt: string | null;
};

type PrepTabSectionProps = {
  prepSession: PrepSessionState;
  prepProgress: number;
  prepSessionPlanned: boolean;
  prepSessionCompleted: boolean;
  prepRecommendationsAvailable: boolean;
  onScheduleChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onToggleTask: (taskId: string) => void;
  onToggleBlocker: (blockerId: string) => void;
  onBlockerNoteChange: (value: string) => void;
  onCarryForwardUnfinished: () => void;
  onMarkPrepComplete: () => void;
  onResetPrepCompletion: () => void;
  onGoToChecklist: () => void;
  prepGroceryBlockersCount: number;
  onResolveBlockersInGrocery: () => void;
  blockerItemSuggestions: Array<{
    id: string;
    name: string;
    category: string;
    reason: string;
    alreadyOnList: boolean;
  }>;
  onAddBlockerSuggestion: (suggestion: {
    id: string;
    name: string;
    category: string;
    reason: string;
    alreadyOnList: boolean;
  }) => void;
  onGoToGrocery: () => void;
  blockerSuggestionResolvedCount: number;
  blockerSuggestionTrackedCount: number;
  unresolvedBlockerSuggestionNames: string[];
  blockerSuggestionConfidenceLabel: 'Not started' | 'Low' | 'Medium' | 'High';
  prepResolvedViaTrackedSuggestions: boolean;
  prepOrchestration: PrepOrchestration;
  onToggleGeneratedPrepTask: (taskId: string) => void;
};

const PrepTabSection = ({
  prepSession,
  prepProgress,
  prepSessionPlanned,
  prepSessionCompleted,
  prepRecommendationsAvailable,
  onScheduleChange,
  onNotesChange,
  onToggleTask,
  onToggleBlocker,
  onBlockerNoteChange,
  onCarryForwardUnfinished,
  onMarkPrepComplete,
  onResetPrepCompletion,
  onGoToChecklist,
  prepGroceryBlockersCount,
  onResolveBlockersInGrocery,
  blockerItemSuggestions,
  onAddBlockerSuggestion,
  onGoToGrocery,
  blockerSuggestionResolvedCount,
  blockerSuggestionTrackedCount,
  unresolvedBlockerSuggestionNames,
  blockerSuggestionConfidenceLabel,
  prepResolvedViaTrackedSuggestions,
  prepOrchestration,
  onToggleGeneratedPrepTask,
}: PrepTabSectionProps) => {
  const activeBlockers = prepSession.blockers.filter((blocker) => blocker.active);
  const unfinishedTasks = prepSession.tasks.filter((task) => !task.done);
  const prepSummary = prepOrchestration.summary;
  const hasGeneratedPrep = prepOrchestration.sessions.length > 0;

  return (
    <>
    <Card className="border-violet-200 bg-gradient-to-r from-violet-50 via-white to-orange-50">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" />
              Meal Prep Session Builder
            </CardTitle>
            <CardDescription>
              ChefSire analyzes planned meal items, recipe-linked ingredients, and overlaps to suggest batch prep workflows.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-white">{prepSummary.batchOpportunitiesFound} opportunities</Badge>
            <Badge variant="outline" className="bg-white">{prepSummary.mealsCoveredByPrep}/{prepSummary.plannedMealCount} meals covered</Badge>
            <Badge variant="outline" className="bg-white">{prepSummary.estimatedWeeklyPrepSavingsMinutes} min saved</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs text-gray-500">Prep readiness</p>
            <p className="text-2xl font-semibold text-violet-700">{prepSummary.readinessScore}%</p>
            <Progress value={prepSummary.readinessScore} className="mt-2 h-2" />
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs text-gray-500">Generated tracking</p>
            <p className="text-2xl font-semibold text-green-700">{prepSummary.completedGeneratedTasks}/{prepSummary.totalGeneratedTasks}</p>
            <p className="text-xs text-gray-500">tasks complete</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs text-gray-500">Prep estimate</p>
            <p className="text-2xl font-semibold text-orange-700">{prepSummary.estimatedWeeklyPrepMinutes}</p>
            <p className="text-xs text-gray-500">minutes</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs text-gray-500">Efficiency score</p>
            <p className="text-2xl font-semibold text-blue-700">{prepSummary.prepEfficiencyScore}%</p>
            <p className="text-xs text-gray-500">batch leverage</p>
          </div>
        </div>

        {!hasGeneratedPrep ? (
          <div className="rounded-lg border border-dashed bg-white p-5 text-center">
            <ChefHat className="mx-auto mb-2 h-8 w-8 text-violet-400" />
            <p className="text-sm font-medium text-gray-900">No batch-prep overlaps detected yet.</p>
            <p className="mt-1 text-xs text-gray-600">Add structured meal items or recipe-linked meals with repeated ingredients to unlock intelligent sessions.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2"><CalendarClock className="h-4 w-4 text-violet-600" />Suggested Prep Sessions</p>
                <Badge variant="secondary">Frontend-derived</Badge>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {prepOrchestration.sessions.map((session) => (
                  <div key={session.id} className="rounded-xl border bg-white p-4 shadow-sm">
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
                        <details key={task.id} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-center justify-between gap-2">
                              <label className="flex items-center gap-2 text-sm font-medium text-gray-800" onClick={(event) => event.stopPropagation()}>
                                <Checkbox checked={task.completed} onCheckedChange={() => onToggleGeneratedPrepTask(task.id)} />
                                <span className={task.completed ? 'line-through text-gray-500' : ''}>{task.name}</span>
                              </label>
                              <Badge variant="outline" className="text-[10px]">{task.prepType}</Badge>
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
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-lg border bg-white p-3">
                <p className="mb-2 text-sm font-semibold text-gray-900 flex items-center gap-2"><Utensils className="h-4 w-4 text-orange-500" />Batch Opportunities</p>
                <div className="space-y-2">
                  {prepOrchestration.batchOpportunities.slice(0, 5).map((task) => (
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
                  {prepOrchestration.sharedIngredients.slice(0, 10).map((ingredient) => (
                    <Badge key={ingredient.id} variant="outline" className="bg-green-50 text-green-800">
                      {ingredient.name} • {ingredient.mealCount}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <p className="mb-2 text-sm font-semibold text-gray-900 flex items-center gap-2"><Clock className="h-4 w-4 text-blue-500" />Prep Timeline</p>
                <div className="space-y-2">
                  {prepOrchestration.timeline.map((step, index) => (
                    <div key={step.id} className="flex gap-2 text-xs text-gray-700">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">{index + 1}</span>
                      <div>
                        <p className="font-medium text-gray-900">{step.label} • {step.minutes} min</p>
                        <p>{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <p className="mb-2 text-sm font-semibold text-gray-900 flex items-center gap-2"><Refrigerator className="h-4 w-4 text-indigo-500" />Storage Guidance</p>
                <div className="space-y-2">
                  {prepOrchestration.storageGuidance.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-md bg-indigo-50 p-2 text-xs text-indigo-900">
                      <p className="font-medium">{item.title}</p>
                      <p>Recommended: {item.guidance.primary.replace('-', ' ')} • best within about {item.guidance.bestWithinDays} day{item.guidance.bestWithinDays === 1 ? '' : 's'} • {item.guidance.containerCount} container{item.guidance.containerCount === 1 ? '' : 's'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>

    <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-orange-50">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-indigo-600" />
              Weekly Prep Session Tracker
            </CardTitle>
            <CardDescription>
              Schedule prep, resolve blockers, and carry unfinished tasks into the next session.
            </CardDescription>
          </div>
          <Badge variant={prepSessionCompleted ? 'default' : prepSessionPlanned ? 'outline' : 'secondary'} className={prepSessionCompleted ? 'bg-green-600 hover:bg-green-600' : ''}>
            {prepSessionCompleted ? 'Completed' : prepSessionPlanned ? 'Scheduled' : 'Not Scheduled'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">Prep session time</p>
            <Input
              type="datetime-local"
              value={prepSession.scheduledAt}
              onChange={(e) => onScheduleChange(e.target.value)}
            />
            <p className="text-xs text-gray-600">
              {prepSessionPlanned ? 'Session saved for this week.' : 'Pick a time to lock in your prep session.'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">Prep notes</p>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Optional: session focus, who is helping, or container plan"
              value={prepSession.notes}
              onChange={(e) => onNotesChange(e.target.value)}
            />
            <p className="text-xs text-gray-600">Notes are saved with this week's prep session.</p>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Prep blockers
            </p>
            <Badge variant={activeBlockers.length > 0 ? 'secondary' : 'outline'}>
              {activeBlockers.length > 0 ? `${activeBlockers.length} active` : 'No blockers'}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {prepSession.blockers.map((blocker) => (
              <Button
                key={blocker.id}
                type="button"
                variant={blocker.active ? 'default' : 'outline'}
                size="sm"
                className={blocker.active ? 'bg-amber-600 hover:bg-amber-600' : ''}
                onClick={() => onToggleBlocker(blocker.id)}
              >
                {blocker.label}
              </Button>
            ))}
          </div>
          <Input
            value={prepSession.blockerNote}
            onChange={(e) => onBlockerNoteChange(e.target.value)}
            placeholder="Optional blocker note (ex: chicken still thawing until Monday)"
          />
          {prepGroceryBlockersCount > 0 && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-blue-800">
                {prepGroceryBlockersCount === 1
                  ? '1 blocker depends on grocery completion.'
                  : `${prepGroceryBlockersCount} blockers depend on grocery completion.`}
              </p>
              <Button size="sm" variant="outline" onClick={onResolveBlockersInGrocery}>
                Resolve in Grocery
              </Button>
            </div>
          )}
          {blockerItemSuggestions.length > 0 && (
            <div className="rounded-md border border-indigo-200 bg-indigo-50/70 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-indigo-900 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-indigo-600" />
                  Blocker item suggestions
                </p>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-indigo-700" onClick={onGoToGrocery}>
                  View in Grocery
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {blockerItemSuggestions.map((suggestion) => (
                  suggestion.alreadyOnList ? (
                    <Badge key={suggestion.id} variant="outline" className="bg-green-50 border-green-200 text-green-700">
                      {suggestion.name} • On list
                    </Badge>
                  ) : (
                    <Button
                      key={suggestion.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-indigo-200 text-indigo-800"
                      onClick={() => onAddBlockerSuggestion(suggestion)}
                    >
                      <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                      Add {suggestion.name}
                    </Button>
                  )
                ))}
              </div>
              <p className="text-[11px] text-indigo-700">
                Quick-add items now, then finish shopping to unblock prep.
              </p>
            </div>
          )}
          {blockerSuggestionTrackedCount > 0 && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-emerald-900">
                  Suggestion resolution tracker
                </p>
                <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                  {blockerSuggestionResolvedCount}/{blockerSuggestionTrackedCount} resolved
                </Badge>
              </div>
              <p className="text-[11px] text-emerald-700">
                Blocker confidence: {blockerSuggestionConfidenceLabel}
              </p>
              {unresolvedBlockerSuggestionNames.length > 0 ? (
                <p className="text-[11px] text-emerald-800">
                  Still pending: {unresolvedBlockerSuggestionNames.join(', ')}.
                </p>
              ) : (
                <p className="text-[11px] text-emerald-800">
                  All tracked blocker suggestions are completed in Grocery.
                </p>
              )}
              {prepResolvedViaTrackedSuggestions && (
                <p className="text-[11px] text-emerald-900">
                  Grocery-linked blockers were cleared from completed suggestion items.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-indigo-500" />
              Prep checklist ({prepProgress}% done)
            </p>
            <p className="text-xs text-gray-600">{prepSession.tasks.filter((task) => task.done).length}/{prepSession.tasks.length} tasks</p>
          </div>
          <div className="space-y-2">
            {prepSession.tasks.map((task) => {
              const carriedOver = prepSession.carryoverTaskIds.includes(task.id);
              return (
                <label key={task.id} className="flex items-center justify-between gap-2 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={task.done} onCheckedChange={() => onToggleTask(task.id)} />
                    <span className={task.done ? 'line-through text-gray-500' : ''}>{task.label}</span>
                  </div>
                  {carriedOver && !task.done && <Badge variant="secondary" className="text-[10px]">Carryover</Badge>}
                </label>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <MoveRight className="w-4 h-4 text-indigo-500" />
              Carryover to next prep session
            </p>
            <Badge variant="outline">{unfinishedTasks.length} unfinished</Badge>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Carry unfinished tasks forward so next week's prep starts with what slipped.
          </p>
          <Button variant="outline" size="sm" onClick={onCarryForwardUnfinished} disabled={unfinishedTasks.length === 0}>
            Carry Forward Unfinished Tasks
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onMarkPrepComplete}
            disabled={!prepSessionPlanned || !prepRecommendationsAvailable || prepSessionCompleted || activeBlockers.length > 0}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Mark Prep Complete
          </Button>
          {prepSessionCompleted && (
            <Button variant="outline" onClick={onResetPrepCompletion}>
              <Clock className="w-4 h-4 mr-2" />
              Reopen Session
            </Button>
          )}
          <Button variant="ghost" onClick={onGoToChecklist}>
            Back to Weekly Readiness
          </Button>
        </div>
      </CardContent>
    </Card>
    </>
  );
};

export default PrepTabSection;
