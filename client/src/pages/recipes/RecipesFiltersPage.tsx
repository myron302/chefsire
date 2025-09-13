// client/src/pages/recipes/RecipesFiltersPage.tsx
import * as React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRecipesFilters } from "./useRecipesFilters";
import {
  CUISINES,
  DIETARY,
  ALLERGENS,
  ETHNICITY_REGIONS,
  MEAL_TYPES,
  DIFFICULTY,
} from "./useRecipesFilters";

/* ------------------------------------------------------------
   Icons (Spoon only, used for rating)
   ------------------------------------------------------------ */
function SpoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M13.5 2c1.933 0 3.5 1.567 3.5 3.5 0 1.252-.66 2.429-1.733 3.08L14 9.4V14a4 4 0 0 1-2 3.465V22h-2v-4.535A4 4 0 0 1 8 14V9.4L6.733 8.58A3.5 3.5 0 0 1 5 5.5C5 3.567 6.567 2 8.5 2c.98 0 1.866.4 2.5 1.045A3.486 3.486 0 0 1 13.5 2z" />
    </svg>
  );
}

/* ------------------------------------------------------------
   Small helpers
   ------------------------------------------------------------ */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function TogglePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className="h-8"
    >
      {children}
    </Button>
  );
}

function useArrayToggle<T extends string>(arr: T[], set: (v: T[]) => void) {
  return (value: T) => {
    if (arr.includes(value)) set(arr.filter((x) => x !== value));
    else set([...arr, value]);
  };
}

/* ------------------------------------------------------------
   Searchable checklist (plain HTML inputs, no extra imports)
   ------------------------------------------------------------ */
