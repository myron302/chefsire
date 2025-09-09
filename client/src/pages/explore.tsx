import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import PostCard from "@/components/post-card";
import RecipeCard from "@/components/recipe-card";
import { Search, Grid, List, RefreshCw, SlidersHorizontal, X } from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

// ===== Types =====
interface FilterState {
  cuisines: string[];
  diets: string[];
  courses: string[];
  difficulties: string[];
  allergens: string[];
  prepRange: [number, number];
  cookRange: [number, number];
  maxCalories: number | null;
  includeIngr: string[];
  excludeIngr: string[];
  savedOnly: boolean;
  verifiedChefs: boolean;
  gfOnly: boolean;
  lfOnly: boolean;
  sort: "trending" | "newest" | "most_liked";
}

// ===== Constants =====
const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'> <rect width='100%' height='100%' fill='#eee'/> <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#999' font-family='sans-serif' font-size='20'>No image</text> </svg>`
  );

const LIMIT = 18;
const CATEGORIES = [
  "All",
  "Italian",
  "Healthy",
  "Desserts",
  "Quick",
  "Vegan",
  "Seafood",
  "Asian",
] as const;

// ===== Helpers =====
const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.src !== PLACEHOLDER_IMG) img.src = PLACEHOLDER_IMG;
};

const getPostImageUrl = (post: Partial<PostWithUser> | undefined) =>
  (post?.imageUrl && String(post.imageUrl).trim()) || PLACEHOLDER_IMG;

const isPostLike = (x: any): x is PostWithUser => x && typeof x === "object";

// Debounce hook
function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// Local storage hook with error handling
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
    } catch {
      console.warn(`Failed to save ${key} to localStorage`);
    }
  }, [key, val]);
  return [val, setVal] as const;
}

// Calculate active filter count
const getFilterCount = (filters: FilterState) => {
  let count = 0;
  count += filters.cuisines.length;
  count += filters.diets.length;
  count += filters.courses.length;
  count += filters.difficulties.length;
  count += filters.allergens.length;
  count += filters.includeIngr.length;
  count += filters.excludeIngr.length;
  count += filters.prepRange[0] !== 0 || filters.prepRange[1] !== 60 ? 1 : 0;
  count += filters.cookRange[0] !== 0 || filters.cookRange[1] !== 90 ? 1 : 0;
  count += filters.maxCalories !== null ? 1 : 0;
  count += filters.savedOnly ? 1 : 0;
  count += filters.verifiedChefs ? 1 : 0;
  count += filters.gfOnly ? 1 : 0;
  count += filters.lfOnly ? 1 : 0;
  return count;
};

