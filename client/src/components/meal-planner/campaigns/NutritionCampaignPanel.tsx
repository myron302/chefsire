import React from 'react';
import { Trophy, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { NUTRITION_CAMPAIGN_CATALOG } from '@/components/meal-planner/campaigns/nutritionCampaignCatalog';
import { NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

type Props = {
  activeCampaignId: string | null;
  progress: NutritionCampaignProgress | null;
  onActivateCampaign: (campaignId: string) => void;
  onClearCampaign: () => void;
};

const NutritionCampaignPanel: React.FC<Props> = ({ activeCampaignId, progress, onActivateCampaign, onClearCampaign }) => {
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
                </div>
                <Badge variant="secondary">{progress.completedMissions}/{progress.totalMissions} missions</Badge>
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
              {progress.complete && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 mt-0.5" />
                  <span>{activeCampaign.rewardCopy}</span>
                </div>
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
