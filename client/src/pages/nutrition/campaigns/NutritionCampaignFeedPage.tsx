import { useMemo, useState } from "react";
import { ArrowRight, Leaf, Sparkles, Tags } from "lucide-react";

import CampaignCard from "@/components/nutrition/campaigns/CampaignCard";
import CampaignCreatorPreview from "@/components/nutrition/campaigns/CampaignCreatorPreview";
import CampaignFilters, { defaultFilters, type NutritionCampaignFiltersState } from "@/components/nutrition/campaigns/CampaignFilters";
import CampaignHero from "@/components/nutrition/campaigns/CampaignHero";
import CampaignStats from "@/components/nutrition/campaigns/CampaignStats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { featuredNutritionCreators, nutritionCampaigns, type NutritionCampaign } from "./mockCampaigns";

function matchesCalories(campaign: NutritionCampaign, value: NutritionCampaignFiltersState["calories"]) {
  if (value === "under-1800") return campaign.macros.caloriesPerDay < 1800;
  if (value === "1800-2300") return campaign.macros.caloriesPerDay >= 1800 && campaign.macros.caloriesPerDay <= 2300;
  if (value === "over-2300") return campaign.macros.caloriesPerDay > 2300;
  return true;
}

function matchesProtein(campaign: NutritionCampaign, value: NutritionCampaignFiltersState["protein"]) {
  if (value === "100-plus") return campaign.macros.proteinPerDay >= 100;
  if (value === "140-plus") return campaign.macros.proteinPerDay >= 140;
  if (value === "170-plus") return campaign.macros.proteinPerDay >= 170;
  return true;
}

function matchesDuration(campaign: NutritionCampaign, value: NutritionCampaignFiltersState["duration"]) {
  if (value === "14") return campaign.durationDays <= 14;
  if (value === "21") return campaign.durationDays === 21;
  if (value === "28-plus") return campaign.durationDays >= 28;
  return true;
}

