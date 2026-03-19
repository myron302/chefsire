import * as React from "react";
import { Link } from "wouter";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type CreatorDropItem = {
  id: string;
  creatorUserId: string;
  title: string;
  description: string | null;
  dropType: "collection_launch" | "promo_launch" | "member_drop" | "challenge_launch" | "update";
  visibility: "public" | "followers" | "members";
  audienceLabel: string;
  scheduledFor: string;
  isPublished: boolean;
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
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

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

function initials(value?: string | null) {
  return value?.slice(0, 2).toUpperCase() || "DR";
}

type CreatorDropCardProps = {
  drop: CreatorDropItem;
  showCreator?: boolean;
  actions?: React.ReactNode;
};

export default function CreatorDropCard({ drop, showCreator = true, actions }: CreatorDropCardProps) {
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
                <Badge variant="secondary">{dropTypeLabel(drop.dropType)}</Badge>
                <Badge variant={drop.visibility === "public" ? "outline" : "default"}>{visibilityBadgeLabel(drop.visibility)}</Badge>
                <Badge variant="outline">Scheduled {formatDateTime(drop.scheduledFor)}</Badge>
                <Badge variant="outline">Visible to {drop.audienceLabel.toLowerCase()}</Badge>
                {!drop.isPublished ? <Badge variant="outline">Draft</Badge> : null}
                {drop.linkedPromotion ? <Badge variant="secondary">Code {drop.linkedPromotion.code}</Badge> : null}
              </div>
              <h3 className="text-lg font-semibold">{drop.title}</h3>
              {drop.description ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{drop.description}</p> : null}
            </div>
          </div>

          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        {(drop.linkedCollection || drop.linkedChallenge) ? (
          <div className="flex flex-wrap gap-2">
            {drop.linkedCollection ? (
              <Link href={drop.linkedCollection.route}>
                <Button variant="outline" size="sm">
                  Collection · {drop.linkedCollection.name}
                </Button>
              </Link>
            ) : null}
            {drop.linkedChallenge ? (
              <Link href={drop.linkedChallenge.route}>
                <Button variant="outline" size="sm">
                  Challenge · {drop.linkedChallenge.title}
                </Button>
              </Link>
            ) : null}
            {drop.creator ? (
              <Link href="/drinks/drops">
                <Button variant="ghost" size="sm">Open drops calendar</Button>
              </Link>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
