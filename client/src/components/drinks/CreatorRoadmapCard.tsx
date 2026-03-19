import * as React from "react";
import { Link } from "wouter";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type CreatorRoadmapItem = {
  id: string;
  creatorUserId: string;
  title: string;
  description: string | null;
  itemType: "collection" | "promo" | "challenge" | "member_drop" | "update" | "roadmap";
  visibility: "public" | "followers" | "members";
  audienceLabel: string;
  scheduledFor: string | null;
  releasedAt: string | null;
  status: "upcoming" | "live" | "archived";
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
};

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function itemTypeLabel(itemType: CreatorRoadmapItem["itemType"]) {
  switch (itemType) {
    case "collection":
      return "Collection";
    case "promo":
      return "Promo";
    case "challenge":
      return "Challenge";
    case "member_drop":
      return "Member drop";
    case "update":
      return "Update";
    case "roadmap":
    default:
      return "Roadmap";
  }
}

function visibilityLabel(visibility: CreatorRoadmapItem["visibility"]) {
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

function statusLabel(status: CreatorRoadmapItem["status"]) {
  switch (status) {
    case "live":
      return "Live now";
    case "archived":
      return "Archive";
    case "upcoming":
    default:
      return "Upcoming";
  }
}

function initials(value?: string | null) {
  return value?.slice(0, 2).toUpperCase() || "RM";
}

type CreatorRoadmapCardProps = {
  item: CreatorRoadmapItem;
  showCreator?: boolean;
  actions?: React.ReactNode;
};

export default function CreatorRoadmapCard({ item, showCreator = true, actions }: CreatorRoadmapCardProps) {
  const scheduledLabel = formatDateTime(item.scheduledFor);
  const releasedLabel = formatDateTime(item.releasedAt);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            {showCreator && item.creator ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={item.creator.avatar ?? undefined} alt={item.creator.username ?? "creator"} />
                  <AvatarFallback>{initials(item.creator.username)}</AvatarFallback>
                </Avatar>
                <Link href={item.creator.route} className="font-medium text-foreground underline underline-offset-2">
                  {item.creator.username ? `@${item.creator.username}` : "Creator"}
                </Link>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant={item.status === "live" ? "default" : "secondary"}>{statusLabel(item.status)}</Badge>
                <Badge variant="secondary">{itemTypeLabel(item.itemType)}</Badge>
                <Badge variant={item.visibility === "public" ? "outline" : "default"}>{visibilityLabel(item.visibility)}</Badge>
                <Badge variant="outline">Visible to {item.audienceLabel.toLowerCase()}</Badge>
                {scheduledLabel ? <Badge variant="outline">Planned {scheduledLabel}</Badge> : null}
                {releasedLabel ? <Badge variant="outline">Released {releasedLabel}</Badge> : null}
              </div>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              {item.description ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p> : null}
            </div>
          </div>

          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        {(item.linkedCollection || item.linkedChallenge) ? (
          <div className="flex flex-wrap gap-2">
            {item.linkedCollection ? (
              <Link href={item.linkedCollection.route}>
                <Button variant="outline" size="sm">
                  Collection · {item.linkedCollection.name}
                </Button>
              </Link>
            ) : null}
            {item.linkedChallenge ? (
              <Link href={item.linkedChallenge.route}>
                <Button variant="outline" size="sm">
                  Challenge · {item.linkedChallenge.title}
                </Button>
              </Link>
            ) : null}
            <Link href="/drinks/roadmap">
              <Button variant="ghost" size="sm">Open roadmap</Button>
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
