import React from 'react';
import { CheckCircle2, Trophy, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import type { NutritionCampaignAdaptiveRecommendation } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import CampaignActivationCard from '@/components/meal-planner/campaigns/components/CampaignActivationCard';
import CampaignHeaderSummary from '@/components/meal-planner/campaigns/components/CampaignHeaderSummary';
import CampaignMissionCard from '@/components/meal-planner/campaigns/components/CampaignMissionCard';
import CampaignSuggestionCard from '@/components/meal-planner/campaigns/components/CampaignSuggestionCard';
import { useCampaignPersistence } from '@/components/meal-planner/campaigns/hooks/useCampaignPersistence';
import { useCampaignIntelligence } from '@/components/meal-planner/campaigns/hooks/useCampaignIntelligence';
import { buildCampaignPanelViewModel } from '@/components/meal-planner/campaigns/view-models/buildCampaignPanelViewModel';
import { selectActiveCampaign, selectRankedCampaigns } from '@/components/meal-planner/planner-core/selectors';

const WeeklyNutritionJourneyTimeline = React.lazy(() => import('@/components/meal-planner/journey-timeline/WeeklyNutritionJourneyTimeline'));
const ENABLE_JOURNEY_TIMELINE = true;

class TimelineErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Journey timeline render failed', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-600">
            Journey timeline is temporarily unavailable.
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

type Props = {
  activeCampaignId: string | null;
  lastActivatedCampaignId?: string | null;
  progress: NutritionCampaignProgress | null;
  onActivateCampaign: (campaignId: string) => void | Promise<void>;
  campaignActionPending?: boolean;
  campaignActionError?: string | null;
  onClearCampaign: () => void;
  adaptiveRecommendationsByCampaignId?: Record<string, NutritionCampaignAdaptiveRecommendation>;
};

const NutritionCampaignPanel: React.FC<Props> = ({
  activeCampaignId,
  lastActivatedCampaignId = null,
  progress,
  onActivateCampaign,
  onClearCampaign,
  adaptiveRecommendationsByCampaignId,
  campaignActionPending = false,
  campaignActionError = null,
}) => {
  const [pendingCampaignId, setPendingCampaignId] = React.useState<string | null>(null);

  const activeCampaign = React.useMemo(() => selectActiveCampaign(activeCampaignId), [activeCampaignId]);
  const pendingCampaign = React.useMemo(() => selectActiveCampaign(pendingCampaignId), [pendingCampaignId]);
  const rankedCampaigns = React.useMemo(
    () => selectRankedCampaigns(adaptiveRecommendationsByCampaignId),
    [adaptiveRecommendationsByCampaignId],
  );
  const activeRecommendation = activeCampaignId ? adaptiveRecommendationsByCampaignId?.[activeCampaignId] : undefined;

  const {
    savedCampaignIds,
    toggleSavedCampaign,
    savingCampaignId,
    campaignPersistenceError,
    evolutionMemoryByCampaignId,
    behavioralProfile,
    lifeStateProfile,
    temporalRhythmProfile,
  } = useCampaignPersistence({
    activeCampaignId,
    progress,
    adaptiveRecommendationsByCampaignId,
  });

  const intelligence = useCampaignIntelligence({
    activeCampaignId,
    activeCampaign,
    progress,
    rankedCampaigns,
    activeRecommendation,
    adaptiveRecommendationsByCampaignId,
    savingCampaignId,
    campaignPersistenceError,
    evolutionMemoryByCampaignId,
    behavioralProfile,
    lifeStateProfile,
    temporalRhythmProfile,
  });

  const campaignPanelViewModel = React.useMemo(
    () => buildCampaignPanelViewModel({
      activeCampaignId,
      progress,
      rankedCampaigns,
      adaptiveRecommendationsByCampaignId,
    }),
    [activeCampaignId, progress, rankedCampaigns, adaptiveRecommendationsByCampaignId],
  );

  void intelligence.adaptiveConfidence;
  void intelligence.campaignProgressSummary;
  void intelligence.stabilizationSummary;

  const actionError = campaignActionError || campaignPersistenceError;
  void intelligence.temporalRhythmSummary;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-600" /> Nutrition Campaign Journey
          </CardTitle>
          <CardDescription>
            Guided weekly planning missions layered on top of your existing planner intelligence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeCampaign && progress ? (
            <div className="space-y-4">
              {lastActivatedCampaignId === activeCampaign.id ? (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900" role="status" aria-live="polite">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    Campaign is active: {activeCampaign.title}
                  </div>
                  <p className="mt-1 text-xs">
                    Started successfully from the server. Progress is now {progress.completionPct}% with {progress.completedMissions} of {progress.totalMissions} missions complete.
                  </p>
                </div>
              ) : null}

              <CampaignHeaderSummary
                campaign={activeCampaign}
                progress={progress}
                recommendation={activeRecommendation}
              />

              <Progress value={progress.completionPct} aria-label={`${activeCampaign.title} progress`} />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {progress.missionProgress.map((item) => (
                  <CampaignMissionCard
                    key={item.mission.id}
                    missionProgress={item}
                    missionWhy={intelligence.missionWhy}
                    phaseNarrative={progress.phaseNarrative}
                  />
                ))}
              </div>

              {progress.completionSemantics && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                  <p className="mb-1 font-medium">Adaptive completion semantics</p>
                  <p>
                    Sustainability: {progress.completionSemantics.sustainabilityCompletion ? 'complete' : 'in progress'}
                    {' · '}Recovery: {progress.completionSemantics.recoveryCompletion ? 'complete' : 'in progress'}
                    {' · '}Continuity: {progress.completionSemantics.continuityCompletion ? 'complete' : 'in progress'}
                  </p>
                  {typeof progress.momentum === 'number' && (
                    <p className="mt-1">
                      Momentum: {Math.round(progress.momentum * 100)}% {' · '}Stability:{' '}
                      {Math.round((progress.journeyStability || 0) * 100)}%
                    </p>
                  )}
                </div>
              )}

              {intelligence.activeJourneyType && (
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
                  <p className="font-medium">Journey type: {intelligence.activeJourneyType}</p>
                  <p>{intelligence.activeJourneyNarrative}</p>
                </div>
              )}

              {intelligence.unlockedAchievements.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {intelligence.unlockedAchievements.map((achievement) => (
                    <Badge key={achievement.id} className="bg-amber-500 hover:bg-amber-500">
                      🏆 {achievement.title}
                    </Badge>
                  ))}
                </div>
              )}

              {intelligence.sharedState && (
                <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
                  <p className="font-medium">Household-ready campaign · {intelligence.sharedState.participants} participants</p>
                  <p>Shared completions: {intelligence.sharedState.completedParticipants} · Streak sync: {intelligence.sharedState.continuityStreakSharedDays} days</p>
                  {intelligence.collaborationSuggestions[0] && <p className="mt-1">{intelligence.collaborationSuggestions[0]}</p>}
                </div>
              )}

              {progress.complete && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <Sparkles className="mt-0.5 h-4 w-4" />
                  <span>{activeCampaign.rewardCopy}</span>
                </div>
              )}


              {intelligence.activeLearningProfile && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <p className="font-medium">Campaign learned…</p>
                  <p>{intelligence.activeLearningProfile.summary}</p>
                  {intelligence.activeLearningInsights.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {intelligence.activeLearningInsights.map((insight) => (
                        <Badge key={insight} variant="secondary" className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                          {insight}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {intelligence.activeEvolutionMemory && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                  <p className="font-medium">Adaptive memory badges</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {intelligence.activeEvolutionMemory.successfulStrategies.slice(0, 3).map((strategy) => (
                      <Badge key={strategy} variant="outline">✅ {strategy}</Badge>
                    ))}
                    {intelligence.activeEvolutionMemory.continuityAnchors.slice(0, 2).map((anchor) => (
                      <Badge key={anchor} variant="outline">🧭 {anchor}</Badge>
                    ))}
                    {intelligence.activeEvolutionMemory.recoveryInterventions.slice(0, 2).map((item) => (
                      <Badge key={item} variant="outline">🛟 {item}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {intelligence.activeEvolutionTimeline.length > 0 && (
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
                  <p className="font-medium">Evolution timeline highlights</p>
                  <ul className="mt-1 list-disc pl-4">
                    {intelligence.activeEvolutionTimeline.slice(0, 3).map((item) => (
                      <li key={item.id}>{item.detail}</li>
                    ))}
                  </ul>
                </div>
              )}

              {intelligence.activeRecommendationFeedback && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-medium">Adaptive recommendation confidence · {Math.round(intelligence.activeRecommendationFeedback.confidence * 100)}%</p>
                  {intelligence.activeRecommendationFeedback.recommendationNudge[0] && <p className="mt-1">{intelligence.activeRecommendationFeedback.recommendationNudge[0]}</p>}
                  {intelligence.activeRecommendationFeedback.cautionSignals[0] && <p className="mt-1">Watch: {intelligence.activeRecommendationFeedback.cautionSignals[0]}</p>}
                </div>
              )}


              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
                <p className="font-medium">Behavioral intelligence · {Math.round(intelligence.resolvedBehavioralProfile.behavioralConfidence * 100)}% confidence</p>
                <p className="mt-1">Continuity: {Math.round(intelligence.resolvedBehavioralProfile.continuityPreferenceScore * 100)}% · Recovery: {Math.round(intelligence.resolvedBehavioralProfile.recoveryStabilizationScore * 100)}% · Prep tolerance: {Math.round(intelligence.resolvedBehavioralProfile.prepToleranceScore * 100)}%</p>
                <p className="mt-1">Cadence compatibility: {Math.round(intelligence.recommendationCompatibility * 100)}% · Recommendation confidence: {Math.round(intelligence.behavioralRecommendationConfidence * 100)}%</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {intelligence.behavioralNarratives.slice(0, 3).map((item) => <Badge key={item} variant="secondary" className="bg-indigo-100 text-indigo-900 hover:bg-indigo-100">{item}</Badge>)}
                </div>
                <p className="mt-2 font-medium">Global recommendation bias</p>
                <ul className="list-disc pl-4">
                  {intelligence.globalRecommendationBias.slice(0, 2).map((item) => <li key={item}>{item}</li>)}
                </ul>
                {(intelligence.behavioralStrengths[0] || intelligence.behavioralSensitivity[0]) && (
                  <p className="mt-1">Strength: {intelligence.behavioralStrengths[0] ?? 'Calibrating'} · Sensitivity: {intelligence.behavioralSensitivity[0] ?? 'No major sensitivity detected'}</p>
                )}
                <p className="mt-1">Strategy weights · continuity {Math.round(intelligence.strategyWeights.continuityAnchor * 100)}%, recovery {Math.round(intelligence.strategyWeights.recoveryPacing * 100)}%, prep reduction {Math.round(intelligence.strategyWeights.prepReduction * 100)}%</p>
                {intelligence.strategyBias[0] && <p className="mt-1">Adaptive weighting: {intelligence.strategyBias[0]}</p>}
                {intelligence.behavioralMilestones[0] && <p className="mt-1">Behavioral evolution: {intelligence.behavioralMilestones.slice(0, 2).map((m) => m.detail).join(' · ')}</p>}
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                <p className="font-medium">Life-state intelligence · {Math.round(lifeStateProfile.contextualConfidence * 100)}% contextual confidence</p>
                <p className="mt-1">Volatility {Math.round(lifeStateProfile.scheduleVolatilityScore * 100)}% · Time scarcity {Math.round(lifeStateProfile.timeScarcityScore * 100)}% · Burnout pressure {Math.round(lifeStateProfile.burnoutPressureScore * 100)}%</p>
                <p className="mt-1">Recovery pressure {Math.round(lifeStateProfile.recoveryPressureScore * 100)}% · Stabilization need {Math.round(lifeStateProfile.stabilizationNeedScore * 100)}% · Energy consistency {Math.round(lifeStateProfile.energyConsistencyScore * 100)}%</p>
                <p className="mt-1">Contextual compatibility {Math.round(intelligence.contextualCompatibility * 100)}% · Recommendation confidence {Math.round(intelligence.contextualRecommendationConfidence * 100)}%</p>
                {intelligence.contextualAdaptationBias[0] && <p className="mt-1">Adaptive guidance: {intelligence.contextualAdaptationBias.slice(0, 2).join(' · ')}</p>}
                {intelligence.contextualInterventions[0] && <p className="mt-1">Protective interventions: {intelligence.contextualInterventions.slice(0, 2).join(' · ')}</p>}
                <p className="mt-1">Stability trend {Math.round(intelligence.contextualStability.stabilizationTrend * 100)}% · Burnout cycle risk {Math.round(intelligence.contextualStability.burnoutCycleRisk * 100)}%</p>
                {intelligence.recoveryWindows[0] && <p className="mt-1">Recovery window: {intelligence.recoveryWindows[0]}</p>}
                {intelligence.protectiveNotes[0] && <p className="mt-1">Protective weighting: {intelligence.protectiveNotes.slice(0, 2).join(' · ')}</p>}
                {intelligence.protectiveRecommendationBias[0] && <p className="mt-1">Recommendation bias: {intelligence.protectiveRecommendationBias[0]}</p>}
                {intelligence.contextualTimeline[0] && <p className="mt-1">Contextual evolution: {intelligence.contextualTimeline.slice(0, 2).map((m) => m.detail).join(' · ')}</p>}
              </div>
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
                <p className="font-medium">Temporal rhythm intelligence</p>
                <p className="mt-1">
                  Phase {intelligence.temporalPhase} · Rhythm stability {Math.round(temporalRhythmProfile.rhythmStabilityScore * 100)}% · Recovery window {Math.round(temporalRhythmProfile.recoveryWindowScore * 100)}%
                </p>
                <p className="mt-1">
                  Cadence resilience {Math.round(intelligence.temporalStability.cadenceResilience * 100)}% · Temporal confidence {Math.round(intelligence.temporalRecommendationConfidence * 100)}%
                </p>
                <p className="mt-1">Timing weights · recovery {Math.round(intelligence.temporalWeights.recoveryPacingWeight * 100)}% · novelty {Math.round(intelligence.temporalWeights.noveltyReintroductionWeight * 100)}% · continuity {Math.round(intelligence.temporalWeights.continuityAnchorWeight * 100)}%</p>
                <ul className="mt-1 list-disc pl-4">
                  {[...intelligence.rhythmNarratives, ...intelligence.temporalTransitions, ...intelligence.cadenceRecommendations].slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                </ul>
                {intelligence.temporalAdaptationBias[0] && <p className="mt-1">Rhythm adaptation: {intelligence.temporalAdaptationBias.slice(0, 2).join(' · ')}</p>}
                {intelligence.rhythmStrategies[0] && <p className="mt-1">Orchestration: {intelligence.rhythmStrategies.slice(0, 2).join(' · ')}</p>}
                {intelligence.temporalProtectionBias[0] && <p className="mt-1">Protection timing: {intelligence.temporalProtectionBias[0]}</p>}
                {intelligence.rhythmProtectionBias[0] && <p className="mt-1">Protection weighting: {intelligence.rhythmProtectionBias[0]}</p>}
                {intelligence.temporalEvolutionTimeline[0] && <p className="mt-1">Temporal evolution: {intelligence.temporalEvolutionTimeline.slice(0, 2).join(' · ')}</p>}
              </div>

              {ENABLE_JOURNEY_TIMELINE && (
                <React.Suspense
                  fallback={
                    <Card>
                      <CardContent className="pt-6 text-sm text-slate-600">Loading journey timeline…</CardContent>
                    </Card>
                  }
                >
                  <TimelineErrorBoundary>
                    <WeeklyNutritionJourneyTimeline
                      context={{
                        phase: progress.phase,
                        phaseNarrative: progress.phaseNarrative,
                        momentum: progress.momentum,
                        journeyStability: progress.journeyStability,
                        transitionReason: progress.transitionReason,
                        completionPct: progress.completionPct,
                        completedMissions: progress.completedMissions,
                        totalMissions: progress.totalMissions,
                        completionSemantics: progress.completionSemantics,
                      }}
                    />
                  </TimelineErrorBoundary>
                </React.Suspense>
              )}

              <Button variant="outline" size="sm" onClick={onClearCampaign}>
                End Active Campaign
              </Button>

              {intelligence.coachInsights[0] && (
                <p className="text-xs text-slate-600">
                  AI Coach: {intelligence.coachInsights[0].recommendation} · {intelligence.campaignInterventionReasoning}
                </p>
              )}

              {intelligence.campaignEvents.length > 0 && (
                <p className="text-xs text-slate-500">Recent events: {intelligence.campaignEvents.slice(0, 2).map((event) => event.title).join(' · ')}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Campaigns are guided weekly nutrition journeys that adapt missions and pacing as your planning habits evolve.
              </p>
              <div className="flex flex-wrap gap-2">
                {rankedCampaigns.slice(0, 3).map((campaign) => (
                  <Badge key={`empty-state-${campaign.id}`} variant="secondary" className="py-1">
                    {campaign.title}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suggested Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {campaignPanelViewModel.suggestedCampaigns.map((item) => (
            <CampaignSuggestionCard
              key={item.campaign.id}
              item={item}
              saved={savedCampaignIds.has(item.campaign.id)}
              onSelect={setPendingCampaignId}
              onToggleSaved={toggleSavedCampaign}
              saving={savingCampaignId === item.campaign.id}
              starting={campaignActionPending && pendingCampaignId === item.campaign.id}
            />
          ))}
        </CardContent>
      </Card>

      {actionError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</p> : null}

      {pendingCampaign && (
        <CampaignActivationCard
          campaign={pendingCampaign}
          recommendation={adaptiveRecommendationsByCampaignId?.[pendingCampaign.id]}
          onStart={async () => {
            await onActivateCampaign(pendingCampaign.id);
            setPendingCampaignId(null);
          }}
          starting={campaignActionPending}
          onCancel={() => setPendingCampaignId(null)}
        />
      )}
    </div>
  );
};

export default NutritionCampaignPanel;
