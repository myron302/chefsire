import type { NutritionTemporalRhythmProfile } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalRhythmProfile';

export const deriveTemporalAdaptationBias = (profile: NutritionTemporalRhythmProfile): string[] => {
  const notes: string[] = [];
  if (profile.rhythmStabilityScore > 0.65) notes.push('Deploy novelty in current stable momentum window.');
  if (profile.recoveryWindowScore < 0.45) notes.push('Reduce challenge and prioritize recovery pacing.');
  if (profile.cadenceTransitionScore < 0.5) notes.push('Shift to lighter cadence transition guidance this week.');
  if (profile.continuityProtectionScore < 0.5) notes.push('Pre-activate continuity anchors before likely instability.');
  if (profile.prepRecoveryWindowScore > 0.55) notes.push('Schedule prep rebound immediately after recovery phase.');
  return notes;
};

export const deriveRhythmOrchestrationStrategies = (profile: NutritionTemporalRhythmProfile): string[] => [
  profile.noveltyWindowScore > 0.6 ? 'Novelty reintroduction window is open.' : 'Novelty should remain capped until rhythm stabilizes.',
  profile.recoveryWindowScore > 0.55 ? 'Recovery sequencing is ready for moderate challenge.' : 'Recovery sequencing should be protected from new load.',
  profile.prepRecoveryWindowScore > 0.55 ? 'Prep recovery windows can carry continuity.' : 'Keep prep expectations lightweight and bounded.',
  profile.continuityProtectionScore > 0.55 ? 'Continuity protection can be proactive this cycle.' : 'Add conservative continuity anchors now.',
];

export const deriveCadencePhaseRecommendations = (profile: NutritionTemporalRhythmProfile): string[] => {
  if (profile.cadenceTransitionScore >= 0.7) return ['Advance cadence with a momentum-focused transition.'];
  if (profile.cadenceTransitionScore >= 0.5) return ['Use a blended cadence: moderate challenge, protected recovery.'];
  return ['Use stabilization cadence with explicit recovery checkpoints.'];
};
