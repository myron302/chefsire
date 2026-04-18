import React from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Lightbulb, ListChecks, MoveRight, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

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
  carryoverTaskIds: string[];
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
}: PrepTabSectionProps) => {
  const activeBlockers = prepSession.blockers.filter((blocker) => blocker.active);
  const unfinishedTasks = prepSession.tasks.filter((task) => !task.done);

  return (
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
  );
};

export default PrepTabSection;
