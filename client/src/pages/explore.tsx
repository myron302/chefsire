// client/src/pages/explore.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";

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

/* =========================
   Ethnicity / Cultural Origin list (expanded)
   ========================= */
const ETHNICITIES = [
  // Africa & Diaspora
  "African","West African","East African","Central African","Southern African","North African",
  "Ethiopian/Eritrean","Nigerian","Ghanaian","Senegalese","Moroccan","Tunisian","Egyptian",
  "African American / African Diaspora","Afro-Caribbean","Caribbean","Jamaican","Trinidadian/Tobagonian","Haitian",
  // Middle East & North Africa
  "Middle Eastern","Levantine (Lebanon/Syria/Jordan/Palestine)","Gulf/Khaleeji","Persian/Iranian",
  // Europe
  "European","Mediterranean","Greek","Turkish","Italian","French","Spanish","Portuguese",
  "British/Irish","German","Nordic/Scandinavian","Eastern European","Balkan",
  // Asia
  "East Asian","Chinese","Japanese","Korean",
  "South Asian","Indian","Pakistani","Bangladeshi","Sri Lankan","Nepali",
  "Southeast Asian","Thai","Vietnamese","Filipino","Indonesian","Malaysian","Singaporean","Khmer (Cambodian)","Lao","Burmese/Myanmar",
  "Central Asian","Uzbek","Kazakh",
  // Pacific & Oceania
  "Pacific Islander","Hawaiian","Polynesian","Micronesian","Melanesian","Maori",
  // The Americas
  "Latinx","Mexican","Central American","South American","Andean","Brazilian","Argentine",
  // Indigenous & Jewish traditions
  "Indigenous / First Nations / Native American","Ashkenazi Jewish","Sephardi Jewish","Mizrahi Jewish",
  // Other
  "Fusion/Contemporary","Other",
];

/* =========================
   Safe helpers
   ========================= */
const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>
      <rect width='100%' height='100%' fill='#eee'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#999' font-family='sans-serif' font-size='20'>No image</text>
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
  return x && typeof x === "object";
}

/* =========================
   Hooks
   ========================= */
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
    } catch {
      // ignore
    }
  }, [key, val]);
  return [val, setVal] as const;
}

/* =========================
   Types & constants
   ========================= */
type ViewMode = "grid" | "list";
type SortMode = "trending" | "newest" | "most_liked";

interface FilterState {
  cuisines: string[];
  ethnicities: string[]; // NEW
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
  gfOnly: boolean; // force Gluten-Free into Diets
  lfOnly: boolean; // lactose-free toggle
  sort: SortMode;
}

const LIMIT = 18;
const CATEGORIES = ["All", "Italian", "Healthy", "Desserts", "Quick", "Vegan", "Seafood", "Asian"] as const;

function countActiveFilters(f: FilterState) {
  let n = 0;
  n += f.cuisines.length;
  n += f.ethnicities.length; // NEW
  n += f.diets.length + (f.gfOnly ? (f.diets.includes("Gluten-Free") ? 0 : 1) : 0);
  n += f.courses.length;
  n += f.difficulties.length;
  n += f.allergens.length;
  n += f.includeIngr.length;
  n += f.excludeIngr.length;
  n += f.prepRange[0] !== 0 || f.prepRange[1] !== 60 ? 1 : 0;
  n += f.cookRange[0] !== 0 || f.cookRange[1] !== 90 ? 1 : 0;
  n += f.maxCalories != null ? 1 : 0;
  n += f.savedOnly ? 1 : 0;
  n += f.verifiedChefs ? 1 : 0;
  n += f.lfOnly ? 1 : 0;
  return n;
}

/* =========================
   Page
   ========================= */
