import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useRecipesFilters } from "./useRecipesFilters";
import { SpoonIcon } from "./RecipesShared";

type RegionGroup = { region: string; items: string[] };
const sortAlpha = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

const ETHNICITY_REGIONS: RegionGroup[] = [
  {
    region: "Africa & Diaspora",
    items: [
      "African (General)",
      "Central African",
      "East African",
      "Ethiopian",
      "Eritrean",
      "Somali",
      "Kenyan",
      "Tanzanian",
      "Ugandan",
      "North African",
      "Moroccan",
      "Algerian",
      "Tunisian",
      "Egyptian",
      "Libyan",
      "Southern African",
      "South African",
      "West African",
      "Nigerian",
      "Ghanaian",
      "Ivorian",
      "Senegalese",
      "Cameroonian",
      "Congolese",
      "Afro-Caribbean",
      "African American / African Diaspora",
    ].sort(sortAlpha),
  },
  {
    region: "Middle East & North Africa",
    items: [
      "Middle Eastern (General)",
      "Levantine (Palestinian/Lebanese/Syrian/Jordanian)",
      "Israeli",
      "Turkish",
      "Kurdish",
      "Armenian",
      "Persian (Iranian)",
      "Gulf (Khaleeji)",
      "Yemeni",
    ].sort(sortAlpha),
  },
  {
    region: "South Asia",
    items: [
      "South Asian (General)",
      "Indian (Punjabi)",
      "Indian (Tamil)",
      "Gujarati",
      "Rajasthani",
      "Bengali",
      "Hyderabadi",
      "Goan",
      "Maharashtrian",
      "Kashmiri",
      "Pakistani",
      "Bangladeshi",
      "Sri Lankan",
      "Nepali",
    ].sort(sortAlpha),
  },
  {
    region: "East Asia",
    items: [
      "East Asian (General)",
      "Chinese (Cantonese)",
      "Chinese (Sichuan)",
      "Chinese (Hunan)",
      "Chinese (Shandong)",
      "Taiwanese",
      "Japanese",
      "Korean",
      "Mongolian",
    ].sort(sortAlpha),
  },
  {
    region: "Southeast Asia",
    items: [
      "Southeast Asian (General)",
      "Thai",
      "Vietnamese",
      "Filipino",
      "Malaysian",
      "Indonesian",
      "Singaporean",
      "Khmer (Cambodian)",
      "Lao",
      "Burmese/Myanmar",
    ].sort(sortAlpha),
  },
  {
    region: "Central Asia",
    items: ["Central Asian (General)", "Uzbek", "Kazakh", "Uyghur"].sort(sortAlpha),
  },
  {
    region: "Europe",
    items: [
      "European (General)",
      "Mediterranean",
      "Italian",
      "Sicilian",
      "French",
      "Spanish",
      "Basque",
      "Catalan",
      "Portuguese",
      "Greek",
      "Balkan",
      "Romanian",
      "Bulgarian",
      "Hungarian",
      "Polish",
      "Czech",
      "Slovak",
      "German",
      "Austrian",
      "Swiss",
      "Dutch",
      "Belgian",
      "British",
      "Scottish",
      "Irish",
      "Scandinavian",
      "Finnish",
      "Russian",
      "Ukrainian",
      "Georgian",
    ].sort(sortAlpha),
  },
  {
    region: "The Americas (North America)",
    items: [
      "American (General)",
      "New England",
      "Midwestern",
      "Southern / Soul Food",
      "Cajun",
      "Creole",
      "Tex-Mex",
      "New Mexican",
      "BBQ",
      "Pacific Northwest",
      "Californian",
      "Hawaiian",
      "Alaskan",
      "Canadian",
      "Québécois",
    ].sort(sortAlpha),
  },
  {
    region: "Latin America & Caribbean",
    items: [
      "Mexican",
      "Yucatecan",
      "Oaxacan",
      "Baja",
      "Central American",
      "Guatemalan",
      "Salvadoran",
      "Honduran",
      "Nicaraguan",
      "Costa Rican",
      "Panamanian",
      "Caribbean (General)",
      "Jamaican",
      "Cuban",
      "Puerto Rican",
      "Dominican",
      "Trinidadian/Tobagonian",
      "Haitian",
      "South American",
      "Peruvian",
      "Brazilian",
      "Argentinian",
      "Chilean",
      "Colombian",
      "Venezuelan",
      "Andean",
    ].sort(sortAlpha),
  },
  {
    region: "Pacific & Oceania",
    items: [
      "Pacific Islander (General)",
      "Polynesian",
      "Samoan",
      "Tongan",
      "Micronesian",
      "Melanesian",
      "Fijian",
      "Maori",
    ].sort(sortAlpha),
  },
  {
    region: "Indigenous & Jewish Traditions",
    items: [
      "Indigenous / First Nations / Native American",
      "Inuit / Alaska Native",
      "Ashkenazi Jewish",
      "Sephardi Jewish",
      "Mizrahi Jewish",
    ].sort(sortAlpha),
  },
  {
    region: "Fusion / Contemporary",
    items: ["Fusion/Contemporary", "Modernist", "Farm-to-Table"].sort(sortAlpha),
  },
];

