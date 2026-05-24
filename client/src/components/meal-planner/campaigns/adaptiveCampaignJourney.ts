import type { CampaignJourneyPhase, CampaignTrajectory } from './adaptiveCampaignPhases';
import { deriveCampaignArc, deriveCampaignTrajectory } from './adaptiveCampaignArcs';
import { derivePhaseTransitionReason, shouldTransitionCampaignPhase, calculateCampaignMomentum } from './adaptiveCampaignTransitions';
import type { AdaptiveCampaignProfile } from './adaptiveCampaignScaling';
import type { NutritionCampaignSignals } from './nutritionCampaignTypes';

export type CampaignJourneyHistoryEntry = {
  phase: CampaignJourneyPhase;
  reason: string;
  occurredAt: string;
  momentum: number;
};
export type CampaignJourneyState = {
  phase: CampaignJourneyPhase;
  momentum: number;
  narrative: string;
  trajectory: CampaignTrajectory;
  history: CampaignJourneyHistoryEntry[];
};

const CAP = 24;
const historyKey = (campaignId: string, userId?: string | null) => `nutrition-campaign-journey-v1:${campaignId}:${userId || 'anon'}`;

export const appendCampaignJourneyHistory = (history: CampaignJourneyHistoryEntry[], entry: CampaignJourneyHistoryEntry): CampaignJourneyHistoryEntry[] => [...history, entry].slice(-CAP);
export const calculateCampaignJourneyStability = (history: CampaignJourneyHistoryEntry[]): number => {
  if (history.length < 2) return 1;
  const transitions = history.reduce((count, item, index) => index === 0 ? count : count + Number(item.phase !== history[index - 1].phase), 0);
  return Number(Math.max(0, 1 - transitions / Math.max(1, history.length - 1)).toFixed(2));
};
export const deriveCampaignJourneySummary = (history: CampaignJourneyHistoryEntry[]) => ({
  completedPhases: Array.from(new Set(history.map((item) => item.phase))),
  recoveryInterventions: history.filter((item) => item.phase === 'recovery' || item.phase === 'sustainability-protection').length,
  stabilizationStreaks: history.filter((item) => item.phase === 'stabilization').length,
  momentumStreaks: history.filter((item) => item.phase === 'momentum' || item.phase === 'escalation').length,
  sustainabilityRescues: history.filter((item) => item.reason.toLowerCase().includes('sustainability')).length,
});

export const deriveCampaignArcNarrative = (phase: CampaignJourneyPhase): string => ({ onboarding: 'Building your planning foundation.', stabilization: 'Stabilizing your planning rhythm.', recovery: 'Recovery cadence engaged.', momentum: 'Momentum is building.', escalation: 'Escalating with confidence and consistency.', maintenance: 'Maintaining your sustainable baseline.', reset: 'Refreshing semantic variety.', 'sustainability-protection': 'Protecting sustainability during fatigue.' }[phase]);
export const deriveCampaignMomentumNarrative = (momentum: number): string => momentum >= 0.75 ? 'High momentum arc active.' : momentum >= 0.55 ? 'Momentum trend is improving.' : 'Momentum protected while rebuilding consistency.';
export const deriveCampaignRecoveryNarrative = (trajectory: CampaignTrajectory): string => trajectory.fatigueTrajectory >= 0.65 ? 'Recovery protection active to reduce fatigue.' : 'Recovery guardrails available if fatigue rises.';

export const deriveSustainabilityCompletion = (trajectory: CampaignTrajectory): boolean => trajectory.sustainabilityTrend >= 0.68 && trajectory.fatigueTrajectory <= 0.52;
export const deriveRecoveryCompletion = (trajectory: CampaignTrajectory): boolean => trajectory.fatigueTrajectory <= 0.45 && trajectory.prepStability >= 0.56;
export const deriveCampaignCompletionSemantics = (trajectory: CampaignTrajectory, missionCompletionPct: number) => ({
  sustainabilityCompletion: deriveSustainabilityCompletion(trajectory),
  recoveryCompletion: deriveRecoveryCompletion(trajectory),
  continuityCompletion: trajectory.continuitySuccess >= 0.65,
  stabilizationCompletion: trajectory.volatilityPattern <= 0.42,
  semanticResetCompletion: trajectory.semanticFatigue <= 0.5,
  missionCompletionPct,
});

export const evolveCampaignJourney = (args: {
  campaignId: string;
  signals: NutritionCampaignSignals;
  profile?: AdaptiveCampaignProfile;
  previousPhase?: CampaignJourneyPhase | null;
  userId?: string | null;
}): CampaignJourneyState => {
  const trajectory = deriveCampaignTrajectory(args.signals, args.profile);
  const arc = deriveCampaignArc(trajectory);
  const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(historyKey(args.campaignId, args.userId));
  const history: CampaignJourneyHistoryEntry[] = stored ? JSON.parse(stored) : [];
  const shouldTransition = shouldTransitionCampaignPhase(args.previousPhase, arc.phase, trajectory);
  const effectivePhase = shouldTransition ? arc.phase : (args.previousPhase || arc.phase);
  const momentum = calculateCampaignMomentum(trajectory);
  const reason = derivePhaseTransitionReason(args.previousPhase, effectivePhase, trajectory);
  const nextHistory = shouldTransition
    ? appendCampaignJourneyHistory(history, { phase: effectivePhase, reason, occurredAt: new Date().toISOString(), momentum })
    : history;
  if (typeof localStorage !== 'undefined') localStorage.setItem(historyKey(args.campaignId, args.userId), JSON.stringify(nextHistory));

  return { phase: effectivePhase, momentum, trajectory, history: nextHistory, narrative: `${deriveCampaignArcNarrative(effectivePhase)} ${deriveCampaignMomentumNarrative(momentum)}` };
};
