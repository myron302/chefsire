import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";

import CreatorDropCard, { type CreatorDropItem } from "@/components/drinks/CreatorDropCard";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import DropRsvpButton from "@/components/drinks/DropRsvpButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";
import {
  formatCreatorDropDateTime,
  getCreatorDropCountdownLabel,
  getCreatorDropLifecycleDescription,
  getCreatorDropLifecycleHeading,
  getCreatorDropPrimaryActionLabel,
  getCreatorDropScheduleMessage,
} from "@/lib/creator-drop";

type DropDetailResponse = {
  ok: boolean;
  drop: CreatorDropItem;
};

function visibilityNarrative(drop: CreatorDropItem) {
  if (drop.visibility === "members") {
    return "Member-only drop pages stay visible only to the creator and active members, so recap notes never leak publicly.";
  }
  if (drop.visibility === "followers") {
    return "Follower drops stay visible only to the creator and followed users, including before launch and after release.";
  }
  return "Public drop pages are visible to anyone across landing, live launch, and replay states.";
}

export default function DrinkDropDetailPage() {
  const [matched, params] = useRoute<{ id: string }>("/drinks/drops/:id");
  const { user, loading: userLoading } = useUser();
  const dropId = matched ? String(params?.id ?? "").trim() : "";

  const query = useQuery<DropDetailResponse>({
    queryKey: [`/api/drinks/drops/${dropId}`, user?.id ?? "guest"],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/drops/${encodeURIComponent(dropId)}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load drop (${response.status})`);
      }
      return payload as DropDetailResponse;
    },
    enabled: Boolean(dropId),
  });

  const drop = query.data?.drop;
  useEffect(() => {
    if (!dropId || !query.data?.drop) return;
    void fetch(`/api/drinks/drops/${encodeURIComponent(dropId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ eventType: "view_drop" }),
    }).catch(() => undefined);
  }, [dropId, query.data?.drop]);

  const primaryDestination = useMemo(() => {
    if (!drop) return null;
    if (drop.linkedCollection) {
      return {
        href: drop.linkedCollection.route,
        label: getCreatorDropPrimaryActionLabel(drop.status, "collection"),
        title: drop.linkedCollection.name,
      };
    }
    if (drop.linkedChallenge) {
      return {
        href: drop.linkedChallenge.route,
        label: getCreatorDropPrimaryActionLabel(drop.status, "challenge"),
        title: drop.linkedChallenge.title,
      };
    }
    return null;
  }, [drop]);

  const trackClick = (targetType: "collection" | "challenge" | "promo", targetId?: string | null) => {
    if (!dropId) return;
    void fetch(`/api/drinks/drops/${encodeURIComponent(dropId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ eventType: "click_drop_target", targetType, targetId: targetId ?? null }),
    }).catch(() => undefined);
  };

  if (!matched) return null;

  if (userLoading) {
    return <div className="container mx-auto max-w-5xl px-4 py-8">Loading drop…</div>;
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8" data-testid="drink-drop-detail-page">
      <DrinksPlatformNav current="drops" />

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Drop landing page</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              A dedicated destination for the full drop lifecycle: preview the launch, jump into the live release, and come back later for the replay recap.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Dedicated launch destination</Badge>
              <Badge variant="outline">Go-live aware</Badge>
              <Badge variant="outline">Replay + recap ready</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/drops"><Button variant="outline">Back to drops</Button></Link>
            {drop?.creator ? <Link href={drop.creator.route}><Button variant="outline">Creator page</Button></Link> : null}
            {drop?.creator ? <Link href={`${drop.creator.route}#creator-roadmap`}><Button variant="outline">Roadmap + archive</Button></Link> : null}
          </div>
        </div>
      </section>

      {query.isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading drop details…</CardContent>
        </Card>
      ) : null}

      {query.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {query.error instanceof Error ? query.error.message : "Unable to load this drop right now."}
          </CardContent>
        </Card>
      ) : null}

      {drop ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr),minmax(320px,1fr)]">
            <CreatorDropCard drop={drop} />

            <Card>
              <CardHeader>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={drop.status === "live" ? "default" : "outline"}>{getCreatorDropCountdownLabel(drop.scheduledFor, drop.status)}</Badge>
                  <Badge variant="secondary">{getCreatorDropScheduleMessage(drop.scheduledFor, drop.status)}</Badge>
                </div>
                <CardTitle>{getCreatorDropLifecycleHeading(drop.status)}</CardTitle>
                <CardDescription>{getCreatorDropLifecycleDescription(drop.status)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">Scheduled time</p>
                  <p className="text-muted-foreground">{formatCreatorDropDateTime(drop.scheduledFor)}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Visibility</p>
                  <p className="text-muted-foreground">{visibilityNarrative(drop)}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Drop page role</p>
                  <p className="text-muted-foreground">
                    {drop.status === "upcoming"
                      ? "This page is the countdown destination before launch, with RSVP/Notify-Me still active."
                      : drop.status === "live"
                        ? "This page becomes the live launch surface and points people into the released content immediately."
                        : "This page becomes the replay surface, keeping recap notes and release links intact after the launch window ends."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DropRsvpButton drop={drop} />
                  {primaryDestination ? (
                    <Link href={primaryDestination.href}><Button onClick={() => trackClick(drop.linkedCollection ? "collection" : "challenge", drop.linkedCollection?.id ?? drop.linkedChallenge?.id)}>{primaryDestination.label}</Button></Link>
                  ) : null}
                  {!primaryDestination ? <Link href={drop.creator?.route ?? "/drinks/drops"}><Button variant="outline">Open creator page</Button></Link> : null}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr),minmax(0,0.8fr)]">
            <Card>
              <CardHeader>
                <CardTitle>
                  {drop.status === "upcoming"
                    ? "Before launch"
                    : drop.status === "live"
                      ? "Live launch highlights"
                      : "Launch recap"}
                </CardTitle>
                <CardDescription>
                  {drop.status === "upcoming"
                    ? "Use the drop page as the canonical pre-launch destination without replacing the creator feed, alerts, roadmap, or collection pages."
                    : drop.status === "live"
                      ? "Live drops should send people into the release while still keeping lightweight context on this page."
                      : "Archived drops keep lightweight release notes and destinations so the launch still feels real after the countdown is over."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {drop.status === "upcoming" ? (
                  <>
                    <div className="space-y-1">
                      <p className="font-medium">Countdown + notify</p>
                      <p className="text-muted-foreground">
                        RSVP/Notify-Me remains active until the scheduled go-live time, so followers and members can subscribe directly from this landing page.
                      </p>
                    </div>
                    {drop.description ? (
                      <div className="space-y-1">
                        <p className="font-medium">What’s coming</p>
                        <p className="whitespace-pre-wrap text-muted-foreground">{drop.description}</p>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {drop.status === "live" ? (
                  <>
                    <div className="space-y-1">
                      <p className="font-medium">Live now</p>
                      <p className="text-muted-foreground">
                        Countdown messaging has flipped into a live state, and the primary CTA now points to the released destination when one is linked.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Creator highlight</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{drop.recapNotes || drop.description || "No launch highlight added yet. The drop still routes people into the live release."}</p>
                    </div>
                  </>
                ) : null}

                {drop.status === "archived" ? (
                  <>
                    <div className="space-y-1">
                      <p className="font-medium">Released / ended</p>
                      <p className="text-muted-foreground">
                        The launch window has passed, but the drop page stays useful as the canonical replay page for release notes and final destinations.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Recap notes</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{drop.recapNotes || "No recap notes were added for this release yet."}</p>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Linked release destinations</CardTitle>
                <CardDescription>Lightweight previews for the collection, challenge, or promo connected to this drop.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {drop.linkedCollection ? (
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="font-medium">Collection · {drop.linkedCollection.name}</p>
                    <p className="text-muted-foreground">Access: {drop.linkedCollection.accessType.replaceAll("_", " ")}</p>
                    <Link href={drop.linkedCollection.route}><Button size="sm" variant="outline" onClick={() => trackClick("collection", drop.linkedCollection?.id)}>{getCreatorDropPrimaryActionLabel(drop.status, "collection")}</Button></Link>
                  </div>
                ) : null}

                {drop.linkedChallenge ? (
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="font-medium">Challenge · {drop.linkedChallenge.title}</p>
                    <p className="text-muted-foreground">Challenge drops can turn this page into a live participation CTA the moment the launch activates.</p>
                    <Link href={drop.linkedChallenge.route}><Button size="sm" variant="outline" onClick={() => trackClick("challenge", drop.linkedChallenge?.id)}>{getCreatorDropPrimaryActionLabel(drop.status, "challenge")}</Button></Link>
                  </div>
                ) : null}

                {drop.linkedPromotion ? (
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="font-medium">Promo code · {drop.linkedPromotion.code}</p>
                    <p className="text-muted-foreground">
                      Starts {drop.linkedPromotion.startsAt ? formatCreatorDropDateTime(drop.linkedPromotion.startsAt) : "with this drop"}
                      {drop.linkedPromotion.endsAt ? ` · Ends ${formatCreatorDropDateTime(drop.linkedPromotion.endsAt)}` : ""}.
                    </p>
                    <Link href={drop.detailRoute}><Button size="sm" variant="outline" onClick={() => trackClick("promo", drop.linkedPromotion?.id)}>{getCreatorDropPrimaryActionLabel(drop.status, "promo")}</Button></Link>
                  </div>
                ) : null}

                {!drop.linkedCollection && !drop.linkedChallenge && !drop.linkedPromotion ? (
                  <p className="text-muted-foreground">No linked launch destination was attached to this drop.</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Story continuity</CardTitle>
              <CardDescription>This same drop should feel coherent across the calendar, creator page, feed, and roadmap/archive surfaces.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link href="/drinks/drops"><Button variant="outline">Open drops calendar</Button></Link>
              {drop.creator ? <Link href={drop.creator.route}><Button variant="outline">Open creator page</Button></Link> : null}
              {drop.creator ? <Link href={`${drop.creator.route}#creator-roadmap`}><Button variant="outline">Open creator archive</Button></Link> : null}
              <Link href="/drinks/roadmap"><Button variant="outline">Open roadmap + archive</Button></Link>
              <Link href="/drinks/feed"><Button variant="outline">Open creator feed</Button></Link>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