export default function Explore() {
  const { toast } = useToast();

  // basics
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useLocalStorage<string | null>("explore:selectedCategory", null);
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>("explore:viewMode", "grid");
  const [sort, setSort] = useLocalStorage<SortMode>("explore:sort", "trending");
  const debouncedQuery = useDebouncedValue(searchTerm.trim(), 350);

  // advanced filters
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [cuisines, setCuisines] = useLocalStorage<string[]>("explore:cuisines", []);
  const [ethnicities, setEthnicities] = useLocalStorage<string[]>("explore:ethnicities", []); // NEW
  const [diets, setDiets] = useLocalStorage<string[]>("explore:diets", []);
  const [courses, setCourses] = useLocalStorage<string[]>("explore:courses", []);
  const [difficulties, setDifficulties] = useLocalStorage<string[]>("explore:difficulties", []);
  const [allergens, setAllergens] = useLocalStorage<string[]>("explore:allergens", []);
  const [prepRange, setPrepRange] = useLocalStorage<[number, number]>("explore:prepRange", [0, 60]);
  const [cookRange, setCookRange] = useLocalStorage<[number, number]>("explore:cookRange", [0, 90]);
  const [maxCalories, setMaxCalories] = useLocalStorage<number | null>("explore:maxCalories", null);
  const [includeIngr, setIncludeIngr] = useLocalStorage<string[]>("explore:includeIngr", []);
  const [excludeIngr, setExcludeIngr] = useLocalStorage<string[]>("explore:excludeIngr", []);
  const [savedOnly, setSavedOnly] = useLocalStorage<boolean>("explore:savedOnly", false);
  const [verifiedChefs, setVerifiedChefs] = useLocalStorage<boolean>("explore:verifiedChefs", false);
  const [gfOnly, setGfOnly] = useLocalStorage<boolean>("explore:gfOnly", false);
  const [lfOnly, setLfOnly] = useLocalStorage<boolean>("explore:lfOnly", false);

  const filterCount = countActiveFilters({
    cuisines,
    ethnicities, // NEW
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
        ethnicities, // NEW
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
      if (selectedCategory && selectedCategory !== "All") params.set("category", selectedCategory);
      params.set("sort", sort);
      params.set("limit", String(LIMIT));
      if (pageParam) params.set("cursor", String(pageParam));

      cuisines.forEach((c) => params.append("cuisine", c));
      ethnicities.forEach((e) => params.append("ethnicity", e)); // NEW

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
      if (!res.ok) throw new Error(`Failed to load: ${res.status} ${res.statusText}`);
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    keepPreviousData: true,
  });

  // flatten + guard
  const allPosts = useMemo(
    () => data?.pages?.flatMap((p) => (Array.isArray(p?.items) ? p.items : [])).filter(isPostLike) ?? [],
    [data]
  );
  const total = data?.pages?.[0]?.total ?? allPosts.length;

  // infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "800px 0px 800px 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "g") setViewMode("grid");
      if (e.key === "l") setViewMode("list");
      if (e.key === "f") setIsFilterOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setViewMode]);

  const foundLabel =
    isFetching && !allPosts.length ? "Loading…" : `${total} ${total === 1 ? "post" : "posts"} found`;

  // reset (simple)
  const resetAll = useCallback(() => {
    setSelectedCategory(null);
    setSearchTerm("");
    setCuisines([]);
    setEthnicities([]); // NEW
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
    toast({ description: "Filters reset." });
  }, [
    toast,
    setSelectedCategory,
    setSearchTerm,
    setCuisines,
    setEthnicities, // NEW
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
  ]);
// client/src/pages/explore.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";

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

/* =========================
   Ethnicity / Cultural Origin list (expanded)
   ========================= */
const ETHNICITIES = [
  // Africa & Diaspora
  "African","West African","East African","Central African","Southern African","North African",
  "Ethiopian/Eritrean","Nigerian","Ghanaian","Senegalese","Moroccan","Tunisian","Egyptian",
  "African American / African Diaspora","Afro-Caribbean","Caribbean","Jamaican","Trinidadian/Tobagonian","Haitian",
  // Middle East & North Africa
  "Middle Eastern","Levantine (Lebanon/Syria/Jordan/Palestine)","Gulf/Khaleeji","Persian/Iranian",
  // Europe
  "European","Mediterranean","Greek","Turkish","Italian","French","Spanish","Portuguese",
  "British/Irish","German","Nordic/Scandinavian","Eastern European","Balkan",
  // Asia
  "East Asian","Chinese","Japanese","Korean",
  "South Asian","Indian","Pakistani","Bangladeshi","Sri Lankan","Nepali",
  "Southeast Asian","Thai","Vietnamese","Filipino","Indonesian","Malaysian","Singaporean","Khmer (Cambodian)","Lao","Burmese/Myanmar",
  "Central Asian","Uzbek","Kazakh",
  // Pacific & Oceania
  "Pacific Islander","Hawaiian","Polynesian","Micronesian","Melanesian","Maori",
  // The Americas
  "Latinx","Mexican","Central American","South American","Andean","Brazilian","Argentine",
  // Indigenous & Jewish traditions
  "Indigenous / First Nations / Native American","Ashkenazi Jewish","Sephardi Jewish","Mizrahi Jewish",
  // Other
  "Fusion/Contemporary","Other",
];

/* =========================
   Safe helpers
   ========================= */
const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>
      <rect width='100%' height='100%' fill='#eee'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#999' font-family='sans-serif' font-size='20'>No image</text>
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
  return x && typeof x === "object";
}

/* =========================
   Hooks
   ========================= */
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
    } catch {
      // ignore
    }
  }, [key, val]);
  return [val, setVal] as const;
}

/* =========================
   Types & constants
   ========================= */
type ViewMode = "grid" | "list";
type SortMode = "trending" | "newest" | "most_liked";

