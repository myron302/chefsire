import { CalendarDays, DollarSign, Flame, GitFork, HeartPulse, MoreHorizontal, Timer, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { NutritionCampaign } from "@/pages/nutrition/campaigns/mockCampaigns";

import CampaignDifficultyBadge from "./CampaignDifficultyBadge";
import CampaignMacroPreview from "./CampaignMacroPreview";
import CampaignSaveButton from "./CampaignSaveButton";

function compactNumber(value: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

const prepTone: Record<NutritionCampaign["prepIntensity"], string> = {
  light: "bg-emerald-50 text-emerald-700 border-emerald-200",
  moderate: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-violet-50 text-violet-700 border-violet-200",
};

export default function CampaignCard({ campaign, featured = false }: { campaign: NutritionCampaign; featured?: boolean }) {
  return (
    <Card className={cn(
      "group overflow-hidden border-white/70 bg-white/90 shadow-lg shadow-slate-950/5 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-950/15",
      featured && "lg:col-span-2",
    )}>
      <div className="relative h-56 overflow-hidden">
        <img src={campaign.coverImageUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/15 to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {campaign.isTrending ? <Badge className="gap-1 rounded-full bg-orange-500 text-white hover:bg-orange-500"><Flame className="h-3.5 w-3.5" /> Trending</Badge> : null}
          {campaign.isNew ? <Badge className="rounded-full bg-cyan-500 text-white hover:bg-cyan-500">New</Badge> : null}
          <CampaignDifficultyBadge difficulty={campaign.difficulty} />
        </div>
        <div className="absolute right-4 top-4 flex gap-2">
          <CampaignSaveButton />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="secondary" className="rounded-full bg-white/90 hover:bg-white">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>Preview weekly layout — Coming soon</DropdownMenuItem>
              <DropdownMenuItem disabled>Compare macros — Coming soon</DropdownMenuItem>
              <DropdownMenuItem disabled>Share campaign — Coming soon</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Avatar className="h-7 w-7 border border-white/60">
              <AvatarImage src={campaign.creator.avatarUrl} alt={campaign.creator.name} />
              <AvatarFallback>{campaign.creator.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span>@{campaign.creator.handle}</span>
          </div>
          <h3 className="mt-2 text-2xl font-black tracking-tight">{campaign.title}</h3>
        </div>
      </div>

      <CardContent className="space-y-5 p-5">
        <p className="text-sm leading-6 text-slate-600">{campaign.subtitle}</p>

        <CampaignMacroPreview macros={campaign.macros} />

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-3">
            <CalendarDays className="h-4 w-4 text-emerald-700" />
            <div className="mt-1 font-bold text-slate-950">{campaign.durationDays} days</div>
            <div className="text-xs text-slate-500">Duration</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <DollarSign className="h-4 w-4 text-emerald-700" />
            <div className="mt-1 font-bold text-slate-950">{campaign.estimatedBudget}</div>
            <div className="text-xs text-slate-500">Budget</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <Timer className="h-4 w-4 text-emerald-700" />
            <div className="mt-1 font-bold capitalize text-slate-950">{campaign.prepIntensity}</div>
            <div className="text-xs text-slate-500">Prep</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <HeartPulse className="h-4 w-4 text-emerald-700" />
            <div className="mt-1 font-bold text-slate-950">{campaign.completionRate}%</div>
            <div className="text-xs text-slate-500">Completion</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-600">Community completion</span>
            <span className="font-bold text-slate-950">{campaign.completionRate}%</span>
          </div>
          <Progress value={campaign.completionRate} className="h-2" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="capitalize">{campaign.category}</Badge>
          <Badge variant="outline" className={cn("capitalize", prepTone[campaign.prepIntensity])}>{campaign.prepIntensity} prep</Badge>
          {campaign.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="secondary" className="rounded-full">{tag}</Badge>)}
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> {compactNumber(campaign.saves)} saves</span>
            <span className="inline-flex items-center gap-1"><GitFork className="h-4 w-4" /> {compactNumber(campaign.remixes)} remixes</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" disabled title="Campaign previews are coming soon.">Preview — Coming soon</Button>
            <Button className="rounded-full bg-slate-950 text-white hover:bg-emerald-700" disabled title="Campaign remixing is coming soon.">
              <GitFork className="mr-2 h-4 w-4" /> Remix — Coming soon
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
