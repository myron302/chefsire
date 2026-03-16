import { useEffect, useState } from "react";
import { Link } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ChallengeItem = {
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
  submissionsCount: number;
};

export default function DrinkChallengesPage() {
  const [items, setItems] = useState<ChallengeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/drinks/challenges")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Unable to load challenges"))))
      .then((payload) => setItems(Array.isArray(payload?.items) ? payload.items : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <DrinksPlatformNav current="challenges" />

      <div>
        <h1 className="text-3xl font-bold">Drink Challenges</h1>
        <p className="text-sm text-muted-foreground mt-1">Join social remix prompts and share your best twists.</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading challenges...</p> : null}

      <div className="grid md:grid-cols-2 gap-4">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-xl">{item.title}</CardTitle>
                <Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? "Active" : "Ended"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{item.description}</p>
              <div className="text-xs text-muted-foreground">
                <p>{new Date(item.startsAt).toLocaleDateString()} - {new Date(item.endsAt).toLocaleDateString()}</p>
                <p>{Number(item.submissionsCount ?? 0).toLocaleString()} submissions</p>
              </div>
              <Link href={`/drinks/challenges/${encodeURIComponent(item.slug)}`}>
                <Button size="sm">View challenge</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
