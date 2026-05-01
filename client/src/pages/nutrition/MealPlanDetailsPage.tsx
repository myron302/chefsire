// client/src/pages/nutrition/MealPlanDetailsPage.tsx
import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { ArrowLeft, Calendar, DollarSign, Star, User, Send } from "lucide-react";

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
    review: { id: string; rating: number; comment: string | null; createdAt: string };
    user: { id: string; username: string; displayName: string };
  }>;
  ratingStats: { avgRating: number; totalReviews: number };
};

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function safeParseJson(text: string) {
  try { return { ok: true as const, value: JSON.parse(text) }; }
  catch { return { ok: false as const, value: null }; }
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          className="focus:outline-none"
          aria-label={`${n} star${n !== 1 ? "s" : ""}`}
        >
          <Star
            className={`w-7 h-7 transition-colors ${
              n <= (hovered || value) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function MealPlanDetailsPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const planId = (params as any)?.id as string | undefined;

  const { data, isLoading, error } = useQuery<MealPlanDetailsResponse>({
    queryKey: planId ? ["/api/meal-plans", planId] : ["/api/meal-plans", "__missing__"],
    enabled: !!planId,
  });

  // Review form state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const blueprint = data?.plan?.blueprint;
  const creator = data?.plan?.creator;

  // Check if the current user already has a review
  const myExistingReview = useMemo(
    () => data?.reviews?.find(r => user?.id && r.user.id === user.id),
    [data?.reviews, user?.id]
  );

  const mealStructurePretty = useMemo(() => {
    const raw = data?.version?.mealStructure;
    if (!raw) return null;
    const parsed = safeParseJson(raw);
    if (!parsed.ok) return raw;
    return JSON.stringify(parsed.value, null, 2);
  }, [data?.version?.mealStructure]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planId || !user) {
      toast({ title: "Sign in required", description: "You must be logged in to leave a review.", variant: "destructive" });
      return;
    }
    if (reviewRating < 1) {
      toast({ title: "Select a rating", description: "Please pick 1–5 stars.", variant: "destructive" });
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/meal-plans/${planId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment.trim() || null }),
      });
      if (res.ok) {
        toast({ title: "Review submitted!", description: "Thanks for your feedback." });
        setReviewRating(0);
        setReviewComment("");
        queryClient.invalidateQueries({ queryKey: ["/api/meal-plans", planId] });
      } else {
        const d = await res.json();
        toast({ title: "Error", description: d.message || "Failed to submit review.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally { setSubmittingReview(false); }
  };

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
          <div className="flex flex-col items-end gap-2 shrink-0">
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
        {/* Left column */}
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
              {isLoading ? <div className="text-sm text-muted-foreground">Loading details…</div> : null}

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
                    {(blueprint?.dietaryLabels || []).map(l => (
                      <Badge key={`dl-${l}`} variant="secondary">{l}</Badge>
                    ))}
                    {(blueprint?.tags || []).map(t => (
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

        {/* Right column */}
        <div className="space-y-6">
          {/* Rating summary */}
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
                data.reviews.map(r => (
                  <div key={r.review.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm truncate">
                        {r.user.displayName || r.user.username}
                        {user?.id === r.user.id && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {Array.from({ length: r.review.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                    </div>
                    {r.review.comment ? (
                      <div className="text-sm text-muted-foreground mt-1">{r.review.comment}</div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No reviews yet.</div>
              )}

              <div className="text-xs text-muted-foreground pt-1">
                Browse more in the <Link href="/nutrition/marketplace" className="underline">Marketplace</Link>.
              </div>
            </CardContent>
          </Card>

          {/* Review form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {myExistingReview ? "Update Your Review" : "Leave a Review"}
              </CardTitle>
              <CardDescription>
                {user
                  ? "You must have purchased this plan to leave a review."
                  : "Sign in to leave a review."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                <Button variant="outline" className="w-full" onClick={() => setLocation("/auth/login")}>
                  Sign in to review
                </Button>
              ) : (
                <form onSubmit={handleSubmitReview} className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Your rating</p>
                    <StarPicker
                      value={myExistingReview ? (reviewRating || myExistingReview.review.rating) : reviewRating}
                      onChange={setReviewRating}
                    />
                  </div>
                  <Textarea
                    placeholder="Share your experience with this meal plan (optional)…"
                    value={reviewComment || (myExistingReview?.review.comment ?? "")}
                    onChange={e => setReviewComment(e.target.value)}
                    rows={3}
                  />
                  <Button type="submit" className="w-full" disabled={submittingReview}>
                    <Send className="w-4 h-4 mr-2" />
                    {submittingReview ? "Submitting…" : myExistingReview ? "Update Review" : "Submit Review"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
