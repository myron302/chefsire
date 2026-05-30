import React from 'react';
import type { NutritionCampaignAdaptiveRecommendation, NutritionCampaignDefinition, NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import { buildMissionWhy } from '@/components/meal-planner/campaigns/components/campaignPanelUtils';
import { deriveCampaignAchievements } from '@/components/meal-planner/campaigns/ecosystem/campaignAchievements';
import { deriveSharedCampaignProgress, deriveCollaborativeMissionSuggestions } from '@/components/meal-planner/campaigns/ecosystem/householdCampaigns';
import { deriveCampaignJourneyType, deriveJourneyCategoryNarrative } from '@/components/meal-planner/campaigns/ecosystem/campaignJourneyTypes';
import { deriveCoachCampaignInsights, deriveCampaignInterventionReasoning } from '@/components/meal-planner/campaigns/ecosystem/coachCampaignIntegration';
import { deriveCampaignEvents } from '@/components/meal-planner/campaigns/ecosystem/campaignEvents';
import { deriveCampaignLearningProfile, deriveAdaptiveLearningInsights } from '@/components/meal-planner/campaigns/evolution/campaignLearningProfiles';
import { deriveEvolutionTimeline } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionTimeline';
import { deriveCampaignRecommendationFeedback } from '@/components/meal-planner/campaigns/evolution/campaignRecommendationFeedback';
import { deriveBehavioralPreferenceNarratives, deriveBehavioralSensitivitySignals, deriveBehavioralStrengths } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralPreferences';
import { deriveBehavioralIntelligenceProfile } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralIntelligenceProfile';
import { deriveBehavioralEvolutionTimeline } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralEvolutionTimeline';
import { deriveBehavioralRecommendationConfidence, deriveBehavioralCompatibilityScore, deriveGlobalRecommendationBias } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralRecommendationIntelligence';
import { deriveAdaptiveStrategyWeights, deriveBehavioralStrategyBias } from '@/components/meal-planner/campaigns/behavioral-intelligence/adaptiveStrategyWeights';
import { deriveContextualAdaptationBias, deriveContextualInterventionStrategies } from '@/components/meal-planner/campaigns/life-state-intelligence/contextualAdaptation';
import { deriveContextualStabilityProfile, deriveRecoveryStabilizationWindows } from '@/components/meal-planner/campaigns/life-state-intelligence/contextualStability';
import { deriveLifeStateEvolutionTimeline } from '@/components/meal-planner/campaigns/life-state-intelligence/contextualTimeline';
import { deriveContextualStrategyWeights, deriveProtectiveAdaptationBias } from '@/components/meal-planner/campaigns/life-state-intelligence/contextualStrategyWeights';
import { deriveContextualCompatibilityScore, deriveContextualRecommendationConfidence, deriveProtectiveRecommendationBias } from '@/components/meal-planner/campaigns/life-state-intelligence/contextualRecommendationIntelligence';
import { deriveTemporalAdaptationBias, deriveRhythmOrchestrationStrategies, deriveCadencePhaseRecommendations } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalAdaptation';
import { deriveTemporalPhase, deriveTemporalPhaseTransitions, deriveRhythmCycleNarratives } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalPhaseModeling';
import { deriveTemporalStabilityProfile } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalStability';
import { deriveTemporalCompatibilityScore, deriveTemporalRecommendationConfidence, deriveTemporalProtectionBias } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalRecommendationIntelligence';
import { deriveTemporalStrategyWeights, deriveRhythmProtectionBias } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalStrategyWeights';
import { deriveTemporalEvolutionTimeline } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalTimeline';
import { selectAdaptiveConfidence, selectCampaignProgress, selectStabilizationSummary, selectTemporalRhythmSummary } from '@/components/meal-planner/planner-core/selectors';
import type { CampaignEvolutionMemoryById } from '@/components/meal-planner/campaigns/hooks/useCampaignPersistence';

type UseCampaignIntelligenceInput = {
  activeCampaignId: string | null;
  activeCampaign: NutritionCampaignDefinition | null;
  progress: NutritionCampaignProgress | null;
  rankedCampaigns: NutritionCampaignDefinition[];
  activeRecommendation?: NutritionCampaignAdaptiveRecommendation;
  adaptiveRecommendationsByCampaignId?: Record<string, NutritionCampaignAdaptiveRecommendation>;
  evolutionMemoryByCampaignId: CampaignEvolutionMemoryById;
  behavioralProfile: ReturnType<typeof deriveBehavioralIntelligenceProfile> | null;
  lifeStateProfile: Parameters<typeof deriveContextualAdaptationBias>[0];
  temporalRhythmProfile: Parameters<typeof deriveTemporalPhase>[0];
};

export const useCampaignIntelligence = ({
  activeCampaignId,
  activeCampaign,
  progress,
  rankedCampaigns,
  activeRecommendation,
  adaptiveRecommendationsByCampaignId,
  evolutionMemoryByCampaignId,
  behavioralProfile,
  lifeStateProfile,
  temporalRhythmProfile,
}: UseCampaignIntelligenceInput) => {
  const adaptiveConfidence = React.useMemo(() => selectAdaptiveConfidence(activeRecommendation), [activeRecommendation]);
  const campaignProgressSummary = React.useMemo(() => selectCampaignProgress(progress), [progress]);
  const missionWhy = activeCampaign ? buildMissionWhy(activeCampaign, activeRecommendation) : '';
  const achievements = React.useMemo(() => deriveCampaignAchievements(progress), [progress]);
  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked);
  const sharedState = React.useMemo(() => deriveSharedCampaignProgress(progress, 3), [progress]);
  const collaborationSuggestions = React.useMemo(() => deriveCollaborativeMissionSuggestions(sharedState), [sharedState]);
  const activeJourneyType = activeCampaign ? deriveCampaignJourneyType(activeCampaign, progress) : null;
  const activeJourneyNarrative = activeJourneyType ? deriveJourneyCategoryNarrative(activeJourneyType) : '';
  const coachInsights = React.useMemo(
    () => deriveCoachCampaignInsights(rankedCampaigns, adaptiveRecommendationsByCampaignId, progress),
    [rankedCampaigns, adaptiveRecommendationsByCampaignId, progress],
  );
  const campaignInterventionReasoning = React.useMemo(() => deriveCampaignInterventionReasoning(progress), [progress]);
  const campaignEvents = React.useMemo(() => deriveCampaignEvents(progress), [progress]);

  const activeEvolutionMemory = activeCampaignId ? evolutionMemoryByCampaignId[activeCampaignId] : null;
  const activeLearningProfile = activeEvolutionMemory ? deriveCampaignLearningProfile(activeEvolutionMemory) : null;
  const activeLearningInsights = activeLearningProfile ? deriveAdaptiveLearningInsights(activeLearningProfile) : [];
  const activeEvolutionTimeline = deriveEvolutionTimeline(progress, activeEvolutionMemory);
  const activeRecommendationFeedback = activeEvolutionMemory
    ? deriveCampaignRecommendationFeedback(activeEvolutionMemory, activeRecommendation)
    : null;

  const resolvedBehavioralProfile = React.useMemo(
    () => behavioralProfile ?? deriveBehavioralIntelligenceProfile(Object.values(evolutionMemoryByCampaignId)),
    [behavioralProfile, evolutionMemoryByCampaignId],
  );
  const behavioralNarratives = React.useMemo(() => deriveBehavioralPreferenceNarratives(resolvedBehavioralProfile), [resolvedBehavioralProfile]);
  const behavioralStrengths = React.useMemo(() => deriveBehavioralStrengths(resolvedBehavioralProfile), [resolvedBehavioralProfile]);
  const behavioralSensitivity = React.useMemo(() => deriveBehavioralSensitivitySignals(resolvedBehavioralProfile), [resolvedBehavioralProfile]);
  const recommendationCompatibility = React.useMemo(
    () => deriveBehavioralCompatibilityScore(resolvedBehavioralProfile, activeRecommendation),
    [resolvedBehavioralProfile, activeRecommendation],
  );
  const behavioralRecommendationConfidence = React.useMemo(
    () => deriveBehavioralRecommendationConfidence(resolvedBehavioralProfile, recommendationCompatibility),
    [resolvedBehavioralProfile, recommendationCompatibility],
  );
  const globalRecommendationBias = React.useMemo(() => deriveGlobalRecommendationBias(resolvedBehavioralProfile), [resolvedBehavioralProfile]);
  const behavioralMilestones = React.useMemo(() => deriveBehavioralEvolutionTimeline(resolvedBehavioralProfile), [resolvedBehavioralProfile]);
  const strategyWeights = React.useMemo(() => deriveAdaptiveStrategyWeights(resolvedBehavioralProfile), [resolvedBehavioralProfile]);
  const strategyBias = React.useMemo(() => deriveBehavioralStrategyBias(strategyWeights), [strategyWeights]);

  const contextualAdaptationBias = React.useMemo(() => deriveContextualAdaptationBias(lifeStateProfile), [lifeStateProfile]);
  const contextualInterventions = React.useMemo(() => deriveContextualInterventionStrategies(lifeStateProfile), [lifeStateProfile]);
  const contextualStability = React.useMemo(() => deriveContextualStabilityProfile(lifeStateProfile, Object.values(evolutionMemoryByCampaignId)), [lifeStateProfile, evolutionMemoryByCampaignId]);
  const recoveryWindows = React.useMemo(() => deriveRecoveryStabilizationWindows(lifeStateProfile), [lifeStateProfile]);
  const contextualTimeline = React.useMemo(() => deriveLifeStateEvolutionTimeline(lifeStateProfile), [lifeStateProfile]);
  const contextualWeights = React.useMemo(() => deriveContextualStrategyWeights(lifeStateProfile), [lifeStateProfile]);
  const protectiveNotes = React.useMemo(() => deriveProtectiveAdaptationBias(contextualWeights), [contextualWeights]);
  const contextualCompatibility = React.useMemo(
    () => deriveContextualCompatibilityScore(resolvedBehavioralProfile, lifeStateProfile, activeRecommendation),
    [resolvedBehavioralProfile, lifeStateProfile, activeRecommendation],
  );
  const contextualRecommendationConfidence = React.useMemo(
    () => deriveContextualRecommendationConfidence(lifeStateProfile, contextualCompatibility),
    [lifeStateProfile, contextualCompatibility],
  );
  const protectiveRecommendationBias = React.useMemo(() => deriveProtectiveRecommendationBias(lifeStateProfile), [lifeStateProfile]);

  const temporalPhase = React.useMemo(() => deriveTemporalPhase(temporalRhythmProfile), [temporalRhythmProfile]);
  const temporalTransitions = React.useMemo(() => deriveTemporalPhaseTransitions(temporalRhythmProfile), [temporalRhythmProfile]);
  const rhythmNarratives = React.useMemo(() => deriveRhythmCycleNarratives(temporalRhythmProfile), [temporalRhythmProfile]);
  const temporalAdaptationBias = React.useMemo(() => deriveTemporalAdaptationBias(temporalRhythmProfile), [temporalRhythmProfile]);
  const rhythmStrategies = React.useMemo(() => deriveRhythmOrchestrationStrategies(temporalRhythmProfile), [temporalRhythmProfile]);
  const cadenceRecommendations = React.useMemo(() => deriveCadencePhaseRecommendations(temporalRhythmProfile), [temporalRhythmProfile]);
  const temporalStability = React.useMemo(() => deriveTemporalStabilityProfile(temporalRhythmProfile), [temporalRhythmProfile]);
  const temporalCompatibility = React.useMemo(
    () => deriveTemporalCompatibilityScore(resolvedBehavioralProfile, lifeStateProfile, temporalRhythmProfile, activeRecommendation),
    [resolvedBehavioralProfile, lifeStateProfile, temporalRhythmProfile, activeRecommendation],
  );
  const temporalRecommendationConfidence = React.useMemo(
    () => deriveTemporalRecommendationConfidence(temporalRhythmProfile, temporalCompatibility),
    [temporalRhythmProfile, temporalCompatibility],
  );
  const temporalProtectionBias = React.useMemo(() => deriveTemporalProtectionBias(temporalRhythmProfile), [temporalRhythmProfile]);
  const temporalWeights = React.useMemo(() => deriveTemporalStrategyWeights(temporalRhythmProfile), [temporalRhythmProfile]);
  const rhythmProtectionBias = React.useMemo(() => deriveRhythmProtectionBias(temporalWeights), [temporalWeights]);
  const temporalEvolutionTimeline = React.useMemo(() => deriveTemporalEvolutionTimeline(temporalRhythmProfile), [temporalRhythmProfile]);
  const stabilizationSummary = React.useMemo(
    () => selectStabilizationSummary(contextualStability as { resilienceScore?: number }, temporalStability as { stabilityIndex?: number }),
    [contextualStability, temporalStability],
  );
  const temporalRhythmSummary = React.useMemo(
    () => selectTemporalRhythmSummary(temporalPhase, temporalTransitions, cadenceRecommendations),
    [temporalPhase, temporalTransitions, cadenceRecommendations],
  );

  return {
    adaptiveConfidence,
    campaignProgressSummary,
    missionWhy,
    unlockedAchievements,
    sharedState,
    collaborationSuggestions,
    activeJourneyType,
    activeJourneyNarrative,
    coachInsights,
    campaignInterventionReasoning,
    campaignEvents,
    activeEvolutionMemory,
    activeLearningProfile,
    activeLearningInsights,
    activeEvolutionTimeline,
    activeRecommendationFeedback,
    resolvedBehavioralProfile,
    behavioralNarratives,
    behavioralStrengths,
    behavioralSensitivity,
    recommendationCompatibility,
    behavioralRecommendationConfidence,
    globalRecommendationBias,
    behavioralMilestones,
    strategyWeights,
    strategyBias,
    contextualAdaptationBias,
    contextualInterventions,
    contextualStability,
    recoveryWindows,
    contextualTimeline,
    contextualWeights,
    protectiveNotes,
    contextualCompatibility,
    contextualRecommendationConfidence,
    protectiveRecommendationBias,
    temporalPhase,
    temporalTransitions,
    rhythmNarratives,
    temporalAdaptationBias,
    rhythmStrategies,
    cadenceRecommendations,
    temporalStability,
    temporalRecommendationConfidence,
    temporalProtectionBias,
    temporalWeights,
    rhythmProtectionBias,
    temporalEvolutionTimeline,
    stabilizationSummary,
    temporalRhythmSummary,
  };
};
