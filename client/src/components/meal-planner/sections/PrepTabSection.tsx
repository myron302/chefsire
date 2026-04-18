import React from 'react';
import { CalendarClock, CheckCircle2, Clock, ListChecks } from 'lucide-react';
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

export type PrepSessionState = {
  scheduledAt: string;
  notes: string;
  tasks: PrepTask[];
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
  onMarkPrepComplete: () => void;
  onResetPrepCompletion: () => void;
  onGoToChecklist: () => void;
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
  onMarkPrepComplete,
  onResetPrepCompletion,
  onGoToChecklist,
}: PrepTabSectionProps) => {
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
              Schedule prep, check off tasks, and mark the week execution-ready.
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

        <div className="rounded-lg border bg-white p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-indigo-500" />
              Prep checklist ({prepProgress}% done)
            </p>
            <p className="text-xs text-gray-600">{prepSession.tasks.filter((task) => task.done).length}/{prepSession.tasks.length} tasks</p>
          </div>
          <div className="space-y-2">
            {prepSession.tasks.map((task) => (
              <label key={task.id} className="flex items-center gap-2 text-sm text-gray-700">
                <Checkbox checked={task.done} onCheckedChange={() => onToggleTask(task.id)} />
                <span className={task.done ? 'line-through text-gray-500' : ''}>{task.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onMarkPrepComplete}
            disabled={!prepSessionPlanned || !prepRecommendationsAvailable || prepSessionCompleted}
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
