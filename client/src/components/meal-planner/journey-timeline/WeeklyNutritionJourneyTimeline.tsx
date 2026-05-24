import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, ShieldCheck, Activity, Brain, ChevronDown, ChevronUp } from 'lucide-react';
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

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const WeeklyNutritionJourneyTimeline: React.FC<Props> = ({ context }) => {
  const [expandedIds, setExpandedIds] = React.useState<Record<string, boolean>>(() => {
    try {
      const cached = localStorage.getItem('chefsire.journeyTimeline.expanded');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  const events = React.useMemo(() => deriveTimelineEvents(context), [context]);
  const eventsByDay = React.useMemo(() => {
    return Array.from({ length: 7 }, (_, dayIndex) => events.filter((event) => event.dayIndex === dayIndex));
  }, [events]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('chefsire.journeyTimeline.expanded', JSON.stringify(next));
      return next;
    });
  };

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
          <div className="grid min-w-[980px] grid-cols-7 gap-3">
            {eventsByDay.map((dayEvents, dayIndex) => (
              <div key={dayIndex} className="relative rounded-xl border bg-slate-50/70 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] uppercase">{weekDays[dayIndex]}</Badge>
                  <span className="text-[10px] text-slate-500">{dayEvents.length} events</span>
                </div>

                <div className="space-y-2">
                  {dayEvents.map((event) => {
                    const isExpanded = Boolean(expandedIds[event.id]);
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => toggleExpanded(event.id)}
                        className={`w-full rounded-xl border p-2 text-left shadow-sm transition-all hover:shadow ${toneClasses[event.tone]}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
                            {iconByType[event.type]}
                            <span>{event.title}</span>
                          </div>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </div>
                        <p className="mt-1 text-xs opacity-90">{event.detail}</p>
                        {typeof event.score === 'number' && (
                          <div className="mt-2 h-1.5 rounded-full bg-white/60">
                            <div className="h-1.5 rounded-full bg-current" style={{ width: `${Math.max(8, Math.round(event.score * 100))}%` }} />
                          </div>
                        )}
                        {isExpanded && (
                          <>
                            {event.explainability && <p className="mt-2 text-[11px] font-medium">Why: {event.explainability}</p>}
                            {event.tags?.length ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {event.tags.slice(0, 4).map((tag) => (
                                  <Badge key={`${event.id}-${tag}`} variant="secondary" className="text-[10px]">{tag}</Badge>
                                ))}
                              </div>
                            ) : null}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyNutritionJourneyTimeline;
