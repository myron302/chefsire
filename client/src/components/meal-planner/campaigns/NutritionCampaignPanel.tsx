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

              {progress.complete && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <Sparkles className="mt-0.5 h-4 w-4" />
                  <span>{activeCampaign.rewardCopy}</span>
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
