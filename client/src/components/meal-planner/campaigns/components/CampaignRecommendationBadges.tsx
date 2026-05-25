import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { NutritionCampaignAdaptiveRecommendation } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import { pacingLabel } from '@/components/meal-planner/campaigns/components/campaignPanelUtils';

type Props = {
  recommendation?: NutritionCampaignAdaptiveRecommendation;
  compactReasons?: boolean;
};

const CampaignRecommendationBadges: React.FC<Props> = ({ recommendation, compactReasons = false }) => {
  if (!recommendation) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      <Badge variant="secondary">Fit {recommendation.fitScore}</Badge>
      {recommendation.fitReasons.slice(0, compactReasons ? 2 : recommendation.fitReasons.length).map((reason) => (
        <Badge key={reason} variant="outline" className="text-[10px]">{reason}</Badge>
      ))}
      {pacingLabel(recommendation) && <Badge variant="outline">{pacingLabel(recommendation)}</Badge>}
    </div>
  );
};

export default React.memo(CampaignRecommendationBadges);
