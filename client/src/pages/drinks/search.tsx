import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, GlassWater, GitBranchPlus, Users, Trophy } from "lucide-react";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type CommunitySearchResults = {
  drinks: Array<{ slug: string; name: string; image: string | null; route: string; sourceCategoryRoute?: string | null }>;
  remixes: Array<{ slug: string; name: string; image: string | null; route: string; remixedFromSlug: string | null; creatorUsername: string | null }>;
  creators: Array<{ userId: string; username: string; avatar: string | null; route: string; followerCount: number }>;
  challenges: Array<{ slug: string; title: string; description: string; route: string; isActive: boolean }>;
};

const EMPTY_RESULTS: CommunitySearchResults = { drinks: [], remixes: [], creators: [], challenges: [] };

export default function DrinksCommunitySearchPage() {
  const [location, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<CommunitySearchResults>(EMPTY_RESULTS);

  const qsQuery = useMemo(() => {
    const params = new URLSearchParams(location.split("?")[1] ?? "");
    return (params.get("q") ?? "").trim();
  }, [location]);

  useEffect(() => {
    setQuery(qsQuery);
    setSubmittedQuery(qsQuery);
  }, [qsQuery]);

  useEffect(() => {
    if (!submittedQuery) {
      setResults(EMPTY_RESULTS);
      return;
    }

    let active = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/drinks/community-search?q=${encodeURIComponent(submittedQuery)}`);
        const data = await response.json();
        if (!response.ok || !data?.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "Search failed");
        }
        if (!active) return;
        setResults({
          drinks: Array.isArray(data?.results?.drinks) ? data.results.drinks : [],
          remixes: Array.isArray(data?.results?.remixes) ? data.results.remixes : [],
          creators: Array.isArray(data?.results?.creators) ? data.results.creators : [],
          challenges: Array.isArray(data?.results?.challenges) ? data.results.challenges : [],
        });
      } catch (err) {
        if (!active) return;
        setResults(EMPTY_RESULTS);
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [submittedQuery]);

  const hasAny = results.drinks.length || results.remixes.length || results.creators.length || results.challenges.length;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextQuery = query.trim();
    setLocation(nextQuery ? `/drinks/search?q=${encodeURIComponent(nextQuery)}` : "/drinks/search");
    setSubmittedQuery(nextQuery);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Drinks Community Search</h1>
          <p className="mt-2 text-sm text-muted-foreground">Search drinks, remixes, creators, and challenges from one place.</p>
        </div>

        <div className="mb-6">
          <DrinksPlatformNav current="search" />
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <form className="flex gap-2" onSubmit={onSubmit}>
              <Input placeholder="Search drinks, remixes, creators, challenges..." value={query} onChange={(e) => setQuery(e.target.value)} />
              <Button type="submit"><Search className="mr-2 h-4 w-4" /> Search</Button>
            </form>
          </CardContent>
        </Card>

        {loading ? <p className="text-sm text-muted-foreground">Searching community surfaces...</p> : null}
        {!loading && error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!loading && !error && submittedQuery && !hasAny ? (
          <Card>
            <CardHeader>
              <CardTitle>No results for “{submittedQuery}”</CardTitle>
              <CardDescription>Try a broader term or explore these discovery surfaces.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link href="/drinks/discover"><Button variant="outline">Discover Hub</Button></Link>
              <Link href="/drinks"><Button variant="outline">Trending</Button></Link>
              <Link href="/drinks/remixes"><Button variant="outline">Recent Remixes</Button></Link>
              <Link href="/drinks/challenges"><Button variant="outline">Challenges</Button></Link>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4">
          {results.drinks.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><GlassWater className="h-4 w-4" /> Drinks</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {results.drinks.map((item) => (
                  <Link key={item.slug} href={item.route}>
                    <div className="rounded border p-3 hover:bg-muted/50">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">/{item.slug}</p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {results.remixes.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><GitBranchPlus className="h-4 w-4" /> Remixes</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {results.remixes.map((item) => (
                  <Link key={item.slug} href={item.route}>
                    <div className="rounded border p-3 hover:bg-muted/50">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">from {item.remixedFromSlug ?? "original"} · {item.creatorUsername ? `@${item.creatorUsername}` : "community"}</p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {results.creators.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Creators</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {results.creators.map((item) => (
                  <Link key={item.userId} href={item.route}>
                    <div className="rounded border p-3 hover:bg-muted/50">
                      <p className="font-semibold">@{item.username}</p>
                      <p className="text-xs text-muted-foreground">{item.followerCount} followers</p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {results.challenges.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4" /> Challenges</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {results.challenges.map((item) => (
                  <Link key={item.slug} href={item.route}>
                    <div className="rounded border p-3 hover:bg-muted/50">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="font-semibold">{item.title}</p>
                        <Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? "Active" : "Ended"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
