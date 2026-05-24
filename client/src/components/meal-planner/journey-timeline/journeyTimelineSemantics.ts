import type { JourneyTimelineContext, JourneyTimelineEvent } from './journeyTimelineTypes';

export const deriveSemanticTimelineEvents = (context: JourneyTimelineContext): JourneyTimelineEvent[] => {
  const semanticReset = Boolean(context.completionSemantics && !context.completionSemantics.semanticResetCompletion);
  const events: JourneyTimelineEvent[] = [
    {
      id: 'semantic-cadence',
      dayIndex: 2,
      type: 'semantic-event',
      title: semanticReset ? 'Semantic freshness reset' : 'Semantic cadence stabilized',
      detail: semanticReset
        ? 'Semantic fatigue signals rose, so the planner increased novelty and fresh/light meal rotation.'
        : 'Semantic variety remains healthy with balanced cozy/heavy and fresh/light cadence.',
      tone: semanticReset ? 'warning' : 'positive',
      marker: semanticReset ? 'refresh' : 'cadence',
      tags: ['semantic cadence', 'meal rhythm'],
    },
  ];

  if (context.completionSemantics?.continuityCompletion) {
    events.push({
      id: 'semantic-continuity-support',
      dayIndex: 4,
      type: 'continuity-event',
      title: 'Continuity stabilized adherence',
      detail: 'Repeated anchors and leftover-friendly sequencing reinforced consistency.',
      tone: 'positive',
      marker: 'anchor',
      tags: ['continuity chain', 'stability anchor'],
    });
  }

  return events;
};
