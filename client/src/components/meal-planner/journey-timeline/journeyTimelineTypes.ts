import type { CampaignJourneyPhase } from '@/components/meal-planner/campaigns/adaptiveCampaignPhases';

export type JourneyTimelineEventType =
  | 'semantic-event'
  | 'recovery-event'
  | 'momentum-event'
  | 'continuity-event'
  | 'prep-event'
  | 'readiness-event'
  | 'campaign-phase-event'
  | 'sustainability-event'
  | 'ai-coach-event';

export type JourneyTimelineTone = 'neutral' | 'positive' | 'warning';

export type JourneyTimelineEvent = {
  id: string;
  dayIndex: number;
  type: JourneyTimelineEventType;
  title: string;
  detail: string;
  tone: JourneyTimelineTone;
  marker?: string;
  phase?: CampaignJourneyPhase;
  score?: number;
  tags?: string[];
};

export type JourneyTimelineContext = {
  weekStartLabel?: string;
  phase?: CampaignJourneyPhase | string;
  phaseNarrative?: string;
  momentum?: number;
  journeyStability?: number;
  transitionReason?: string;
  completionPct?: number;
  completedMissions?: number;
  totalMissions?: number;
  completionSemantics?: {
    sustainabilityCompletion: boolean;
    recoveryCompletion: boolean;
    continuityCompletion: boolean;
    stabilizationCompletion: boolean;
    semanticResetCompletion: boolean;
  };
  coachInsights?: Array<{
    id: string;
    description: string;
    severity?: 'positive' | 'neutral' | 'warning';
    category?: string;
  }>;
};
