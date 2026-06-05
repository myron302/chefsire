// client/src/pages/nutrition/MyPurchasesPage.tsx
import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bookmark, Calendar, DollarSign, ShoppingBag, ArrowLeft, ExternalLink } from "lucide-react";
import { MealPlannerSocialActions } from "@/components/nutrition/social/MealPlannerSocial";

type PurchaseRow = {
  purchase: {
    id: string;
    blueprintId: string;
    pricePaidCents: number;
    paymentStatus: string;
    paymentMethod: string | null;
    createdAt: string;
  };
  blueprint: {
    id: string;
    title: string;
    description: string | null;
    duration: number;
    durationUnit: string;
    priceInCents: number;
    category: string;
    difficulty: string;
    servings: number;
    dietaryLabels: string[];
    tags: string[];
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  creator: {
    id: string;
    username: string;
    displayName: string;
  };
};

type MyPurchasesResponse = {
  purchases: PurchaseRow[];
};

type SavedMealPlannerResponse = {
  marketplacePlans: Array<{
    blueprint: { id: string; title: string; description: string | null; priceInCents: number; duration: number; durationUnit: string; savedAt?: string | null };
    creator: { id: string; username: string; displayName: string };
    social?: { likeCount: number; saveCount: number; commentCount: number; viewerHasLiked: boolean; viewerHasSaved: boolean };
  }>;
  sharedWeeks: Array<{
    token: string;
    weekAnchor: string;
    savedAt: string | null;
    sharer: { id?: string | null; username: string | null; displayName: string | null };
    social?: { likeCount: number; saveCount: number; commentCount: number; viewerHasLiked: boolean; viewerHasSaved: boolean };
  }>;
};

function formatMoney(cents: number) {
  const dollars = cents / 100;
  return dollars.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function MyPurchasesPage() {
  const [, setLocation] = useLocation();

  const {
    data,
    isLoading,
    error,
  } = useQuery<MyPurchasesResponse>({
    queryKey: ["/api/my-purchases"],
  });

  const savedQuery = useQuery<SavedMealPlannerResponse>({ queryKey: ["/api/me/saved-meal-planner-items"] });

  const purchases = useMemo(() => data?.purchases || [], [data]);
  const savedPlans = savedQuery.data?.marketplacePlans || [];
  const savedWeeks = savedQuery.data?.sharedWeeks || [];

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="w-7 h-7" />
            <h1 className="text-3xl font-bold">My Meal Plan Purchases</h1>
          </div>
          <p className="text-muted-foreground">
            Your purchased meal plans live here. Open a plan to view details and start using it.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation("/nutrition/marketplace")}
            className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Marketplace
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bookmark className="h-5 w-5" /> Saved planner items</CardTitle>
          <CardDescription>Bookmarked marketplace plans and public shared weeks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {savedQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading saved items…</p> : null}
          {!savedQuery.isLoading && savedPlans.length === 0 && savedWeeks.length === 0 ? <p className="text-sm text-muted-foreground">No saved planner items yet. Tap Save on marketplace plans or shared weeks to collect them here.</p> : null}
          {savedPlans.length > 0 ? <div className="text-sm font-semibold">Marketplace plans</div> : null}
          {savedPlans.map((item) => (
            <div key={item.blueprint.id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold">{item.blueprint.title}</div>
                  <div className="text-sm text-muted-foreground">By {item.creator.displayName || item.creator.username} • {formatMoney(item.blueprint.priceInCents)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <MealPlannerSocialActions target="meal-plan" id={item.blueprint.id} initialStats={item.social} compact />
                  <Button size="sm" variant="outline" onClick={() => setLocation(`/nutrition/meal-plans/${item.blueprint.id}`)}>Open</Button>
                </div>
              </div>
            </div>
          ))}
          {savedWeeks.length > 0 ? <div className="text-sm font-semibold">Shared weeks</div> : null}
          {savedWeeks.map((item) => (
            <div key={item.token} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold">Week of {item.weekAnchor}</div>
                  <div className="text-sm text-muted-foreground">Shared by {item.sharer.displayName || item.sharer.username || "Chefsire member"}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <MealPlannerSocialActions target="shared-week" id={item.token} initialStats={item.social} compact />
                  <Button size="sm" variant="outline" onClick={() => setLocation(`/meal-planner/shared/${item.token}`)}>Open</Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchases</CardTitle>
          <CardDescription>
            {isLoading
              ? "Loading your purchases…"
              : purchases.length
                ? `${purchases.length} purchased plan${purchases.length === 1 ? "" : "s"}`
                : "No purchases yet"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error ? (
            <div className="text-sm text-red-600">
              Failed to load purchases. Please make sure you're logged in and try again.
            </div>
          ) : null}

          {!isLoading && purchases.length === 0 ? (
            <div className="rounded-lg border p-6">
              <div className="text-lg font-semibold mb-1">Nothing here yet</div>
              <div className="text-sm text-muted-foreground mb-4">
                Browse the marketplace and purchase a plan to see it here.
              </div>
              <Button onClick={() => setLocation("/nutrition/marketplace")}>Browse Marketplace</Button>
            </div>
          ) : null}

          {purchases.map((row) => {
            const plan = row.blueprint;
            const creator = row.creator;
            return (
              <div key={row.purchase.id} className="rounded-lg border p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-lg font-semibold truncate">{plan.title}</div>
                      <Badge variant="secondary">{plan.category}</Badge>
                      <Badge variant="outline">{plan.difficulty}</Badge>
                      {plan.status === "published" ? (
                        <Badge className="bg-green-600 text-white">Published</Badge>
                      ) : (
                        <Badge variant="secondary">{plan.status}</Badge>
                      )}
                    </div>

                    {plan.description ? (
                      <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{plan.description}</div>
                    ) : null}

                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {plan.duration} {plan.durationUnit}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        Paid {formatMoney(row.purchase.pricePaidCents)}
                      </span>
                      <span>
                        Bought {formatDate(row.purchase.createdAt)}
                      </span>
                      <span className="truncate">By {creator.displayName || creator.username}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setLocation(`/nutrition/meal-plans/${plan.id}`)}
                      className="gap-2"
                    >
                      Open
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {(plan.dietaryLabels?.length || plan.tags?.length) ? (
                  <>
                    <Separator className="my-3" />
                    <div className="flex flex-wrap gap-2">
                      {(plan.dietaryLabels || []).slice(0, 8).map((l) => (
                        <Badge key={`dl-${plan.id}-${l}`} variant="secondary">{l}</Badge>
                      ))}
                      {(plan.tags || []).slice(0, 8).map((t) => (
                        <Badge key={`tag-${plan.id}-${t}`} variant="outline">#{t}</Badge>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}

          <div className="pt-2 text-sm text-muted-foreground">
            Looking for your creator drafts? Go to <Link href="/nutrition/create" className="underline">Create Meal Plan</Link>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
