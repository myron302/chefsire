import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { BellDot, Bookmark, Megaphone, Sparkles, Tag, Users } from "lucide-react";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DrinkAlertType =
  | "drink_collection_wishlist_promo"
  | "drink_collection_wishlist_price_drop"
  | "drink_collection_followed_creator_launch"
  | "drink_collection_followed_creator_promo"
  | "drink_creator_followed_post"
  | "drink_creator_member_post";

type DrinkAlert = {
  id: string;
  userId: string;
  type: DrinkAlertType;
  collectionId: string | null;
  creatorUserId: string | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  metadata?: Record<string, unknown>;
};

type DrinkAlertsResponse = {
  ok: boolean;
  userId: string;
  alerts: DrinkAlert[];
  count: number;
  unreadCount: number;
  empty: boolean;
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function typeMeta(type: DrinkAlertType) {
  switch (type) {
    case "drink_collection_wishlist_promo":
      return { label: "Wishlist promo", icon: Tag, badge: "secondary" as const, why: "You saved this premium collection." };
    case "drink_collection_wishlist_price_drop":
      return { label: "Price drop", icon: Bookmark, badge: "secondary" as const, why: "You added this collection to your wishlist." };
    case "drink_collection_followed_creator_launch":
      return { label: "Creator launch", icon: Sparkles, badge: "default" as const, why: "You follow this creator." };
    case "drink_collection_followed_creator_promo":
      return { label: "Creator promo", icon: Megaphone, badge: "outline" as const, why: "A creator you follow launched a promo." };
    case "drink_creator_member_post":
      return { label: "Member update", icon: BellDot, badge: "default" as const, why: "You actively support this creator." };
    case "drink_creator_followed_post":
    default:
      return { label: "Creator post", icon: Users, badge: "outline" as const, why: "A creator you follow published a new update." };
  }
}

export default function DrinksNotificationsPage() {
  const { user, loading: userLoading } = useUser();
  const queryClient = useQueryClient();

  const query = useQuery<DrinkAlertsResponse>({
    queryKey: ["/api/drinks/alerts", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/alerts", { credentials: "include" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load alerts (${response.status})`);
      }

      return payload as DrinkAlertsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const markReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/drinks/alerts/${encodeURIComponent(alertId)}/read`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || `Failed to mark alert read (${response.status})`);
      }

      return payload;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/alerts", user?.id ?? ""] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/drinks/alerts/read-all", {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || `Failed to mark alerts read (${response.status})`);
      }

      return payload;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/alerts", user?.id ?? ""] });
    },
  });

  if (userLoading) {
    return <div className="container mx-auto max-w-6xl px-4 py-8">Loading alerts…</div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-6xl space-y-4 px-4 py-8">
        <DrinksPlatformNav current="notifications" />
        <Card>
          <CardHeader>
            <CardTitle>Premium collection alerts</CardTitle>
            <CardDescription>Sign in to track promos, price drops, and creator launches for premium drink collections.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/auth/login">
              <Button>Sign in</Button>
            </Link>
            <Link href="/drinks/collections/explore">
              <Button variant="outline">Browse premium collections</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const alerts = query.data?.alerts ?? [];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8" data-testid="drinks-alerts-page">
      <DrinksPlatformNav current="notifications" />

      <section className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <BellDot className="h-8 w-8 text-blue-600" />
              Alerts
            </h1>
            <p className="text-sm text-muted-foreground">
              Stay on top of premium collection promos, price drops, and launches from creators you follow.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/collections/wishlist">
              <Button variant="outline" size="sm">Open wishlist</Button>
            </Link>
            <Link href="/drinks/collections/explore">
              <Button variant="outline" size="sm">Browse collections</Button>
            </Link>
            <Button
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending || !query.data?.unreadCount}
            >
              {markAllReadMutation.isPending ? "Marking…" : "Mark all read"}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total alerts</p>
          <p className="text-2xl font-semibold">{alerts.length}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Unread</p>
          <p className="text-2xl font-semibold">{query.data?.unreadCount ?? 0}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Useful for</p>
          <p className="text-sm font-medium">Wishlists, follows, and premium collection promos</p>
        </div>
      </div>

      {query.isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading your alerts…</CardContent>
        </Card>
      ) : null}

      {query.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {query.error instanceof Error ? query.error.message : "Unable to load alerts right now."}
          </CardContent>
        </Card>
      ) : null}

      {query.isSuccess && alerts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No alerts yet</CardTitle>
            <CardDescription>
              Save premium collections or follow creators to get notified when promos go live, prices drop, or a new collection launches.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/drinks/collections/wishlist">
              <Button variant="outline">Wishlist</Button>
            </Link>
            <Link href="/drinks/discover">
              <Button>Discover creators</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {alerts.length > 0 ? (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const meta = typeMeta(alert.type);
            const Icon = meta.icon;
            return (
              <Card key={alert.id} className={alert.isRead ? "border-border" : "border-blue-200 shadow-sm"}>
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={meta.badge}>{meta.label}</Badge>
                      {!alert.isRead ? <Badge>Unread</Badge> : <Badge variant="outline">Read</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDateTime(alert.createdAt)}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{alert.title}</CardTitle>
                      <CardDescription className="text-sm">{alert.message}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{meta.why}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {alert.linkUrl ? (
                      <Link href={alert.linkUrl}>
                        <Button
                          size="sm"
                          variant={alert.isRead ? "outline" : "default"}
                          onClick={() => {
                            if (!alert.isRead) {
                              markReadMutation.mutate(alert.id);
                            }
                          }}
                        >
                          View details
                        </Button>
                      </Link>
                    ) : null}
                    {!alert.isRead ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markReadMutation.mutate(alert.id)}
                        disabled={markReadMutation.isPending}
                      >
                        Mark read
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
