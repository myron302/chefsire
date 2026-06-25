import React from 'react';
import { Clock3, Target, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { NutritionCampaignAdaptiveRecommendation, NutritionCampaignDefinition } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import { pacingLabel, recommendationReasonLabel } from '@/components/meal-planner/campaigns/components/campaignPanelUtils';

type Props = {
  campaign: NutritionCampaignDefinition;
  recommendation?: NutritionCampaignAdaptiveRecommendation;
  onStart: () => void | Promise<void>;
  onCancel: () => void;
  starting?: boolean;
};

const CampaignActivationCard: React.FC<Props> = ({ campaign, recommendation, onStart, onCancel, starting = false }) => (
  <Card className="border-emerald-300 bg-emerald-50/50">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Wand2 className="h-4 w-4 text-emerald-700" />Activate Campaign</CardTitle>
      <CardDescription>Confirm before starting your guided journey.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      <div>
        <p className="font-semibold">{campaign.title}</p>
        <p className="text-sm text-slate-600 mt-1">{campaign.narrative}</p>
      </div>
      <p className="text-sm"><strong>Why recommended:</strong> {recommendationReasonLabel(campaign, recommendation)}</p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary"><Clock3 className="mr-1 h-3 w-3" />{campaign.durationDays} days expected</Badge>
        <Badge variant="outline"><Target className="mr-1 h-3 w-3" />{campaign.missions.length} mission preview</Badge>
        {recommendation && <Badge variant="outline">Fit {recommendation.fitScore}</Badge>}
        {pacingLabel(recommendation) && <Badge variant="outline">{pacingLabel(recommendation)}</Badge>}
      </div>
      <div className="rounded-lg border bg-white p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Mission preview</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {campaign.missions.slice(0, 3).map((mission) => <li key={mission.id}>• {mission.title}</li>)}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={starting} onClick={() => void onStart()}>{starting ? "Starting journey…" : "Start journey"}</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </CardContent>
  </Card>
);

export default React.memo(CampaignActivationCard);
