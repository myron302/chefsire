import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useUser } from "@/contexts/UserContext";
import CreatorCampaignCard, { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import CampaignPlaybookOnboardingChecklist, {
  CampaignPlaybookOnboardingEmptyState,
  CampaignPlaybookOnboardingSummaryChips,
  type CampaignPlaybookOnboardingItem,
} from "@/components/drinks/CampaignPlaybookOnboardingChecklist";

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type CampaignsResponse = {
  ok: boolean;
  creatorUserId: string;
  count: number;
  pinnedCampaign: CreatorCampaignItem | null;
  items: CreatorCampaignItem[];
};

type DashboardOnboardingResponse = {
  campaigns: CreatorCampaignItem[];
  onboardingItems: CampaignPlaybookOnboardingItem[];
};

function progressValue(item: CampaignPlaybookOnboardingItem) {
  if (!item.summary.totalCount) return 0;
  return Math.round((item.summary.completeCount / item.summary.totalCount) * 100);
}

export default function CampaignPlaybookOnboardingSection() {
  const { user } = useUser();

  const campaignsQuery = useQuery<CampaignsResponse>({
    queryKey: ["/api/drinks/campaigns/creator", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/creator/${encodeURIComponent(user?.id ?? "")}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaigns (${response.status})`);
      return payload as CampaignsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const onboardingQuery = useQuery<DashboardOnboardingResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-onboarding", user?.id ?? ""],
    queryFn: async () => {
      const campaigns = campaignsQuery.data?.items ?? [];
      const onboardingResults = await Promise.all(
        campaigns.map(async (campaign) => {
          const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaign.id)}/playbook-onboarding`, { credentials: "include" });
          const payload = await response.json().catch(() => null);
          if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load onboarding (${response.status})`);
          return { campaign, item: payload?.item as CampaignPlaybookOnboardingItem };
        }),
      );

      const onboardingItems = onboardingResults
        .map((result) => result.item)
        .filter((item): item is CampaignPlaybookOnboardingItem => Boolean(item?.isPlaybookApplied))
        .filter((item) => item.summary.remainingCount > 0)
        .sort((left, right) => {
          if (left.summary.warningCount !== right.summary.warningCount) return right.summary.warningCount - left.summary.warningCount;
          if (left.summary.remainingCount !== right.summary.remainingCount) return right.summary.remainingCount - left.summary.remainingCount;
          return left.campaignName.localeCompare(right.campaignName);
        });

      return {
        campaigns,
        onboardingItems,
      };
    },
    enabled: Boolean(user?.id) && Boolean(campaignsQuery.data),
  });

  const onboardingItems = onboardingQuery.data?.onboardingItems ?? [];
  const appliedCount = React.useMemo(() => onboardingItems.length, [onboardingItems]);
  const warningCount = React.useMemo(() => onboardingItems.reduce((sum, item) => sum + item.summary.warningCount, 0), [onboardingItems]);
  const remainingCount = React.useMemo(() => onboardingItems.reduce((sum, item) => sum + item.summary.remainingCount, 0), [onboardingItems]);

  return (
    <Card id="campaign-playbook-onboarding">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Playbook Onboarding / Setup Steps</CardTitle>
            <CardDescription>
              Campaign-specific setup after you apply a playbook. This stays separate from playbook fit, outcomes, launch readiness, and the broader action center.
            </CardDescription>
          </div>
          <Link href="/drinks/creator-dashboard#campaign-playbook-profiles">
            <Button variant="outline" size="sm">Manage playbooks</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Campaigns needing setup</p>
            <p className="mt-1 text-2xl font-semibold">{appliedCount}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining setup steps</p>
            <p className="mt-1 text-2xl font-semibold">{remainingCount}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Warnings to clear</p>
            <p className="mt-1 text-2xl font-semibold">{warningCount}</p>
          </div>
        </div>

        {campaignsQuery.isLoading || onboardingQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading playbook onboarding…</p> : null}
        {campaignsQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(campaignsQuery.error, "Unable to load campaigns right now.")}</p> : null}
        {onboardingQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(onboardingQuery.error, "Unable to load playbook onboarding right now.")}</p> : null}

        {!campaignsQuery.isLoading && !onboardingQuery.isLoading && !campaignsQuery.isError && !onboardingQuery.isError && onboardingItems.length === 0 ? (
          <CampaignPlaybookOnboardingEmptyState
            title="No playbook setup steps are currently open"
            body="Once a playbook is applied to a campaign, ChefSire will surface the remaining campaign-specific setup steps here so you can finish rollout, CTA, content, and readiness gaps quickly."
          />
        ) : null}

        <div className="space-y-4">
          {onboardingItems.map((item) => {
            const topChecklistItems = item.checklist.slice(0, 3);
            const linkedCampaign = onboardingQuery.data?.campaigns.find((campaign) => campaign.id === item.campaignId) ?? null;

            return (
              <div key={item.campaignId} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={item.campaignRoute} className="font-semibold underline underline-offset-2">
                        {item.campaignName}
                      </Link>
                      <Badge variant="outline">{item.summary.remainingCount} left</Badge>
                      {item.summary.warningCount > 0 ? <Badge variant="destructive">{item.summary.warningCount} warning{item.summary.warningCount === 1 ? "" : "s"}</Badge> : null}
                    </div>
                    <CampaignPlaybookOnboardingSummaryChips item={item} />
                  </div>
                  <div className="min-w-[180px] space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Setup progress</span>
                      <span>{progressValue(item)}%</span>
                    </div>
                    <Progress value={progressValue(item)} />
                  </div>
                </div>

                {linkedCampaign ? (
                  <div className="mt-4">
                    <CreatorCampaignCard campaign={linkedCampaign} showCreator={false} />
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">Top remaining steps</p>
                  <CampaignPlaybookOnboardingChecklist
                    items={topChecklistItems}
                    compact
                    emptyMessage="This campaign does not have any remaining onboarding steps."
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={item.campaignRoute}><Button size="sm">Open campaign detail</Button></Link>
                  {item.checklist[0]?.targetRoute ? (
                    <Link href={item.checklist[0].targetRoute}><Button size="sm" variant="outline">Open next setup surface</Button></Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
