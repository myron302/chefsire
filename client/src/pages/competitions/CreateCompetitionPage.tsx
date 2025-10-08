// client/src/pages/competitions/CreateCompetitionPage.tsx
import * as React from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Timer, Eye, Lock, Wand2, ArrowLeft, Rocket } from "lucide-react";

/** Replace this once real auth is wired */
const DEV_USER_ID = "user-dev-1";

/** Fetch helper with x-user-id header while auth is WIP */
async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (!headers.has("x-user-id")) headers.set("x-user-id", DEV_USER_ID);
  const resp = await fetch(path, { ...init, headers });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.error || data?.message || `Request failed: ${resp.status}`);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!finalTheme) return setError("Please choose a theme or enter a custom theme.");
    if (timeLimitMinutes < 15 || timeLimitMinutes > 120) return setError("Time limit must be 15–120 minutes.");
    if (minOfficialVoters < 1 || minOfficialVoters > 100) return setError("Official voters must be 1–100.");

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
      setTimeout(() => navigate(`/competitions/${encodeURIComponent(id)}`), 200);
    } catch (e: any) {
      setError(e?.message || "Failed to create competition.");
    } finally {
      setSubmitting(false);
    }
  }

  const pctReady =
    (finalTheme ? 25 : 0) +
    (timeLimitMinutes >= 15 && timeLimitMinutes <= 120 ? 25 : 0) +
    (minOfficialVoters >= 1 ? 25 : 0) +
    25;
    return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-50 via-pink-50 to-amber-50">
      {/* HERO */}
      <div className="bg-gradient-to-r from-fuchsia-700 via-pink-700 to-amber-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="mb-3">
            <Link href="/explore">
              <Button variant="ghost" className="text-white/90 hover:bg-white/10">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Explore
              </Button>
            </Link>
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-extrabold tracking-tight"
          >
            Create a ChefSire Cookoff
          </motion.h1>
          <p className="text-pink-100 mt-2">
            Spin up a live room, go head-to-head, and let the community decide the champion.
          </p>
          <div className="mt-4 max-w-md">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Setup Progress
              </span>
              <span className="font-mono">{pctReady}%</span>
            </div>
            <Progress value={pctReady} className="mt-2 bg-white/20" />
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>}
        {successId && (
          <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-emerald-800">
            Success! Redirecting to your room…
          </div>
        )}

        <Card className="shadow-lg">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Title */}
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Title (optional)</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., Saturday Sizzle Showdown"
                />
              </div>

              {/* Theme */}
              <div>
                <label className="block text-sm mb-1">Theme</label>
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
                <p className="text-xs text-gray-500 mt-1">Pick a preset theme.</p>
              </div>
              <div>
                <label className="block text-sm mb-1">Or Custom Theme</label>
                <input
                  value={customTheme}
                  onChange={(e) => setCustomTheme(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Your custom theme"
                />
                <p className="text-xs text-gray-500 mt-1">Overrides the dropdown if filled.</p>
              </div>

              {/* Privacy + Recipe */}
              <div className="flex items-center gap-2">
                <input
                  id="isPrivate"
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="isPrivate" className="text-sm flex items-center gap-1">
                  <Lock className="w-4 h-4" /> Private (invite-only)
                </label>
              </div>
              <div>
                <label className="block text-sm mb-1">Specific Recipe ID (optional)</label>
                <input
                  value={recipeId}
                  onChange={(e) => setRecipeId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Leave blank for open interpretation"
                />
              </div>

              {/* Time + Min Voters */}
              <div>
                <label className="block text-sm mb-1 flex items-center gap-1">
                  <Timer className="w-4 h-4" /> Time Limit (minutes)
                </label>
                <input
                  type="number"
                  min={15}
                  max={120}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                  className="w-full border rounded px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">Between 15 and 120 minutes.</p>
              </div>
              <div>
                <label className="block text-sm mb-1 flex items-center gap-1">
                  <Eye className="w-4 h-4" /> Minimum Official Voters
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={minOfficialVoters}
                  onChange={(e) => setMinOfficialVoters(Number(e.target.value))}
                  className="w-full border rounded px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">Distinct spectators required for “official”.</p>
              </div>

              {/* CTA */}
              <div className="md:col-span-2 pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full md:w-auto bg-gradient-to-r from-fuchsia-600 to-amber-500 hover:from-fuchsia-700 hover:to-amber-600"
                >
                  <Rocket className="w-4 h-4 mr-2" />
                  {submitting ? "Creating…" : "Create Competition"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="bg-gradient-to-r from-amber-50 to-pink-50 border-amber-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-amber-600" />
              Pro Tips
            </h3>
            <ul className="text-sm text-slate-700 space-y-1">
              <li>• “Start Competition” opens the live window and timer.</li>
              <li>• “End & Open Judging” starts the 24-hour voting period.</li>
              <li>• “Finalize Results” publishes placements and the winner.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
