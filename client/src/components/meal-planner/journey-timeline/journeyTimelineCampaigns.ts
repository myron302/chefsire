import type { JourneyTimelineContext, JourneyTimelineEvent } from './journeyTimelineTypes';

export const deriveCampaignTimelineEvents = (context: JourneyTimelineContext): JourneyTimelineEvent[] => {
  const events: JourneyTimelineEvent[] = [];
  if (context.phase) {
    events.push({
      id: 'campaign-phase',
      dayIndex: 0,
      type: 'campaign-phase-event',
      title: `${String(context.phase).replace('-', ' ')} phase active`,
      detail: context.phaseNarrative || 'Campaign journey phase is adapting to current planner signals.',
      tone: 'neutral',
      marker: 'phase',
      phase: context.phase as any,
      tags: ['campaign arc'],
      lane: 'campaign',
      explainability: 'Phase events expose campaign arc evolution and why mission pacing changed.',
    });
  }
  if (context.transitionReason) {
    events.push({
      id: 'campaign-transition',
      dayIndex: 1,
      type: 'campaign-phase-event',
      title: 'Campaign phase transition',
      detail: context.transitionReason,
      tone: 'positive',
      marker: 'transition',
      tags: ['explainability'],
      lane: 'campaign',
    });
  }
  if (typeof context.momentum === 'number') {
    events.push({
      id: 'campaign-momentum',
      dayIndex: 3,
      type: context.momentum >= 0.6 ? 'momentum-event' : 'recovery-event',
      title: context.momentum >= 0.6 ? 'Momentum phase unlocked' : 'Recovery protection activated',
      detail: `Momentum index is ${Math.round(context.momentum * 100)}%, driving adaptive mission pacing.`,
      tone: context.momentum >= 0.6 ? 'positive' : 'warning',
      marker: context.momentum >= 0.6 ? 'momentum' : 'recovery',
      score: context.momentum,
      tags: ['campaign arc', 'adaptive pacing'],
      lane: 'campaign',
      explainability: 'Momentum vs recovery gating prevents burnout while preserving campaign progression.',
    });
  }
  return events;
};
