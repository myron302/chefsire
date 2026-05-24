import type { JourneyTimelineContext, JourneyTimelineEvent } from './journeyTimelineTypes';

export const deriveContinuityTimelineEvents = (context: JourneyTimelineContext): JourneyTimelineEvent[] => {
  const continuityStable = Boolean(context.completionSemantics?.continuityCompletion);
  return [
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
    },
  ];
};
