// client/src/pages/competitions/CreateCompetitionPage.tsx
import React, { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Timer, Lock, Globe, ChefHat, Film, FolderSearch2 } from "lucide-react";

/** -----------------------------------------------------------------------
 *  Utilities
 *  ---------------------------------------------------------------------*/
type CreateCompetitionPayload = {
  title?: string | null;
  themeId?: string | null;
  themeName?: string | null;
  recipeId?: string | null;
  isPrivate: boolean;
  timeLimitMinutes: number; // 30–120
  minOfficialVoters?: number; // default 3
};

// Dev convenience: set a dev user id in localStorage to satisfy the server's x-user-id shim
// localStorage.setItem("devUserId", "user-123")
function getAuthHeaders(): HeadersInit {
  const dev = typeof window !== "undefined" ? localStorage.getItem("devUserId") : null;
  return dev ? { "x-user-id": dev } : {};
}

/** Example starter themes (you can replace with an API later) */
const PRESET_THEMES = [
  { slug: "italian-classics", name: "Italian Classics" },
  { slug: "taco-tuesday", name: "Taco Tuesday" },
  { slug: "asian-fusion", name: "Asian Fusion" },
  { slug: "comfort-food", name: "Comfort Food" },
  { slug: "fitness-healthy", name: "Fitness & Healthy" },
  { slug: "desserts-baking", name: "Desserts & Baking" },
  { slug: "quick-30", name: "Quick 30-Min Meals" },
  { slug: "budget-10", name: "Budget Cooking ($10)" },
  { slug: "leftover-remix", name: "Leftover Remix" },
  { slug: "regional", name: "Regional Cuisine Challenge" },
];

/** Time options in minutes */
const TIME_OPTIONS = [30, 45, 60, 75, 90, 105, 120];

export default function CreateCompetitionPage() {
  const [, navigate] = useLocation();

  // Form state
  const [title, setTitle] = useState<string>("");
  const [themeName, setThemeName] = useState<string>("");
  const [customTheme, setCustomTheme] = useState<string>("");
  const [recipeId, setRecipeId] = useState<string>("");
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(60);
  const [minOfficialVoters, setMinOfficialVoters] = useState<number>(3);
  const [notes, setNotes] = useState<string>("");

  const chosenTheme = useMemo(() => {
    if (themeName === "__custom__") return customTheme.trim();
    if (!themeName) return "";
    const found = PRESET_THEMES.find((t) => t.slug === themeName);
    return found ? found.name : "";
  }, [themeName, customTheme]);

  const canSubmit =
    timeLimitMinutes >= 30 &&
    timeLimitMinutes <= 120 &&
    (chosenTheme.length > 0 || title.trim().length > 0);

  const createMutation = useMutation({
    mutationFn: async (payload: CreateCompetitionPayload) => {
      const res = await fetch("/api/competitions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to create competition (${res.status})`);
      }
      return (await res.json()) as { id: string };
    },
    onSuccess: (created) => {
      navigate(`/competitions/${created.id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || createMutation.isPending) return;

    const payload: CreateCompetitionPayload = {
      title: title?.trim() || null,
      themeId: null, // optional for now; you can wire to a real theme id later
      themeName: chosenTheme || null,
      recipeId: recipeId?.trim() || null,
      isPrivate,
      timeLimitMinutes,
      minOfficialVoters: minOfficialVoters || 3,
    };

    createMutation.mutate(payload);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <ChefHat className="h-7 w-7" />
        <h1 className="font-serif text-2xl">Create a Cookoff</h1>
        <Badge variant="secondary" className="ml-auto">Beta</Badge>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Room Setup</CardTitle>
          <p className="text-sm text-muted-foreground">
            Set your theme, duration (30–120 min), and privacy. You’ll start live video later and judging will stay open for 24 hours.
          </p>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">Room Title (optional)</Label>
              <Input
                id="title"
                placeholder="e.g., Dessert Duel: Ultimate Brownies"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Theme */}
            <div className="grid gap-2">
              <Label>Theme</Label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Select value={themeName} onValueChange={setThemeName}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PRESET_THEMES.map((t) => (
                        <SelectItem key={t.slug} value={t.slug}>
                          {t.name}
                        </SelectItem>
                      ))}
                      <Separator className="my-1" />
                      <SelectItem value="__custom__">Custom theme…</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Custom theme name (if selected)"
                  value={customTheme}
                  onChange={(e) => setCustomTheme(e.target.value)}
                  disabled={themeName !== "__custom__"}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Participants can free-style within the theme or you can paste a recipe ID below to anchor the challenge.
              </p>
            </div>

            {/* Recipe (optional) */}
            <div className="grid gap-2">
              <Label htmlFor="recipeId">Specific Recipe ID (optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="recipeId"
                  placeholder="Paste a recipe id from ChefSire (optional)"
                  value={recipeId}
                  onChange={(e) => setRecipeId(e.target.value)}
                />
                <Button type="button" variant="outline" className="whitespace-nowrap" onClick={() => alert("Coming soon: recipe picker dialog")}>
                  <FolderSearch2 className="mr-2 h-4 w-4" /> Browse
                </Button>
              </div>
            </div>

            {/* Duration */}
            <div className="grid gap-2">
              <Label>Time Limit</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TIME_OPTIONS.map((m) => {
                  const active = timeLimitMinutes === m;
                  return (
                    <Button
                      key={m}
                      type="button"
                      variant={active ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => setTimeLimitMinutes(m)}
                    >
                      <Timer className="mr-2 h-4 w-4" />
                      {m} min
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Privacy + min voters */}
            <div className="grid gap-2">
              <Label>Privacy & Legitimacy</Label>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  {isPrivate ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                  <div>
                    <div className="font-medium">{isPrivate ? "Private (invite only)" : "Public (anyone can join)"}</div>
                    <div className="text-xs text-muted-foreground">
                      Private rooms require an invite link. Public rooms are discoverable.
                    </div>
                  </div>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>

              <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="minVoters">Minimum unique voters (official)</Label>
                  <Input
                    id="minVoters"
                    type="number"
                    min={1}
                    max={50}
                    value={minOfficialVoters}
                    onChange={(e) => setMinOfficialVoters(Math.max(1, Math.min(50, parseInt(e.target.value || "0"))))}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Events with fewer votes are marked as "Exhibition".
                  </p>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="notes">Notes (visible to participants)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any special rules or notes (optional)"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={!canSubmit || createMutation.isPending} className="min-w-40">
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
                  </>
                ) : (
                  "Create Room"
                )}
              </Button>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Film className="h-3.5 w-3.5" />
                Auto-recordings and a 24-hour judging window are enabled by default.
              </div>
            </div>

            {createMutation.isError ? (
              <p className="text-sm text-red-600">{(createMutation.error as Error)?.message}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 text-xs text-muted-foreground">
        Tip: For local testing without auth, set a dev id in your browser console:
        <code className="ml-2 rounded bg-muted px-2 py-0.5">localStorage.setItem("devUserId","user-123")</code>
      </div>
    </div>
  );
}
