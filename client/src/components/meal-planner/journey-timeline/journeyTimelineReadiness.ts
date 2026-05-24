import type { JourneyTimelineContext, JourneyTimelineEvent } from './journeyTimelineTypes';

export const derivePrepTimelineEvents = (context: JourneyTimelineContext): JourneyTimelineEvent[] => {
  const recoveryComplete = Boolean(context.completionSemantics?.recoveryCompletion);
  const prepEvents = (context.prepMoments || []).slice(0, 7).map((prep, index) => ({
    id: `prep-${prep.dayIndex}-${index}`,
    dayIndex: prep.dayIndex,
    type: 'prep-event' as const,
    title: prep.complete ? 'Prep window completed' : 'Prep window scheduled',
    detail: prep.label || (prep.complete ? 'Prep orchestration completed and ready for continuity handoff.' : 'Prep orchestration queued for the next meal chain.'),
    tone: prep.complete ? ('positive' as const) : ('neutral' as const),
    tags: ['prep windows', 'orchestration'],
    lane: 'prep' as const,
  }));

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
      lane: 'prep',
      explainability: 'Prep adaptations explain why workload changed while continuity remained intact.',
    },
    ...prepEvents,
  ];
};

export const deriveReadinessTimelineEvents = (context: JourneyTimelineContext): JourneyTimelineEvent[] => {
  const stability = context.journeyStability ?? 0;
  const readinessSignals = (context.readinessSignals || []).slice(0, 7).map((signal, index) => ({
    id: `readiness-${signal.dayIndex}-${index}`,
    dayIndex: signal.dayIndex,
    type: 'readiness-event' as const,
    title: signal.label || 'Readiness checkpoint',
    detail: `Readiness confidence ${Math.round(signal.score * 100)}%.`,
    tone: signal.score > 0.65 ? ('positive' as const) : ('neutral' as const),
    score: signal.score,
    tags: ['weekly readiness'],
    lane: 'readiness' as const,
  }));

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
      lane: 'readiness',
      explainability: 'Readiness signals clarify why the planner escalates or stabilizes execution intensity.',
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
      lane: 'readiness',
    },
    ...readinessSignals,
  ];
};