// ===== Component =====
export default function Explore() {
  const { toast } = useToast();

  // State
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
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Advanced filters
  const [cuisines, setCuisines] = useLocalStorage<string[]>("explore:cuisines", []);
  const [diets, setDiets] = useLocalStorage<string[]>("explore:diets", []);
  const [courses, setCourses] = useLocalStorage<string[]>("explore:courses", []);
  const [difficulties, setDifficulties] = useLocalStorage<string[]>(
    "explore:difficulties",
    []
  );
  const [allergens, setAllergens] = useLocalStorage<string[]>("explore:allergens", []);
  const [prepRange, setPrepRange] = useLocalStorage<[number, number]>(
    "explore:prepRange",
    [0, 60]
  );
  const [cookRange, setCookRange] = useLocalStorage<[number, number]>(
    "explore:cookRange",
    [0, 90]
  );
  const [maxCalories, setMaxCalories] = useLocalStorage<number | null>(
    "explore:maxCalories",
    null
  );
  const [includeIngr, setIncludeIngr] = useLocalStorage<string[]>(
    "explore:includeIngr",
    []
  );
  const [excludeIngr, setExcludeIngr] = useLocalStorage<string[]>(
    "explore:excludeIngr",
    []
  );
  const [savedOnly, setSavedOnly] = useLocalStorage<boolean>("explore:savedOnly", false);
  const [verifiedChefs, setVerifiedChefs] = useLocalStorage<boolean>(
    "explore:verifiedChefs",
    false
  );
  const [gfOnly, setGfOnly] = useLocalStorage<boolean>("explore:gfOnly", false);
  const [lfOnly, setLfOnly] = useLocalStorage<boolean>("explore:lfOnly", false);

  const debouncedQuery = useDebouncedValue(searchTerm.trim(), 350);

  // Data fetching
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

      params.set("prep_min", String(prepRange[0]));
      params.set("prep_max", String(prepRange[1]));
      params.set("cook_min", String(cookRange[0]));
      params.set("cook_max", String(cookRange[1]));
      if (maxCalories != null) params.set("max_calories", String(maxCalories));

      includeIngr.forEach((i) => params.append("include", i));
      excludeIngr.forEach((i) => params.append("exclude", i));

      if (savedOnly) params.set("saved_only", "1");
      if (verifiedChefs) params.set("verified_only", "1");
      if (lfOnly) params.set("lactose_free_only", "1");

      const res = await fetch(`/api/posts/explore?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    keepPreviousData: true,
  });

  // Memoized posts
  const allPosts = useMemo(
    () =>
      data?.pages
        ?.flatMap((p) => (Array.isArray(p?.items) ? p.items : []))
        .filter(isPostLike) ?? [],
    [data]
  );
  const total = data?.pages?.[0]?.total ?? allPosts.length;

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "800px 0px 800px 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "g") setViewMode("grid");
      if (e.key === "l") setViewMode("list");
      if (e.key === "f") setIsFilterOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setViewMode]);

  // Reset filters with confirmation
  const resetAll = useCallback(() => {
    toast({
      title: "Reset Filters",
      description: "Are you sure you want to reset all filters?",
      action: (
        <Button
          onClick={() => {
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
            setIsFilterOpen(false);
          }}
        >
          Confirm
        </Button>
      ),
    });
  }, [
    setSelectedCategory,
    setSearchTerm,
    setCuisines,
    setDiets,
    setCourses,
    setDifficulties,
    setAllergens,
    setPrepRange,
    setCookRange,
    setMaxCalories,
    setIncludeIngr,
    setExcludeIngr,
    setSavedOnly,
    setVerifiedChefs,
    setGfOnly,
    setLfOnly,
    setSort,
    toast,
  ]);

  const filterCount = getFilterCount({
    cuisines,
    diets,
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
    gfOnly,
    lfOnly,
    sort,
  });

  const foundLabel = isFetching && !allPosts.length ? "Loading…" : `${total} ${total === 1 ? "post" : "posts"} found`;

  // UI
  if (isLoading && !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Header
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          viewMode={viewMode}
          setViewMode={setViewMode}
          sort={sort}
          setSort={setSort}
          foundLabel="Loading…"
          openFilters={() => setIsFilterOpen(true)}
          diets={diets}
          setDiets={setDiets}
          CATEGORIES={CATEGORIES}
          filterCount={filterCount}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i} className="animate-pulse overflow-hidden">
              <div className="w-full aspect-[4/3] bg-muted" />
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="w-3/4 h-4 bg-muted rounded" />
                  <div className="w-1/2 h-3 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-center">
        <h2 className="text-2xl font-semibold mb-2">We burnt something 😢</h2>
        <p className="text-muted-foreground mb-6">
          {(error as Error)?.message || "Something went wrong loading Explore."}
        </p>
        <Button onClick={() => refetch()} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Header
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        viewMode={viewMode}
        setViewMode={setViewMode}
        sort={sort}
        setSort={setSort}
        foundLabel={foundLabel}
        openFilters={() => setIsFilterOpen(true)}
        diets={diets}
        setDiets={setDiets}
        CATEGORIES={CATEGORIES}
        filterCount={filterCount}
      />

      {/* Posts */}
{allPosts.length > 0 ? (
  viewMode === "grid" ? (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4" data-testid="grid-explore">
      {allPosts.map((post, i) => (
        <Card
          key={post.id ?? `post-${i}`}
          className="group cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
        >
          <div className="relative overflow-hidden">
            <div className="w-full aspect-[4/3] bg-muted">
              <img
                src={getPostImageUrl(post)}
                onError={onImgError}
                alt={post?.caption || "Post image"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                decoding="async"
                data-testid={`img-explore-post-${post.id ?? i}`}
              />
              {post?.isRecipe && (
                <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">
                  Recipe
                </Badge>
              )}
            </div>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={(post?.user?.avatar && String(post.user.avatar)) || PLACEHOLDER_IMG}
                  onError={onImgError}
                  alt={post?.user?.displayName || "Creator"}
                  className="w-6 h-6 rounded-full bg-muted"
                  loading="lazy"
                  decoding="async"
                />
                <span className="text-sm font-medium">
                  {post?.user?.displayName || "Unknown Chef"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {post?.caption || "—"}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span aria-label={`${post?.likesCount ?? 0} likes`}>
                  ♥ {post?.likesCount ?? 0}
                </span>
                <span aria-label={`${post?.commentsCount ?? 0} comments`}>
                  💬 {post?.commentsCount ?? 0}
                </span>
              </div>
            </CardContent>
          </div>
        </Card>
      ))}
    </div>
  ) : (
    <div className="space-y-8 mt-4" data-testid="list-explore">
      {allPosts.map((post, i) =>
        post?.isRecipe ? (
          post ? (
            <RecipeCard key={post.id ?? `r-${i}`} post={post} />
          ) : null
        ) : (
          post ? (
            <PostCard key={post.id ?? `p-${i}`} post={post} />
          ) : null
        )
      )}
    </div>
  )
) : (
  <EmptyState onClear={resetAll} query={debouncedQuery} category={selectedCategory} />
)}
      {/* Infinite load */}
      {allPosts.length > 0 && (
        <div className="flex items-center justify-center mt-8">
          {hasNextPage ? (
            <>
              <div ref={sentinelRef} />
              <Button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                variant="outline"
                size="sm"
                className="mx-auto"
              >
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">You’ve reached the end. 🍽️</p>
          )}
        </div>
      )}

      {/* Filters Sheet */}
      <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Filters ({filterCount} active)</SheetTitle>
          </SheetHeader>

          <div className="grid gap-6">
            {/* Filter Categories */}
            <div className="space-y-2">
              <Label>Cuisine / Ethnicity</Label>
              <MultiSelectCombobox
                options={CUISINES}
                value={cuisines}
                onChange={setCuisines}
                buttonLabel="Select cuisines"
                placeholder="Search cuisines…"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Diet</Label>
              <MultiSelectCombobox
                options={DIETS}
                value={diets}
                onChange={setDiets}
                buttonLabel="Select diets"
                placeholder="Search diets…"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Course</Label>
              <MultiSelectCombobox
                options={COURSES}
                value={courses}
                onChange={setCourses}
                buttonLabel="Select courses"
                placeholder="Search courses…"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <MultiSelectCombobox
                options={DIFFICULTIES}
                value={difficulties}
                onChange={setDifficulties}
                buttonLabel="Select difficulty"
                placeholder="Filter difficulty…"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Exclude Allergens</Label>
              <MultiSelectCombobox
                options={ALLERGENS}
                value={allergens}
                onChange={setAllergens}
                buttonLabel="Select allergens"
                placeholder="Select allergens…"
                className="w-full"
              />
            </div>

            {/* Time & Calories */}
            <RangeRow label="Prep time (min)" value={prepRange} onChange={setPrepRange} max={120} />
            <RangeRow label="Cook time (min)" value={cookRange} onChange={setCookRange} max={240} />
            <div className="space-y-2">
              <Label>Max Calories (per serving)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="e.g., 500"
                  value={maxCalories ?? ""}
                  onChange={(e) =>
                    setMaxCalories(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))
                  }
                  className="w-32"
                />
                <Button variant="ghost" size="sm" onClick={() => setMaxCalories(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Ingredients */}
            <TagInput
              label="Include Ingredients"
              value={includeIngr}
              onChange={setIncludeIngr}
              placeholder="e.g., chicken, basil…"
            />
            <TagInput
              label="Exclude Ingredients"
              value={excludeIngr}
              onChange={setExcludeIngr}
              placeholder="e.g., peanuts, cilantro…"
            />

            {/* Toggles */}
            <ToggleRow
              label="Gluten-Free Only"
              checked={gfOnly}
              onCheckedChange={setGfOnly}
            />
            <ToggleRow
              label="Lactose-Free Only"
              checked={lfOnly}
              onCheckedChange={setLfOnly}
            />
            <ToggleRow
              label="Saved Only"
              hint="Show recipes you’ve saved"
              checked={savedOnly}
              onCheckedChange={setSavedOnly}
            />
            <ToggleRow
              label="Verified Chefs Only"
              hint="Creators with verified badge"
              checked={verifiedChefs}
              onCheckedChange={setVerifiedChefs}
            />

            {/* Sort */}
            <div className="space-y-2">
              <Label>Sort</Label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="h-9 rounded-md border bg-background px-2 text-sm w-full"
              >
                <option value="trending">Trending</option>
                <option value="newest">Newest</option>
                <option value="most_liked">Most Liked</option>
              </select>
            </div>
          </div>

          <SheetFooter className="mt-6">
            <div className="flex w-full items-center justify-between gap-2">
              <Button variant="ghost" onClick={resetAll}>
                Reset All
              </Button>
              <Button onClick={() => setIsFilterOpen(false)}>Apply Filters</Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ===== Sub-Components =====
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
  filterCount,
}: {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (value: string | null) => void;
  viewMode: "grid" | "list";
  setViewMode: (value: "grid" | "list") => void;
  sort: string;
  setSort: (value: string) => void;
  foundLabel: string;
  openFilters: () => void;
  diets: string[];
  setDiets: (value: string[]) => void;
  CATEGORIES: readonly string[];
  filterCount: number;
}) {
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
          {CATEGORIES.map((category) => {
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
                data-testid={`category-filter-${category.toLowerCase()}`}
              >
                {category}
              </Badge>
            );
          })}
        </div>

        {/* Popular diet chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {POPULAR_DIET_CHIPS.map((d) => {
            const active = diets.includes(d);
            return (
              <Badge
                key={d}
                variant={active ? "default" : "outline"}
                className="cursor-pointer shrink-0"
                onClick={() =>
                  active
                    ? setDiets(diets.filter((x) => x !== d))
                    : setDiets([...diets, d])
                }
                aria-pressed={active}
                title={`Diet: ${d}`}
                data-testid={`diet-chip-${d.toLowerCase()}`}
              >
                {d}
              </Badge>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 md:ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={openFilters}
            aria-label={`Open filters (${filterCount} active)`}
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filters {filterCount > 0 && `(${filterCount})`}
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
            aria-pressed={viewMode === "grid"}
            aria-label="Grid view (g)"
            title="Grid view (g)"
            data-testid="button-grid-view"
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
            data-testid="button-list-view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <p className="text-sm text-muted-foreground">{foundLabel}</p>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label="Sort posts"
        >
          <option value="trending">Trending</option>
          <option value="newest">Newest</option>
          <option value="most_liked">Most Liked</option>
        </select>
      </div>
    </div>
  );
}

function RangeRow({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  max: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-sm">
          {value[0]}–{value[1]} min
        </span>
      </div>
      <Slider
        value={value}
        min={0}
        max={max}
        step={5}
        onValueChange={(v) => onChange([v[0] ?? value[0], v[1] ?? value[1]])}
        className="w-full"
      />
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <Label className="text-sm">{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

function EmptyState({
  onClear,
  query,
  category,
}: {
  onClear: () => void;
  query: string;
  category: string | null;
}) {
  return (
    <div className="text-center py-16">
      <h3 className="text-lg font-semibold mb-2">No posts found</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        {query || (category && category !== "All")
          ? "Try adjusting your search terms or filters."
          : "Looks quiet here. Try searching for 'pasta', 'chicken', or 'vegan'."}
      </p>
      <Button onClick={onClear} className="mt-4" size="sm">
        Reset Filters
      </Button>
    </div>
  );
}
