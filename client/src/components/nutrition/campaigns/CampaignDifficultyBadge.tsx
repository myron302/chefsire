import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NutritionCampaignDifficulty } from "@/pages/nutrition/campaigns/mockCampaigns";

const difficultyStyles: Record<NutritionCampaignDifficulty, string> = {
  beginner: "border-emerald-200 bg-emerald-50 text-emerald-700",
  intermediate: "border-amber-200 bg-amber-50 text-amber-700",
  advanced: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function CampaignDifficultyBadge({ difficulty }: { difficulty: NutritionCampaignDifficulty }) {
  return (
    <Badge variant="outline" className={cn("capitalize shadow-sm", difficultyStyles[difficulty])}>
      {difficulty}
    </Badge>
  );
}
