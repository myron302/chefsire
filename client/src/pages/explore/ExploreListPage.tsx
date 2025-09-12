// client/src/pages/explore/ExploreFiltersPage.tsx
import * as React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useExploreFilters } from "./useExploreFilters";
import { SPOON_SCALE, STANDARDS, DIETARY_WITH_RELIGIOUS, MEAL_TYPES, DIFFICULTY, CUISINES, ALLERGENS } from "./ExploreShared";

const ETHNICITY_REGIONS: Record<
  string,
  { label: string; items: string[] }
> = {
  "Africa": {
    label: "Africa",
    items: [
      "Ethiopian", "Eritrean", "Somali", "Kenyan", "Tanzanian", "Ugandan",
      "Nigerian", "Ghanaian", "Ivorian", "Senegalese", "Cameroonian",
      "South African", "Moroccan", "Algerian", "Tunisian", "Egyptian",
    ],
  },
  "Middle East & SW Asia": {
    label: "Middle East & SW Asia",
    items: [
      "Levantine", "Palestinian", "Lebanese", "Syrian", "Jordanian",
      "Israeli", "Turkish", "Kurdish", "Armenian", "Georgian",
      "Persian (Iranian)", "Gulf (Khaleeji)", "Yemeni",
    ],
  },
  "South Asia": {
    label: "South Asia",
    items: [
      "North Indian (Punjabi)", "South Indian (Tamil)", "Gujarati", "Rajasthani",
      "Bengali", "Hyderabadi", "Goan", "Maharashtrian", "Kashmiri",
      "Sri Lankan", "Pakistani", "Bangladeshi", "Nepali",
    ],
  },
  "East & Southeast Asia": {
    label: "East & Southeast Asia",
    items: [
      "Chinese (Cantonese)", "Chinese (Sichuan)", "Chinese (Hunan)", "Chinese (Shandong)",
      "Taiwanese", "Japanese", "Korean", "Mongolian",
      "Thai", "Vietnamese", "Filipino", "Malaysian", "Indonesian", "Singaporean",
    ],
  },
  "Central Asia": {
    label: "Central Asia",
    items: ["Uzbek", "Kazakh", "Uighur"],
  },
  "Europe": {
    label: "Europe",
    items: [
      "Italian", "Sicilian", "French", "Spanish", "Basque", "Catalan", "Portuguese",
      "Greek", "Balkan", "Romanian", "Bulgarian", "Hungarian", "Polish", "Czech", "Slovak",
      "German", "Austrian", "Swiss", "Dutch", "Belgian", "British", "Scottish", "Irish",
      "Scandinavian", "Finnish", "Russian", "Ukrainian",
    ],
  },
  "The Americas & Caribbean": {
    label: "The Americas & Caribbean",
    items: [
      "American", "Southern / Soul Food", "Cajun", "Creole", "Tex-Mex", "New Mexican",
      "Pacific Northwest", "Californian", "Hawaiian", "Alaskan",
      "Mexican", "Yucatecan", "Oaxacan", "Baja",
      "Caribbean", "Jamaican", "Cuban", "Puerto Rican", "Dominican",
      "Peruvian", "Brazilian", "Argentinian", "Chilean", "Colombian", "Venezuelan",
    ],
  },
  "Broad / Fusion": {
    label: "Broad / Fusion",
    items: ["Mediterranean", "North African", "Middle Eastern", "Pan-Asian", "Fusion"],
  },
};

