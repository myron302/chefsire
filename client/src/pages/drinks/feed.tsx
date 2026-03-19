import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import CreatorPostCard, { type CreatorPostItem } from "@/components/drinks/CreatorPostCard";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CreatorPostsFeedResponse = {
  ok: boolean;
  signedIn: boolean;
  count: number;
  visibility: {
    public: boolean;
    followers: boolean;
    members: boolean;
  };
  items: CreatorPostItem[];
};

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export default function DrinkCreatorPostsFeedPage() {
  const { user, loading: userLoading } = useUser();

  const feedQuery = useQuery<CreatorPostsFeedResponse>({
    queryKey: ["/api/drinks/creator-posts/feed", user?.id ?? "guest"],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-posts/feed", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load creator posts feed (${response.status})`);
      }
      return payload as CreatorPostsFeedResponse;
    },
  });

  if (userLoading) {
    return <div className="container mx-auto max-w-6xl px-4 py-8">Loading creator feed…</div>;
  }

  const posts = feedQuery.data?.items ?? [];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8" data-testid="drinks-creator-post-feed">
      <DrinksPlatformNav current="feed" />

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Creator Feed</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Drinks-platform-native creator posts: product updates, collection launches, challenge notes, promo news, and member updates in one lightweight feed.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Public posts for everyone</Badge>
              <Badge variant="outline">Follower posts if you follow</Badge>
              <Badge variant="outline">Member posts if your membership is active</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/discover"><Button variant="outline">Discover hub</Button></Link>
            <Link href="/drinks/creator-dashboard#posts"><Button variant="outline">Creator dashboard</Button></Link>
            {!user ? <Link href="/auth/login"><Button>Sign in for your full feed</Button></Link> : null}
          </div>
        </div>

        {!user ? (
          <Card>
            <CardHeader>
              <CardTitle>Public feed preview</CardTitle>
              <CardDescription>
                Signed-out visitors see public creator posts only. Sign in to unlock followed-creator and member-only visibility in this same feed.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link href="/auth/login"><Button>Sign in</Button></Link>
              <Link href="/drinks/creators/trending"><Button variant="outline">Find creators to follow</Button></Link>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {feedQuery.isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading creator feed…</CardContent>
        </Card>
      ) : null}

      {feedQuery.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {readErrorMessage(feedQuery.error, "Unable to load the creator feed right now.")}
          </CardContent>
        </Card>
      ) : null}

      {feedQuery.isSuccess ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Visible posts</p>
            <p className="text-2xl font-semibold">{posts.length}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Signed in</p>
            <p className="text-sm font-medium">{user ? "Yes — personalized feed" : "No — public only"}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Best use</p>
            <p className="text-sm font-medium">Membership updates, collection launches, creator promos, and challenge notes</p>
          </div>
        </div>
      ) : null}

      {feedQuery.isSuccess && posts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No creator posts yet</CardTitle>
            <CardDescription>
              {user
                ? "Follow creators or join creator memberships to give this feed more signal as posts start landing."
                : "Creators have not published any public posts yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/drinks/creators/trending"><Button>Browse creators</Button></Link>
            <Link href="/drinks/discover"><Button variant="outline">Open discover hub</Button></Link>
          </CardContent>
        </Card>
      ) : null}

      {posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <CreatorPostCard key={post.id} post={post} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
