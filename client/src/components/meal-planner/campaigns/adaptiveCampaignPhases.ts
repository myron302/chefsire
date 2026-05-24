export type CampaignJourneyPhase =
  | 'onboarding'
  | 'stabilization'
  | 'recovery'
  | 'momentum'
  | 'escalation'
  | 'maintenance'
  | 'reset'
  | 'sustainability-protection';

export type CampaignTrajectory = {
  adherenceTrajectory: number;
  fatigueTrajectory: number;
  prepStability: number;
  semanticFatigue: number;
  continuitySuccess: number;
  readinessTrend: number;
  sustainabilityTrend: number;
  volatilityPattern: number;
  missionCompletionConsistency: number;
};

export const deriveCampaignPhaseIntensity = (phase: CampaignJourneyPhase): number => {
  switch (phase) {
    case 'onboarding': return 0.45;
    case 'stabilization': return 0.5;
    case 'recovery': return 0.4;
    case 'momentum': return 0.72;
    case 'escalation': return 0.86;
    case 'maintenance': return 0.62;
    case 'reset': return 0.48;
    case 'sustainability-protection': return 0.43;
    default: return 0.55;
  }
};

export const deriveCampaignPhase = (trajectory: CampaignTrajectory): CampaignJourneyPhase => {
  if (trajectory.semanticFatigue >= 0.72) return 'reset';
  if (trajectory.sustainabilityTrend <= 0.42 || trajectory.fatigueTrajectory >= 0.7) return 'sustainability-protection';
  if (trajectory.fatigueTrajectory >= 0.62 || trajectory.prepStability <= 0.45) return 'recovery';
  if (trajectory.volatilityPattern >= 0.6 || trajectory.missionCompletionConsistency <= 0.5) return 'stabilization';
  if (trajectory.adherenceTrajectory >= 0.75 && trajectory.continuitySuccess >= 0.68 && trajectory.readinessTrend >= 0.65) return 'escalation';
  if (trajectory.adherenceTrajectory >= 0.66) return 'momentum';
  if (trajectory.missionCompletionConsistency >= 0.63) return 'maintenance';
  return 'onboarding';
};
