import { type UseQueryResult } from "@tanstack/react-query";
import { Link } from "wouter";

import CreatorBundlesSection from "@/components/drinks/CreatorBundlesSection";
import CampaignActionCenterSection from "@/components/drinks/CampaignActionCenterSection";
import CampaignLaunchReadinessSection from "@/components/drinks/CampaignLaunchReadinessSection";
import CampaignRolloutTimelineSection from "@/components/drinks/CampaignRolloutTimelineSection";
import CampaignUnlockReadinessAlertsSection from "@/components/drinks/CampaignUnlockReadinessAlertsSection";
import PinnedCampaignSpotlightSection from "@/components/drinks/PinnedCampaignSpotlightSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  type CreatorBadgesResponse,
  type CreatorDrinkSummary,
} from "@/pages/drinks/creator-dashboard/types";
import { metricNumber } from "@/pages/drinks/creator-dashboard/utils";

interface CreatorDashboardOverviewHubSectionProps {
  creatorDropsUpcomingCount: number;
  safeSummary: CreatorDrinkSummary;
  pendingCollaborationCount: number;
  badgesQuery: UseQueryResult<CreatorBadgesResponse, Error>;
  publicCollectionsCount: number;
  premiumPurchaseCollectionsLength: number;
  memberOnlyCollectionsLength: number;
  freeCollectionsCount: number;
  totalWishlistInterest: number;
  userId: string;
}

export default function CreatorDashboardOverviewHubSection({
  creatorDropsUpcomingCount,
  safeSummary,
  pendingCollaborationCount,
  badgesQuery,
  publicCollectionsCount,
  premiumPurchaseCollectionsLength,
  memberOnlyCollectionsLength,
  freeCollectionsCount,
  totalWishlistInterest,
  userId,
}: CreatorDashboardOverviewHubSectionProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Overview at a glance</CardTitle>
          <CardDescription>
            Start here for urgent next moves, readiness risk, your current strongest signal, and the strategy surfaces worth opening next.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border p-4 text-sm">
            <p className="font-medium text-foreground">Urgent next moves</p>
            <p className="mt-2 text-muted-foreground">Action Center stays first so campaign tasks are not buried under long analytics sections.</p>
          </div>
          <div className="rounded-xl border p-4 text-sm">
            <p className="font-medium text-foreground">{metricNumber(creatorDropsUpcomingCount)} launch beats in motion</p>
            <p className="mt-2 text-muted-foreground">Drop timing, unlock alerts, rollout history, and launch readiness stay grouped together.</p>
          </div>
          <div className="rounded-xl border p-4 text-sm">
            <p className="font-medium text-foreground">{safeSummary.topPerformingDrink ? `${safeSummary.topPerformingDrink.name} leads this week` : "No strongest drink yet"}</p>
            <p className="mt-2 text-muted-foreground">Use momentum, top-performer, and recent activity cards below to understand what is working now.</p>
          </div>
          <div className="rounded-xl border p-4 text-sm">
            <p className="font-medium text-foreground">{metricNumber(pendingCollaborationCount)} collaboration items pending</p>
            <p className="mt-2 text-muted-foreground">Publishing, drops, memberships, and storefront operations remain fully accessible in Operations.</p>
          </div>
        </CardContent>
      </Card>

      <CampaignActionCenterSection />
      <CampaignRolloutTimelineSection limit={8} />
      <CampaignUnlockReadinessAlertsSection limit={4} />
      <CampaignLaunchReadinessSection limit={4} />
      <PinnedCampaignSpotlightSection />
      <CreatorBundlesSection />

      <Card>
        <CardHeader>
          <CardTitle>Creator Milestones & Badges</CardTitle>
          <CardDescription>
            {badgesQuery.data
              ? `${metricNumber(badgesQuery.data.earnedCount)} earned badges`
              : "Progress markers for your creator journey."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {badgesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading badges…</p> : null}
          {badgesQuery.isError ? <p className="text-sm text-destructive">Unable to load badges right now.</p> : null}
          {badgesQuery.data ? (
            <>
              {badgesQuery.data.badges.filter((badge) => badge.isEarned).length === 0 ? (
                <p className="text-sm text-muted-foreground">No badges earned yet. Publish and remix drinks to unlock your first milestone.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {badgesQuery.data.badges.filter((badge) => badge.isEarned).map((badge) => (
                    <Badge key={badge.id} variant="secondary" className="py-1">
                      <span className="mr-1" aria-hidden>{badge.icon}</span>{badge.title}
                    </Badge>
                  ))}
                </div>
              )}

              {badgesQuery.data.nextMilestones.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next milestones</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {badgesQuery.data.nextMilestones.map((badge) => (
                      <div key={badge.id} className="rounded-md border p-2 text-sm">
                        <div className="font-medium"><span className="mr-1">{badge.icon}</span>{badge.title}</div>
                        {badge.progress ? <div className="mt-1 text-xs text-muted-foreground">{metricNumber(badge.progress.current)} / {metricNumber(badge.progress.target)} {badge.progress.label.toLowerCase()}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Creator Storefront Summary</CardTitle>
          <CardDescription>Your collections storefront and lightweight monetization setup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Public collections</p>
              <p className="text-xl font-semibold">{metricNumber(publicCollectionsCount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Premium purchase</p>
              <p className="text-xl font-semibold">{metricNumber(premiumPurchaseCollectionsLength)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Members only</p>
              <p className="text-xl font-semibold">{metricNumber(memberOnlyCollectionsLength)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Free collections</p>
              <p className="text-xl font-semibold">{metricNumber(freeCollectionsCount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Wishlist interest</p>
              <p className="text-xl font-semibold">{metricNumber(totalWishlistInterest)}</p>
            </div>
          </div>
          {premiumPurchaseCollectionsLength > 0 || memberOnlyCollectionsLength > 0 ? (
            <p className="text-sm text-muted-foreground">
              {metricNumber(premiumPurchaseCollectionsLength)} premium purchase collections and {metricNumber(memberOnlyCollectionsLength)} members-only collections live.
              Your public creator page now highlights one-off purchase value separately from membership perks.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No monetized collections yet. Mark a collection as Premium Purchase or Members Only to add a support path without blocking browsing.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/collections">
              <Button variant="outline" size="sm">Manage collections</Button>
            </Link>
            <Link href={`/drinks/creator/${encodeURIComponent(userId)}`}>
              <Button variant="outline" size="sm">View creator storefront</Button>
            </Link>
            <Link href="/drinks/collections/explore">
              <Button size="sm">Browse premium collections</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

    </>
  );
}
