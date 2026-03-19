import * as React from "react";
import { Link } from "wouter";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import CreatorCollaborationAttribution, { type AcceptedCreatorCollaboration } from "@/components/drinks/CreatorCollaborationAttribution";

export type CreatorPostItem = {
  id: string;
  creatorUserId: string;
  title: string;
  body: string;
  postType: "update" | "promo" | "collection_launch" | "challenge" | "member_only";
  visibility: "public" | "followers" | "members";
  audienceLabel: string;
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
  acceptedCollaboration?: AcceptedCreatorCollaboration | null;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function visibilityBadgeLabel(visibility: CreatorPostItem["visibility"]) {
  switch (visibility) {
    case "members":
      return "Members";
    case "followers":
      return "Followers";
    case "public":
    default:
      return "Public";
  }
}

function postTypeLabel(postType: CreatorPostItem["postType"]) {
  switch (postType) {
    case "promo":
      return "Promo";
    case "collection_launch":
      return "Collection launch";
    case "challenge":
      return "Challenge";
    case "member_only":
      return "Member update";
    case "update":
    default:
      return "Update";
  }
}

function initials(value?: string | null) {
  return value?.slice(0, 2).toUpperCase() || "CP";
}

type CreatorPostCardProps = {
  post: CreatorPostItem;
  showCreator?: boolean;
  actions?: React.ReactNode;
};

export default function CreatorPostCard({ post, showCreator = true, actions }: CreatorPostCardProps) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            {showCreator && post.creator ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={post.creator.avatar ?? undefined} alt={post.creator.username ?? "creator"} />
                  <AvatarFallback>{initials(post.creator.username)}</AvatarFallback>
                </Avatar>
                <Link href={post.creator.route} className="font-medium text-foreground underline underline-offset-2">
                  {post.creator.username ? `@${post.creator.username}` : "Creator"}
                </Link>
                <span>·</span>
                <span>{formatDateTime(post.createdAt)}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{formatDateTime(post.createdAt)}</p>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{postTypeLabel(post.postType)}</Badge>
                <Badge variant={post.visibility === "public" ? "outline" : "default"}>{visibilityBadgeLabel(post.visibility)}</Badge>
                <Badge variant="outline">Visible to {post.audienceLabel.toLowerCase()}</Badge>
              </div>
              <h3 className="text-lg font-semibold">{post.title}</h3>
              <CreatorCollaborationAttribution collaboration={post.acceptedCollaboration ?? null} primaryCreatorUserId={post.creatorUserId} />
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{post.body}</p>
            </div>
          </div>

          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        {(post.linkedCollection || post.linkedChallenge) ? (
          <div className="flex flex-wrap gap-2">
            {post.linkedCollection ? (
              <Link href={post.linkedCollection.route}>
                <Button variant="outline" size="sm">
                  Collection · {post.linkedCollection.name}
                </Button>
              </Link>
            ) : null}
            {post.linkedChallenge ? (
              <Link href={post.linkedChallenge.route}>
                <Button variant="outline" size="sm">
                  Challenge · {post.linkedChallenge.title}
                </Button>
              </Link>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
