// pages/explore.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import PostCard from "@/components/post-card";
import RecipeCard from "@/components/recipe-card";
import { Search, Grid, List, RefreshCw, SlidersHorizontal } from "lucide-react";
import type { PostWithUser } from "@shared/schema";
import { MultiSelectCombobox } from "@/components/multi-select-combobox";
import { TagInput } from "@/components/tag-input";
import {
  CUISINES,
  DIETS,
  COURSES,
  POPULAR_DIET_CHIPS,
  DIFFICULTIES,
  ALLERGENS,
} from "@/lib/filters";

/* ===== safe helpers ===== */
const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>
      <rect width='100%' height='100%' fill='%23eee'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
        fill='%23999' font-family='sans-serif' font-size='20'>No image</text>
    </svg>`
  );

function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src !== PLACEHOLDER_IMG) img.src = PLACEHOLDER_IMG;
}

function getPostImageUrl(post: Partial<PostWithUser> | undefined) {
  return (post?.imageUrl && String(post.imageUrl).trim()) || PLACEHOLDER_IMG;
}

function isPostLike(x: any): x is PostWithUser {
  return x && typeof x === "object" && "id" in x;
}

/* ===== utilities ===== */
function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function useLocalStorage<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  }, [key, val]);
  return [val, setVal] as const;
}

/* ===== component ===== */
export default function Explore() {
  // basic
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useLocalStorage<string | null>(
    "explore:selectedCategory",
    null
  );
  const [viewMode, setViewMode] = useLocalStorage<"grid" | "list">(
    "explore:viewMode",
    "grid"
  );
  const [sort, setSort] = useLocalStorage<"trending" | "newest" | "most_liked">(
    "explore:sort",
    "trending"
  );
  const debouncedQuery = useDebouncedValue(searchTerm.trim(), 350);

  // advanced filters
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [cuisines, setCuisines] = useLocalStorage<string[]>("explore:cuisines", []);
  const [diets, setDiets] = useLocalStorage<string[]>("explore:diets", []);
  const [courses, setCourses] = useLocalStorage<string[]>("explore:courses", []);
  const [difficulties, setDifficulties] = useLocalStorage<string[]>(
    "explore:difficulties",
    []
  );
  const [allergens, setAllergens] = useLocalStorage<string[]>("explore:allergens", []);

  // time/calories
  const [prepRange, setPrepRange] = useLocalStorage<[number, number]>(
    "explore:prepRange",
    [0, 60]
  ); // minutes
  const [cookRange, setCookRange] = useLocalStorage<[number, number]>(
    "explore:cookRange",
    [0, 90]
  ); // minutes
  const [maxCalories, setMaxCalories] = useLocalStorage<number | null>(
    "explore:maxCalories",
    null
  );

  // ingredients include/exclude
  const [includeIngr, setIncludeIngr] = useLocalStorage<string[]>(
    "explore:includeIngr",
    []
  );
  const [excludeIngr, setExcludeIngr] = useLocalStorage<string[]>(
    "explore:excludeIngr",
    []
  );

  // toggles
  const [savedOnly, setSavedOnly] = useLocalStorage<boolean>("explore:savedOnly", false);
  const [verifiedChefs, setVerifiedChefs] = useLocalStorage<boolean>(
    "explore:verifiedChefs",
    false
  );
  const [gfOnly, setGfOnly] = useLocalStorage<boolean>("explore:gfOnly", false);
  const [lfOnly, setLfOnly] = useLocalStorage<boolean>("explore:lfOnly", false);

  const LIMIT = 18;

  // data
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
  } = useInfiniteQuery<{
    items: PostWithUser[];
    nextCursor?: string | null;
    total?: number;
  }>({
    queryKey: [
      "/api/posts/explore",
      {
        q: debouncedQuery,
        category: selectedCategory,
        sort,
        limit: LIMIT,
        cuisines,
        diets: gfOnly ? Array.from(new Set([...diets, "Gluten-Free"])) : diets,
        courses,
        difficulties,
        allergens,
        prepRange,
        cookRange,
        maxCalories,
        includeIngr,
        excludeIngr,
        savedOnly,
        verifiedChefs,
        lfOnly,
      },
    ],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (selectedCategory && selectedCategory !== "All")
        params.set("category", selectedCategory);
      params.set("sort", sort);
      params.set("limit", String(LIMIT));
      if (pageParam) params.set("cursor", String(pageParam));

      cuisines.forEach((c) => params.append("cuisine", c));
      const dietsFinal = gfOnly ? Array.from(new Set([...diets, "Gluten-Free"])) : diets;
      dietsFinal.forEach((d) => params.append("diet", d));
      courses.forEach((c) => params.append("course", c));
      difficulties.forEach((d) => params.append("difficulty", d));
      allergens.forEach((a) => params.append("allergen", a));

      // ranges / numbers
      params.set("prep_min", String(prepRange[0]));
      params.set("prep_max", String(prepRange[1]));
      params.set("cook_min", String(cookRange[0]));
      params.set("cook_max", String(cookRange[1]));
      if (maxCalories != null) params.set("max_calories", String(maxCalories));

      // ingredients
      includeIngr.forEach((i) => params.append("include", i));
      excludeIngr.forEach((i) => params.append("exclude", i));

      // toggles
      if (savedOnly) params.set("saved_only", "1");
      if (verifiedChefs) params.set("verified_only", "1");
      if (lfOnly) params.set("lactose_free_only", "1");

      const res = await fetch(`/api/posts/explore?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    keepPreviousData: true,
  });
              {/* Time & calories */}
            <RangeRow
              label="Prep time (min)"
              value={prepRange}
              onChange={setPrepRange}
              max={120}
            />
            <RangeRow
              label="Cook time (min)"
              value={cookRange}
              onChange={setCookRange}
              max={240}
            />

            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-muted-foreground">
                Max calories (per serving)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="e.g., 500"
                  value={maxCalories ?? ""}
                  onChange={(e) =>
                    setMaxCalories(
                      e.target.value === "" ? null : Math.max(0, Number(e.target.value))
                    )
                  }
                  className="w-28"
                />
                {maxCalories != null && (
                  <Button variant="ghost" size="sm" onClick={() => setMaxCalories(null)}>
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Ingredients include / exclude */}
            <TagInput
              label="Include ingredients"
              value={includeIngr}
              onChange={setIncludeIngr}
              placeholder="e.g., chicken, basil…"
            />
            <TagInput
              label="Exclude ingredients"
              value={excludeIngr}
              onChange={setExcludeIngr}
              placeholder="e.g., peanuts, cilantro…"
            />

            {/* Toggles */}
            <ToggleRow
              label="Gluten-free only"
              checked={gfOnly}
              onCheckedChange={setGfOnly}
            />
            <ToggleRow
              label="Lactose-free only"
              checked={lfOnly}
              onCheckedChange={setLfOnly}
            />
            <ToggleRow
              label="Saved only"
              hint="Show recipes you’ve saved"
              checked={savedOnly}
              onCheckedChange={setSavedOnly}
            />
            <ToggleRow
              label="Verified chefs only"
              hint="Creators with verified badge"
              checked={verifiedChefs}
              onCheckedChange={setVerifiedChefs}
            />

            {/* Sort */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-muted-foreground">Sort</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="trending">Trending</option>
                <option value="newest">Newest</option>
                <option value="most_liked">Most liked</option>
              </select>
            </div>
          </div>

          <SheetFooter className="mt-4">
            <div className="flex w-full items-center justify-between gap-2">
              <Button variant="ghost" onClick={() => resetAll()}>
                Reset
              </Button>
              <Button onClick={() => setIsFilterOpen(false)}>Apply</Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );

  /* helpers */
  function resetAll() {
    setSelectedCategory(null);
    setSearchTerm("");
    setCuisines([]);
    setDiets([]);
    setCourses([]);
    setDifficulties([]);
    setAllergens([]);
    setPrepRange([0, 60]);
    setCookRange([0, 90]);
    setMaxCalories(null);
    setIncludeIngr([]);
    setExcludeIngr([]);
    setSavedOnly(false);
    setVerifiedChefs(false);
    setGfOnly(false);
    setLfOnly(false);
    setSort("trending");
  }
} // closes Explore

