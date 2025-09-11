// client/src/pages/explore.tsx
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { LayoutGrid, List, Filter, X } from "lucide-react";

/** -------------------------------
 * Types + demo data (replace later)
 * -------------------------------- */
type ViewMode = "grid" | "list";
type Difficulty = "Easy" | "Medium" | "Hard";
type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Dessert";
type Dietary = "Vegan" | "Vegetarian" | "Gluten-Free" | "Dairy-Free" | "Keto";

// NEW: add ethnicity + allergens fields for filtering
type Post = {
  id: string;
  title: string;
  image: string;
  cuisine: string;
  isRecipe: boolean;
  author: string;
  cookTime: number; // minutes
  difficulty: Difficulty;
  rating: number; // 0..5 (spoons)
  likes: number;
  mealType: MealType;
  dietary: Dietary[];
  ethnicity: string[];       // NEW
  allergens: string[];       // NEW
  createdAt: string; // ISO date
};

const CUISINES = [
  "Asian",
  "BBQ",
  "Breakfast",
  "Burgers",
  "Desserts",
  "Healthy",
  "Italian",
  "Mediterranean",
  "Mexican",
  "Quick",
  "Salads",
  "Seafood",
  "Vegan",
];

const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"];
const DIETARY: Dietary[] = ["Dairy-Free", "Gluten-Free", "Keto", "Vegan", "Vegetarian"];
const DIFFICULTY: Difficulty[] = ["Easy", "Medium", "Hard"];

// utils
const sortAlpha = (xs: string[]) => [...xs].sort((a, b) => a.localeCompare(b));

// Spoon icon (simple, lightweight)
function SpoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}>
      <path
        d="M12.5 2c2.485 0 4 1.79 4 4.25 0 1.9-1.12 3.64-2.79 4.21l-.21.07V14a3.5 3.5 0 0 1-2 3.16V22a1 1 0 1 1-2 0v-4.84A3.5 3.5 0 0 1 7.5 14V10.5l-.21-.07C5.6 9.89 4.5 8.15 4.5 6.25 4.5 3.79 6.015 2 8.5 2c1.33 0 2.53.6 3.25 1.55A4.18 4.18 0 0 1 12.5 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

// NEW: Ethnicity / Cultural Origin grouped + alphabetized
const ETHNICITY_GROUPS: { label: string; options: string[] }[] = [
  {
    label: "Africa & Diaspora",
    options: sortAlpha([
      "African",
      "Afro-Caribbean",
      "Caribbean",
      "Central African",
      "East African",
      "Egyptian",
      "Ethiopian/Eritrean",
      "Ghanaian",
      "Haitian",
      "Jamaican",
      "Moroccan",
      "Nigerian",
      "North African",
      "Senegalese",
      "Southern African",
      "Trinidadian/Tobagonian",
      "Tunisian",
      "West African",
    ]),
  },
  {
    label: "Middle East",
    options: sortAlpha([
      "Gulf/Khaleeji",
      "Levantine",
      "Middle Eastern",
      "Persian/Iranian",
      "Turkish",
    ]),
  },
  {
    label: "Europe",
    options: sortAlpha([
      "Balkan",
      "British/Irish",
      "Eastern European",
      "European",
      "French",
      "German",
      "Greek",
      "Italian",
      "Mediterranean",
      "Nordic/Scandinavian",
      "Portuguese",
      "Spanish",
    ]),
  },
  {
    label: "Asia — East",
    options: sortAlpha(["Chinese", "East Asian", "Japanese", "Korean"]),
  },
  {
    label: "Asia — South",
    options: sortAlpha([
      "Bangladeshi",
      "Indian",
      "Nepali",
      "Pakistani",
      "South Asian",
      "Sri Lankan",
    ]),
  },
  {
    label: "Asia — Southeast",
    options: sortAlpha([
      "Burmese/Myanmar",
      "Cambodian",
      "Filipino",
      "Indonesian",
      "Lao",
      "Malaysian",
      "Singaporean",
      "Southeast Asian",
      "Thai",
      "Vietnamese",
    ]),
  },
  {
    label: "Asia — Central",
    options: sortAlpha(["Central Asian", "Kazakh", "Uzbek"]),
  },
  {
    label: "Pacific & Oceania",
    options: sortAlpha([
      "Hawaiian",
      "Maori",
      "Melanesian",
      "Micronesian",
      "Pacific Islander",
      "Polynesian",
    ]),
  },
  {
    label: "The Americas",
    options: sortAlpha([
      "Argentine",
      "Brazilian",
      "Central American",
      "Latinx",
      "Mexican",
      "South American",
    ]),
  },
  {
    label: "Jewish Traditions",
    options: sortAlpha(["Ashkenazi Jewish", "Mizrahi Jewish", "Sephardi Jewish"]),
  },
  {
    label: "Indigenous & Other",
    options: sortAlpha([
      "Indigenous / First Nations / Native American",
      "Fusion/Contemporary",
      "Other",
    ]),
  },
];

