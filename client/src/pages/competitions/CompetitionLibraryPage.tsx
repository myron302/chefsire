// client/src/pages/competitions/CompetitionLibraryPage.tsx
import * as React from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Filter, Search, Trophy, ArrowLeft, Play, Clock, Users } from "lucide-react";

/** Simple fetch helper (dev header until auth is wired) */
const DEV_USER_ID = "user-dev-1";
async function api(path: string) {
  const resp = await fetch(path, { headers: { "x-user-id": DEV_USER_ID } as any });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((data && (data.error || data.message)) || "Request failed");
  return data;
}

type Competition = {
  id: string;
  creatorId: string;
  title: string | null;
  themeName: string | null;
  status: "upcoming" | "live" | "judging" | "completed" | "canceled";
  isPrivate: boolean;
  createdAt?: string;
  videoRecordingUrl?: string | null;
  isOfficial?: boolean;
  winnerParticipantId?: string | null;
};

export default function CompetitionLibraryPage() {
  const [items, setItems] = React.useState<Competition[]>([]);
  const [q, setQ] = React.useState("");
  const [theme, setTheme] = React.useState("");
  const [creator, setCreator] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (theme) params.set("theme", theme);
      if (creator) params.set("creator", creator);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const data = await api(`/api/competitions/library?${params.toString()}`);
      setItems(data.items || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load library.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50">
      {/* HERO */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-700" />
        <div className="max-w-7xl mx-auto px-4 py-10 text-white">
          <Link href="/explore">
            <Button variant="ghost" className="text-white mb-3 hover:bg-white/20">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl md:text-4xl font-extrabold">Competition Library</h1>
          <p className="text-indigo-100">Replays, winners, and all the glory — searchable and filterable.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 -mt-6">
        <Card className="overflow-hidden hover:shadow-md">
          <div className="bg-gradient-to-r from-indigo-50 to-fuchsia-50 border-b p-3 flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-700" />
            <span className="text-sm font-medium">Search & Filter</span>
          </div>
          <CardContent className="p-4">
            <div className="grid md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-gray-600">Search</label>
                <div className="flex items-center gap-2">
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, theme…" />
                  <Button onClick={load} className="gap-2">
                    <Search className="w-4 h-4" /> Go
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600">Theme</label>
                <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g., Taco Tuesday" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Creator (User ID)</label>
                <Input value={creator} onChange={(e) => setCreator(e.target.value)} placeholder="…uuid…" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">From</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">To</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="pt-3">
              <Button variant="outline" onClick={() => { setQ(""); setTheme(""); setCreator(""); setDateFrom(""); setDateTo(""); }}>
                Reset
              </Button>
            </div>
            {error && <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded border p-3 animate-pulse bg-gray-50 h-64" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-gray-600">No competitions found.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((c) => (
              <Card key={c.id} className="overflow-hidden hover:shadow-lg transition-transform hover:-translate-y-[2px]">
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="font-semibold text-sm line-clamp-1">
                    {c.title || "ChefSire Cookoff"}
                  </div>
                  <Badge className={
                    c.status === "completed" ? "bg-blue-600 text-white"
                    : c.status === "judging" ? "bg-amber-500 text-white"
                    : c.status === "live" ? "bg-green-600 text-white"
                    : "bg-gray-600 text-white"
                  }>
                    {c.status}
                  </Badge>
                </div>
                <CardContent className="p-4">
                  <div className="text-xs text-gray-600 mb-1">Theme</div>
                  <div className="font-medium mb-3">{c.themeName || "—"}</div>

                  <div className="grid grid-cols-2 gap-3 text-xs text-gray-700">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-gray-500" />
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-gray-500" />
                      {c.isPrivate ? "Private" : "Public"}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.isOfficial && (
                      <Badge variant="outline" className="text-xs">
                        <Trophy className="w-3 h-3 mr-1" />
                        Official
                      </Badge>
                    )}
                    {c.winnerParticipantId && (
                      <Badge variant="outline" className="text-xs font-mono">
                        Winner: {c.winnerParticipantId.slice(0, 8)}…
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Link href={`/competitions/${c.id}`}>
                      <Button className="gap-2">
                        <Play className="w-4 h-4" />
                        View
                      </Button>
                    </Link>
                    {c.videoRecordingUrl && (
                      <a href={c.videoRecordingUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline">Replay</Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
