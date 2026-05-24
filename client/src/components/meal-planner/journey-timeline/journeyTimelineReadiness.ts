import type { JourneyTimelineContext, JourneyTimelineEvent } from './journeyTimelineTypes';

export const derivePrepTimelineEvents = (context: JourneyTimelineContext): JourneyTimelineEvent[] => {
  const recoveryComplete = Boolean(context.completionSemantics?.recoveryCompletion);
  return [
    {
      id: 'prep-orchestration',
      dayIndex: 2,
      type: 'prep-event',
      title: recoveryComplete ? 'Prep orchestration efficient' : 'Prep intensity adapted',
      detail: recoveryComplete
        ? 'Prep cadence stayed sustainable and protected recovery capacity.'
        : 'Planner reduced prep overload while maintaining mission continuity.',
      tone: recoveryComplete ? 'positive' : 'warning',
      marker: 'prep',
      tags: ['prep windows', 'orchestration'],
    },
  ];
};

export const deriveReadinessTimelineEvents = (context: JourneyTimelineContext): JourneyTimelineEvent[] => {
  const stability = context.journeyStability ?? 0;
  return [
    {
      id: 'readiness-shift',
      dayIndex: 6,
      type: 'readiness-event',
      title: 'Readiness shift detected',
      detail: `Readiness and sustainability confidence tracked at ${Math.round(stability * 100)}% journey stability.`,
      tone: stability >= 0.6 ? 'positive' : 'neutral',
      marker: 'readiness',
      score: stability,
      tags: ['grocery readiness', 'weekly readiness'],
    },
    {
      id: 'sustainability-protection',
      dayIndex: 4,
      type: 'sustainability-event',
      title: context.completionSemantics?.sustainabilityCompletion ? 'Sustainability protection stable' : 'Sustainability protection period',
      detail: context.completionSemantics?.sustainabilityCompletion
        ? 'Current planning rhythm is maintaining sustainability guardrails.'
        : 'Planner is proactively protecting sustainability during volatility and fatigue.',
      tone: context.completionSemantics?.sustainabilityCompletion ? 'positive' : 'warning',
      marker: 'sustainability',
      tags: ['sustainability', 'stabilization'],
    },
  ];
};
