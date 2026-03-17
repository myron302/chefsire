import * as React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { useUser } from "@/contexts/UserContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";

type DrinkNotificationType = "view_summary" | "grocery_add" | "remix" | "follow";

type DrinkNotificationItem = {
  id: string;
  type: DrinkNotificationType;
  createdAt: string;
  title: string;
  subtitle: string;
  route: string | null;
  relatedDrinkSlug: string | null;
  relatedUsername: string | null;
};

type DrinkNotificationsResponse = {
  ok: boolean;
  userId: string;
  generatedAt: string;
  items: DrinkNotificationItem[];
  summary: {
    totalItems: number;
    typeCounts: Record<DrinkNotificationType, number>;
    windowDays: number;
    summarized: string[];
  };
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function labelForType(type: DrinkNotificationType): string {
  switch (type) {
    case "remix":
      return "Remix";
    case "follow":
      return "Follower";
    case "grocery_add":
      return "Grocery Add";
    case "view_summary":
    default:
      return "Views";
  }
}

function variantForType(type: DrinkNotificationType): "default" | "secondary" | "outline" {
  if (type === "remix") return "default";
  if (type === "follow") return "secondary";
  return "outline";
}

export default function DrinksNotificationsPage() {
  const { user, loading: userLoading } = useUser();

  const query = useQuery<DrinkNotificationsResponse>({
    queryKey: ["/api/drinks/notifications", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/notifications", { credentials: "include" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load notifications (${response.status})`);
      }

      return payload as DrinkNotificationsResponse;
    },
    enabled: Boolean(user?.id),
  });

  if (userLoading) {
    return <div className="container mx-auto p-6">Loading notifications...</div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto space-y-3 p-6">
        <h1 className="text-2xl font-bold">Drinks Notifications</h1>
        <p className="text-muted-foreground">Sign in to view creator and activity notifications.</p>
        <DrinksPlatformNav current="notifications" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6" data-testid="drinks-notifications-page">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Drinks Notifications Center</h1>
        <p className="text-muted-foreground">Your latest creator and drink activity in one place.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/drinks/creator-dashboard">
            <Button variant="outline" size="sm">Creator Dashboard</Button>
          </Link>
          <Link href="/drinks/discover">
            <Button variant="outline" size="sm">Discover Hub</Button>
          </Link>
        </div>
      </div>

      <DrinksPlatformNav current="notifications" />

      {query.isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading notification activity...</CardContent>
        </Card>
      ) : query.isError || !query.data ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">Unable to load notifications right now.</CardContent>
        </Card>
      ) : query.data.items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No notifications yet</CardTitle>
            <CardDescription>
              When your drinks get remixed, viewed, or followed, updates will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/drinks/submit">
              <Button>Submit a Drink</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {query.data.items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={variantForType(item.type)}>{labelForType(item.type)}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                </div>
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <CardDescription>{item.subtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                {item.route ? (
                  <Link href={item.route}>
                    <Button variant="ghost" className="px-0">Open related activity</Button>
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">No destination available.</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