function RegionEthnicitySection() {
  const {
    selectedEthnicities,
    setSelectedEthnicities,
  } = useExploreFilters();
  const [q, setQ] = React.useState("");

  // single pool of items but grouped by region
  const groups = React.useMemo(() => {
    const norm = q.trim().toLowerCase();
    const out: [string, string[]][] = [];
    for (const key of Object.keys(ETHNICITY_REGIONS)) {
      let items = [...ETHNICITY_REGIONS[key].items].sort((a, b) =>
        a.localeCompare(b)
      );
      if (norm) items = items.filter((x) => x.toLowerCase().includes(norm));
      if (items.length) out.push([key, items]);
    }
    return out;
  }, [q]);

  const toggle = (value: string) => {
    setSelectedEthnicities(
      selectedEthnicities.includes(value)
        ? selectedEthnicities.filter((x) => x !== value)
        : [...selectedEthnicities, value]
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Ethnicity / Cultural Origin</h3>
      </div>
      <Input
        placeholder="Search ethnicity…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="space-y-5">
        {groups.map(([regionKey, items]) => (
          <div key={regionKey}>
            <div className="mb-2 text-sm font-semibold text-foreground/90">
              <span className="text-[0.95rem] font-bold">{ETHNICITY_REGIONS[regionKey].label}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {items.map((v) => (
                <label key={v} className="flex items-center gap-2 rounded-md border p-2">
                  <Checkbox
                    checked={selectedEthnicities.includes(v)}
                    onCheckedChange={() => toggle(v)}
                  />
                  <span className="text-sm">{v}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedEthnicities.length > 0 && (
        <div className="pt-2">
          <div className="mb-1 text-xs text-muted-foreground">Selected</div>
          <div className="flex flex-wrap gap-2">
            {selectedEthnicities.map((e) => (
              <Badge key={e} variant="secondary" className="flex items-center gap-1">
                {e}
                <button
                  className="ml-1"
                  onClick={() =>
                    setSelectedEthnicities(selectedEthnicities.filter((x) => x !== e))
                  }
                  aria-label={`Remove ${e}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function DietsSection() {
  const { selectedDietary, setSelectedDietary } = useExploreFilters();
  const [q, setQ] = React.useState("");
  const options = React.useMemo(
    () =>
      DIETARY_WITH_RELIGIOUS.filter((d) =>
        d.toLowerCase().includes(q.trim().toLowerCase())
      ),
    [q]
  );
  const toggle = (value: string) =>
    setSelectedDietary(
      selectedDietary.includes(value)
        ? selectedDietary.filter((x) => x !== value)
        : [...selectedDietary, value]
    );

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">Dietary (incl. Halal / Kosher)</h3>
      <Input placeholder="Search dietary…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {options.map((d) => (
          <label key={d} className="flex items-center gap-2 rounded-md border p-2">
            <Checkbox checked={selectedDietary.includes(d)} onCheckedChange={() => toggle(d)} />
            <span className="text-sm">{d}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function AllergensSection() {
  const { excludedAllergens, setExcludedAllergens } = useExploreFilters();
  const toggle = (value: string) =>
    setExcludedAllergens(
      excludedAllergens.includes(value)
        ? excludedAllergens.filter((x) => x !== value)
        : [...excludedAllergens, value]
    );
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">Exclude Allergens</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ALLERGENS.map((a) => (
          <label key={a} className="flex items-center gap-2 rounded-md border p-2">
            <Checkbox checked={excludedAllergens.includes(a)} onCheckedChange={() => toggle(a)} />
            <span className="text-sm">{a}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

export default function ExploreFiltersPage() {
  const [, navigate] = useLocation();
  const f = useExploreFilters();

  const reset = () => f.resetFilters();
  const apply = () => navigate("/explore");

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-6 py-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Filters</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={reset}>Reset</Button>
          <Button onClick={apply}>Apply</Button>
        </div>
      </div>

      {/* Cuisine / Meal / Difficulty / Time / Spoons */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Cuisine */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold">Cuisines</h3>
            <div className="grid grid-cols-2 gap-2">
              {CUISINES.map((c) => (
                <label key={c} className="flex items-center gap-2 rounded-md border p-2">
                  <Checkbox
                    checked={f.selectedCuisines.includes(c)}
                    onCheckedChange={() =>
                      f.setSelectedCuisines(
                        f.selectedCuisines.includes(c)
                          ? f.selectedCuisines.filter((x) => x !== c)
                          : [...f.selectedCuisines, c]
                      )
                    }
                  />
                  <span className="text-sm">{c}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Meal Types */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold">Meal Type</h3>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_TYPES.map((m) => (
                <label key={m} className="flex items-center gap-2 rounded-md border p-2">
                  <Checkbox
                    checked={f.selectedMealTypes.includes(m)}
                    onCheckedChange={() =>
                      f.setSelectedMealTypes(
                        f.selectedMealTypes.includes(m)
                          ? f.selectedMealTypes.filter((x) => x !== m)
                          : [...f.selectedMealTypes, m]
                      )
                    }
                  />
                  <span className="text-sm">{m}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Difficulty</h3>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY.map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={f.selectedDifficulty === d ? "default" : "outline"}
                  onClick={() => f.setSelectedDifficulty(f.selectedDifficulty === d ? "" : d)}
                >
                  {d}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Prep Time */}
          <div className="space-y-2">
            <Label>Max Cook Time: {f.maxCookTime} min</Label>
            <Slider
              value={[f.maxCookTime]}
              min={5}
              max={240}
              step={5}
              onValueChange={(v) => f.setMaxCookTime(v[0] ?? 60)}
            />
          </div>

          {/* Spoons (rating) */}
          <div className="space-y-2">
            <Label>Min Spoons: {f.minRating || 0}</Label>
            <div className="flex items-center gap-1">
              {SPOON_SCALE.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="p-1"
                  onClick={() => f.setMinRating(f.minRating === n ? 0 : n)}
                  aria-label={`${n} spoons & up`}
                >
                  {/* Use your Knife+Spoon SVG in ExploreShared SpoonIcon if desired */}
                  <span className={`text-xl ${f.minRating >= n ? "" : "opacity-30"}`}>🥄</span>
                </button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="ml-1 h-7 px-2"
                onClick={() => f.setMinRating(0)}
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Standards (prep styles like Halal/Kosher are in diets; this is extra) */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold">Preparation Standards</h3>
            <div className="grid grid-cols-2 gap-2">
              {STANDARDS.map((s) => (
                <label key={s} className="flex items-center gap-2 rounded-md border p-2">
                  <Checkbox
                    checked={f.selectedPreparation.includes(s)}
                    onCheckedChange={() =>
                      f.setSelectedPreparation(
                        f.selectedPreparation.includes(s)
                          ? f.selectedPreparation.filter((x) => x !== s)
                          : [...f.selectedPreparation, s]
                      )
                    }
                  />
                  <span className="text-sm">{s}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ethnicity (grouped; the only ethnicity UI now) */}
      <RegionEthnicitySection />

      {/* Diets with Halal/Kosher */}
      <DietsSection />

      {/* Allergens */}
      <AllergensSection />

      <div className="sticky bottom-0 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/50 py-3 border-t">
        <div className="max-w-5xl mx-auto px-4 md:px-0 flex gap-2">
          <Button variant="secondary" onClick={reset} className="flex-1">
            Reset
          </Button>
          <Button onClick={apply} className="flex-1">
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