function sortCampaigns(campaigns: NutritionCampaign[], sort: NutritionCampaignFiltersState["sort"]) {
  return [...campaigns].sort((a, b) => {
    if (sort === "new") return Number(b.isNew) - Number(a.isNew) || b.saves - a.saves;
    if (sort === "popular") return b.saves - a.saves;
    if (sort === "completion") return b.completionRate - a.completionRate;
    return Number(b.isTrending) - Number(a.isTrending) || b.remixes - a.remixes;
  });
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
          <Sparkles className="h-4 w-4" /> {eyebrow}
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <Button variant="ghost" className="w-fit gap-2 rounded-full text-emerald-700 hover:text-emerald-800">
        View all <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function NutritionCampaignFeedPage() {
  const [filters, setFilters] = useState<NutritionCampaignFiltersState>(defaultFilters);

  const filteredCampaigns = useMemo(() => {
    const visible = nutritionCampaigns.filter((campaign) => {
      if (filters.dietType !== "all" && campaign.dietType !== filters.dietType) return false;
      if (filters.difficulty !== "all" && campaign.difficulty !== filters.difficulty) return false;
      if (filters.prepIntensity !== "all" && campaign.prepIntensity !== filters.prepIntensity) return false;
      if (filters.budget !== "all" && campaign.budgetLevel !== filters.budget) return false;
      if (!matchesCalories(campaign, filters.calories)) return false;
      if (!matchesProtein(campaign, filters.protein)) return false;
      if (!matchesDuration(campaign, filters.duration)) return false;
      return true;
    });

    return sortCampaigns(visible, filters.sort);
  }, [filters]);

  const trendingCampaigns = nutritionCampaigns.filter((campaign) => campaign.isTrending).slice(0, 4);
  const seasonalCampaigns = nutritionCampaigns.filter((campaign) => campaign.seasonalTags.length > 0 && campaign.isNew).slice(0, 3);
  const popularCategories = Array.from(new Set(nutritionCampaigns.map((campaign) => campaign.category)));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ecfdf5_45%,#ffffff_100%)]">
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        <CampaignHero campaigns={nutritionCampaigns} />
        <CampaignStats campaigns={nutritionCampaigns} />

        <section className="space-y-5">
          <SectionHeader
            eyebrow="Momentum"
            title="Trending Campaigns"
            description="Nutrition systems gaining saves, remixes, and completion velocity across the ChefSire community."
          />
          <div className="grid gap-5 lg:grid-cols-2">
            {trendingCampaigns.map((campaign, index) => <CampaignCard key={campaign.id} campaign={campaign} featured={index === 0} />)}
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeader
            eyebrow="Creator economy"
            title="Featured Creators"
            description="Follow nutrition creators with repeatable planning styles, strong consistency scores, and ready-to-remix campaign libraries."
          />
          <div className="flex gap-4 overflow-x-auto pb-2">
            {featuredNutritionCreators.map((creator) => <CampaignCreatorPreview key={creator.id} creator={creator} />)}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <Card className="overflow-hidden border-white/70 bg-white/85 shadow-xl shadow-emerald-950/5 backdrop-blur">
            <CardContent className="p-6">
              <SectionHeader
                eyebrow="Seasonal"
                title="Seasonal Campaigns"
                description="Timely plans for training blocks, semester resets, workweek routines, and seasonal wellness arcs."
              />
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {seasonalCampaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-3xl border bg-gradient-to-br from-white to-emerald-50 p-4 shadow-sm">
                    <Badge className="rounded-full bg-emerald-600 text-white hover:bg-emerald-600">{campaign.seasonalTags[0]}</Badge>
                    <h3 className="mt-3 font-bold text-slate-950">{campaign.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{campaign.subtitle}</p>
                    <div className="mt-3 text-sm font-semibold text-emerald-700">{campaign.durationDays} days · {campaign.estimatedBudget}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-white/70 bg-slate-950 text-white shadow-xl shadow-emerald-950/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-lime-300">
                <Tags className="h-4 w-4" /> Popular categories
              </div>
              <h2 className="mt-2 text-2xl font-black">Browse by nutrition goal</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {popularCategories.map((category) => (
                  <Badge key={category} variant="secondary" className="rounded-full bg-white/10 px-4 py-2 text-white ring-1 ring-white/15 hover:bg-white/20">
                    <Leaf className="mr-1.5 h-3.5 w-3.5 text-lime-300" /> {category}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionHeader
            eyebrow="Discovery feed"
            title="Main Feed Grid"
            description="Filter by diet type, prep intensity, calories, protein, budget, duration, and signal type. The scaffold is intentionally frontend-only for this foundation pass."
          />
          <CampaignFilters filters={filters} resultCount={filteredCampaigns.length} onChange={setFilters} />

          <Tabs defaultValue="grid" className="space-y-5">
            <TabsList className="rounded-full bg-white/80 p-1 shadow-sm">
              <TabsTrigger value="grid" className="rounded-full">Campaign grid</TabsTrigger>
              <TabsTrigger value="analytics" className="rounded-full">Signal view</TabsTrigger>
            </TabsList>
            <TabsContent value="grid" className="mt-0">
              {filteredCampaigns.length > 0 ? (
                <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                  {filteredCampaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
                </div>
              ) : (
                <Card className="border-dashed bg-white/80">
                  <CardContent className="p-8 text-center">
                    <h3 className="text-xl font-bold text-slate-950">No campaigns match this filter set yet.</h3>
                    <p className="mt-2 text-sm text-slate-600">Reset filters or broaden your macro ranges to rediscover available mock campaigns.</p>
                    <Button className="mt-4 rounded-full" onClick={() => setFilters(defaultFilters)}>Reset filters</Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="analytics" className="mt-0">
              <Card className="border-white/70 bg-white/85 shadow-xl shadow-emerald-950/5 backdrop-blur">
                <CardContent className="grid gap-4 p-5 md:grid-cols-3">
                  {filteredCampaigns.slice(0, 6).map((campaign) => (
                    <div key={campaign.id} className="rounded-3xl border bg-gradient-to-br from-slate-50 to-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-bold text-slate-950">{campaign.title}</h3>
                        <Badge variant="outline">{campaign.completionRate}%</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="rounded-2xl bg-emerald-50 p-2"><strong>{campaign.macros.caloriesPerDay}</strong><br /><span className="text-xs text-slate-500">cal</span></div>
                        <div className="rounded-2xl bg-lime-50 p-2"><strong>{campaign.macros.proteinPerDay}g</strong><br /><span className="text-xs text-slate-500">protein</span></div>
                        <div className="rounded-2xl bg-cyan-50 p-2"><strong>{campaign.remixes}</strong><br /><span className="text-xs text-slate-500">remixes</span></div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  );
}
