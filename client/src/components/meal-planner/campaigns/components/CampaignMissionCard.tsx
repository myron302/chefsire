import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { NutritionCampaignMissionProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

type Props = {
  missionProgress: NutritionCampaignMissionProgress;
  missionWhy: string;
  phaseNarrative?: string;
};

const CampaignMissionCard: React.FC<Props> = ({ missionProgress, missionWhy, phaseNarrative }) => (
  <div className={`rounded-lg border p-3 ${missionProgress.completed ? 'border-emerald-300 bg-emerald-50/70' : ''}`}>
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-medium">{missionProgress.mission.title}</p>
      <Badge variant={missionProgress.completed ? 'secondary' : 'outline'}>{missionProgress.completed ? 'Completed' : 'In progress'}</Badge>
    </div>
    <p className="text-xs text-gray-600">{missionProgress.mission.description}</p>
    <p className="text-xs mt-1 text-slate-700">Adaptive target: {missionProgress.target}</p>
    <p className="text-xs mt-1 text-slate-700">Why this mission matters: {missionWhy}</p>
    {phaseNarrative && <p className="text-xs mt-1 text-blue-700">Phase note: {phaseNarrative}</p>}
    <p className="text-xs mt-1">{missionProgress.value}/{missionProgress.target}</p>
    <Progress value={missionProgress.progressPct} className="mt-2" />
  </div>
);

export default React.memo(CampaignMissionCard);
