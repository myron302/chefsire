import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import CampaignRecommendationBadges from '@/components/meal-planner/campaigns/components/CampaignRecommendationBadges';
import type { CampaignSuggestionCardViewModel } from '@/components/meal-planner/campaigns/view-models/buildCampaignPanelViewModel';

type CampaignSuggestionCardProps = {
  item: CampaignSuggestionCardViewModel;
  saved: boolean;
  onSelect: (campaignId: string) => void;
  onToggleSaved: (campaignId: string) => void | Promise<void>;
  saving?: boolean;
  starting?: boolean;
};

const CampaignSuggestionCard: React.FC<CampaignSuggestionCardProps> = ({
  item,
  saved,
  saving = false,
  starting = false,
  onSelect,
  onToggleSaved,
}) => {
  const { campaign, identity } = item;

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{campaign.title}</p>
        <div className="flex gap-2">
          {item.isTopRecommendation && (
            <Badge className="bg-emerald-600 hover:bg-emerald-600">Recommended</Badge>
          )}
          <Badge variant="outline">{campaign.durationDays} days</Badge>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="secondary">{item.sourceLabel}</Badge>
        {item.seasonalLabel && <Badge variant="outline">{item.seasonalLabel}</Badge>}
        {item.creatorTemplate && <Badge variant="outline">{item.creatorTemplate.creatorAvatar} {item.creatorTemplate.creatorName}</Badge>}
        {item.isHouseholdReady && <Badge variant="outline">Household Ready</Badge>}
        {item.isAiCoachRecommended && <Badge variant="outline">AI Coach Recommended</Badge>}
        <p className="w-full text-[11px] text-slate-500">{item.discoveryReason}</p>
      </div>

      <div className={`mt-2 rounded-md border p-2 text-[11px] ${identity.visualIdentity.bgClassName} ${identity.visualIdentity.borderClassName} ${identity.visualIdentity.textClassName}`}>
        <p className="font-medium">{identity.journeySignature}</p>
        <p>{identity.creatorAttribution}</p>
        <p>{item.remixNarrative}</p>
        <p>{item.evolutionNarrative}</p>
        {item.collectionLabel && <p>Collection: {item.collectionLabel}</p>}
      </div>

      <CampaignRecommendationBadges
        recommendation={item.recommendation}
        compactReasons
      />

      <p className="mt-1 text-xs text-gray-600">{campaign.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={starting}
          onClick={() => onSelect(campaign.id)}
        >
          {starting ? 'Starting…' : item.isActive ? 'Active campaign' : 'Start campaign'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={() => void onToggleSaved(campaign.id)}
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save campaign'}
        </Button>
      </div>
    </div>
  );
};

export default CampaignSuggestionCard;
