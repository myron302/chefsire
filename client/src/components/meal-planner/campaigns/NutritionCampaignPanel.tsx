import React from 'react';
import { Trophy, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { NUTRITION_CAMPAIGN_CATALOG } from '@/components/meal-planner/campaigns/nutritionCampaignCatalog';
import { NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import type { NutritionCampaignAdaptiveRecommendation } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

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

const NutritionCampaignPanel: React.FC<Props> = ({ activeCampaignId, progress, onActivateCampaign, onClearCampaign, adaptiveRecommendationsByCampaignId }) => {
  const activeCampaign = NUTRITION_CAMPAIGN_CATALOG.find((item) => item.id === activeCampaignId) || null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-emerald-600" /> Nutrition Campaign Journey</CardTitle>
          <CardDescription>Guided weekly planning missions layered on top of your existing planner intelligence.</CardDescription>
        </CardHeader>
        <CardContent>
          {activeCampaign && progress ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{activeCampaign.title}</p>
                  <p className="text-sm text-gray-600">{activeCampaign.narrative}</p>
                  {activeCampaignId && adaptiveRecommendationsByCampaignId?.[activeCampaignId]?.narrative && (
                    <p className="text-xs text-emerald-700 mt-1">{adaptiveRecommendationsByCampaignId[activeCampaignId].narrative}</p>
                  )}
                  {progress.phaseNarrative && <p className="text-xs text-blue-700 mt-1">{progress.phaseNarrative}</p>}
                  {progress.transitionReason && <p className="text-xs text-amber-700 mt-1">{progress.transitionReason}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                {progress.phase && <Badge variant="outline" className="capitalize">{progress.phase.replace('-', ' ')} phase</Badge>}
                <Badge variant="secondary">{progress.completedMissions}/{progress.totalMissions} missions</Badge>
              </div>
              </div>
              <Progress value={progress.completionPct} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {progress.missionProgress.map((item) => (
                  <div key={item.mission.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{item.mission.title}</p>
                    <p className="text-xs text-gray-600">{item.mission.description}</p>
                    <p className="text-xs mt-1">{item.value}/{item.target}</p>
                    <Progress value={item.progressPct} className="mt-2" />
                  </div>
                ))}
              </div>
              {progress.completionSemantics && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                  <p className="font-medium mb-1">Adaptive completion semantics</p>
                  <p>Sustainability: {progress.completionSemantics.sustainabilityCompletion ? 'complete' : 'in progress'} · Recovery: {progress.completionSemantics.recoveryCompletion ? 'complete' : 'in progress'} · Continuity: {progress.completionSemantics.continuityCompletion ? 'complete' : 'in progress'}</p>
                  {typeof progress.momentum === 'number' && <p className="mt-1">Momentum: {Math.round(progress.momentum * 100)}% · Stability: {Math.round((progress.journeyStability || 0) * 100)}%</p>}
                </div>
              )}
              {progress.complete && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 mt-0.5" />
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
              <Button variant="outline" size="sm" onClick={onClearCampaign}>End Active Campaign</Button>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Choose a campaign to start a guided nutrition journey.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suggested Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {NUTRITION_CAMPAIGN_CATALOG.map((campaign) => (
            <div key={campaign.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">{campaign.title}</p>
                <Badge variant="outline">{campaign.durationDays} days</Badge>
              </div>
              {adaptiveRecommendationsByCampaignId?.[campaign.id] && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="secondary">Fit {adaptiveRecommendationsByCampaignId[campaign.id].fitScore}</Badge>
                  {adaptiveRecommendationsByCampaignId[campaign.id].fitReasons.slice(0, 2).map((reason) => (
                    <Badge key={`${campaign.id}-${reason}`} variant="outline" className="text-[10px]">{reason}</Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-600 mt-1">{campaign.description}</p>
              <Button className="mt-3" size="sm" variant={activeCampaignId === campaign.id ? 'secondary' : 'default'} onClick={() => onActivateCampaign(campaign.id)}>
                {activeCampaignId === campaign.id ? 'Active' : 'Start Campaign'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default NutritionCampaignPanel;
