import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { NutritionCampaignAdaptiveRecommendation, NutritionCampaignDefinition, NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import { pacingLabel } from '@/components/meal-planner/campaigns/components/campaignPanelUtils';

type Props = {
  campaign: NutritionCampaignDefinition;
  progress: NutritionCampaignProgress;
  recommendation?: NutritionCampaignAdaptiveRecommendation;
};

const CampaignHeaderSummary: React.FC<Props> = ({ campaign, progress, recommendation }) => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <div>
      <p className="font-semibold">{campaign.title}</p>
      <p className="text-sm text-gray-600">{campaign.narrative}</p>
      {recommendation?.narrative && <p className="text-xs text-emerald-700 mt-1">{recommendation.narrative}</p>}
      {progress.phaseNarrative && <p className="text-xs text-blue-700 mt-1">{progress.phaseNarrative}</p>}
      {progress.transitionReason && <p className="text-xs text-amber-700 mt-1">{progress.transitionReason}</p>}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {progress.phase && <Badge variant="outline" className="capitalize">{progress.phase.replace('-', ' ')} phase</Badge>}
      {pacingLabel(recommendation) && <Badge variant="secondary">{pacingLabel(recommendation)}</Badge>}
      <Badge variant="secondary">{progress.completedMissions}/{progress.totalMissions} missions</Badge>
      <Badge variant="outline">{Math.round(progress.completionPct)}% complete</Badge>
    </div>
  </div>
);

export default React.memo(CampaignHeaderSummary);