const CUISINES = [
  "Italian",
  "Healthy",
  "Desserts",
  "Quick",
  "Vegan",
  "Seafood",
  "Asian",
  "Mexican",
  "Mediterranean",
  "BBQ",
  "Breakfast",
  "Burgers",
  "Salads",
].sort(sortAlpha);

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"] as const;

const DIETARY = [
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Keto",
  "Paleo",
  "Mediterranean",
  "Whole30",
  "Flexitarian",
  "High-Protein",
  "High-Fiber",
  "Low-Carb",
  "Low-Fat",
  "Low-Calorie",
  "Diabetic-Friendly",
  "Heart-Healthy",
  "Low-Sodium",
  "Low-Sugar",
  "Low-FODMAP",
  "Gluten-Free",
  "Lactose-Free",
  "Dairy-Free",
  "Egg-Free",
  "Nut-Free",
  "Soy-Free",
  "Shellfish-Free",
  "Halal",
  "Kosher",
].sort(sortAlpha);

const DIFFICULTY: Array<"Easy" | "Medium" | "Hard"> = ["Easy", "Medium", "Hard"];

export default function RecipesFiltersPage() {
  const { state, set, reset } = useRecipesFilters();
  const [ethSearch, setEthSearch] = React.useState("");

  const toggle = <T extends string>(arr: T[], value: T) =>
    arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];

  const ethLower = ethSearch.trim().toLowerCase();

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recipe Filters</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Ethnicities: {state.ethnicities.length}</Badge>
          <Badge variant="outline">Cuisines: {state.cuisines.length}</Badge>
          <Badge variant="outline">Meals: {state.mealTypes.length}</Badge>
          <Badge variant="outline">Dietary: {state.dietary.length}</Badge>
          {state.difficulty && <Badge variant="outline">Difficulty: {state.difficulty}</Badge>}
          {state.onlyRecipes && <Badge variant="outline">Recipe-only</Badge>}
          <Badge variant="outline" className="inline-flex items-center gap-1">
            <SpoonIcon className="h-3 w-3" /> {state.minSpoons}+
          </Badge>
        </div>
      </div>

      {/* Ethnicity / Cultural Origin */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-foreground">Ethnicity / Cultural Origin</h4>
            <p className="text-xs text-muted-foreground">
              Pick one or more; use search to narrow within regions.
            </p>
          </div>
          <div className="w-60">
            <Label htmlFor="eth-search" className="sr-only">
              Search ethnicities
            </Label>
            <Input
              id="eth-search"
              placeholder="Search ethnicities…"
              value={ethSearch}
              onChange={(e) => setEthSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-5">
          {ETHNICITY_REGIONS.map(({ region, items }) => {
            const visible = ethLower ? items.filter((i) => i.toLowerCase().includes(ethLower)) : items;
            if (visible.length === 0) return null;
            return (
              <div key={region} className="space-y-2">
                <h5 className="text-[1rem] font-semibold text-foreground">{region}</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {visible.map((e) => (
                    <label key={e} className="flex items-center gap-2 rounded-md border p-2">
                      <Checkbox
                        checked={state.ethnicities.includes(e)}
                        onCheckedChange={() => set({ ethnicities: toggle(state.ethnicities, e) })}
                      />
                      <span className="text-sm">{e}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Cuisines */}
      <section>
        <h4 className="mb-2 text-base font-semibold">Cuisines</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CUISINES.map((c) => (
            <label key={c} className="flex items-center gap-2 rounded-md border p-2">
              <Checkbox
                checked={state.cuisines.includes(c)}
                onCheckedChange={() => set({ cuisines: toggle(state.cuisines, c) })}
              />
              <span className="text-sm">{c}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Meal Types */}
      <section>
        <h4 className="mb-2 text-base font-semibold">Meal Type</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MEAL_TYPES.map((m) => (
            <label key={m} className="flex items-center gap-2 rounded-md border p-2">
              <Checkbox
                checked={state.mealTypes.includes(m)}
                onCheckedChange={() => set({ mealTypes: toggle(state.mealTypes, m) })}
              />
              <span className="text-sm">{m}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Dietary (includes Halal / Kosher) */}
      <section>
        <h4 className="mb-2 text-base font-semibold">Dietary</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DIETARY.map((d) => (
            <label key={d} className="flex items-center gap-2 rounded-md border p-2">
              <Checkbox
                checked={state.dietary.includes(d)}
                onCheckedChange={() => set({ dietary: toggle(state.dietary, d) })}
              />
              <span className="text-sm">{d}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Difficulty */}
      <section>
        <h4 className="mb-2 text-base font-semibold">Difficulty</h4>
        <div className="flex flex-wrap gap-2">
          {(["Easy", "Medium", "Hard"] as const).map((d) => (
            <Button
              key={d}
              size="sm"
              variant={state.difficulty === d ? "default" : "outline"}
              onClick={() => set({ difficulty: state.difficulty === d ? "" : d })}
            >
              {d}
            </Button>
          ))}
        </div>
      </section>

      {/* Max Cook Time */}
      <section>
        <div className="flex items-center justify-between">
          <h4 className="mb-2 text-base font-semibold">Max Cook Time</h4>
          <Label className="text-sm">{state.maxCookTime} min</Label>
        </div>
        <Slider
          value={[state.maxCookTime]}
          min={5}
          max={240}
          step={5}
          onValueChange={(v) => set({ maxCookTime: v[0] ?? state.maxCookTime })}
        />
      </section>

      {/* Min spoons */}
      <section>
        <div className="flex items-center justify-between">
          <h4 className="mb-2 text-base font-semibold">Min Rating (spoons)</h4>
          <div className="flex items-center gap-1 text-sm">
            <SpoonIcon className="h-4 w-4" /> {state.minSpoons || 0}+
          </div>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className="p-1"
              aria-label={`${n} spoons & up`}
              onClick={() => set({ minSpoons: state.minSpoons === n ? 0 : n })}
            >
              <SpoonIcon className={`h-6 w-6 ${state.minSpoons >= n ? "" : "opacity-30"}`} />
            </button>
          ))}
          <Button size="sm" variant="ghost" className="ml-1 h-7 px-2" onClick={() => set({ minSpoons: 0 })}>
            Clear
          </Button>
        </div>
      </section>

      {/* More */}
      <section className="space-y-2">
        <h4 className="text-base font-semibold">More</h4>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={state.onlyRecipes}
            onCheckedChange={(v) => set({ onlyRecipes: Boolean(v) })}
          />
          <span className="text-sm">Show recipe posts only</span>
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["newest", "rating", "likes"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={state.sortBy === s ? "default" : "outline"}
              onClick={() => set({ sortBy: s })}
            >
              {s === "newest" ? "Newest" : s === "rating" ? "Top Rated" : "Most Liked"}
            </Button>
          ))}
        </div>
      </section>

      <div className="pt-2 flex gap-2">
        <Button variant="secondary" onClick={reset} className="flex-1">
          Reset
        </Button>
        <Button onClick={() => history.back()} className="flex-1">
          Apply
        </Button>
      </div>
    </div>
  );
}
