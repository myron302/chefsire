import type { CampaignJourneyPhase, CampaignTrajectory } from './adaptiveCampaignPhases';

export const calculateCampaignMomentum = (trajectory: CampaignTrajectory): number => {
  const raw =
    (trajectory.adherenceTrajectory * 0.3) +
    (trajectory.continuitySuccess * 0.2) +
    (trajectory.readinessTrend * 0.15) +
    (trajectory.missionCompletionConsistency * 0.15) +
    ((1 - trajectory.fatigueTrajectory) * 0.1) +
    ((1 - trajectory.volatilityPattern) * 0.1);
  return Number(Math.max(0, Math.min(1, raw)).toFixed(2));
};

export const shouldTransitionCampaignPhase = (
  currentPhase: CampaignJourneyPhase | null | undefined,
  nextPhase: CampaignJourneyPhase,
  trajectory: CampaignTrajectory,
): boolean => {
  if (!currentPhase) return true;
  if (currentPhase === nextPhase) return false;
  const momentum = calculateCampaignMomentum(trajectory);
  if (nextPhase === 'momentum' || nextPhase === 'escalation') return momentum >= 0.62;
  if (nextPhase === 'recovery' || nextPhase === 'sustainability-protection') return trajectory.fatigueTrajectory >= 0.58 || trajectory.sustainabilityTrend <= 0.5;
  return true;
};

export const derivePhaseTransitionReason = (
  currentPhase: CampaignJourneyPhase | null | undefined,
  nextPhase: CampaignJourneyPhase,
  trajectory: CampaignTrajectory,
): string => {
  if (!currentPhase) return `Journey initialized in ${nextPhase}.`;
  if (nextPhase === 'reset') return 'Semantic fatigue triggered a freshness reset.';
  if (nextPhase === 'sustainability-protection') return 'Protecting sustainability during fatigue and overload.';
  if (nextPhase === 'recovery') return 'Recovery cadence engaged from rising fatigue.';
  if (nextPhase === 'stabilization') return 'Stabilization mode activated during volatility.';
  if (nextPhase === 'momentum') return 'Momentum phase unlocked through consistent continuity.';
  if (nextPhase === 'escalation') return 'High adherence and readiness unlocked escalation.';
  if (nextPhase === 'maintenance') return 'Maintaining steady mission consistency.';
  return `Transitioned from ${currentPhase} to ${nextPhase}.`;
};
