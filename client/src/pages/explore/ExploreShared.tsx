import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

// Prefer your central filter lists, but keep fallbacks for local dev
import {
  DIETS as MASTER_DIETS,
  ALLERGENS as MASTER_ALLERGENS,
  CUISINES as MASTER_CUISINES,
} from "@/lib/filters";

export const sortAlpha = (xs: string[]) => [...xs].sort((a, b) => a.localeCompare(b));

const toFlatAlpha = (
  arr: { label: string; value: string }[] | undefined,
  fallback: string[]
) =>
  (arr ? Array.from(new Set(arr.map((x) => x.label))) : fallback).sort((a, b) =>
    a.localeCompare(b)
  );

// Flat, alphabetized helpers (fallback values are minimal, because your main list is rich)
export const CUISINES = toFlatAlpha(MASTER_CUISINES as any, [
  "Italian",
  "Asian",
  "Mexican",
  "Mediterranean",
  "BBQ",
  "Breakfast",
  "Desserts",
  "Healthy",
  "Seafood",
  "Vegan",
  "Salads",
  "Quick",
  "Burgers",
]);

export const ALLERGENS = toFlatAlpha(MASTER_ALLERGENS as any, [
  "Gluten",
  "Dairy",
  "Eggs",
  "Peanuts",
  "Tree Nuts",
  "Soy",
  "Fish",
  "Shellfish",
  "Sesame",
  "Mustard",
]);

// Build Diet list from master; exclude "*-Free" (those live under Allergens) and Halal/Kosher here
const removeFromDiet = new Set(["Halal", "Kosher"]);
export const DIETARY: string[] = Array.from(
  new Set((MASTER_DIETS as any[]).map((d) => d.label))
)
  .filter((label) => !/-Free$/i.test(label))
  .filter((label) => !removeFromDiet.has(label))
  .sort((a, b) => a.localeCompare(b));

/* ----- Ethnicity / Cultural Origin (grouped + alphabetical) ----- */
export const ETHNICITY_GROUPS: { label: string; options: string[] }[] = [
  {
    label: "Africa",
    options: sortAlpha([
      "Algerian",
      "Cameroonian",
      "Egyptian",
      "Eritrean",
      "Ethiopian",
      "Ghanaian",
      "Ivorian",
      "Kenyan",
      "Moroccan",
      "Nigerian",
      "Senegalese",
      "Somali",
      "South African",
      "Tanzanian",
      "Tunisian",
      "Ugandan",
    ]),
  },
  {
    label: "Middle East / Southwest Asia",
    options: sortAlpha([
      "Armenian",
      "Georgian",
      "Gulf (Khaleeji)",
      "Israeli",
      "Jordanian",
      "Kurdish",
      "Lebanese",
      "Levantine",
      "Middle Eastern",
      "Palestinian",
      "Persian (Iranian)",
      "Syrian",
      "Turkish",
      "Yemeni",
    ]),
  },
  {
    label: "South Asia",
    options: sortAlpha([
      "Bangladeshi",
      "Bengali",
      "Goan",
      "Gujarati",
      "Hyderabadi",
      "Jain",
      "Kashmiri",
      "Maharashtrian",
      "Nepali",
      "North Indian (Punjabi)",
      "Pakistani",
      "Rajasthani",
      "South Indian (Tamil)",
      "Sri Lankan",
    ]),
  },
  {
    label: "East Asia",
    options: sortAlpha([
      "Chinese (Cantonese)",
      "Chinese (Hunan)",
      "Chinese (Shandong)",
      "Chinese (Sichuan)",
      "Japanese",
      "Korean",
      "Mongolian",
      "Taiwanese",
    ]),
  },
  {
    label: "Southeast Asia",
    options: sortAlpha([
      "Filipino",
      "Indonesian",
      "Khmer (Cambodian)",
      "Lao",
      "Malaysian",
      "Singaporean",
      "Thai",
      "Vietnamese",
    ]),
  },
  {
    label: "Central Asia",
    options: sortAlpha(["Kazakh", "Uighur", "Uzbek"]),
  },
  {
    label: "Europe",
    options: sortAlpha([
      "Austrian",
      "Balkan",
      "Basque",
      "Belgian",
      "British",
      "Bulgarian",
      "Catalan",
      "Czech",
      "Dutch",
      "Finnish",
      "French",
      "German",
      "Greek",
      "Hungarian",
      "Irish",
      "Italian",
      "Polish",
      "Portuguese",
      "Romanian",
      "Russian",
      "Scandinavian",
      "Scottish",
      "Sicilian",
      "Slovak",
      "Spanish",
      "Swiss",
      "Ukrainian",
    ]),
  },
  {
    label: "The Americas — United States",
    options: sortAlpha([
      "Alaskan",
      "American",
      "Californian",
      "Cajun",
      "Creole",
      "Hawaiian",
      "New Mexican",
      "Pacific Northwest",
      "Southern / Soul Food",
      "Tex-Mex",
    ]),
  },
  {
    label: "The Americas — Mexico",
    options: sortAlpha(["Baja", "Mexican", "Oaxacan", "Yucatecan"]),
  },
  {
    label: "The Americas — Caribbean",
    options: sortAlpha(["Caribbean", "Cuban", "Dominican", "Jamaican", "Puerto Rican"]),
  },
  {
    label: "The Americas — Central & South",
    options: sortAlpha(["Argentinian", "Brazilian", "Chilean", "Colombian", "Peruvian", "Venezuelan"]),
  },
  {
    label: "Broad / Other",
    options: sortAlpha(["Fusion", "Mediterranean", "North African", "Pan-Asian"]),
  },
];

/* ----- Shared UI atoms ----- */
export function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-[1.05rem] font-semibold text-foreground">{title}</h4>
      {children}
    </section>
  );
}

export function SpoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}>
      <path
        d="M12.5 2c2.485 0 4 1.79 4 4.25 0 1.9-1.12 3.64-2.79 4.21l-.21.07V14a3.5 3.5 0 0 1-2 3.16V22a1 1 0 1 1-2 0v-4.84A3.5 3.5 0 0 1 7.5 14V10.5l-.21-.07C5.6 9.89 4.5 8.15 4.5 6.25 4.5 3.79 6.015 2 8.5 2c1.33 0 2.53.6 3.25 1.55A4.18 4.18 0 0 1 12.5 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SpoonSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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

// Searchable checkbox group (used for Ethnicity regions)
export function SearchableGroup({
  label,
  options,
  selected,
  onToggle,
  columns = 1,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  columns?: 1 | 2;
}) {
  const [q, setQ] = React.useState("");
  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.toLowerCase().includes(s));
  }, [q, options]);

  return (
    <div>
      <h5 className="mb-2 inline-block rounded-md bg-muted px-2 py-1 text-[1rem] font-bold text-foreground">
        {label}
      </h5>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${label}…`}
        className="mb-2 h-8 w-full rounded-md border bg-background px-2 text-sm"
      />
      <div className={columns === 2 ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
        {filtered.map((name) => (
          <label key={name} className="flex items-center gap-2">
            <Checkbox checked={selected.includes(name)} onCheckedChange={() => onToggle(name)} />
            <span className="text-sm">{name}</span>
          </label>
        ))}
      </div>
      {filtered.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No matches.</p>}
    </div>
  );
}
