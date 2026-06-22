import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CreatorFollowButton } from "@/components/nutrition/social/MealPlannerSocial";

export type ConversionBadgeInput = {
  priceInCents?: number | null;
  price?: string | number | null;
  avgRating?: number | null;
  reviewCount?: number | null;
  salesCount?: number | null;
  createdAt?: string | null;
  social?: { likeCount?: number; saveCount?: number; commentCount?: number } | null;
  ranking?: { trendingScore?: number | null } | null;
  creatorFollowerCount?: number | null;
};

function priceCents(input: ConversionBadgeInput) {
  if (typeof input.priceInCents === "number") return input.priceInCents;
  if (typeof input.price === "number") return Math.round(input.price * 100);
  if (typeof input.price === "string") return Math.round(Number(input.price.replace(/[^0-9.]/g, "") || 0) * 100);
  return 0;
}

function isNew(createdAt?: string | null) {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && Date.now() - created <= 45 * 24 * 60 * 60 * 1000;
}

export function getConversionBadges(input: ConversionBadgeInput) {
  const badges: Array<{ label: string; variant?: "default" | "secondary" | "outline"; className?: string }> = [];
  const saves = Number(input.social?.saveCount || 0);
  const likes = Number(input.social?.likeCount || 0);
  const comments = Number(input.social?.commentCount || 0);
  const sales = Number(input.salesCount || 0);
  const trendingScore = Number(input.ranking?.trendingScore || 0) || likes * 2 + saves * 3 + comments * 2 + sales * 4;
  const cents = priceCents(input);

  if (trendingScore >= 10 || likes + saves + comments >= 6) badges.push({ label: "Trending", className: "bg-orange-600 text-white" });
  if (saves >= Math.max(3, likes) || saves >= 5) badges.push({ label: "Most saved", variant: "secondary" });
  if (Number(input.creatorFollowerCount || 0) >= 25 || sales >= 10) badges.push({ label: "Popular creator", variant: "secondary" });
  if (isNew(input.createdAt) && sales < 3) badges.push({ label: "New creator", variant: "outline" });
  if (Number(input.avgRating || 0) >= 4.5 && Number(input.reviewCount || 0) >= 3) badges.push({ label: "Highly rated", className: "bg-yellow-500 text-white" });
  if (cents <= 500) badges.push({ label: "Budget friendly", variant: "outline" });
  if (cents > 0) badges.push({ label: "Premium plan", variant: "secondary" });

  return badges.slice(0, 4);
}

export function ConversionBadges({ input }: { input: ConversionBadgeInput }) {
  const badges = getConversionBadges(input);
  if (badges.length === 0) return null;
  return <div className="flex flex-wrap gap-2">{badges.map((badge) => <Badge key={badge.label} variant={badge.variant} className={badge.className}>{badge.label}</Badge>)}</div>;
}

export function CreatorFollowPrompt({ creatorId, creatorName, className = "" }: { creatorId?: string | null; creatorName?: string | null; className?: string }) {
  if (!creatorId) return null;
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold">Follow this creator for more meal plans</div>
          <div className="text-sm text-muted-foreground">Get back to {creatorName || "this creator"}'s plans, shared weeks, and future creator tools faster.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreatorFollowButton creatorId={creatorId} />
          <Link href={`/nutrition/creators/${creatorId}`} className="inline-flex h-10 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">View creator</Link>
        </div>
      </CardContent>
    </Card>
  );
}