function SearchableChecklist({
  label,
  items,
  selected,
  onToggle,
  placeholder = "Search…",
  columns = 2,
  maxHeight = "18rem",
}: {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (value: string) => void;
  placeholder?: string;
  columns?: 1 | 2 | 3;
  maxHeight?: string;
}) {
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((x) => x.toLowerCase().includes(t));
  }, [items, q]);

  const gridCols =
    columns === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1";

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <h4 className="text-sm font-semibold">{label}</h4>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-48 rounded-md border bg-background px-2 text-sm"
        />
      </div>

      <div
        className={`grid ${gridCols} gap-2 overflow-y-auto pr-1`}
        style={{ maxHeight, WebkitOverflowScrolling: "touch" as any }}
      >
        {filtered.map((name) => {
          const checked = selected.includes(name);
          return (
            <label
              key={name}
              className="flex items-center gap-2 rounded-md border p-2 text-sm"
              title={name}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(name)}
                className="h-4 w-4"
              />
              <span className="truncate">{name}</span>
            </label>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-xs text-muted-foreground">No matches.</div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   Ethnicity (grouped by region + search)
   ------------------------------------------------------------ */
function EthnicityRegionGroups() {
  const { state, set } = useRecipesFilters();
  const [q, setQ] = React.useState("");

  const toggle = (value: string) =>
    set((prev) => ({
      ...prev,
      ethnicities: prev.ethnicities.includes(value)
        ? prev.ethnicities.filter((x) => x !== value)
        : [...prev.ethnicities, value],
    }));

  const query = q.trim().toLowerCase();

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <h4 className="text-sm font-semibold">Ethnicities (by region)</h4>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ethnicities…"
          className="h-9 w-60 rounded-md border bg-background px-2 text-sm"
        />
      </div>

      <div className="space-y-6">
        {Object.entries(ETHNICITY_REGIONS).map(([region, list]) => {
          const filtered = query ? list.filter((x) => x.toLowerCase().includes(query)) : list;
          if (filtered.length === 0) return null;

          return (
            <div key={region} className="space-y-2">
              {/* region heading: a bit bigger & bolder */}
              <h5 className="text-sm font-bold uppercase tracking-wide text-foreground/90">
                {region}
              </h5>

              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
                style={{ WebkitOverflowScrolling: "touch" as any }}
              >
                {filtered.map((name) => {
                  const checked = state.ethnicities.includes(name);
                  return (
                    <label
                      key={name}
                      className="flex items-center gap-2 rounded-md border p-2 text-sm"
                      title={name}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(name)}
                        className="h-4 w-4"
                      />
                      <span className="truncate">{name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   Main Page
   ------------------------------------------------------------ */
export default function RecipesFiltersPage() {
  const { state, set, reset } = useRecipesFilters();
  const [, setLocation] = useLocation();

  // individual togglers
  const toggleCuisine = useArrayToggle(state.cuisines, (v) =>
    set((prev) => ({ ...prev, cuisines: v }))
  );
  const toggleMealType = useArrayToggle(state.mealTypes as string[], (v) =>
    set((prev) => ({ ...prev, mealTypes: v }))
  );
  const toggleDiet = useArrayToggle(state.dietary as string[], (v) =>
    set((prev) => ({ ...prev, dietary: v }))
  );
  const toggleAllergen = useArrayToggle(state.allergens as string[], (v) =>
    set((prev) => ({ ...prev, allergens: v }))
  );

  const setDifficulty = (d: "" | "Easy" | "Medium" | "Hard") =>
    set((prev) => ({ ...prev, difficulty: prev.difficulty === d ? "" : d }));

  const setSort = (s: "newest" | "rating" | "likes") =>
    set((prev) => ({ ...prev, sortBy: s }));

  const activeCount =
    state.cuisines.length +
    state.ethnicities.length +
    state.dietary.length +
    state.mealTypes.length +
    (state.difficulty ? 1 : 0) +
    state.allergens.length +
    (state.maxCookTime !== 60 ? 1 : 0) +
    (state.minSpoons ? 1 : 0) +
    (state.onlyRecipes ? 1 : 0) +
    (state.sortBy !== "newest" ? 1 : 0);

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Recipe Filters</h1>
          <p className="text-sm text-muted-foreground">
            Choose cuisines, ethnicities, diets, allergens, and more.{" "}
            <Badge variant="outline" className="ml-1">
              {activeCount} active
            </Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={reset}>
            Reset
          </Button>
          <Button onClick={() => setLocation("/recipes")}>View Results</Button>
        </div>
      </div>

      {/* Filters grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <Section title="Cuisines">
            <SearchableChecklist
              label="Select Cuisines"
              items={CUISINES}
              selected={state.cuisines}
              onToggle={toggleCuisine}
              placeholder="Search cuisines…"
              columns={2}
              maxHeight="20rem"
            />
          </Section>

          <Section title="Ethnicity / Cultural Origin">
            <EthnicityRegionGroups />
          </Section>

          <Section title="Meal Types">
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPES.map((m) => (
                <TogglePill
                  key={m}
                  active={state.mealTypes.includes(m)}
                  onClick={() => toggleMealType(m)}
                >
                  {m}
                </TogglePill>
              ))}
            </div>
          </Section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Section title="Dietary">
            <SearchableChecklist
              label="Dietary"
              items={DIETARY}
              selected={state.dietary}
              onToggle={toggleDiet}
              placeholder="Search dietary…"
              columns={2}
              maxHeight="16rem"
            />
          </Section>

          <Section title="Allergens">
            <SearchableChecklist
              label="Allergens"
              items={ALLERGENS}
              selected={state.allergens}
              onToggle={toggleAllergen}
              placeholder="Search allergens…"
              columns={2}
              maxHeight="16rem"
            />
          </Section>

          <Section title="Difficulty">
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY.map((d) => (
                <TogglePill
                  key={d}
                  active={state.difficulty === d}
                  onClick={() => setDifficulty(d)}
                >
                  {d}
                </TogglePill>
              ))}
            </div>
          </Section>

          <Section title={`Max Cook Time: ${state.maxCookTime} min`}>
            {/* Simple range input to avoid extra imports */}
            <input
              type="range"
              min={5}
              max={240}
              step={5}
              value={state.maxCookTime}
              onChange={(e) =>
                set((prev) => ({ ...prev, maxCookTime: Number(e.target.value) }))
              }
              className="w-full"
            />
            <div className="mt-1 text-xs text-muted-foreground">
              Drag to limit results by total cook time.
            </div>
          </Section>

          <Section title="Minimum Rating (Spoons)">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="p-1"
                  aria-label={`${n} spoons & up`}
                  onClick={() =>
                    set((prev) => ({
                      ...prev,
                      minSpoons: prev.minSpoons === n ? 0 : n,
                    }))
                  }
                  title={`${n} spoons & up`}
                >
                  <SpoonIcon
                    className={`h-6 w-6 ${
                      state.minSpoons >= n ? "text-emerald-600" : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="ml-1 h-7 px-2"
                onClick={() => set((prev) => ({ ...prev, minSpoons: 0 }))}
              >
                Clear
              </Button>
            </div>
          </Section>

          <Section title="More">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.onlyRecipes}
                onChange={(e) =>
                  set((prev) => ({ ...prev, onlyRecipes: e.target.checked }))
                }
                className="h-4 w-4"
              />
              <span className="text-sm">Show recipe posts only</span>
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              {(["newest", "rating", "likes"] as const).map((s) => (
                <TogglePill
                  key={s}
                  active={state.sortBy === s}
                  onClick={() => setSort(s)}
                >
                  {s === "newest" ? "Newest" : s === "rating" ? "Top Rated" : "Most Liked"}
                </TogglePill>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {/* Footer actions (mobile-friendly) */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur border-t py-3">
        <div className="mx-auto max-w-6xl px-4 md:px-6 flex items-center justify-between gap-2">
          <Button variant="secondary" onClick={reset}>
            Reset filters
          </Button>
          <div className="flex gap-2">
            <Link href="/recipes">
              <Button>Apply & View Results</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
