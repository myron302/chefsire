// client/src/pages/competitions/CreateCompetitionPage.tsx
import * as React from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  Calendar,
  Timer,
  Shield,
  ListChecks,
  ArrowLeft,
  CheckCircle2,
  Wand2,
  Palette,
  Copy,
  Share2,
} from "lucide-react";

/** Replace this once real auth is wired */
const DEV_USER_ID = "user-dev-1";

/** Fetch helper with x-user-id header while auth is WIP */
async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (!headers.has("x-user-id")) headers.set("x-user-id", DEV_USER_ID);
  const resp = await fetch(path, { ...init, headers });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed: ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

const THEME_OPTIONS = [
  "Italian Cuisine",
  "Taco Tuesday",
  "Asian Fusion",
  "Comfort Food",
  "Healthy / Fitness",
  "Desserts & Baking",
  "Quick 30-Min Meals",
  "Budget Cooking ($10 challenge)",
  "Leftover Remix",
  "Regional Specialties",
];

export default function CreateCompetitionPage() {
  const [, navigate] = useLocation();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successId, setSuccessId] = React.useState<string | null>(null);

  // form state
  const [title, setTitle] = React.useState("");
  const [themeName, setThemeName] = React.useState(THEME_OPTIONS[0]);
  const [customTheme, setCustomTheme] = React.useState("");
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [timeLimitMinutes, setTimeLimitMinutes] = React.useState(60);
  const [minOfficialVoters, setMinOfficialVoters] = React.useState(3);
  const [recipeId, setRecipeId] = React.useState("");

  const finalTheme = (customTheme || themeName || "").trim();
  const progress =
    (finalTheme ? 25 : 0) +
    (timeLimitMinutes >= 15 && timeLimitMinutes <= 120 ? 25 : 0) +
    (minOfficialVoters >= 1 ? 25 : 0) +
    25; // title/recipe optional but give a baseline

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!finalTheme) {
      setError("Please choose a theme or enter a custom theme.");
      return;
    }
    if (timeLimitMinutes < 15 || timeLimitMinutes > 120) {
      setError("Time limit must be between 15 and 120 minutes.");
      return;
    }
    if (minOfficialVoters < 1 || minOfficialVoters > 100) {
      setError("Minimum official voters must be between 1 and 100.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: title.trim() || null,
        themeName: finalTheme,
        recipeId: recipeId.trim() || null,
        isPrivate,
        timeLimitMinutes,
        minOfficialVoters,
      };
      const data = await api("/api/competitions", { method: "POST", body: JSON.stringify(payload) });
      const id = data?.id;
      if (!id) throw new Error("Missing id in response.");
      setSuccessId(id);
      setTimeout(() => navigate(`/competitions/${encodeURIComponent(id)}`), 30);
    } catch (e: any) {
      setError(e?.message || "Failed to create competition.");
    } finally {
      setSubmitting(false);
    }
  }

  function copyPreviewLink() {
    const demo = `${window.location.origin}/competitions/preview`;
    navigator.clipboard.writeText(demo).then(
      () => alert("Copied a mock preview link (useful for demos)."),
      () => alert("Copy failed.")
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-purple-50">
      {/* HERO */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-rose-700 via-fuchsia-700 to-purple-700" />
        <div className="absolute -top-24 -left-24 w-[28rem] h-[28rem] bg-fuchsia-500/20 blur-3xl rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-[28rem] h-[28rem] bg-rose-500/20 blur-3xl rounded-full" />

        <div className="max-w-5xl mx-auto px-4 py-10 text-white">
          <Link href="/explore">
            <Button variant="ghost" className="text-white mb-3 hover:bg-white/20">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/15 rounded-2xl backdrop-blur">
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold">Create a Cookoff</h1>
              <p className="text-rose-100">Pick a theme, set a timer, and fire up the live room.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <Card className="bg-white/10 border-white/20 text-white backdrop-blur">
              <CardContent className="p-4">
                <div className="text-xs text-rose-100">Setup Progress</div>
                <div className="text-2xl font-bold mt-1">{Math.min(100, progress)}%</div>
                <Progress value={Math.min(100, progress)} className="mt-3" />
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/20 text-white backdrop-blur">
              <CardContent className="p-4">
                <div className="text-xs text-rose-100">Theme</div>
                <div className="text-sm mt-1 line-clamp-1">{finalTheme || "—"}</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/20 text-white backdrop-blur">
              <CardContent className="p-4">
                <div className="text-xs text-rose-100">Time Limit</div>
                <div className="text-sm mt-1">{timeLimitMinutes} min</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/20 text-white backdrop-blur">
              <CardContent className="p-4">
                <div className="text-xs text-rose-100">Minimum Voters</div>
                <div className="text-sm mt-1">{minOfficialVoters}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* FORM + PREVIEW */}
      <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 overflow-hidden hover:shadow-xl transition-transform hover:-translate-y-[2px]">
          <div className="bg-gradient-to-r from-rose-50 to-amber-50 border-b p-3 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-rose-700" />
            <span className="text-sm font-medium">Setup</span>
          </div>
          <CardContent className="p-4">
            {error && (
              <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>
            )}
            {successId && (
              <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-green-800">
                Created! Redirecting…
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid gap-4">
              {/* Title */}
              <div className="grid gap-1">
                <label className="text-sm">Title (optional)</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., ChefSire Saturday Showdown"
                />
              </div>

              {/* Theme */}
              <div className="grid md:grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="text-sm flex items-center gap-2">
                    <Palette className="w-4 h-4 text-rose-700" />
                    Theme
                  </label>
                  <select
                    value={themeName}
                    onChange={(e) => setThemeName(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    {THEME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">Pick a preset or enter a custom theme.</p>
                </div>
                <div className="grid gap-1">
                  <label className="text-sm">Or Custom Theme</label>
                  <input
                    value={customTheme}
                    onChange={(e) => setCustomTheme(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Your custom theme"
                  />
                </div>
              </div>

              {/* Privacy + Recipe */}
              <div className="grid md:grid-cols-2 gap-3">
                <label className="inline-flex items-center gap-2 border rounded px-3 py-2 bg-white">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm flex items-center gap-1">
                    <Shield className="w-4 h-4 text-rose-700" /> Private (invite-only)
                  </span>
                </label>
                <div className="grid gap-1">
                  <label className="text-sm">Specific Recipe ID (optional)</label>
                  <input
                    value={recipeId}
                    onChange={(e) => setRecipeId(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Leave blank for open interpretation"
                  />
                </div>
              </div>

              {/* Time + Min Voters */}
              <div className="grid md:grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="text-sm flex items-center gap-2">
                    <Timer className="w-4 h-4 text-rose-700" />
                    Time Limit (minutes)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={120}
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                    className="w-full border rounded px-3 py-2"
                  />
                  <p className="text-xs text-gray-500">Between 15 and 120 minutes.</p>
                </div>
                <div className="grid gap-1">
                  <label className="text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-rose-700" />
                    Minimum Official Voters
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={minOfficialVoters}
                    onChange={(e) => setMinOfficialVoters(Number(e.target.value))}
                    className="w-full border rounded px-3 py-2"
                  />
                  <p className="text-xs text-gray-500">
                    Minimum distinct viewers required for an “official” result.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {submitting ? "Creating…" : "Create Competition"}
                </Button>
                <Button type="button" variant="outline" onClick={copyPreviewLink}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Copy Demo Link
                </Button>
                <Badge variant="outline" className="text-xs">
                  <Wand2 className="w-3 h-3 mr-1" /> Auto-add you as Host
                </Badge>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Preview / Summary */}
        <Card className="overflow-hidden hover:shadow-xl transition-transform hover:-translate-y-[2px]">
          <div className="bg-gradient-to-r from-purple-50 to-rose-50 border-b p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-700" />
            <span className="text-sm font-medium">Preview</span>
          </div>
          <CardContent className="p-4 space-y-4">
            <div>
              <div className="text-xs text-gray-600 mb-1">Title</div>
              <div className="font-medium">{title || "ChefSire Cookoff"}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-600 mb-1">Theme</div>
                <Badge>{(customTheme || themeName) || "—"}</Badge>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Privacy</div>
                <Badge variant={isPrivate ? "default" : "secondary"}>
                  {isPrivate ? "Private" : "Public"}
                </Badge>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Time Limit</div>
                <div className="font-medium">{timeLimitMinutes} minutes</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Minimum Voters</div>
                <div className="font-medium">{minOfficialVoters}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-gray-600 mb-1">Recipe ID</div>
                <div className="font-mono text-xs">{recipeId || "—"}</div>
              </div>
            </div>

            <div className="pt-2">
              <Link href="/competitions/new">
                <Button variant="outline" className="w-full">Reset Form</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FOOTER CTA */}
      <div className="bg-gradient-to-r from-purple-600 to-rose-600 text-white mt-8">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Need a theme idea?</div>
            <p className="text-purple-200 text-sm">
              Try “Budget Cooking ($10)”, “Leftover Remix”, or “30-Minute Meals”.
            </p>
          </div>
          <Link href="/explore">
            <Button variant="secondary" className="bg-white text-purple-700 hover:bg-white/90">
              Explore Inspiration
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
