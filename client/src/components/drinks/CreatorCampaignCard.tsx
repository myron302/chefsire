import * as React from "react";
import { CalendarRange, Flame, GlassWater, Heart, Lock, Pin, Users } from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type CreatorCampaignItem = {
  id: string;
  creatorUserId: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: "public" | "followers" | "members";
  audienceLabel: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  isPinned: boolean;
  state: "upcoming" | "active" | "past";
  route: string;
  followerCount: number;
  isFollowing: boolean;
  isOwner: boolean;
  canFollow: boolean;
  counts: {
    collections: number;
    drops: number;
    promos: number;
    challenges: number;
    posts: number;
    roadmap: number;
    total: number;
  };
  createdAt: string;
  updatedAt: string;
  creator: {
    userId: string;
    username: string | null;
    avatar: string | null;
    route: string;
  } | null;
};

function formatDateRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) return "Open-ended story arc";
  const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
  const startLabel = startsAt ? formatter.format(new Date(startsAt)) : "Now";
  const endLabel = endsAt ? formatter.format(new Date(endsAt)) : "Ongoing";
  return `${startLabel} → ${endLabel}`;
}

function stateBadgeLabel(state: CreatorCampaignItem["state"]) {
  switch (state) {
    case "upcoming":
      return "Upcoming";
    case "past":
      return "Past";
    case "active":
    default:
      return "Active";
  }
}

function visibilityIcon(visibility: CreatorCampaignItem["visibility"]) {
  switch (visibility) {
    case "followers":
      return <Users className="h-3.5 w-3.5" />;
    case "members":
      return <Lock className="h-3.5 w-3.5" />;
    default:
      return <GlassWater className="h-3.5 w-3.5" />;
  }
}

export default function CreatorCampaignCard({
  campaign,
  actions,
  showCreator = true,
  onOpenCampaign,
  openHref,
}: {
  campaign: CreatorCampaignItem;
  actions?: React.ReactNode;
  showCreator?: boolean;
  onOpenCampaign?: (() => void) | null;
  openHref?: string | null;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            {showCreator && campaign.creator ? (
              <div className="text-sm text-muted-foreground">
                <Link href={campaign.creator.route} className="underline underline-offset-2">
                  {campaign.creator.username ? `@${campaign.creator.username}` : "Creator"}
                </Link>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Badge variant={campaign.state === "active" ? "default" : "outline"}>{stateBadgeLabel(campaign.state)}</Badge>
              {campaign.isPinned ? <Badge variant="secondary" className="gap-1"><Pin className="h-3.5 w-3.5" />Pinned spotlight</Badge> : null}
              <Badge variant={campaign.visibility === "public" ? "outline" : "secondary"} className="gap-1">{visibilityIcon(campaign.visibility)}{campaign.audienceLabel}</Badge>
              {!campaign.isActive ? <Badge variant="outline">Inactive</Badge> : null}
              <Badge variant="outline" className="gap-1"><CalendarRange className="h-3.5 w-3.5" />{formatDateRange(campaign.startsAt, campaign.endsAt)}</Badge>
              <Badge variant="outline" className="gap-1"><Flame className="h-3.5 w-3.5" />{campaign.counts.total} linked item{campaign.counts.total === 1 ? "" : "s"}</Badge>
              <Badge variant={campaign.isFollowing ? "secondary" : "outline"} className="gap-1"><Heart className="h-3.5 w-3.5" />{campaign.followerCount} following</Badge>
            </div>
            <div>
              <h3 className="text-lg font-semibold">{campaign.name}</h3>
              {campaign.description ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{campaign.description}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {campaign.counts.drops > 0 ? <span>{campaign.counts.drops} drops</span> : null}
              {campaign.counts.collections > 0 ? <span>{campaign.counts.collections} collections</span> : null}
              {campaign.counts.promos > 0 ? <span>{campaign.counts.promos} promos</span> : null}
              {campaign.counts.challenges > 0 ? <span>{campaign.counts.challenges} challenges</span> : null}
              {campaign.counts.posts > 0 ? <span>{campaign.counts.posts} posts</span> : null}
              {campaign.counts.roadmap > 0 ? <span>{campaign.counts.roadmap} roadmap notes</span> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={openHref ?? campaign.route}><Button size="sm" variant={campaign.state === "active" ? "default" : "outline"} onClick={onOpenCampaign ?? undefined}>Open campaign</Button></Link>
            {actions}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