interface FilterState {
  cuisines: string[];
  ethnicities: string[]; // NEW
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
  gfOnly: boolean; // force Gluten-Free into Diets
  lfOnly: boolean; // lactose-free toggle
  sort: SortMode;
}

const LIMIT = 18;
const CATEGORIES = ["All", "Italian", "Healthy", "Desserts", "Quick", "Vegan", "Seafood", "Asian"] as const;

function countActiveFilters(f: FilterState) {
  let n = 0;
  n += f.cuisines.length;
  n += f.ethnicities.length; // NEW
  n += f.diets.length + (f.gfOnly ? (f.diets.includes("Gluten-Free") ? 0 : 1) : 0);
  n += f.courses.length;
  n += f.difficulties.length;
  n += f.allergens.length;
  n += f.includeIngr.length;
  n += f.excludeIngr.length;
  n += f.prepRange[0] !== 0 || f.prepRange[1] !== 60 ? 1 : 0;
  n += f.cookRange[0] !== 0 || f.cookRange[1] !== 90 ? 1 : 0;
  n += f.maxCalories != null ? 1 : 0;
  n += f.savedOnly ? 1 : 0;
  n += f.verifiedChefs ? 1 : 0;
  n += f.lfOnly ? 1 : 0;
  return n;
}

/* =========================
   Page
   ========================= */
export default function Explore() {
  const { toast } = useToast();

  // basics
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useLocalStorage<string | null>("explore:selectedCategory", null);
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>("explore:viewMode", "grid");
  const [sort, setSort] = useLocalStorage<SortMode>("explore:sort", "trending");
  const debouncedQuery = useDebouncedValue(searchTerm.trim(), 350);

  // advanced filters
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [cuisines, setCuisines] = useLocalStorage<string[]>("explore:cuisines", []);
  const [ethnicities, setEthnicities] = useLocalStorage<string[]>("explore:ethnicities", []); // NEW
  const [diets, setDiets] = useLocalStorage<string[]>("explore:diets", []);
  const [courses, setCourses] = useLocalStorage<string[]>("explore:courses", []);
  const [difficulties, setDifficulties] = useLocalStorage<string[]>("explore:difficulties", []);
  const [allergens, setAllergens] = useLocalStorage<string[]>("explore:allergens", []);
  const [prepRange, setPrepRange] = useLocalStorage<[number, number]>("explore:prepRange", [0, 60]);
  const [cookRange, setCookRange] = useLocalStorage<[number, number]>("explore:cookRange", [0, 90]);
  const [maxCalories, setMaxCalories] = useLocalStorage<number | null>("explore:maxCalories", null);
  const [includeIngr, setIncludeIngr] = useLocalStorage<string[]>("explore:includeIngr", []);
  const [excludeIngr, setExcludeIngr] = useLocalStorage<string[]>("explore:excludeIngr", []);
  const [savedOnly, setSavedOnly] = useLocalStorage<boolean>("explore:savedOnly", false);
  const [verifiedChefs, setVerifiedChefs] = useLocalStorage<boolean>("explore:verifiedChefs", false);
  const [gfOnly, setGfOnly] = useLocalStorage<boolean>("explore:gfOnly", false);
  const [lfOnly, setLfOnly] = useLocalStorage<boolean>("explore:lfOnly", false);

  const filterCount = countActiveFilters({
    cuisines,
    ethnicities, // NEW
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
        ethnicities, // NEW
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
      if (selectedCategory && selectedCategory !== "All") params.set("category", selectedCategory);
      params.set("sort", sort);
      params.set("limit", String(LIMIT));
      if (pageParam) params.set("cursor", String(pageParam));

      cuisines.forEach((c) => params.append("cuisine", c));
      ethnicities.forEach((e) => params.append("ethnicity", e)); // NEW

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
      if (!res.ok) throw new Error(`Failed to load: ${res.status} ${res.statusText}`);
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    keepPreviousData: true,
  });

  // flatten + guard
  const allPosts = useMemo(
    () => data?.pages?.flatMap((p) => (Array.isArray(p?.items) ? p.items : [])).filter(isPostLike) ?? [],
    [data]
  );
  const total = data?.pages?.[0]?.total ?? allPosts.length;

  // infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "800px 0px 800px 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "g") setViewMode("grid");
      if (e.key === "l") setViewMode("list");
      if (e.key === "f") setIsFilterOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setViewMode]);

  const foundLabel =
    isFetching && !allPosts.length ? "Loading…" : `${total} ${total === 1 ? "post" : "posts"} found`;

  // reset (simple)
  const resetAll = useCallback(() => {
    setSelectedCategory(null);
    setSearchTerm("");
    setCuisines([]);
    setEthnicities([]); // NEW
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
    toast({ description: "Filters reset." });
  }, [
    toast,
    setSelectedCategory,
    setSearchTerm,
    setCuisines,
    setEthnicities, // NEW
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
  ]);
