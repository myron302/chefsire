import { BarChart3, Flame, GitFork, Target, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { NutritionCampaign } from "@/pages/nutrition/campaigns/mockCampaigns";

export default function CampaignStats({ campaigns }: { campaigns: NutritionCampaign[] }) {
  const count = campaigns.length || 1;
  const goals = new Set(campaigns.map((campaign) => campaign.dietType)).size;
  const avgDays = Math.round(campaigns.reduce((sum, campaign) => sum + campaign.durationDays, 0) / count);
  const avgProtein = Math.round(campaigns.reduce((sum, campaign) => sum + campaign.macros.proteinPerDay, 0) / count);
  const beginnerFriendly = campaigns.filter((campaign) => campaign.difficulty === "beginner").length;

  const stats = [
    { label: "Programs", value: campaigns.length.toString(), icon: Target, tone: "from-emerald-500 to-lime-500" },
    { label: "Nutrition goals", value: goals.toString(), icon: Flame, tone: "from-orange-500 to-rose-500" },
    { label: "Avg length", value: `${avgDays} days`, icon: GitFork, tone: "from-cyan-500 to-blue-500" },
    { label: "Avg protein", value: `${avgProtein}g/day`, icon: BarChart3, tone: "from-violet-500 to-fuchsia-500" },
    { label: "Beginner friendly", value: beginnerFriendly.toString(), icon: Users, tone: "from-slate-700 to-slate-950" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {stats.map(({ label, value, icon: Icon, tone }) => (
        <Card key={label} className="overflow-hidden border-white/70 bg-white/80 shadow-lg shadow-emerald-950/5 backdrop-blur">
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`rounded-2xl bg-gradient-to-br ${tone} p-3 text-white shadow-lg`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-950">{value}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
