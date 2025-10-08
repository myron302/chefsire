import * as React from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChefHat,
  Sparkles,
  ShieldCheck,
  Timer,
  Users,
  ArrowLeft,
  ArrowRight,
  ListChecks,
  Video,
} from "lucide-react";

type ThemeOption = { id: string; name: string; blurb: string };

const THEMES: ThemeOption[] = [
  { id: "italian", name: "Italian Night", blurb: "Pasta, risotto, and rustic sauces." },
  { id: "taco", name: "Taco Tuesday", blurb: "Tacos, salsas, and fiesta sides." },
  { id: "asian-fusion", name: "Asian Fusion", blurb: "Bold flavors across Asia." },
  { id: "comfort", name: "Comfort Food", blurb: "Nostalgic classics that hug the soul." },
  { id: "healthy", name: "Healthy / Fitness", blurb: "Lean, clean, and flavorful." },
  { id: "desserts", name: "Desserts & Baking", blurb: "Sweet showstoppers and bakes." },
  { id: "quick", name: "Quick 30-Min", blurb: "Speed runs from pantry to plate." },
  { id: "budget", name: "Budget ($10)", blurb: "Delicious on a dime." },
  { id: "leftover", name: "Leftover Remix", blurb: "Transform yesterday into wow." },
  { id: "regional", name: "Regional Specialties", blurb: "Spotlight on local legends." },
];

const DURATIONS = [30, 45, 60, 90, 120];

const DEV_USER_ID = "user-dev-1";

async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!headers.has("x-user-id")) headers.set("x-user-id", DEV_USER_ID);
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `Request failed: ${res.status}`);
  return data;
}

export default function CreateCompetitionPage() {
  const [, navigate] = useLocation();

  const [title, setTitle] = React.useState("");
  const [theme, setTheme] = React.useState<ThemeOption | null>(THEMES[0]);
  const [recipeId, setRecipeId] = React.useState("");
  const [duration, setDuration] = React.useState<number>(60);
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [minVoters, setMinVoters] = React.useState<number>(3);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        title: title || null,
        themeName: theme?.name ?? null,
        recipeId: recipeId || null,
        isPrivate,
        timeLimitMinutes: duration,
        minOfficialVoters: minVoters,
      };
      const result = await api("/api/competitions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      navigate(`/competitions/${encodeURIComponent(result.id)}`);
    } catch (e: any) {
      setError(e?.message || "Failed to create competition.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-fuchsia-50 to-purple-50">
      {/* HERO with stronger overlay */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-700 via-fuchsia-700 to-purple-800" />
        {/* Decorative glows */}
        <div className="absolute -top-24 -right-24 w-[26rem] h-[26rem] bg-pink-400/25 blur-3xl rounded-full" />
        <div className="absolute -bottom-24 -left-24 w-[34rem] h-[34rem] bg-purple-400/25 blur-3xl rounded-full" />
        {/* Dark overlay for contrast */}
        <div className="absolute inset-0 bg-black/55" />

        <div className="max-w-7xl mx-auto px-4 py-10 relative">
          <div className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between">
              <Link href="/">
                <Button variant="ghost" className="text-white hover:bg-white/15">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
              <Badge className="bg-white/20 border-white/20 text-white">Cookoff Creator</Badge>
            </div>

            <div className="mt-6 flex items-start gap-3">
              <div className="p-3 bg-white/15 rounded-2xl backdrop-blur">
                <ChefHat className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                  Create a Cookoff
                </h1>
                <p className="text-fuchsia-100 text-lg">
                  Pick a theme, set a timer, and fire up the live room.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-white/10 border-white/20 text-white backdrop-blur hover:bg-white/15 transition">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-fuchsia-100">
                    <Sparkles className="w-4 h-4" />
                    Themes
                  </div>
                  <div className="text-2xl font-bold mt-2">{THEMES.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 border-white/20 text-white backdrop-blur hover:bg-white/15 transition">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-fuchsia-100">
                    <Timer className="w-4 h-4" />
                    Time Limit
                  </div>
                  <div className="text-2xl font-bold mt-2">15–120m</div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 border-white/20 text-white backdrop-blur hover:bg-white/15 transition">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-fuchsia-100">
                    <Users className="w-4 h-4" />
                    Viewers Judge
                  </div>
                  <div className="text-2xl font-bold mt-2">24h</div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 border-white/20 text-white backdrop-blur hover:bg-white/15 transition">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-fuchsia-100">
                    <Video className="w-4 h-4" />
                    Live Room
                  </div>
                  <div className="text-2xl font-bold mt-2">Instant</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* FORM */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800 mb-4">{error}</div>
        )}

        <form onSubmit={handleCreate} className="grid lg:grid-cols-3 gap-6">
          {/* Column 1: Basics */}
          <Card className="lg:col-span-2 overflow-hidden hover:shadow-xl transition">
            <div className="bg-gradient-to-r from-rose-50 to-fuchsia-50 border-b p-3 flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-rose-700" />
              <span className="text-sm font-medium">Competition Details</span>
            </div>
            <CardContent className="p-4 grid gap-4">
              <div>
                <label className="block text-sm mb-1">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., Pasta Showdown"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Theme</label>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={`text-left rounded border p-3 hover:shadow-sm transition ${
                        theme?.id === t.id
                          ? "border-rose-500 bg-rose-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-gray-600">{t.blurb}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm mb-1">Time Limit</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full border rounded px-3 py-2"
                  >
                    {DURATIONS.map((m) => (
                      <option key={m} value={m}>
                        {m} minutes
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Min “Official” Voters</label>
                  <input
                    type="number"
                    min={1}
                    value={minVoters}
                    onChange={(e) => setMinVoters(Math.max(1, Number(e.target.value)))}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Recipe ID (optional)</label>
                  <input
                    value={recipeId}
                    onChange={(e) => setRecipeId(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Attach an existing recipe"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Column 2: Privacy & Actions */}
          <Card className="overflow-hidden hover:shadow-xl transition">
            <div className="bg-gradient-to-r from-purple-50 to-rose-50 border-b p-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-700" />
              <span className="text-sm font-medium">Privacy & Actions</span>
            </div>
            <CardContent className="p-4 grid gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                />
                Private (invite-only)
              </label>

              <div className="grid gap-2">
                <Button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  disabled={submitting}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {submitting ? "Creating…" : "Create Competition"}
                </Button>
                <Link href="/">
                  <Button variant="secondary" className="bg-white text-rose-700 hover:bg-white/90">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Home
                  </Button>
                </Link>
                <Link href="/explore">
                  <Button variant="outline">
                    Explore ChefSire
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>

              <div className="text-xs text-gray-600">
                After you create the room, you can start the timer, join live video, and share the invite link for spectators to vote.
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
