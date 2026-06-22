import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreatorFollowButton, MealPlannerSocialActions } from "@/components/nutrition/social/MealPlannerSocial";
import { ConversionBadges } from "@/components/nutrition/social/conversionUtils";
import { Calendar, ChefHat, DollarSign, Star, Users } from "lucide-react";

type CreatorPayload = {
  creator: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    specialty: string | null;
    followerCount: number;
  };
  stats: {
    plansPublished: number;
    totalLikes: number;
    totalSaves: number;
    totalReviews: number;
    totalSales: number;
  };
  publicSharedWeeks?: Array<{
    token: string;
    weekAnchor: string;
    sharedAt: string | null;
    social?: { likeCount: number; saveCount: number; commentCount: number; viewerHasLiked: boolean; viewerHasSaved: boolean };
  }>;
};

type PlanListing = {
  blueprint: {
    id: string;
    title: string;
    description: string | null;
    duration: number;
    durationUnit: string;
    priceInCents: number;
    category: string;
    difficulty: string;
    salesCount: number;
  };
  creator: { id: string; username: string; displayName: string };
  avgRating: number;
  reviewCount: number;
  social?: { likeCount: number; saveCount: number; commentCount: number; viewerHasLiked: boolean; viewerHasSaved: boolean };
};

function money(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function MealPlanCreatorStorefrontPage() {
  const params = useParams<{ creatorId: string }>();
  const [, setLocation] = useLocation();
  const creatorId = params?.creatorId;

  const creatorQuery = useQuery<CreatorPayload>({
    queryKey: ["/api/meal-plan-creators", creatorId],
    enabled: Boolean(creatorId),
  });
  const plansQuery = useQuery<{ plans: PlanListing[] }>({
    queryKey: ["/api/meal-plan-creators", creatorId, "plans"],
    queryFn: async () => {
      const res = await fetch(`/api/meal-plan-creators/${encodeURIComponent(String(creatorId))}/plans`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load creator plans");
      return res.json();
    },
    enabled: Boolean(creatorId),
  });

  if (creatorQuery.isLoading) return <div className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground">Loading creator storefront…</div>;
  if (creatorQuery.error || !creatorQuery.data) {
    return <div className="mx-auto max-w-3xl p-6"><Card><CardHeader><CardTitle>Creator not found</CardTitle><CardDescription>This meal-plan creator profile is unavailable.</CardDescription></CardHeader></Card></div>;
  }

  const { creator, stats } = creatorQuery.data;
  const plans = plansQuery.data?.plans || [];
  const publicSharedWeeks = creatorQuery.data.publicSharedWeeks || [];
  const topLikedPlans = [...plans].sort((a, b) => Number(b.social?.likeCount || 0) - Number(a.social?.likeCount || 0)).slice(0, 3);
  const topSavedPlans = [...plans].sort((a, b) => Number(b.social?.saveCount || 0) - Number(a.social?.saveCount || 0)).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Card>
        <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center">
          <Avatar className="h-24 w-24">
            <AvatarImage src={creator.avatarUrl || undefined} />
            <AvatarFallback>{(creator.displayName || creator.username || "C").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold">{creator.displayName || creator.username}</h1>
              {creator.specialty ? <Badge variant="secondary">{creator.specialty}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">@{creator.username} • {creator.followerCount || 0} followers</p>
            {creator.bio ? <p className="mt-3 max-w-3xl text-muted-foreground">{creator.bio}</p> : <p className="mt-3 text-muted-foreground">This creator is building a meal-planner storefront.</p>}
          </div>
          <div className="flex flex-col gap-2">
            <CreatorFollowButton creatorId={creator.id} />
            <Button variant="outline" onClick={() => document.getElementById("creator-plans")?.scrollIntoView({ behavior: "smooth" })}>Browse Plans</Button>
            <Button variant="outline" onClick={() => document.getElementById("creator-shared-weeks")?.scrollIntoView({ behavior: "smooth" })}>View Shared Weeks</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        <Stat label="Plans published" value={stats.plansPublished} />
        <Stat label="Total likes" value={stats.totalLikes} />
        <Stat label="Total saves" value={stats.totalSaves} />
        <Stat label="Reviews" value={stats.totalReviews} />
        <Stat label="Sales" value={stats.totalSales} />
      </div>


      <div className="grid gap-4 md:grid-cols-2">
        <SpotlightPlans title="Most Liked" description="Marketplace plans ranked by social likes." plans={topLikedPlans} onOpen={(planId) => setLocation(`/nutrition/meal-plans/${planId}`)} />
        <SpotlightPlans title="Most Saved" description="Marketplace plans shoppers are saving most." plans={topSavedPlans} onOpen={(planId) => setLocation(`/nutrition/meal-plans/${planId}`)} />
      </div>

      <Card id="creator-shared-weeks">
        <CardHeader>
          <CardTitle>Recent shared weeks</CardTitle>
          <CardDescription>Reusable public weekly planner snapshots from this creator.</CardDescription>
        </CardHeader>
        <CardContent>
          {publicSharedWeeks.length === 0 ? <p className="text-sm text-muted-foreground">No public shared weeks yet.</p> : null}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {publicSharedWeeks.map((week) => (
              <Card key={week.token}>
                <CardContent className="space-y-3 p-5">
                  <div>
                    <div className="font-semibold">Week of {week.weekAnchor}</div>
                    <div className="text-sm text-muted-foreground">{week.sharedAt ? `Updated ${new Date(week.sharedAt).toLocaleDateString()}` : 'Public weekly snapshot'}</div>
                  </div>
                  <MealPlannerSocialActions target="shared-week" id={week.token} initialStats={week.social} compact />
                  <Button className="w-full" variant="outline" onClick={() => setLocation(`/meal-planner/shared/${week.token}`)}>View shared week</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card id="creator-plans">
        <CardHeader>
          <CardTitle>Published meal plans</CardTitle>
          <CardDescription>Creator storefront catalog for marketplace plans.</CardDescription>
        </CardHeader>
        <CardContent>
          {plansQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading plans…</p> : null}
          {!plansQuery.isLoading && plans.length === 0 ? <p className="text-sm text-muted-foreground">No published meal plans yet.</p> : null}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.blueprint.id} className="overflow-hidden">
                <CardContent className="space-y-4 p-5">
                  <div className="flex h-32 items-center justify-center rounded-lg bg-gradient-to-br from-green-100 to-blue-100">
                    <ChefHat className="h-12 w-12 text-green-600 opacity-60" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{plan.blueprint.title}</h3>
                    {plan.blueprint.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{plan.blueprint.description}</p> : null}
                  </div>
                  <ConversionBadges input={{ priceInCents: plan.blueprint.priceInCents, avgRating: plan.avgRating, reviewCount: plan.reviewCount, salesCount: plan.blueprint.salesCount, social: plan.social, creatorFollowerCount: creator.followerCount }} />
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{plan.blueprint.duration} {plan.blueprint.durationUnit || "days"}</span>
                    <span className="inline-flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{money(plan.blueprint.priceInCents)}</span>
                    <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" />{plan.avgRating ? Number(plan.avgRating).toFixed(1) : "New"}</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{plan.blueprint.salesCount}</span>
                  </div>
                  <MealPlannerSocialActions target="meal-plan" id={plan.blueprint.id} initialStats={plan.social} compact />
                  <Button className="w-full" onClick={() => setLocation(`/nutrition/meal-plans/${plan.blueprint.id}`)}>Start with this plan</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SpotlightPlans({ title, description, plans, onOpen }: { title: string; description: string; plans: PlanListing[]; onOpen: (planId: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {plans.length === 0 ? <p className="text-sm text-muted-foreground">No ranked plans yet.</p> : null}
        {plans.map((plan) => (
          <div key={plan.blueprint.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{plan.blueprint.title}</div>
              <div className="text-xs text-muted-foreground">{Number(plan.social?.likeCount || 0)} likes • {Number(plan.social?.saveCount || 0)} saves</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => onOpen(plan.blueprint.id)}>View</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-bold">{Number(value || 0).toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
