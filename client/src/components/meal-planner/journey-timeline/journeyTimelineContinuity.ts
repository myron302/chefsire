import type { JourneyTimelineContext, JourneyTimelineEvent } from './journeyTimelineTypes';

export const deriveContinuityTimelineEvents = (context: JourneyTimelineContext): JourneyTimelineEvent[] => {
  const continuityStable = Boolean(context.completionSemantics?.continuityCompletion);
  const base: JourneyTimelineEvent[] = [
    {
      id: 'continuity-chain',
      dayIndex: 5,
      type: 'continuity-event',
      title: continuityStable ? 'Continuity chain reinforced' : 'Continuity chain rebuilding',
      detail: continuityStable
        ? 'Breakfast anchors, leftovers, and prep dependencies are aligned into stable clusters.'
        : 'Planner is preserving low-friction anchors while continuity consistency improves.',
      tone: continuityStable ? 'positive' : 'neutral',
      marker: 'chain',
      tags: ['breakfast chain', 'leftover links', 'prep dependency'],
      lane: 'continuity',
      chainId: 'core-continuity',
      explainability: 'Continuity is preserved to protect adherence while adaptation shifts cadence around anchors.',
    },
  ];

  const linkEvents = (context.continuityLinks || []).slice(0, 8).map((link) => ({
    id: `continuity-${link.id}`,
    dayIndex: link.dayIndex,
    type: 'continuity-event' as const,
    title: `${link.label} chain`,
    detail: `${link.relationship.replace('-', ' ')} continuity ${typeof link.strength === 'number' ? `(${Math.round(link.strength * 100)}% confidence)` : 'detected'}.`,
    tone: (link.strength || 0) >= 0.6 ? ('positive' as const) : ('neutral' as const),
    tags: ['continuity chain', link.relationship],
    lane: 'continuity' as const,
    chainId: link.id,
    explainability: 'Continuity links expose how repeated meal structure lowers decision fatigue and protects consistency.',
    score: link.strength,
  }));

  return [...base, ...linkEvents];
};
