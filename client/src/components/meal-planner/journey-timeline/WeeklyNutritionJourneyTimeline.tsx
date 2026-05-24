import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, ShieldCheck, Activity, Brain } from 'lucide-react';
import { deriveTimelineEvents } from './journeyTimelineEvents';
import type { JourneyTimelineContext, JourneyTimelineEvent } from './journeyTimelineTypes';

type Props = {
  context: JourneyTimelineContext;
};

const toneClasses: Record<JourneyTimelineEvent['tone'], string> = {
  neutral: 'border-slate-200 bg-white text-slate-800',
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
};

const iconByType: Record<JourneyTimelineEvent['type'], React.ReactNode> = {
  'semantic-event': <Brain className="h-4 w-4" />,
  'recovery-event': <ShieldCheck className="h-4 w-4" />,
  'momentum-event': <Sparkles className="h-4 w-4" />,
  'continuity-event': <Activity className="h-4 w-4" />,
  'prep-event': <Activity className="h-4 w-4" />,
  'readiness-event': <ShieldCheck className="h-4 w-4" />,
  'campaign-phase-event': <Sparkles className="h-4 w-4" />,
  'sustainability-event': <ShieldCheck className="h-4 w-4" />,
  'ai-coach-event': <Brain className="h-4 w-4" />,
};

const WeeklyNutritionJourneyTimeline: React.FC<Props> = ({ context }) => {
  const events = React.useMemo(() => deriveTimelineEvents(context), [context]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Nutrition Journey Timeline</CardTitle>
        <CardDescription>
          Adaptive orchestration of campaign arcs, semantic cadence, continuity chains, readiness shifts, and AI coach interventions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-[800px] gap-3">
            {events.map((event) => (
              <div key={event.id} className={`w-56 shrink-0 rounded-xl border p-3 shadow-sm transition-all hover:shadow ${toneClasses[event.tone]}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">Day {event.dayIndex + 1}</Badge>
                  <span className="inline-flex items-center">{iconByType[event.type]}</span>
                </div>
                <p className="text-sm font-semibold">{event.title}</p>
                <p className="mt-1 text-xs opacity-90">{event.detail}</p>
                {event.tags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {event.tags.slice(0, 2).map((tag) => (
                      <Badge key={`${event.id}-${tag}`} variant="secondary" className="text-[10px]">{tag}</Badge>
                    ))}
                  </div>
                ) : null}
                {typeof event.score === 'number' && (
                  <div className="mt-2 h-1.5 rounded-full bg-white/60">
                    <div className="h-1.5 rounded-full bg-current" style={{ width: `${Math.max(8, Math.round(event.score * 100))}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyNutritionJourneyTimeline;
