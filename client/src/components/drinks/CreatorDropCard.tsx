import * as React from "react";
import { Link } from "wouter";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import CreatorCollaborationAttribution, { type AcceptedCreatorCollaboration } from "@/components/drinks/CreatorCollaborationAttribution";
import DropRsvpButton from "@/components/drinks/DropRsvpButton";
import {
  formatCreatorDropDateTime,
  getCreatorDropCountdownLabel,
  getCreatorDropScheduleMessage,
  type CreatorDropStatus,
} from "@/lib/creator-drop";

export type CreatorDropItem = {
  id: string;
  creatorUserId: string;
  title: string;
  description: string | null;
  dropType: "collection_launch" | "promo_launch" | "member_drop" | "challenge_launch" | "update";
  visibility: "public" | "followers" | "members";
  status: CreatorDropStatus;
  audienceLabel: string;
  scheduledFor: string;
  detailRoute: string;
  isPublished: boolean;
  rsvpCount: number;
  isRsvped: boolean;
  createdAt: string;
  updatedAt: string;
  creator: {
    userId: string;
    username: string | null;
    avatar: string | null;
    route: string;
  } | null;
  linkedCollection: {
    id: string;
    name: string;
    accessType: "public" | "premium_purchase" | "membership_only";
    isPublic: boolean;
    route: string;
  } | null;
  linkedChallenge: {
    id: string;
    slug: string;
    title: string;
    route: string;
  } | null;
  linkedPromotion: {
    id: string;
    code: string;
    startsAt: string | null;
    endsAt: string | null;
  } | null;
  acceptedCollaboration?: AcceptedCreatorCollaboration | null;
};

function dropTypeLabel(dropType: CreatorDropItem["dropType"]) {
  switch (dropType) {
    case "promo_launch":
      return "Promo launch";
    case "member_drop":
      return "Member drop";
    case "challenge_launch":
      return "Challenge launch";
    case "update":
      return "Update";
    case "collection_launch":
    default:
      return "Collection launch";
  }
}

function visibilityBadgeLabel(visibility: CreatorDropItem["visibility"]) {
  switch (visibility) {
    case "followers":
      return "Followers";
    case "members":
      return "Members";
    case "public":
    default:
      return "Public";
  }
}

function statusBadgeLabel(status: CreatorDropStatus) {
  switch (status) {
    case "live":
      return "Live now";
    case "archived":
      return "Archived";
    case "upcoming":
    default:
      return "Upcoming";
  }
}

function initials(value?: string | null) {
  return value?.slice(0, 2).toUpperCase() || "DR";
}

type CreatorDropCardProps = {
  drop: CreatorDropItem;
  showCreator?: boolean;
  actions?: React.ReactNode;
};

export default function CreatorDropCard({ drop, showCreator = true, actions }: CreatorDropCardProps) {
  const hasLinkedDestination = Boolean(drop.linkedCollection || drop.linkedChallenge);
  const countdownLabel = getCreatorDropCountdownLabel(drop.scheduledFor, drop.status);
  const scheduleMessage = getCreatorDropScheduleMessage(drop.scheduledFor, drop.status);
  const statusVariant = drop.status === "live" ? "default" : drop.status === "archived" ? "outline" : "secondary";

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            {showCreator && drop.creator ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={drop.creator.avatar ?? undefined} alt={drop.creator.username ?? "creator"} />
                  <AvatarFallback>{initials(drop.creator.username)}</AvatarFallback>
                </Avatar>
                <Link href={drop.creator.route} className="font-medium text-foreground underline underline-offset-2">
                  {drop.creator.username ? `@${drop.creator.username}` : "Creator"}
                </Link>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant={statusVariant}>{statusBadgeLabel(drop.status)}</Badge>
                <Badge variant="secondary">{dropTypeLabel(drop.dropType)}</Badge>
                <Badge variant={drop.visibility === "public" ? "outline" : "default"}>{visibilityBadgeLabel(drop.visibility)}</Badge>
                <Badge variant="outline">{countdownLabel}</Badge>
                <Badge variant="outline">{scheduleMessage}</Badge>
                <Badge variant="outline">Visible to {drop.audienceLabel.toLowerCase()}</Badge>
                <Badge variant="outline">{drop.rsvpCount} notified</Badge>
                {drop.isRsvped ? <Badge variant="secondary">You’re notified</Badge> : null}
                {!drop.isPublished ? <Badge variant="outline">Draft</Badge> : null}
                {drop.linkedPromotion ? <Badge variant="secondary">Code {drop.linkedPromotion.code}</Badge> : null}
              </div>
              <h3 className="text-lg font-semibold">{drop.title}</h3>
              <CreatorCollaborationAttribution collaboration={drop.acceptedCollaboration ?? null} primaryCreatorUserId={drop.creatorUserId} />
              {drop.description ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{drop.description}</p> : null}
              <p className="text-sm font-medium text-foreground">{formatCreatorDropDateTime(drop.scheduledFor)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <DropRsvpButton drop={drop} />
            <Link href={drop.detailRoute}>
              <Button type="button" size="sm" variant="outline">View drop</Button>
            </Link>
            {actions}
          </div>
        </div>

        {hasLinkedDestination ? (
          <div className="flex flex-wrap gap-2">
            {drop.linkedCollection ? (
              <Link href={drop.linkedCollection.route}>
                <Button variant={drop.status === "live" ? "default" : "outline"} size="sm">
                  {drop.status === "live" ? "Open live collection" : `Collection · ${drop.linkedCollection.name}`}
                </Button>
              </Link>
            ) : null}
            {drop.linkedChallenge ? (
              <Link href={drop.linkedChallenge.route}>
                <Button variant={drop.status === "live" ? "default" : "outline"} size="sm">
                  {drop.status === "live" ? "Open live challenge" : `Challenge · ${drop.linkedChallenge.title}`}
                </Button>
              </Link>
            ) : null}
            <Link href="/drinks/drops">
              <Button variant="ghost" size="sm">Open drops calendar</Button>
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
