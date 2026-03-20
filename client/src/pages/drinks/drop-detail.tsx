import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";

import CreatorDropCard, { type CreatorDropItem } from "@/components/drinks/CreatorDropCard";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import DropRsvpButton from "@/components/drinks/DropRsvpButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";
import { formatCreatorDropDateTime, getCreatorDropCountdownLabel, getCreatorDropScheduleMessage } from "@/lib/creator-drop";

type DropDetailResponse = {
  ok: boolean;
  drop: CreatorDropItem;
};

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

  if (!matched) return null;

  if (userLoading) {
    return <div className="container mx-auto max-w-5xl px-4 py-8">Loading drop…</div>;
  }

  const drop = query.data?.drop;

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8" data-testid="drink-drop-detail-page">
      <DrinksPlatformNav current="drops" />

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Drop detail</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Track exactly when a creator drop goes live, who can see it, and what collection, challenge, or promo it unlocks.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Countdown UX</Badge>
              <Badge variant="outline">Visibility-aware</Badge>
              <Badge variant="outline">RSVP + go-live ready</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/drops"><Button variant="outline">Back to drops</Button></Link>
            {drop?.creator ? <Link href={drop.creator.route}><Button variant="outline">Creator page</Button></Link> : null}
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
                <CardTitle>{getCreatorDropCountdownLabel(drop.scheduledFor, drop.status)}</CardTitle>
                <CardDescription>{getCreatorDropScheduleMessage(drop.scheduledFor, drop.status)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">Scheduled time</p>
                  <p className="text-muted-foreground">{formatCreatorDropDateTime(drop.scheduledFor)}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Visibility</p>
                  <p className="text-muted-foreground">
                    {drop.visibility === "public"
                      ? "Anyone can see this drop when it is visible."
                      : drop.visibility === "followers"
                        ? "Only followers and the creator can see this drop."
                        : "Only active members and the creator can see this drop."}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Go-live alerts</p>
                  <p className="text-muted-foreground">
                    RSVP/Notify-Me listeners receive an in-app alert when the scheduled time is reached and the drop becomes live.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DropRsvpButton drop={drop} />
                  {drop.status === "live" && drop.linkedCollection ? (
                    <Link href={drop.linkedCollection.route}><Button>Open live collection</Button></Link>
                  ) : null}
                  {drop.status === "live" && !drop.linkedCollection && drop.linkedChallenge ? (
                    <Link href={drop.linkedChallenge.route}><Button>Open live challenge</Button></Link>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Linked collection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {drop.linkedCollection ? (
                  <>
                    <p className="font-medium">{drop.linkedCollection.name}</p>
                    <p className="text-muted-foreground">Access: {drop.linkedCollection.accessType.replaceAll("_", " ")}</p>
                    <Link href={drop.linkedCollection.route}><Button size="sm" variant="outline">Open collection</Button></Link>
                  </>
                ) : (
                  <p className="text-muted-foreground">No collection linked to this drop.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Linked challenge</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {drop.linkedChallenge ? (
                  <>
                    <p className="font-medium">{drop.linkedChallenge.title}</p>
                    <p className="text-muted-foreground">Challenge launches can turn this drop into an active participation CTA the moment it goes live.</p>
                    <Link href={drop.linkedChallenge.route}><Button size="sm" variant="outline">Open challenge</Button></Link>
                  </>
                ) : (
                  <p className="text-muted-foreground">No challenge linked to this drop.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Linked promo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {drop.linkedPromotion ? (
                  <>
                    <p className="font-medium">Promo code {drop.linkedPromotion.code}</p>
                    <p className="text-muted-foreground">
                      Promo starts {drop.linkedPromotion.startsAt ? formatCreatorDropDateTime(drop.linkedPromotion.startsAt) : "with this drop"}.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No promo linked to this drop.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
