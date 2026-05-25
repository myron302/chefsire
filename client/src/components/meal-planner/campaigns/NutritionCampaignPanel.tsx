import React from 'react';
import { Trophy, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { NUTRITION_CAMPAIGN_CATALOG } from '@/components/meal-planner/campaigns/nutritionCampaignCatalog';
import { NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import type { NutritionCampaignAdaptiveRecommendation } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import CampaignActivationCard from '@/components/meal-planner/campaigns/components/CampaignActivationCard';
import CampaignHeaderSummary from '@/components/meal-planner/campaigns/components/CampaignHeaderSummary';
import CampaignMissionCard from '@/components/meal-planner/campaigns/components/CampaignMissionCard';
import CampaignRecommendationBadges from '@/components/meal-planner/campaigns/components/CampaignRecommendationBadges';
import { buildMissionWhy } from '@/components/meal-planner/campaigns/components/campaignPanelUtils';
import { deriveCampaignAchievements } from '@/components/meal-planner/campaigns/ecosystem/campaignAchievements';
import { deriveCampaignOrigin, deriveCampaignSourceLabel, deriveCampaignDiscoveryReason } from '@/components/meal-planner/campaigns/ecosystem/campaignOrigins';
import { deriveCreatorCampaignRecommendations } from '@/components/meal-planner/campaigns/ecosystem/creatorCampaignTemplates';
import { deriveSeasonalCampaigns, deriveSeasonalNarratives } from '@/components/meal-planner/campaigns/ecosystem/seasonalCampaigns';
import { deriveSharedCampaignProgress, deriveCollaborativeMissionSuggestions } from '@/components/meal-planner/campaigns/ecosystem/householdCampaigns';
import { deriveCampaignJourneyType, deriveJourneyCategoryNarrative } from '@/components/meal-planner/campaigns/ecosystem/campaignJourneyTypes';
import { deriveCoachCampaignInsights, deriveCampaignInterventionReasoning } from '@/components/meal-planner/campaigns/ecosystem/coachCampaignIntegration';
import { deriveCampaignEvents } from '@/components/meal-planner/campaigns/ecosystem/campaignEvents';

import { deriveCampaignIdentity } from '@/components/meal-planner/campaigns/identity/campaignIdentity';
import { deriveCampaignRemix, deriveCampaignRemixNarrative } from '@/components/meal-planner/campaigns/identity/campaignRemix';
import { deriveCampaignCollections } from '@/components/meal-planner/campaigns/identity/campaignCollections';
import { deriveCampaignLineage, deriveCampaignEvolutionNarrative } from '@/components/meal-planner/campaigns/identity/campaignLineage';
import { getSavedCampaigns, removeSavedCampaign, saveCampaignIdentity } from '@/components/meal-planner/campaigns/identity/savedCampaignStore';

import { deriveCampaignEvolutionMemory, updateCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionMemory';
import { getCampaignEvolutionMemory, saveCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionStore';
import { deriveCampaignLearningProfile, deriveAdaptiveLearningInsights } from '@/components/meal-planner/campaigns/evolution/campaignLearningProfiles';
import { deriveEvolutionTimeline } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionTimeline';
import { deriveCampaignRecommendationFeedback } from '@/components/meal-planner/campaigns/evolution/campaignRecommendationFeedback';

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
  progress: NutritionCampaignProgress | null;
  onActivateCampaign: (campaignId: string) => void;
  onClearCampaign: () => void;
  adaptiveRecommendationsByCampaignId?: Record<string, NutritionCampaignAdaptiveRecommendation>;
};

const NutritionCampaignPanel: React.FC<Props> = ({
  activeCampaignId,
  progress,
  onActivateCampaign,
  onClearCampaign,
  adaptiveRecommendationsByCampaignId,
}) => {
  const [pendingCampaignId, setPendingCampaignId] = React.useState<string | null>(null);
  const [savedCampaignIds, setSavedCampaignIds] = React.useState<Set<string>>(() => new Set(getSavedCampaigns().map((item) => item.campaignId)));
  const [evolutionMemoryByCampaignId, setEvolutionMemoryByCampaignId] = React.useState(() => {
    const fromStore = getCampaignEvolutionMemory();
    return fromStore.reduce<Record<string, ReturnType<typeof deriveCampaignEvolutionMemory>>>((acc, item) => {
      acc[item.campaignId] = item;
      return acc;
    }, {});
  });

  const toggleSavedCampaign = React.useCallback((campaignId: string) => {
    const campaign = NUTRITION_CAMPAIGN_CATALOG.find((item) => item.id === campaignId);
    if (!campaign) return;
    const creator = deriveCreatorCampaignRecommendations([campaign], adaptiveRecommendationsByCampaignId)[campaign.id]?.creatorName;
    setSavedCampaignIds((prev) => {
      if (prev.has(campaignId)) {
        removeSavedCampaign(campaignId);
        const next = new Set(prev);
        next.delete(campaignId);
        return next;
      }
      const identity = deriveCampaignIdentity(campaign, progress, creator);
      saveCampaignIdentity(identity);
      return new Set(prev).add(campaignId);
    });
  }, [adaptiveRecommendationsByCampaignId, progress]);

  const activeCampaign = NUTRITION_CAMPAIGN_CATALOG.find((item) => item.id === activeCampaignId) || null;
  const pendingCampaign = NUTRITION_CAMPAIGN_CATALOG.find((item) => item.id === pendingCampaignId) || null;

  const rankedCampaigns = React.useMemo(() => {
    const withOrder = NUTRITION_CAMPAIGN_CATALOG.map((campaign, index) => ({ campaign, index }));
    return withOrder
      .sort((a, b) => {
        const aFit = adaptiveRecommendationsByCampaignId?.[a.campaign.id]?.fitScore;
        const bFit = adaptiveRecommendationsByCampaignId?.[b.campaign.id]?.fitScore;
        if (typeof aFit === 'number' && typeof bFit === 'number') return bFit - aFit;
        if (typeof aFit === 'number') return -1;
        if (typeof bFit === 'number') return 1;
        return a.index - b.index;
      })
      .map((item) => item.campaign);
  }, [adaptiveRecommendationsByCampaignId]);

  const topCampaignId = rankedCampaigns[0]?.id;
  const activeRecommendation = activeCampaignId ? adaptiveRecommendationsByCampaignId?.[activeCampaignId] : undefined;
  const missionWhy = activeCampaign ? buildMissionWhy(activeCampaign, activeRecommendation) : '';
  const creatorTemplatesByCampaignId = React.useMemo(
    () => deriveCreatorCampaignRecommendations(rankedCampaigns, adaptiveRecommendationsByCampaignId),
    [rankedCampaigns, adaptiveRecommendationsByCampaignId],
  );
  const seasonalCampaignIds = React.useMemo(
    () => new Set(deriveSeasonalCampaigns(rankedCampaigns).map((campaign) => campaign.id)),
    [rankedCampaigns],
  );
  const seasonalNarrative = React.useMemo(() => deriveSeasonalNarratives(), []);
  const achievements = React.useMemo(() => deriveCampaignAchievements(progress), [progress]);
  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked);
  const sharedState = React.useMemo(() => deriveSharedCampaignProgress(progress, 3), [progress]);
  const collaborationSuggestions = React.useMemo(() => deriveCollaborativeMissionSuggestions(sharedState), [sharedState]);
  const activeJourneyType = activeCampaign ? deriveCampaignJourneyType(activeCampaign, progress) : null;
  const coachInsights = React.useMemo(
    () => deriveCoachCampaignInsights(rankedCampaigns, adaptiveRecommendationsByCampaignId, progress),
    [rankedCampaigns, adaptiveRecommendationsByCampaignId, progress],
  );
  const campaignEvents = React.useMemo(() => deriveCampaignEvents(progress), [progress]);
  const collections = React.useMemo(() => deriveCampaignCollections(rankedCampaigns), [rankedCampaigns]);

  React.useEffect(() => {
    if (!activeCampaignId) return;
    setEvolutionMemoryByCampaignId((prev) => {
      const nextMemory = updateCampaignEvolutionMemory(prev[activeCampaignId] ?? null, activeCampaignId, progress);
      const next = { ...prev, [activeCampaignId]: nextMemory };
      saveCampaignEvolutionMemory(Object.values(next));
      return next;
    });
  }, [activeCampaignId, progress]);

  const activeEvolutionMemory = activeCampaignId ? evolutionMemoryByCampaignId[activeCampaignId] : null;
  const activeLearningProfile = activeEvolutionMemory ? deriveCampaignLearningProfile(activeEvolutionMemory) : null;
  const activeLearningInsights = activeLearningProfile ? deriveAdaptiveLearningInsights(activeLearningProfile) : [];
  const activeEvolutionTimeline = deriveEvolutionTimeline(progress, activeEvolutionMemory);
  const activeRecommendationFeedback = activeEvolutionMemory
    ? deriveCampaignRecommendationFeedback(activeEvolutionMemory, activeRecommendation)
    : null;

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
              <CampaignHeaderSummary
                campaign={activeCampaign}
                progress={progress}
                recommendation={activeRecommendation}
              />

              <Progress value={progress.completionPct} />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {progress.missionProgress.map((item) => (
                  <CampaignMissionCard
                    key={item.mission.id}
                    missionProgress={item}
                    missionWhy={missionWhy}
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

              {activeJourneyType && (
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
                  <p className="font-medium">Journey type: {activeJourneyType}</p>
                  <p>{deriveJourneyCategoryNarrative(activeJourneyType)}</p>
                </div>
              )}

              {unlockedAchievements.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {unlockedAchievements.map((achievement) => (
                    <Badge key={achievement.id} className="bg-amber-500 hover:bg-amber-500">
                      🏆 {achievement.title}
                    </Badge>
                  ))}
                </div>
              )}

              {sharedState && (
                <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
                  <p className="font-medium">Household-ready campaign · {sharedState.participants} participants</p>
                  <p>Shared completions: {sharedState.completedParticipants} · Streak sync: {sharedState.continuityStreakSharedDays} days</p>
                  {collaborationSuggestions[0] && <p className="mt-1">{collaborationSuggestions[0]}</p>}
                </div>
              )}

              {progress.complete && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <Sparkles className="mt-0.5 h-4 w-4" />
                  <span>{activeCampaign.rewardCopy}</span>
                </div>
              )}


              {activeLearningProfile && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <p className="font-medium">Campaign learned…</p>
                  <p>{activeLearningProfile.summary}</p>
                  {activeLearningInsights.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {activeLearningInsights.map((insight) => (
                        <Badge key={insight} variant="secondary" className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                          {insight}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeEvolutionMemory && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                  <p className="font-medium">Adaptive memory badges</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {activeEvolutionMemory.successfulStrategies.slice(0, 3).map((strategy) => (
                      <Badge key={strategy} variant="outline">✅ {strategy}</Badge>
                    ))}
                    {activeEvolutionMemory.continuityAnchors.slice(0, 2).map((anchor) => (
                      <Badge key={anchor} variant="outline">🧭 {anchor}</Badge>
                    ))}
                    {activeEvolutionMemory.recoveryInterventions.slice(0, 2).map((item) => (
                      <Badge key={item} variant="outline">🛟 {item}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {activeEvolutionTimeline.length > 0 && (
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
                  <p className="font-medium">Evolution timeline highlights</p>
                  <ul className="mt-1 list-disc pl-4">
                    {activeEvolutionTimeline.slice(0, 3).map((item) => (
                      <li key={item.id}>{item.detail}</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeRecommendationFeedback && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-medium">Adaptive recommendation confidence · {Math.round(activeRecommendationFeedback.confidence * 100)}%</p>
                  {activeRecommendationFeedback.recommendationNudge[0] && <p className="mt-1">{activeRecommendationFeedback.recommendationNudge[0]}</p>}
                  {activeRecommendationFeedback.cautionSignals[0] && <p className="mt-1">Watch: {activeRecommendationFeedback.cautionSignals[0]}</p>}
                </div>
              )}

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

              {coachInsights[0] && (
                <p className="text-xs text-slate-600">
                  AI Coach: {coachInsights[0].recommendation} · {deriveCampaignInterventionReasoning(progress)}
                </p>
              )}

              {campaignEvents.length > 0 && (
                <p className="text-xs text-slate-500">Recent events: {campaignEvents.slice(0, 2).map((event) => event.title).join(' · ')}</p>
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
          {rankedCampaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{campaign.title}</p>
                <div className="flex gap-2">
                  {topCampaignId === campaign.id && (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Recommended</Badge>
                  )}
                  <Badge variant="outline">{campaign.durationDays} days</Badge>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {(() => {
                  const origin = deriveCampaignOrigin(campaign, {
                    hasCreatorTemplate: Boolean(creatorTemplatesByCampaignId[campaign.id]),
                    isSeasonal: seasonalCampaignIds.has(campaign.id),
                    isHouseholdReady: campaign.theme === 'meal-prep' || campaign.theme === 'leftovers',
                    recommendation: adaptiveRecommendationsByCampaignId?.[campaign.id],
                  });
                  return (
                    <>
                      <Badge variant="secondary">{deriveCampaignSourceLabel(origin)}</Badge>
                      {seasonalCampaignIds.has(campaign.id) && <Badge variant="outline">{seasonalNarrative.title}</Badge>}
                      {creatorTemplatesByCampaignId[campaign.id] && <Badge variant="outline">{creatorTemplatesByCampaignId[campaign.id].creatorAvatar} {creatorTemplatesByCampaignId[campaign.id].creatorName}</Badge>}
                      {(campaign.theme === 'meal-prep' || campaign.theme === 'leftovers') && <Badge variant="outline">Household Ready</Badge>}
                      {activeCampaignId !== campaign.id && topCampaignId === campaign.id && <Badge variant="outline">AI Coach Recommended</Badge>}
                      <p className="w-full text-[11px] text-slate-500">{deriveCampaignDiscoveryReason(origin)}</p>
                    </>
                  );
                })()}
              </div>


              {(() => {
                const creatorName = creatorTemplatesByCampaignId[campaign.id]?.creatorName;
                const identity = deriveCampaignIdentity(campaign, progress, creatorName);
                const remix = deriveCampaignRemix(campaign, { householdContinuity: campaign.theme === 'leftovers' });
                const lineage = deriveCampaignLineage(campaign, remix, creatorName);
                const collection = collections.find((item) => item.campaignIds.includes(campaign.id));
                return (
                  <div className={`mt-2 rounded-md border p-2 text-[11px] ${identity.visualIdentity.bgClassName} ${identity.visualIdentity.borderClassName} ${identity.visualIdentity.textClassName}`}>
                    <p className="font-medium">{identity.journeySignature}</p>
                    <p>{identity.creatorAttribution}</p>
                    <p>{deriveCampaignRemixNarrative(remix)}</p>
                    <p>{deriveCampaignEvolutionNarrative(lineage)}</p>
                    {collection && <p>Collection: {collection.label}</p>}
                  </div>
                );
              })()}

              <CampaignRecommendationBadges
                recommendation={adaptiveRecommendationsByCampaignId?.[campaign.id]}
                compactReasons
              />

              <p className="mt-1 text-xs text-gray-600">{campaign.description}</p>
              <Button
                className="mt-3"
                size="sm"
                variant={activeCampaignId === campaign.id ? 'secondary' : 'default'}
                onClick={() => setPendingCampaignId(campaign.id)}
              >
                {activeCampaignId === campaign.id ? 'Active' : 'Start Campaign'}
              </Button>
              <Button
                className="mt-2"
                size="sm"
                variant="outline"
                onClick={() => toggleSavedCampaign(campaign.id)}
              >
                {savedCampaignIds.has(campaign.id) ? 'Saved' : 'Save Campaign'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {pendingCampaign && (
        <CampaignActivationCard
          campaign={pendingCampaign}
          recommendation={adaptiveRecommendationsByCampaignId?.[pendingCampaign.id]}
          onStart={() => {
            onActivateCampaign(pendingCampaign.id);
            setPendingCampaignId(null);
          }}
          onCancel={() => setPendingCampaignId(null)}
        />
      )}
    </div>
  );
};

export default NutritionCampaignPanel;
