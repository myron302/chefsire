// client/src/pages/recipes/RecipesFiltersPage.tsx
import * as React from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider"; // If you don't have this, swap for <input type="range" />
import { ChevronLeft, Filter, X } from "lucide-react";

import {
  useRecipesFilters,
  CUISINES,
  MEAL_TYPES,
  DIETARY,
  ALLERGENS,
  DIFFICULTY,
  ETHNICITY_REGIONS,
  ETHNICITIES,
} from "@/hooks/useRecipesFilters";

/** Small selectable chip */
function Chip({
  label,
  selected,
  onToggle,
  className = "",
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "text-sm px-3 py-1.5 rounded-full border",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted text-foreground border-border hover:bg-muted/80",
        className,
      ].join(" ")}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

/** Section shell */
function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function RecipesFiltersPage() {
  const [, setLocation] = useLocation();
  const { state, set, reset } = useRecipesFilters();

  // helpers for toggling list selections
  const toggleIn = (key: keyof typeof state, val: string) =>
    set((s) => {
      const arr = new Set<string>(s[key] as string[]);
      if (arr.has(val)) arr.delete(val);
      else arr.add(val);
      return { ...s, [key]: Array.from(arr) };
    });

  const isSelected = (key: keyof typeof state, val: string) =>
    (state[key] as string[]).includes(val);

  const applyAndBack = () => {
    // (Optionally could persist to URL, keep it simple for now)
    setLocation("/recipes");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setLocation("/recipes")} className="px-2">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            Recipe Filters
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={reset}>
            <X className="w-4 h-4 mr-1" />
            Reset
          </Button>
          <Button onClick={applyAndBack}>Apply</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
        {/* Main filter clusters */}
        <div className="space-y-5">
          <Card className="p-4 space-y-5">
            {/* Search (client-side quick search that mirrors list page box) */}
            <Section title="Search">
              <Input
                placeholder="Search recipe titles or keywords…"
                value={(state as any).search ?? ""}
                onChange={(e) => set((s) => ({ ...s, search: e.target.value }))}
              />
            </Section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Cuisines */}
              <Section
                title="Cuisines"
                right={
                  state.cuisines.length > 0 ? (
                    <button
                      className="text-xs underline text-muted-foreground"
                      onClick={() => set((s) => ({ ...s, cuisines: [] }))}
                    >
                      Clear
                    </button>
                  ) : null
                }
              >
                <div className="flex flex-wrap gap-2">
                  {CUISINES.map((c) => (
                    <Chip
                      key={c}
                      label={c}
                      selected={isSelected("cuisines", c)}
                      onToggle={() => toggleIn("cuisines", c)}
                    />
                  ))}
                </div>
              </Section>

              {/* Meal Types */}
              <Section
                title="Meal Types"
                right={
                  state.mealTypes.length > 0 ? (
                    <button
                      className="text-xs underline text-muted-foreground"
                      onClick={() => set((s) => ({ ...s, mealTypes: [] }))}
                    >
                      Clear
                    </button>
                  ) : null
                }
              >
                <div className="flex flex-wrap gap-2">
                  {MEAL_TYPES.map((m) => (
                    <Chip
                      key={m}
                      label={m}
                      selected={isSelected("mealTypes", m)}
                      onToggle={() => toggleIn("mealTypes", m)}
                    />
                  ))}
                </div>
              </Section>
            </div>

            {/* Ethnicities grouped by region */}
            <Section
              title="Ethnicities (by Region)"
              right={
                state.ethnicities.length > 0 ? (
                  <button
                    className="text-xs underline text-muted-foreground"
                    onClick={() => set((s) => ({ ...s, ethnicities: [] }))}
                  >
                    Clear
                  </button>
                ) : null
              }
            >
              <div className="space-y-4">
                {ETHNICITY_REGIONS.map((region) => (
                  <div key={region} className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">
                      {region}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ETHNICITIES[region]?.map((eth) => (
                        <Chip
                          key={eth}
                          label={eth}
                          selected={isSelected("ethnicities", eth)}
                          onToggle={() => toggleIn("ethnicities", eth)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Dietary */}
            <Section
              title="Dietary"
              right={
                state.dietary.length > 0 ? (
                  <button
                    className="text-xs underline text-muted-foreground"
                    onClick={() => set((s) => ({ ...s, dietary: [] }))}
                  >
                    Clear
                  </button>
                ) : null
              }
            >
              <div className="flex flex-wrap gap-2">
                {DIETARY.map((d) => (
                  <Chip
                    key={d}
                    label={d}
                    selected={isSelected("dietary", d)}
                    onToggle={() => toggleIn("dietary", d)}
                  />
                ))}
              </div>
            </Section>

            {/* Allergens */}
            <Section
              title="Exclude Allergens"
              right={
                state.allergens.length > 0 ? (
                  <button
                    className="text-xs underline text-muted-foreground"
                    onClick={() => set((s) => ({ ...s, allergens: [] }))}
                  >
                    Clear
                  </button>
                ) : null
              }
            >
              <div className="flex flex-wrap gap-2">
                {ALLERGENS.map((a) => (
                  <Chip
                    key={a}
                    label={a}
                    selected={isSelected("allergens", a)}
                    onToggle={() => toggleIn("allergens", a)}
                  />
                ))}
              </div>
            </Section>
          </Card>

          {/* Advanced */}
          <Card className="p-4 space-y-5">
            {/* Difficulty + Only recipes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Section title="Difficulty">
                <div className="flex flex-wrap gap-2">
                  {(["", ...DIFFICULTY] as const).map((d) => (
                    <Chip
                      key={d || "Any"}
                      label={d || "Any"}
                      selected={(state.difficulty || "") === d}
                      onToggle={() =>
                        set((s) => ({
                          ...s,
                          difficulty: (s.difficulty || "") === d ? "" : (d as typeof s.difficulty),
                        }))
                      }
                    />
                  ))}
                </div>
              </Section>

              <Section title="Content Type">
                <div className="flex flex-wrap gap-2">
                  <Chip
                    label="Only recipes (hide non-recipe posts)"
                    selected={state.onlyRecipes}
                    onToggle={() => set((s) => ({ ...s, onlyRecipes: !s.onlyRecipes }))}
                    className="w-full text-left"
                  />
                </div>
              </Section>
            </div>

            {/* Cook time */}
            <Section title={`Max Cook Time: ${state.maxCookTime} min`}>
              {/* If you don’t have a Slider component, replace with:
                  <input type="range" min={5} max={240} step={5} value={state.maxCookTime}
                    onChange={(e) => set((s) => ({ ...s, maxCookTime: Number(e.target.value) }))} />
               */}
              {Slider ? (
                <Slider
                  min={5}
                  max={240}
                  step={5}
                  value={[state.maxCookTime]}
                  onValueChange={([v]) => set((s) => ({ ...s, maxCookTime: v }))}
                />
              ) : (
                <input
                  type="range"
                  min={5}
                  max={240}
                  step={5}
                  value={state.maxCookTime}
                  onChange={(e) =>
                    set((s) => ({ ...s, maxCookTime: Number(e.target.value) }))
                  }
                  className="w-full"
                />
              )}
            </Section>

            {/* Spoons */}
            <Section title={`Minimum Rating (Spoons): ${state.minSpoons}`}>
              {Slider ? (
                <Slider
                  min={0}
                  max={5}
                  step={1}
                  value={[state.minSpoons]}
                  onValueChange={([v]) => set((s) => ({ ...s, minSpoons: v }))}
                />
              ) : (
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={1}
                  value={state.minSpoons}
                  onChange={(e) =>
                    set((s) => ({ ...s, minSpoons: Number(e.target.value) }))
                  }
                  className="w-full"
                />
              )}
            </Section>

            {/* Sort */}
            <Section title="Sort By">
              <div className="flex flex-wrap gap-2">
                {(["newest", "rating", "likes"] as const).map((opt) => (
                  <Chip
                    key={opt}
                    label={opt === "newest" ? "Newest" : opt === "rating" ? "Rating" : "Likes"}
                    selected={state.sortBy === opt}
                    onToggle={() => set((s) => ({ ...s, sortBy: opt }))}
                  />
                ))}
              </div>
            </Section>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={reset}>
                Reset
              </Button>
              <Button onClick={applyAndBack}>Apply</Button>
            </div>
          </Card>
        </div>

        {/* Sticky summary (desktop) */}
        <div className="lg:sticky lg:top-20 space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Current Filters
            </h3>
            <div className="space-y-2 text-sm">
              <Row label="Search" value={(state as any).search || "—"} />
              <Row label="Cuisines" value={state.cuisines.join(", ") || "—"} />
              <Row label="Ethnicities" value={state.ethnicities.join(", ") || "—"} />
              <Row label="Dietary" value={state.dietary.join(", ") || "—"} />
              <Row label="Allergens" value={state.allergens.join(", ") || "—"} />
              <Row label="Meal Types" value={state.mealTypes.join(", ") || "—"} />
              <Row label="Difficulty" value={state.difficulty || "Any"} />
              <Row label="Max Cook Time" value={`${state.maxCookTime} min`} />
              <Row label="Min Spoons" value={String(state.minSpoons)} />
              <Row label="Only Recipes" value={state.onlyRecipes ? "Yes" : "No"} />
              <Row
                label="Sort By"
                value={state.sortBy === "newest" ? "Newest" : state.sortBy === "rating" ? "Rating" : "Likes"}
              />
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Button variant="outline" className="w-full" onClick={reset}>
                Reset
              </Button>
              <Button className="w-full" onClick={applyAndBack}>
                Apply
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Tips
            </h3>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>Pick a cuisine + meal type to tighten results.</li>
              <li>Use allergens to exclude ingredients across all recipes.</li>
              <li>Set “Only recipes” to hide non-recipe posts.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
