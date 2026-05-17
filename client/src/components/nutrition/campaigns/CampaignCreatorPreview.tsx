import { Award, Sparkles, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { NutritionCampaignCreator } from "@/pages/nutrition/campaigns/mockCampaigns";

function compactNumber(value: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export default function CampaignCreatorPreview({ creator }: { creator: NutritionCampaignCreator }) {
  return (
    <Card className="group min-w-[260px] overflow-hidden border-white/70 bg-white/80 shadow-lg shadow-emerald-950/5 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/10">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-14 w-14 border-2 border-white shadow-md">
            <AvatarImage src={creator.avatarUrl} alt={creator.name} />
            <AvatarFallback>{creator.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold text-slate-950">{creator.name}</h3>
              {creator.isFeatured ? (
                <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                  <Sparkles className="h-3 w-3" /> Featured
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-slate-500">@{creator.handle}</p>
            <p className="mt-1 text-sm font-medium text-emerald-700">{creator.specialty}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-emerald-50 p-2">
            <Users className="mx-auto h-4 w-4 text-emerald-700" />
            <div className="font-bold text-slate-950">{compactNumber(creator.followers)}</div>
            <div className="text-[11px] text-slate-500">followers</div>
          </div>
          <div className="rounded-xl bg-lime-50 p-2">
            <Sparkles className="mx-auto h-4 w-4 text-lime-700" />
            <div className="font-bold text-slate-950">{creator.campaignCount}</div>
            <div className="text-[11px] text-slate-500">campaigns</div>
          </div>
          <div className="rounded-xl bg-amber-50 p-2">
            <Award className="mx-auto h-4 w-4 text-amber-700" />
            <div className="font-bold text-slate-950">{creator.consistencyScore}%</div>
            <div className="text-[11px] text-slate-500">score</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