// NEW: Common allergens (used for exclusion) — alphabetized
const ALLERGENS = sortAlpha([
  "Celery",
  "Dairy",
  "Eggs",
  "Fish",
  "Gluten",
  "Lupin",
  "Mustard",
  "Peanuts",
  "Sesame",
  "Shellfish",
  "Soy",
  "Sulfites",
  "Tree Nuts",
  "Wheat",
]);

const DEMO_POSTS: Post[] = [
  {
    id: "1",
    title: "Margherita Pizza",
    image: "https://images.unsplash.com/photo-1548365328-8b84986da7b3?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Italian",
    isRecipe: true,
    author: "Giulia",
    cookTime: 25,
    difficulty: "Easy",
    rating: 4.7,
    likes: 223,
    mealType: "Dinner",
    dietary: ["Vegetarian"],
    ethnicity: ["Italian", "Mediterranean"],
    allergens: ["Gluten", "Dairy"],
    createdAt: "2025-09-08T12:00:00Z",
  },
  {
    id: "2",
    title: "Rainbow Salad",
    image: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Healthy",
    isRecipe: false,
    author: "Ava",
    cookTime: 10,
    difficulty: "Easy",
    rating: 4.2,
    likes: 150,
    mealType: "Lunch",
    dietary: ["Vegan", "Gluten-Free"],
    ethnicity: ["Fusion/Contemporary"],
    allergens: [],
    createdAt: "2025-09-07T10:00:00Z",
  },
  {
    id: "3",
    title: "Choco Truffles",
    image: "https://images.unsplash.com/photo-1541781286675-09c7e9d404bc?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Desserts",
    isRecipe: true,
    author: "Noah",
    cookTime: 45,
    difficulty: "Medium",
    rating: 4.9,
    likes: 512,
    mealType: "Dessert",
    dietary: ["Vegetarian"],
    ethnicity: ["French", "European"],
    allergens: ["Dairy"],
    createdAt: "2025-09-05T18:30:00Z",
  },
  {
    id: "4",
    title: "Spicy Ramen",
    image: "https://images.unsplash.com/photo-1546549039-49cc4f5b3c89?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Asian",
    isRecipe: true,
    author: "Rin",
    cookTime: 30,
    difficulty: "Medium",
    rating: 4.5,
    likes: 340,
    mealType: "Dinner",
    dietary: [],
    ethnicity: ["Japanese", "East Asian"],
    allergens: ["Gluten", "Eggs", "Soy"],
    createdAt: "2025-09-03T21:15:00Z",
  },
  {
    id: "5",
    title: "BBQ Brisket",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop",
    cuisine: "BBQ",
    isRecipe: false,
    author: "Mason",
    cookTime: 240,
    difficulty: "Hard",
    rating: 4.1,
    likes: 98,
    mealType: "Dinner",
    dietary: [],
    ethnicity: ["American", "Fusion/Contemporary"],
    allergens: [],
    createdAt: "2025-09-09T14:45:00Z",
  },
  {
    id: "6",
    title: "Avocado Toast",
    image: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Breakfast",
    isRecipe: true,
    author: "Ivy",
    cookTime: 8,
    difficulty: "Easy",
    rating: 4.0,
    likes: 77,
    mealType: "Breakfast",
    dietary: ["Vegetarian"],
    ethnicity: ["British/Irish", "Fusion/Contemporary"],
    allergens: ["Gluten"],
    createdAt: "2025-09-10T08:05:00Z",
  },
];

