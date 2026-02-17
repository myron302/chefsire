// client/src/pages/nutrition/MealPlanDetailsPage.tsx
import { useMemo } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calendar, DollarSign, Star, User } from "lucide-react";

type MealPlanDetailsResponse = {
  plan: {
    blueprint: {
      id: string;
      creatorId: string;
      title: string;
      description: string | null;
      duration: number;
      durationUnit: string;
      priceInCents: number;
      category: string;
      dietaryLabels: string[];
      difficulty: string;
      servings: number;
      tags: string[];
      status: string;
      salesCount: number;
      isPremiumContent: boolean | null;
      createdAt: string;
      updatedAt: string;
    };
    creator: {
      id: string;
      username: string;
      displayName: string;
    };
  };
  version: {
    id: string;
    blueprintId: string;
    version: number;
    mealStructure: string;
    changeLog: string | null;
    createdAt: string;
  } | null;
  reviews: Array<{
    review: {
      id: string;
      rating: number;
      comment: string | null;
      createdAt: string;
    };
    user: {
      id: string;
      username: string;
      displayName: string;
    };
  }>;
  ratingStats: {
    avgRating: number;
    totalReviews: number;
  };
};

function formatMoney(cents: number) {
  const dollars = cents / 100;
  return dollars.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function safeParseJson(text: string) {
  try {
    return { ok: true as const, value: JSON.parse(text) };
  } catch {
    return { ok: false as const, value: null };
  }
}

export default function MealPlanDetailsPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const planId = (params as any)?.id as string | undefined;

  const {
    data,
    isLoading,
    error,
  } = useQuery<MealPlanDetailsResponse>({
    queryKey: planId ? ["/api/meal-plans", planId] : ["/api/meal-plans", "__missing__"],
    enabled: !!planId,
  });

  const blueprint = data?.plan?.blueprint;
  const creator = data?.plan?.creator;

  const mealStructurePretty = useMemo(() => {
    const raw = data?.version?.mealStructure;
    if (!raw) return null;
    const parsed = safeParseJson(raw);
    if (!parsed.ok) return raw;
    return JSON.stringify(parsed.value, null, 2);
  }, [data?.version?.mealStructure]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="outline" onClick={() => setLocation("/nutrition/marketplace")} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Marketplace
            </Button>
            <Button variant="ghost" onClick={() => setLocation("/nutrition")}>
              Meal Planner
            </Button>
          </div>

          <h1 className="text-3xl font-bold truncate">
            {isLoading ? "Loading…" : blueprint?.title || "Meal Plan"}
          </h1>
          {blueprint?.description ? (
            <p className="text-muted-foreground mt-1">{blueprint.description}</p>
          ) : null}
        </div>

        {blueprint ? (
          <div className="flex flex-col items-end gap-2">
            <div className="text-2xl font-bold">{formatMoney(blueprint.priceInCents)}</div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{blueprint.category}</Badge>
              <Badge variant="outline">{blueprint.difficulty}</Badge>
              {blueprint.status === "published" ? (
                <Badge className="bg-green-600 text-white">Published</Badge>
              ) : (
                <Badge variant="secondary">{blueprint.status}</Badge>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border p-6 text-sm text-red-600">
          Failed to load this meal plan. It may not exist, or you may need to log in.
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>
                {creator ? (
                  <span className="inline-flex items-center gap-2">
                    <User className="w-4 h-4" />
                    By {creator.displayName || creator.username}
                  </span>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading details…</div>
              ) : null}

              {blueprint ? (
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {blueprint.duration} {blueprint.durationUnit}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {formatMoney(blueprint.priceInCents)}
                  </span>
                  <span>Servings: {blueprint.servings}</span>
                  <span>Sales: {blueprint.salesCount}</span>
                </div>
              ) : null}

              {(blueprint?.dietaryLabels?.length || blueprint?.tags?.length) ? (
                <>
                  <Separator />
                  <div className="flex flex-wrap gap-2">
                    {(blueprint?.dietaryLabels || []).map((l) => (
                      <Badge key={`dl-${l}`} variant="secondary">{l}</Badge>
                    ))}
                    {(blueprint?.tags || []).map((t) => (
                      <Badge key={`tag-${t}`} variant="outline">#{t}</Badge>
                    ))}
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Meal Structure</CardTitle>
              <CardDescription>
                {data?.version
                  ? `Latest version: v${data.version.version}${data.version.changeLog ? ` • ${data.version.changeLog}` : ""}`
                  : "No structure found yet"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!data?.version ? (
                <div className="text-sm text-muted-foreground">
                  This plan doesn't have a saved structure yet.
                </div>
              ) : (
                <pre className="text-xs bg-muted/40 border rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                  {mealStructurePretty}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                Ratings
              </CardTitle>
              <CardDescription>
                {data?.ratingStats
                  ? `${(data.ratingStats.avgRating || 0).toFixed(1)} average • ${data.ratingStats.totalReviews || 0} review${data.ratingStats.totalReviews === 1 ? "" : "s"}`
                  : "No ratings yet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.reviews?.length ? (
                data.reviews.map((r) => (
                  <div key={r.review.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm truncate">{r.user.displayName || r.user.username}</div>
                      <Badge variant="secondary">{r.review.rating} / 5</Badge>
                    </div>
                    {r.review.comment ? (
                      <div className="text-sm text-muted-foreground mt-2">{r.review.comment}</div>
                    ) : (
                      <div className="text-sm text-muted-foreground mt-2">No comment</div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No reviews yet.</div>
              )}

              <div className="text-xs text-muted-foreground">
                Want to browse more? Go back to <Link href="/nutrition/marketplace" className="underline">Marketplace</Link>.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
