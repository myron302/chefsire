import { ArrowRight, BarChart3, Flame, GitFork, Sparkles, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NutritionCampaign } from "@/pages/nutrition/campaigns/mockCampaigns";

function compactNumber(value: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export default function CampaignHero({ campaigns }: { campaigns: NutritionCampaign[] }) {
  const totalSaves = campaigns.reduce((sum, campaign) => sum + campaign.saves, 0);
  const trendingCount = campaigns.filter((campaign) => campaign.isTrending).length;
  const averageCompletion = Math.round(campaigns.reduce((sum, campaign) => sum + campaign.completionRate, 0) / campaigns.length);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-2xl shadow-emerald-950/20 sm:px-8 lg:px-10 lg:py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(16,185,129,0.35),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(132,204,22,0.28),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(6,78,59,0.92))]" />
      <div className="absolute -right-16 top-10 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute -bottom-20 left-1/3 h-64 w-64 rounded-full bg-lime-300/10 blur-3xl" />

      <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <Badge className="gap-2 rounded-full bg-white/10 px-4 py-2 text-white ring-1 ring-white/15 hover:bg-white/10">
            <Sparkles className="h-4 w-4 text-lime-300" />
            Nutrition Campaigns Beta
          </Badge>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Discover Elite Nutrition Systems
            </h1>
            <p className="max-w-2xl text-base leading-7 text-emerald-50/80 sm:text-lg">
              Share, remix, and follow creator-built meal plan campaigns with clear macros, prep intensity, budget signals, and completion momentum.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="rounded-full bg-white text-slate-950 shadow-xl hover:bg-emerald-50">
              Explore campaigns <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              View creator playbooks
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full bg-white/10 text-white ring-1 ring-white/15">
              <Flame className="mr-1.5 h-3.5 w-3.5 text-orange-300" /> {trendingCount} trending systems
            </Badge>
            <Badge variant="secondary" className="rounded-full bg-white/10 text-white ring-1 ring-white/15">
              <Users className="mr-1.5 h-3.5 w-3.5 text-cyan-200" /> {compactNumber(totalSaves)} saves
            </Badge>
            <Badge variant="secondary" className="rounded-full bg-white/10 text-white ring-1 ring-white/15">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5 text-lime-200" /> {averageCompletion}% completion avg
            </Badge>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute inset-0 rotate-6 rounded-[2rem] bg-gradient-to-br from-lime-300/30 to-emerald-400/30 blur-sm" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-xl">
            <div className="rounded-[1.5rem] bg-white p-4 text-slate-950 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Live remix board</p>
                  <h2 className="mt-1 text-2xl font-black">Macro Systems</h2>
                </div>
                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                  <GitFork className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {["Protein-first cut", "Plant prep engine", "Family budget reset"].map((label, index) => (
                  <div key={label} className="rounded-2xl border bg-gradient-to-r from-slate-50 to-emerald-50/70 p-3">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{label}</span>
                      <span className="text-emerald-700">+{[420, 315, 276][index]} saves</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-lime-400" style={{ width: `${[84, 72, 66][index]}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
