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
      lane: 'cadence',
      explainability: 'Cadence events explain why the planner changes meal mood and novelty to prevent semantic fatigue.',
    },
  ];

  for (const signal of (context.cadenceSignals || []).slice(0, 10)) {
    events.push({
      id: `semantic-cadence-${signal.dayIndex}-${signal.cadence}`,
      dayIndex: signal.dayIndex,
      type: signal.cadence === 'recovery' ? 'recovery-event' : 'semantic-event',
      title: `${signal.cadence.replace('-', '/')} cadence`,
      detail: signal.fatigueDelta && signal.fatigueDelta > 0
        ? `Fatigue accumulation increased by ${Math.round(signal.fatigueDelta * 100)}%, cadence adapted for recovery.`
        : 'Cadence tuned for sustainability and appetite rhythm alignment.',
      tone: signal.cadence === 'recovery' ? 'warning' : 'neutral',
      tags: ['semantic cadence', signal.cadence],
      lane: 'cadence',
      score: signal.intensity,
    });
  }

  return events;
};
