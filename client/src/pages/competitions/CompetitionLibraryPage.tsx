import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Film, Trophy, Search } from "lucide-react";

type Competition = {
  id: string;
  title: string | null;
  themeName: string | null;
  status: "upcoming" | "live" | "judging" | "completed" | "canceled";
  creatorId: string;
  startTime: string | null;
  endTime: string | null;
  judgingClosesAt: string | null;
  videoRecordingUrl: string | null;
  winnerParticipantId: string | null;
  isOfficial: boolean | null;
};

type LibraryRes = { items: Competition[]; limit: number; offset: number };

const THEMES = [
  "Italian Classics",
  "Taco Tuesday",
  "Asian Fusion",
  "Comfort Food",
  "Fitness & Healthy",
  "Desserts & Baking",
  "Quick 30-Min Meals",
  "Budget Cooking ($10)",
  "Leftover Remix",
  "Regional Cuisine Challenge",
];

function useLibraryQuery(params: URLSearchParams) {
  return useQuery({
    queryKey: ["library", params.toString()],
    queryFn: async (): Promise<LibraryRes> => {
      const res = await fetch(`/api/competitions/library?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load library");
      return res.json();
    },
  });
}

export default function CompetitionLibraryPage() {
  // local filters
  const [q, setQ] = React.useState("");
  const [theme, setTheme] = React.useState<string>("");
  const [creator, setCreator] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const params = React.useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (theme) p.set("theme", theme);
    if (creator) p.set("creator", creator);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    return p;
  }, [q, theme, creator, dateFrom, dateTo]);

  const { data, isLoading, isError, refetch } = useLibraryQuery(params);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl">Cookoff Library</h1>
        <Badge variant="secondary" className="ml-2">Replays & Results</Badge>
        <div className="ml-auto">
          <Link href="/competitions/new">
            <Button>Start a Cookoff</Button>
          </Link>
        </div>
      </header>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Search & Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <div className="md:col-span-2">
            <Label>Search</Label>
            <div className="mt-1 flex">
              <Input placeholder="Title keywords…" value={q} onChange={(e) => setQ(e.target.value)} />
              <Button variant="secondary" className="ml-2" onClick={() => refetch()}>
                <Search className="mr-2 h-4 w-4" />
                Go
              </Button>
            </div>
          </div>
          <div>
            <Label>Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any</SelectItem>
                {THEMES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Creator ID</Label>
            <Input className="mt-1" placeholder="user-…" value={creator} onChange={(e) => setCreator(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2 md:col-span-5">
            <div>
              <Label>From</Label>
              <Input type="date" className="mt-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" className="mt-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : isError ? (
        <div className="text-red-600">Failed to load library.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(data?.items ?? []).map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base line-clamp-1">
                  {c.title || "Cookoff"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{c.themeName || "Freestyle"}</Badge>
                  <Badge className="capitalize">{c.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.startTime && <>Started: {format(new Date(c.startTime), "PPpp")}<br/></>}
                  {c.endTime && <>Ended: {format(new Date(c.endTime), "PPpp")}</>}
                </div>
                <Separator />
                <div className="flex items-center gap-2">
                  <Link href={`/competitions/${c.id}`}>
                    <Button variant="outline" size="sm">Open</Button>
                  </Link>
                  {c.videoRecordingUrl ? (
                    <a
                      href={c.videoRecordingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm underline"
                    >
                      <Film className="h-4 w-4" />
                      Replay
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">Replay not available</span>
                  )}
                  {c.winnerParticipantId && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs"><Trophy className="h-4 w-4" /> Winner decided</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