/** -------------------------------
 * Explore Page
 * -------------------------------- */
export default function Explore() {
  // view + main toggles
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [onlyRecipes, setOnlyRecipes] = React.useState(false);

  // filters
  const [selectedCuisines, setSelectedCuisines] = React.useState<string[]>([]);
  const [selectedMealTypes, setSelectedMealTypes] = React.useState<MealType[]>([]);
  const [selectedDietary, setSelectedDietary] = React.useState<Dietary[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = React.useState<Difficulty | "">("");
  const [maxCookTime, setMaxCookTime] = React.useState<number>(60); // minutes
  const [minRating, setMinRating] = React.useState<number>(0);
  const [sortBy, setSortBy] = React.useState<"newest" | "rating" | "likes">("newest");

  // NEW: Ethnicity + Allergen filters
  const [selectedEthnicities, setSelectedEthnicities] = React.useState<string[]>([]);
  const [excludedAllergens, setExcludedAllergens] = React.useState<string[]>([]);

  // TODO: swap DEMO_POSTS with your fetched data
  const posts = DEMO_POSTS;

  const filteredPosts = React.useMemo(() => {
    const filtered = posts.filter((p) => {
      if (onlyRecipes && !p.isRecipe) return false;
      if (selectedCuisines.length && !selectedCuisines.includes(p.cuisine)) return false;
      if (selectedMealTypes.length && !selectedMealTypes.includes(p.mealType)) return false;
      if (selectedDietary.length && !selectedDietary.every((d) => p.dietary.includes(d))) return false; // must include all selected dietaries
      if (selectedDifficulty && p.difficulty !== selectedDifficulty) return false;
      if (maxCookTime && p.cookTime > maxCookTime) return false;
      if (minRating && p.rating < minRating) return false;

      // NEW: Ethnicity — require at least one overlap
      if (selectedEthnicities.length) {
        const hasEthnicity = p.ethnicity?.some((e) => selectedEthnicities.includes(e));
        if (!hasEthnicity) return false;
      }

      // NEW: Exclude allergens — reject if any intersection
      if (excludedAllergens.length) {
        const hasExcluded = p.allergens?.some((a) => excludedAllergens.includes(a));
        if (hasExcluded) return false;
      }

      return true;
    });

    switch (sortBy) {
      case "rating":
        return [...filtered].sort((a, b) => b.rating - a.rating);
      case "likes":
        return [...filtered].sort((a, b) => b.likes - a.likes);
      default:
        return [...filtered].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
  }, [
    posts,
    onlyRecipes,
    selectedCuisines,
    selectedMealTypes,
    selectedDietary,
    selectedDifficulty,
    maxCookTime,
    minRating,
    sortBy,
    selectedEthnicities,
    excludedAllergens,
  ]);

  function resetFilters() {
    setSelectedCuisines([]);
    setSelectedMealTypes([]);
    setSelectedDietary([]);
    setSelectedDifficulty("");
    setMaxCookTime(60);
    setMinRating(0);
    setOnlyRecipes(false);
    setSortBy("newest");
    setSelectedEthnicities([]);
    setExcludedAllergens([]);
    // keep current viewMode
  }

  return (
    <div className="mx-auto max-w-6xl md:grid md:grid-cols-[18rem_1fr] gap-6 px-4 md:px-6">
      {/* Desktop sidebar (no dropdowns, scrollable) */}
      <DesktopFiltersSidebar
        selectedCuisines={selectedCuisines}
        setSelectedCuisines={setSelectedCuisines}
        selectedMealTypes={selectedMealTypes}
        setSelectedMealTypes={setSelectedMealTypes}
        selectedDietary={selectedDietary}
        setSelectedDietary={setSelectedDietary}
        selectedDifficulty={selectedDifficulty}
        setSelectedDifficulty={setSelectedDifficulty}
        maxCookTime={maxCookTime}
        setMaxCookTime={setMaxCookTime}
        minRating={minRating}
        setMinRating={setMinRating}
        onlyRecipes={onlyRecipes}
        setOnlyRecipes={setOnlyRecipes}
        sortBy={sortBy}
        setSortBy={setSortBy}
        // NEW
        selectedEthnicities={selectedEthnicities}
        setSelectedEthnicities={setSelectedEthnicities}
        excludedAllergens={excludedAllergens}
        setExcludedAllergens={setExcludedAllergens}
        onReset={resetFilters}
      />

      {/* Main content */}
      <main className="min-w-0">
        {/* Mobile controls row */}
        <div className="md:hidden mb-3 flex items-center justify-between gap-2">
          <MobileFiltersSheet
            selectedCuisines={selectedCuisines}
            setSelectedCuisines={setSelectedCuisines}
            selectedMealTypes={selectedMealTypes}
            setSelectedMealTypes={setSelectedMealTypes}
            selectedDietary={selectedDietary}
            setSelectedDietary={setSelectedDietary}
            selectedDifficulty={selectedDifficulty}
            setSelectedDifficulty={setSelectedDifficulty}
            maxCookTime={maxCookTime}
            setMaxCookTime={setMaxCookTime}
            minRating={minRating}
            setMinRating={setMinRating}
            onlyRecipes={onlyRecipes}
            setOnlyRecipes={setOnlyRecipes}
            sortBy={sortBy}
            setSortBy={setSortBy}
            // NEW
            selectedEthnicities={selectedEthnicities}
            setSelectedEthnicities={setSelectedEthnicities}
            excludedAllergens={excludedAllergens}
            setExcludedAllergens={setExcludedAllergens}
            onReset={resetFilters}
          />
          <div className="flex gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              onClick={() => setViewMode("grid")}
              className="gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              onClick={() => setViewMode("list")}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              List
            </Button>
          </div>
        </div>

        {/* Active filter count */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Cuisines: {selectedCuisines.length}</Badge>
          <Badge variant="outline">Meal Types: {selectedMealTypes.length}</Badge>
          <Badge variant="outline">Dietary: {selectedDietary.length}</Badge>
          <Badge variant="outline">Ethnicity: {selectedEthnicities.length}</Badge>
          <Badge variant="outline">No {excludedAllergens.length ? excludedAllergens.join(", ") : "—"}</Badge>
          {selectedDifficulty && <Badge variant="outline">Difficulty: {selectedDifficulty}</Badge>}
          {onlyRecipes && <Badge variant="outline">Recipe-only</Badge>}
          <Badge variant="outline">≤ {maxCookTime} min</Badge>
          <Badge variant="outline">
            <span className="inline-flex items-center gap-1">
              <SpoonIcon className="h-3.5 w-3.5" /> {minRating}+
            </span>
          </Badge>
          <Badge variant="outline">Sort: {sortBy}</Badge>
          {(selectedCuisines.length ||
            selectedMealTypes.length ||
            selectedDietary.length ||
            selectedEthnicities.length ||
            excludedAllergens.length ||
            selectedDifficulty ||
            onlyRecipes ||
            minRating ||
            maxCookTime !== 60 ||
            sortBy !== "newest") && (
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>

        {/* Results */}
        {filteredPosts.length === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredPosts.map((p) => (
              <GridCard key={p.id} post={p} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map((p) => (
              <ListRow key={p.id} post={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/** -------------------------------
 * Desktop sidebar (sticky, scrollable)
 * -------------------------------- */
function DesktopFiltersSidebar(props: {
  selectedCuisines: string[];
  setSelectedCuisines: (v: string[]) => void;
  selectedMealTypes: MealType[];
  setSelectedMealTypes: (v: MealType[]) => void;
  selectedDietary: Dietary[];
  setSelectedDietary: (v: Dietary[]) => void;
  selectedDifficulty: Difficulty | "";
  setSelectedDifficulty: (v: Difficulty | "") => void;
  maxCookTime: number;
  setMaxCookTime: (v: number) => void;
  minRating: number;
  setMinRating: (v: number) => void;
  onlyRecipes: boolean;
  setOnlyRecipes: (v: boolean) => void;
  sortBy: "newest" | "rating" | "likes";
  setSortBy: (v: "newest" | "rating" | "likes") => void;
  // NEW:
  selectedEthnicities: string[];
  setSelectedEthnicities: (v: string[]) => void;
  excludedAllergens: string[];
  setExcludedAllergens: (v: string[]) => void;
  onReset: () => void;
}) {
  const {
    selectedCuisines,
    setSelectedCuisines,
    selectedMealTypes,
    setSelectedMealTypes,
    selectedDietary,
    setSelectedDietary,
    selectedDifficulty,
    setSelectedDifficulty,
    maxCookTime,
    setMaxCookTime,
    minRating,
    setMinRating,
    onlyRecipes,
    setOnlyRecipes,
    sortBy,
    setSortBy,
    // NEW
    selectedEthnicities,
    setSelectedEthnicities,
    excludedAllergens,
    setExcludedAllergens,
    onReset,
  } = props;

  const toggleFromArray = <T extends string>(arr: T[], setArr: (v: T[]) => void, value: T) => {
    setArr(arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);
  };

  return (
    <aside className="hidden md:block w-72 shrink-0">
      <div className="sticky top-20 space-y-5">
        {/* Cuisines */}
        <FilterSection title="Cuisines">
          <div
            className="grid grid-cols-1 gap-2 max-h-[28rem] overflow-y-auto pr-1"
            style={{ WebkitOverflowScrolling: "touch" as any }}
          >
            {sortAlpha(CUISINES).map((c) => (
              <label key={c} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedCuisines.includes(c)}
                  onCheckedChange={() =>
                    toggleFromArray(selectedCuisines, setSelectedCuisines, c)
                  }
                />
                <span className="text-sm">{c}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* NEW: Ethnicity / Cultural Origin (grouped) */}
        <FilterSection title="Ethnicity / Cultural Origin">
          <div className="space-y-4">
            {ETHNICITY_GROUPS.map((group) => (
              <div key={group.label}>
                <h5 className="mb-2 text-xs font-medium text-muted-foreground">
                  {group.label}
                </h5>
                <div
                  className="grid grid-cols-1 gap-2 max-h-[12rem] overflow-y-auto pr-1"
                  style={{ WebkitOverflowScrolling: "touch" as any }}
                >
                  {group.options.map((e) => (
                    <label key={e} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedEthnicities.includes(e)}
                        onCheckedChange={() =>
                          toggleFromArray(selectedEthnicities, setSelectedEthnicities, e)
                        }
                      />
                      <span className="text-sm">{e}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </FilterSection>

        {/* Meal type */}
        <FilterSection title="Meal Type">
          <div className="grid grid-cols-2 gap-2">
            {MEAL_TYPES.map((m) => (
              <label key={m} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedMealTypes.includes(m)}
                  onCheckedChange={() => toggleFromArray(selectedMealTypes, setSelectedMealTypes, m)}
                />
                <span className="text-sm">{m}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Dietary */}
        <FilterSection title="Dietary">
          <div className="grid grid-cols-2 gap-2">
            {DIETARY.map((d) => (
              <label key={d} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedDietary.includes(d)}
                  onCheckedChange={() => toggleFromArray(selectedDietary, setSelectedDietary, d)}
                />
                <span className="text-sm">{d}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* NEW: Exclude Allergens */}
        <FilterSection title="Exclude Allergens">
          <div className="grid grid-cols-2 gap-2">
            {ALLERGENS.map((a) => (
              <label key={a} className="flex items-center gap-2">
                <Checkbox
                  checked={excludedAllergens.includes(a)}
                  onCheckedChange={() => toggleFromArray(excludedAllergens, setExcludedAllergens, a)}
                />
                <span className="text-sm">{a}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Difficulty */}
        <FilterSection title="Difficulty">
          <div className="flex flex-wrap gap-2">
            {DIFFICULTY.map((d) => (
              <Button
                key={d}
                size="sm"
                variant={selectedDifficulty === d ? "default" : "outline"}
                onClick={() => setSelectedDifficulty(selectedDifficulty === d ? "" : d)}
              >
                {d}
              </Button>
            ))}
          </div>
        </FilterSection>

        {/* Max cook time */}
        <FilterSection title={`Max Cook Time: ${maxCookTime} min`}>
          <Slider
            value={[maxCookTime]}
            min={5}
            max={240}
            step={5}
            onValueChange={(v) => setMaxCookTime(v[0] ?? 60)}
          />
        </FilterSection>

        {/* Min spoons (rating) */}
        <FilterSection title={`Min Spoons: ${minRating || 0}`}>
          <SpoonSelect value={minRating} onChange={setMinRating} />
        </FilterSection>

        {/* Flags & sort */}
        <FilterSection title="More">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={onlyRecipes}
              onCheckedChange={(v) => setOnlyRecipes(Boolean(v))}
            />
            <span className="text-sm">Show recipe posts only</span>
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {(["newest", "rating", "likes"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={sortBy === s ? "default" : "outline"}
                onClick={() => setSortBy(s)}
              >
                {s === "newest" ? "Newest" : s === "rating" ? "Top Spoons" : "Most Liked"}
              </Button>
            ))}
          </div>
        </FilterSection>

        <div className="pt-2">
          <Button variant="secondary" onClick={onReset} className="w-full">
            Reset filters
          </Button>
        </div>
      </div>
    </aside>
  );
}

/** -------------------------------
 * Mobile sheet (scrollable, one X)
 * -------------------------------- */
function MobileFiltersSheet(props: {
  selectedCuisines: string[];
  setSelectedCuisines: (v: string[]) => void;
  selectedMealTypes: MealType[];
  setSelectedMealTypes: (v: MealType[]) => void;
  selectedDietary: Dietary[];
  setSelectedDietary: (v: Dietary[]) => void;
  selectedDifficulty: Difficulty | "";
  setSelectedDifficulty: (v: Difficulty | "") => void;
  maxCookTime: number;
  setMaxCookTime: (v: number) => void;
  minRating: number;
  setMinRating: (v: number) => void;
  onlyRecipes: boolean;
  setOnlyRecipes: (v: boolean) => void;
  sortBy: "newest" | "rating" | "likes";
  setSortBy: (v: "newest" | "rating" | "likes") => void;
  // NEW:
  selectedEthnicities: string[];
  setSelectedEthnicities: (v: string[]) => void;
  excludedAllergens: string[];
  setExcludedAllergens: (v: string[]) => void;
  onReset: () => void;
}) {
  const {
    selectedCuisines,
    setSelectedCuisines,
    selectedMealTypes,
    setSelectedMealTypes,
    selectedDietary,
    setSelectedDietary,
    selectedDifficulty,
    setSelectedDifficulty,
    maxCookTime,
    setMaxCookTime,
    minRating,
    setMinRating,
    onlyRecipes,
    setOnlyRecipes,
    sortBy,
    setSortBy,
    // NEW
    selectedEthnicities,
    setSelectedEthnicities,
    excludedAllergens,
    setExcludedAllergens,
    onReset,
  } = props;

  const [open, setOpen] = React.useState(false);

  const toggleFromArray = <T extends string>(arr: T[], setArr: (v: T[]) => void, value: T) => {
    setArr(arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {(selectedCuisines.length +
            selectedMealTypes.length +
            selectedDietary.length +
            selectedEthnicities.length +
            excludedAllergens.length +
            (selectedDifficulty ? 1 : 0) +
            (onlyRecipes ? 1 : 0) +
            (minRating ? 1 : 0) +
            (maxCookTime !== 60 ? 1 : 0) +
            (sortBy !== "newest" ? 1 : 0)) > 0 && (
            <Badge variant="secondary" className="ml-2">
              {[
                selectedCuisines.length > 0,
                selectedMealTypes.length > 0,
                selectedDietary.length > 0,
                selectedEthnicities.length > 0,
                excludedAllergens.length > 0,
                Boolean(selectedDifficulty),
                onlyRecipes,
                Boolean(minRating),
                maxCookTime !== 60,
                sortBy !== "newest",
              ].filter(Boolean).length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[88dvh] p-0">
        {/* ONE close button */}
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>Filters</SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <div
          className="
            overflow-y-auto
            max-h-[calc(88dvh-56px-72px)]
            p-4
            touch-pan-y
            overscroll-contain
            space-y-6
          "
          style={{ WebkitOverflowScrolling: "touch" as any }}
        >
          <FilterSection title="Cuisines">
            <div className="grid grid-cols-2 gap-2">
              {sortAlpha(CUISINES).map((c) => (
                <label key={c} className="flex items-center gap-2 rounded-md border p-2">
                  <Checkbox
                    checked={selectedCuisines.includes(c)}
                    onCheckedChange={() => toggleFromArray(selectedCuisines, setSelectedCuisines, c)}
                  />
                  <span className="text-sm">{c}</span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* NEW: Ethnicity / Cultural Origin (grouped) */}
          <FilterSection title="Ethnicity / Cultural Origin">
            <div className="space-y-5">
              {ETHNICITY_GROUPS.map((group) => (
                <div key={group.label}>
                  <h5 className="mb-2 text-xs font-medium text-muted-foreground">{group.label}</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {group.options.map((e) => (
                      <label key={e} className="flex items-center gap-2 rounded-md border p-2">
                        <Checkbox
                          checked={selectedEthnicities.includes(e)}
                          onCheckedChange={() =>
                            toggleFromArray(selectedEthnicities, setSelectedEthnicities, e)
                          }
                        />
                        <span className="text-sm">{e}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Meal Type">
            <div className="grid grid-cols-2 gap-2">
              {MEAL_TYPES.map((m) => (
                <label key={m} className="flex items-center gap-2 rounded-md border p-2">
                  <Checkbox
                    checked={selectedMealTypes.includes(m)}
                    onCheckedChange={() => toggleFromArray(selectedMealTypes, setSelectedMealTypes, m)}
                  />
                  <span className="text-sm">{m}</span>
                </label>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Dietary">
            <div className="grid grid-cols-2 gap-2">
              {DIETARY.map((d) => (
                <label key={d} className="flex items-center gap-2 rounded-md border p-2">
                  <Checkbox
                    checked={selectedDietary.includes(d)}
                    onCheckedChange={() => toggleFromArray(selectedDietary, setSelectedDietary, d)}
                  />
                  <span className="text-sm">{d}</span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* NEW: Exclude Allergens */}
          <FilterSection title="Exclude Allergens">
            <div className="grid grid-cols-2 gap-2">
              {ALLERGENS.map((a) => (
                <label key={a} className="flex items-center gap-2 rounded-md border p-2">
                  <Checkbox
                    checked={excludedAllergens.includes(a)}
                    onCheckedChange={() => toggleFromArray(excludedAllergens, setExcludedAllergens, a)}
                  />
                  <span className="text-sm">{a}</span>
                </label>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Difficulty">
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY.map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={selectedDifficulty === d ? "default" : "outline"}
                  onClick={() => setSelectedDifficulty(selectedDifficulty === d ? "" : d)}
                >
                  {d}
                </Button>
              ))}
            </div>
          </FilterSection>

          <FilterSection title={`Max Cook Time: ${maxCookTime} min`}>
            <Slider
              value={[maxCookTime]}
              min={5}
              max={240}
              step={5}
              onValueChange={(v) => setMaxCookTime(v[0] ?? 60)}
            />
          </FilterSection>

          {/* Min spoons (rating) */}
          <FilterSection title={`Min Spoons: ${minRating || 0}`}>
            <SpoonSelect value={minRating} onChange={setMinRating} />
          </FilterSection>

          <FilterSection title="More">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={onlyRecipes}
                onCheckedChange={(v) => setOnlyRecipes(Boolean(v))}
              />
              <span className="text-sm">Show recipe posts only</span>
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              {(["newest", "rating", "likes"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={sortBy === s ? "default" : "outline"}
                  onClick={() => setSortBy(s)}
                >
                  {s === "newest" ? "Newest" : s === "rating" ? "Top Spoons" : "Most Liked"}
                </Button>
              ))}
            </div>
          </FilterSection>
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 border-t bg-background p-4">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onReset} className="flex-1">
              Reset
            </Button>
            <SheetClose asChild>
              <Button className="flex-1">Apply</Button>
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** -------------------------------
 * Little utilities
 * -------------------------------- */
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-sm font-medium">{title}</h4>
      {children}
    </section>
  );
}

// Star → Spoon selector
function SpoonSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="p-1"
          aria-label={`${n} spoons & up`}
          onClick={() => onChange(n === value ? 0 : n)}
          title={`${n} spoons & up`}
        >
          <SpoonIcon className={`h-5 w-5 ${value >= n ? "" : "opacity-30"}`} />
        </button>
      ))}
      <Button size="sm" variant="ghost" className="ml-1 h-7 px-2" onClick={() => onChange(0)}>
        Clear
      </Button>
    </div>
  );
}

/** -------------------------------
 * Cards & empty state
 * -------------------------------- */
function GridCard({ post }: { post: Post }) {
  return (
    <article className="overflow-hidden rounded-lg border bg-card">
      <div className="aspect-square overflow-hidden">
        <img
          src={post.image}
          alt={post.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-semibold">{post.title}</h3>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{post.author}</span>
          <Badge variant="outline" className="text-xs">
            {post.cuisine}
          </Badge>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <SpoonIcon className="h-3.5 w-3.5" /> {post.rating.toFixed(1)}
          </span>
          <span>{post.cookTime} min</span>
        </div>
        {post.isRecipe && (
          <span className="mt-2 inline-block text-[10px] uppercase tracking-wide text-emerald-600">
            Recipe
          </span>
        )}
      </div>
    </article>
  );
}

function ListRow({ post }: { post: Post }) {
  return (
    <article className="flex gap-3 rounded-lg border bg-card p-2">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md">
        <img
          src={post.image}
          alt={post.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-sm font-semibold">{post.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>by {post.author}</span>
          <span>• {post.cuisine}</span>
          <span>• {post.mealType}</span>
          {post.dietary.length > 0 && <span>• {post.dietary.join(", ")}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <SpoonIcon className="h-3.5 w-3.5" /> {post.rating.toFixed(1)}
          </span>
          <span>{post.cookTime} min</span>
          <span>{post.difficulty}</span>
          {post.isRecipe && <span className="text-emerald-600">Recipe</span>}
        </div>
      </div>
    </article>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
      <p className="text-sm text-muted-foreground">No posts match these filters.</p>
      <Button className="mt-3" variant="secondary" onClick={onReset}>
        Reset filters
      </Button>
    </div>
  );
}
