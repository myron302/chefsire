// client/src/pages/competitions/CreateCompetitionPage.tsx
import * as React from "react";
import { useLocation } from "wouter";

/** Replace this once real auth is wired */
const DEV_USER_ID = "user-dev-1";

/** Fetch helper with x-user-id header while auth is WIP */
async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  // Dev header for now:
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
      const data = await api("/api/competitions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const id = data?.id;
      if (!id) throw new Error("Missing id in response.");
      setSuccessId(id);
      // navigate after a short tick so UI can show success state if desired
      setTimeout(() => {
        navigate(`/competitions/${encodeURIComponent(id)}`);
      }, 10);
    } catch (e: any) {
      setError(e?.message || "Failed to create competition.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold mb-1">Create a Competition</h1>
      <p className="text-sm text-gray-600 mb-6">
        Spin up a live cookoff room. You can run it public or invite-only, set a time limit,
        and open judging for 24 hours after it ends.
      </p>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-800">
          {error}
        </div>
      )}

      {successId && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-green-800">
          Created! Redirecting to room…
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded border p-4 grid gap-4 bg-white">
        {/* Title */}
        <div>
          <label className="block text-sm mb-1">Title (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="e.g., ChefSire Saturday Showdown"
          />
        </div>

        {/* Theme */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <p className="text-xs text-gray-500 mt-1">
              Pick a preset or enter a custom theme.
            </p>
          </div>
          <div>
            <label className="block text-sm mb-1">Or Custom Theme</label>
            <input
              value={customTheme}
              onChange={(e) => setCustomTheme(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Your custom theme"
            />
          </div>
        </div>

        {/* Privacy + Recipe */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <input
              id="isPrivate"
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="isPrivate" className="text-sm">
              Private (invite-only)
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
        </div>

        {/* Time + Min Voters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Time Limit (minutes)</label>
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
            <label className="block text-sm mb-1">Minimum Official Voters</label>
            <input
              type="number"
              min={1}
              max={100}
              value={minOfficialVoters}
              onChange={(e) => setMinOfficialVoters(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum distinct viewers required for an “official” result.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Competition"}
          </button>
        </div>
      </form>

      <div className="mt-6 text-sm text-gray-500">
        After creation, you’ll land in the room. Use “Start Competition” to begin, “End & Open
        Judging” to start the 24-hour voting window, and “Finalize Results” to publish winners.
      </div>
    </div>
  );
}
