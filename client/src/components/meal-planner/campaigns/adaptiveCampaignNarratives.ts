import type { AdaptiveCampaignProfile } from './adaptiveCampaignScaling';

export const deriveCampaignRecoveryFocus = (profile: AdaptiveCampaignProfile): number => {
  const instabilityLoad = profile.volatilityLevel * 0.45;
  const fatigueLoad = profile.fatigueSensitivity * 0.35;
  const prepStress = (1 - profile.prepTolerance) * 0.2;
  return Math.min(1, Math.max(0, instabilityLoad + fatigueLoad + prepStress));
};

export const deriveCampaignMood = (profile: AdaptiveCampaignProfile): 'recovery' | 'stabilization' | 'momentum' | 'variety-refresh' => {
  if (profile.semanticFatigue >= 0.65) return 'variety-refresh';
  const recoveryFocus = deriveCampaignRecoveryFocus(profile);
  if (recoveryFocus >= 0.68) return 'recovery';
  if (profile.continuitySuccess >= 0.62 && profile.adherenceStrength >= 0.6) return 'momentum';
  return 'stabilization';
};

export const deriveCampaignNarrative = (profile: AdaptiveCampaignProfile): string => {
  const mood = deriveCampaignMood(profile);
  if (mood === 'recovery') return 'Recovery-focused week';
  if (mood === 'variety-refresh') return 'Semantic variety refresh';
  if (mood === 'momentum') return profile.continuitySuccess > 0.72 ? 'Comfort continuity reset' : 'Low-friction sustainability sprint';
  return profile.prepTolerance < 0.45 ? 'Low-friction sustainability sprint' : 'Fresh/light stabilization week';
};
