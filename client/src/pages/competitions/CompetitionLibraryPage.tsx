// client/src/pages/competitions/CompetitionLibraryPage.tsx
import * as React from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // if you don't have this, replace with a native input
import {
  Search,
  Sparkles,
  Filter,
  Timer,
  Users,
  Trophy,
  Flame,
  Calendar,
  Video,
  Eye,
  Plus,
  Layers,
  Home,
} from "lucide-react";

type Competition = {
  id: string;
  title: string | null;
  themeName: string | null;
  status: "upcoming" | "live" | "judging" | "completed" | "canceled";
  isPrivate: boolean;
  timeLimitMinutes: number;
  createdAt?: string;
  startTime?: string | null;
  endTime?: string | null;
  judgingClosesAt?: string | null;
};

type LibraryResponse = {
  items: Competition[];
  limit: number;
  offset: number;
};

const DEV_USER_ID = "user-dev-1";

async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!headers.has("x-user-id")) headers.set("x-user-id", DEV_USER_ID);
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed: ${res.status}`);
  }
  return data;
}

const STATUS_OPTIONS = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "judging", label: "Judging" },
  { id: "completed", label: "Completed" },
];

const THEME_PRESETS = [
  "Italian Night",
  "Taco Tuesday",
  "Asian Fusion",
  "Comfort Food",
  "Healthy / Fitness",
  "Desserts & Baking",
  "Quick 30-Min",
  "Budget ($10)",
  "Leftover Remix",
  "Regional Specialties",
];

export default function CompetitionLibraryPage() {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<string>("all");
  const [theme, setTheme] = React.useState<string>("");

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<Competition[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (theme.trim()) params.set("theme", theme.trim());
      // status filtering is done client-side here (optional: you can add a server param)
      const data: LibraryResponse = await api(`/api/competitions/library?${params.toString()}`);
      let comps = data.items || [];
      if (status !== "all") {
        comps = comps.filter((c) => c.status === status);
      }
      setItems(comps);
    } catch (e: any) {
      setError(e?.message || "Failed to load competitions");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters(e?: React.FormEvent) {
    e?.preventDefault();
    load();
  }

  const statusBadge = (s: Competition["status"]) => {
    const map: Record<string, string> = {
      live: "bg-green-600",
      judging: "bg-amber-500",
      completed: "bg-blue-600",
      upcoming: "bg-neutral-600",
      canceled: "bg-red-600",
    };
    return <Badge className={`${map[s] || "bg-neutral-600"} text-white`}>{s}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-fuchsia-50 to-purple-50">
      {/* HERO — high-contrast overlay */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-fuchsia-700 via-purple-800 to-rose-700" />
        <div className="absolute -top-24 -right-24 w-[26rem] h-[26rem] bg-pink-400/25 blur-3xl rounded-full" />
        <div className="absolute -bottom-24 -left-24 w-[34rem] h-[34rem] bg-purple-400/25 blur-3xl rounded-full" />
        <div className="absolute inset-0 bg-black/55" />

        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between">
              <Link href="/">
                <Button variant="ghost" className="text-white hover:bg-white/15">
                  <Home className="mr-2 h-4 w-4" />
                  Home
                </Button>
              </Link>
              <Link href="/competitions/new">
                <Button variant="secondary" className="bg-white text-fuchsia-800 hover:bg-white/90">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Competition
                </Button>
              </Link>
            </div>

            <div className="mt-6 flex items-start gap-3">
              <div className="p-3 bg-white/15 rounded-2xl backdrop-blur">
                <Layers className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                  Cookoff Library & Replays
                </h1>
                <p className="text-fuchsia-100 text-lg">
                  Search live, upcoming, and past competitions. Watch replays and join rooms.
                </p>
              </div>
            </div>

            {/* Stats Row */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-white/10 border-white/20 text-white backdrop-blur hover:bg-white/15 transition">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-fuchsia-100">
                    <Sparkles className="w-4 h-4" />
                    Themes
                  </div>
                  <div className="text-2xl font-bold mt-2">{THEME_PRESETS.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 border-white/20 text-white backdrop-blur hover:bg-white/15 transition">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-fuchsia-100">
                    <Timer className="w-4 h-4" />
                    Time Limits
                  </div>
                  <div className="text-2xl font-bold mt-2">15–120m</div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 border-white/20 text-white backdrop-blur hover:bg-white/15 transition">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-fuchsia-100">
                    <Users className="w-4 h-4" />
                    Community
                  </div>
                  <div className="text-2xl font-bold mt-2">Open</div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 border-white/20 text-white backdrop-blur hover:bg-white/15 transition">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-fuchsia-100">
                    <Video className="w-4 h-4" />
                    Replays
                  </div>
                  <div className="text-2xl font-bold mt-2">Yes</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800 mb-4">{error}</div>
        )}

        <form onSubmit={applyFilters} className="grid lg:grid-cols-4 gap-4 items-start">
          <Card className="lg:col-span-2">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-gray-500" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by title…"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Filter className="w-4 h-4 text-gray-600" />
                Status
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatus(s.id)}
                    className={`text-xs rounded px-2 py-1 border ${
                      status === s.id ? "bg-rose-600 text-white border-rose-600" : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Sparkles className="w-4 h-4 text-gray-600" />
                Theme
              </div>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">All themes</option>
                {THEME_PRESETS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          <div className="lg:col-span-4 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Tip: Use status tabs and theme to refine. Click a card to join or view details.
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => { setQ(""); setStatus("all"); setTheme(""); }}>
                Reset
              </Button>
              <Button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white">
                Apply
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        {/* Tabs-like header (client filter) */}
        <div className="flex flex-wrap gap-2 mb-4">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setStatus(s.id); applyFilters(); }}
              className={`text-sm rounded-full px-3 py-1 border ${
                status === s.id ? "bg-purple-600 text-white border-purple-600" : "bg-white hover:bg-gray-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-48 animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-gray-600">
              No competitions found. Try widening your filters or{" "}
              <Link href="/competitions/new">
                <span className="text-rose-600 underline cursor-pointer">create one</span>
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((c) => (
              <Link key={c.id} href={`/competitions/${encodeURIComponent(c.id)}`}>
                <Card className="group cursor-pointer hover:shadow-xl transition-all hover:-translate-y-[2px] overflow-hidden">
                  {/* Banner */}
                  <div className="relative h-24 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-purple-600">
                    <div className="absolute inset-0 bg-black/15" />
                    <div className="absolute top-2 left-2 flex items-center gap-2">
                      {statusBadge(c.status)}
                      {c.isPrivate && <Badge variant="outline" className="border-white/60 text-white/90">Private</Badge>}
                    </div>
                    <div className="absolute bottom-2 left-2 flex items-center gap-2 text-white">
                      <Flame className="w-4 h-4" />
                      <span className="text-xs">{c.timeLimitMinutes} min</span>
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold line-clamp-1">{c.title || "ChefSire Cookoff"}</h3>
                      <Eye className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </div>
                    <div className="mt-1 text-sm text-gray-600 line-clamp-1">
                      Theme: {c.themeName || "—"}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <Timer className="w-3 h-3" />
                        {c.startTime ? "Started" : c.status === "upcoming" ? "Not started" : "—"}
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <Trophy className="w-3 h-3" />
                        {c.status === "completed" ? "Results" : "—"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-10 bg-gradient-to-r from-purple-600 to-rose-600 text-white rounded-xl">
          <div className="px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Ready to host a showdown?
              </div>
              <p className="text-purple-200 text-sm">
                Create a room, invite friends or the community, and go live.
              </p>
            </div>
            <Link href="/competitions/new">
              <Button variant="secondary" className="bg-white text-purple-700 hover:bg-white/90">
                <Plus className="mr-2 h-4 w-4" />
                Create Competition
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
