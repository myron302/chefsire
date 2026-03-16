import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Challenge = {
  id: string;
  slug: string;
  title: string;
  description: string;
  theme: string | null;
  originalDrinkSlug: string | null;
  challengeType: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

type Submission = {
  id: string;
  userId: string;
  drinkSlug: string;
  createdAt: string;
  creatorUsername: string | null;
  drink: { name: string; route: string } | null;
};

export default function DrinkChallengeDetailPage() {
  const [, params] = useRoute("/drinks/challenges/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug ?? "";
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [canonicalDrink, setCanonicalDrink] = useState<{ name: string; route: string } | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    fetch(`/api/drinks/challenges/${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Unable to fetch challenge"))))
      .then((payload) => {
        setChallenge(payload?.challenge ?? null);
        setCanonicalDrink(payload?.canonicalDrink ?? null);
      });

    fetch(`/api/drinks/challenges/${encodeURIComponent(slug)}/submissions`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Unable to fetch submissions"))))
      .then((payload) => setSubmissions(Array.isArray(payload?.submissions) ? payload.submissions : []));
  }, [slug]);

  const remixRoute = useMemo(() => {
    if (!challenge?.isActive) return null;
    if (challenge.originalDrinkSlug) {
      return `/drinks/submit?remix=${encodeURIComponent(challenge.originalDrinkSlug)}&challenge=${encodeURIComponent(challenge.slug)}`;
    }

    return `/drinks/submit?challenge=${encodeURIComponent(challenge.slug)}`;
  }, [challenge]);

  async function handleJoinChallenge() {
    if (!challenge || !remixRoute || isJoining) return;

    setIsJoining(true);
    setJoinError(null);

    try {
      const response = await fetch(`/api/drinks/challenges/${encodeURIComponent(challenge.slug)}/join`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage = typeof payload?.error === "string" ? payload.error : "Unable to join challenge.";
        throw new Error(errorMessage);
      }

      setLocation(typeof payload?.submitRoute === "string" ? payload.submitRoute : remixRoute);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Unable to join challenge.");
    } finally {
      setIsJoining(false);
    }
  }

  if (!challenge) {
    return (
      <div className="container mx-auto px-4 py-8">
        <DrinksPlatformNav current="challenges" />
        <p className="text-sm text-muted-foreground mt-6">Loading challenge...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <DrinksPlatformNav current="challenges" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{challenge.title}</CardTitle>
            <Badge variant={challenge.isActive ? "default" : "secondary"}>{challenge.isActive ? "Active" : "Ended"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{challenge.description}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(challenge.startsAt).toLocaleString()} - {new Date(challenge.endsAt).toLocaleString()}
          </p>
          {canonicalDrink ? (
            <p className="text-sm">
              Original drink: <Link href={canonicalDrink.route} className="underline">{canonicalDrink.name}</Link>
            </p>
          ) : null}
          {remixRoute ? (
            <Button onClick={handleJoinChallenge} disabled={isJoining}>{isJoining ? "Joining..." : "Join / Remix"}</Button>
          ) : null}
          {joinError ? <p className="text-sm text-destructive">{joinError}</p> : null}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Recent submissions</h2>
        {submissions.length === 0 ? <p className="text-sm text-muted-foreground">No submissions yet.</p> : null}
        <div className="grid gap-3">
          {submissions.map((submission) => (
            <Card key={submission.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{submission.drink?.name ?? submission.drinkSlug}</p>
                  <p className="text-xs text-muted-foreground">
                    {submission.creatorUsername ? `by @${submission.creatorUsername}` : "community creator"} · {new Date(submission.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Link href={submission.drink?.route ?? `/drinks/recipe/${encodeURIComponent(submission.drinkSlug)}`}>
                  <Button variant="outline" size="sm">View</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
