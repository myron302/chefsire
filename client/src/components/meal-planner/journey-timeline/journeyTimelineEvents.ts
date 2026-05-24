import { deriveCampaignTimelineEvents } from './journeyTimelineCampaigns';
import { deriveSemanticTimelineEvents } from './journeyTimelineSemantics';
import { derivePrepTimelineEvents, deriveReadinessTimelineEvents } from './journeyTimelineReadiness';
import { deriveContinuityTimelineEvents } from './journeyTimelineContinuity';
import type { JourneyTimelineContext, JourneyTimelineEvent } from './journeyTimelineTypes';

const CAP = 28;

export const deriveTimelineEvents = (context: JourneyTimelineContext): JourneyTimelineEvent[] => {
  const aiCoachEvents: JourneyTimelineEvent[] = (context.coachInsights || []).slice(0, 6).map((insight, index) => ({
    id: `ai-coach-${insight.id}`,
    dayIndex: index % 7,
    type: 'ai-coach-event',
    title: 'AI Coach observation',
    detail: insight.description,
    tone: insight.severity === 'warning' ? 'warning' : insight.severity === 'positive' ? 'positive' : 'neutral',
    marker: 'coach',
    tags: ['ai coach', insight.category || 'insight'],
  }));

  return [
    ...deriveCampaignTimelineEvents(context),
    ...deriveSemanticTimelineEvents(context),
    ...deriveContinuityTimelineEvents(context),
    ...derivePrepTimelineEvents(context),
    ...deriveReadinessTimelineEvents(context),
    ...aiCoachEvents,
  ]
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .slice(0, CAP);
};