/* ===== Header, RangeRow, ToggleRow, EmptyState ===== */

function Header({
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  viewMode,
  setViewMode,
  sort,
  setSort,
  foundLabel,
  openFilters,
  diets,
  setDiets,
  CATEGORIES,
}: any) {
  return (
    <div className="mb-4 sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 py-4">
      <h1 className="text-3xl font-bold mb-4">Explore</h1>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
        <Input
          type="text"
          placeholder="Search recipes, chefs, or ingredients…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-xl"
          aria-label="Search explore"
        />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {CATEGORIES.map((category: string) => {
            const active =
              selectedCategory === category || (!selectedCategory && category === "All");
            return (
              <Badge
                key={category}
                variant={active ? "default" : "outline"}
                className="cursor-pointer shrink-0"
                onClick={() =>
                  setSelectedCategory(active && category !== "All" ? null : category)
                }
                aria-pressed={active}
              >
                {category}
              </Badge>
            );
          })}
        </div>

        {/* Popular diet chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {POPULAR_DIET_CHIPS.map((d: string) => {
            const active = diets.includes(d);
            return (
              <Badge
                key={d}
                variant={active ? "default" : "outline"}
                className="cursor-pointer shrink-0"
                onClick={() =>
                  active
                    ? setDiets(diets.filter((x: string) => x !== d))
                    : setDiets([...diets, d])
                }
                aria-pressed={active}
                title={`Diet: ${d}`}
              >
                {d}
              </Badge>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 md:ml-auto">
          <Button variant="outline" size="sm" onClick={openFilters}>
            <SlidersHorizontal className="h-4 w-4 mr-2" /> Filters
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
            aria-pressed={viewMode === "grid"}
            aria-label="Grid view (g)"
            title="Grid view (g)"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            aria-label="List view (l)"
            title="List view (l)"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <p className="text-sm text-muted-foreground">{foundLabel}</p>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="trending">Trending</option>
            <option value="newest">Newest</option>
            <option value="most_liked">Most liked</option>
          </select>
        </div>
      </div>
    </div>
  );
}
            {/* Time & calories */}
            <RangeRow
              label="Prep time (min)"
              value={prepRange}
              onChange={setPrepRange}
              max={120}
            />
            <RangeRow
              label="Cook time (min)"
              value={cookRange}
              onChange={setCookRange}
              max={240}
            />

            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-muted-foreground">
                Max calories (per serving)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="e.g., 500"
                  value={maxCalories ?? ""}
                  onChange={(e) =>
                    setMaxCalories(
                      e.target.value === "" ? null : Math.max(0, Number(e.target.value))
                    )
                  }
                  className="w-28"
                />
                {maxCalories != null && (
                  <Button variant="ghost" size="sm" onClick={() => setMaxCalories(null)}>
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Ingredients include / exclude */}
            <TagInput
              label="Include ingredients"
              value={includeIngr}
              onChange={setIncludeIngr}
              placeholder="e.g., chicken, basil…"
            />
            <TagInput
              label="Exclude ingredients"
              value={excludeIngr}
              onChange={setExcludeIngr}
              placeholder="e.g., peanuts, cilantro…"
            />

            {/* Toggles */}
            <ToggleRow
              label="Gluten-free only"
              checked={gfOnly}
              onCheckedChange={setGfOnly}
            />
            <ToggleRow
              label="Lactose-free only"
              checked={lfOnly}
              onCheckedChange={setLfOnly}
            />
            <ToggleRow
              label="Saved only"
              hint="Show recipes you’ve saved"
              checked={savedOnly}
              onCheckedChange={setSavedOnly}
            />
            <ToggleRow
              label="Verified chefs only"
              hint="Creators with verified badge"
              checked={verifiedChefs}
              onCheckedChange={setVerifiedChefs}
            />

            {/* Sort */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-muted-foreground">Sort</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="trending">Trending</option>
                <option value="newest">Newest</option>
                <option value="most_liked">Most liked</option>
              </select>
            </div>
          </div>

          <SheetFooter className="mt-4">
            <div className="flex w-full items-center justify-between gap-2">
              <Button variant="ghost" onClick={() => resetAll()}>
                Reset
              </Button>
              <Button onClick={() => setIsFilterOpen(false)}>Apply</Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );

  /* helpers */
  function resetAll() {
    setSelectedCategory(null);
    setSearchTerm("");
    setCuisines([]);
    setDiets([]);
    setCourses([]);
    setDifficulties([]);
    setAllergens([]);
    setPrepRange([0, 60]);
    setCookRange([0, 90]);
    setMaxCalories(null);
    setIncludeIngr([]);
    setExcludeIngr([]);
    setSavedOnly(false);
    setVerifiedChefs(false);
    setGfOnly(false);
    setLfOnly(false);
    setSort("trending");
  }
} // closes Explore

/* ===== Header, RangeRow, ToggleRow, EmptyState ===== */

function Header({
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  viewMode,
  setViewMode,
  sort,
  setSort,
  foundLabel,
  openFilters,
  diets,
  setDiets,
  CATEGORIES,
}: any) {
  return (
    <div className="mb-4 sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 py-4">
      <h1 className="text-3xl font-bold mb-4">Explore</h1>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
        <Input
          type="text"
          placeholder="Search recipes, chefs, or ingredients…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-xl"
          aria-label="Search explore"
        />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {CATEGORIES.map((category: string) => {
            const active =
              selectedCategory === category || (!selectedCategory && category === "All");
            return (
              <Badge
                key={category}
                variant={active ? "default" : "outline"}
                className="cursor-pointer shrink-0"
                onClick={() =>
                  setSelectedCategory(active && category !== "All" ? null : category)
                }
                aria-pressed={active}
              >
                {category}
              </Badge>
            );
          })}
        </div>

        {/* Popular diet chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {POPULAR_DIET_CHIPS.map((d: string) => {
            const active = diets.includes(d);
            return (
              <Badge
                key={d}
                variant={active ? "default" : "outline"}
                className="cursor-pointer shrink-0"
                onClick={() =>
                  active
                    ? setDiets(diets.filter((x: string) => x !== d))
                    : setDiets([...diets, d])
                }
                aria-pressed={active}
                title={`Diet: ${d}`}
              >
                {d}
              </Badge>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 md:ml-auto">
          <Button variant="outline" size="sm" onClick={openFilters}>
            <SlidersHorizontal className="h-4 w-4 mr-2" /> Filters
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
            aria-pressed={viewMode === "grid"}
            aria-label="Grid view (g)"
            title="Grid view (g)"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            aria-label="List view (l)"
            title="List view (l)"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <p className="text-sm text-muted-foreground">{foundLabel}</p>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="trending">Trending</option>
            <option value="newest">Newest</option>
            <option value="most_liked">Most liked</option>
          </select>
        </div>
      </div>
    </div>
  );
}
