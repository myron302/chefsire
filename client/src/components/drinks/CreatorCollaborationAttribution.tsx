import * as React from "react";
import { Link } from "wouter";

type CollaborationCreator = {
  userId: string;
  username: string | null;
  route: string;
};

export type AcceptedCreatorCollaboration = {
  id: string;
  collaborationType: "collection" | "drop" | "post" | "roadmap";
  status: "accepted";
  ownerCreator: CollaborationCreator | null;
  collaborator: CollaborationCreator | null;
};

type CreatorCollaborationAttributionProps = {
  collaboration?: AcceptedCreatorCollaboration | null;
  primaryCreatorUserId?: string | null;
  prefix?: string;
  className?: string;
};

function creatorLabel(creator?: CollaborationCreator | null) {
  return creator?.username ? `@${creator.username}` : "creator";
}

export default function CreatorCollaborationAttribution({
  collaboration,
  primaryCreatorUserId,
  prefix = "Created with",
  className = "text-xs text-muted-foreground",
}: CreatorCollaborationAttributionProps) {
  if (!collaboration?.ownerCreator || !collaboration?.collaborator) return null;

  const secondaryCreator = collaboration.ownerCreator.userId === primaryCreatorUserId
    ? collaboration.collaborator
    : collaboration.collaborator.userId === primaryCreatorUserId
      ? collaboration.ownerCreator
      : collaboration.collaborator;

  return (
    <p className={className}>
      {prefix}{" "}
      <Link href={secondaryCreator.route} className="underline underline-offset-2">
        {creatorLabel(secondaryCreator)}
      </Link>
    </p>
  );
}
