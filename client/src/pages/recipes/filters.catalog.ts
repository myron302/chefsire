import { useMemo, useState } from "react";
import {
  CUISINES,
  MEAL_TYPES,
  DIETARY,
  ETHNICITY_REGIONS,
} from "./filters.catalog";

export type RecipesFiltersState = {
  q: string;
  selectedCuisines: string[];      // from CUISINES (flat)
  selectedEthnicities: string[];   // "Region — Name" labels
  selectedDiets: string[];         // from DIETARY (flat)
  selectedMealTypes: string[];     // from MEAL_TYPES (flat)
};

function makeEthnicityLabels() {
  const labels: string[] = [];
  Object.entries(ETHNICITY_REGIONS || {}).forEach(([region, arr]) => {
    (arr || []).forEach((name) => labels.push(`${region} — ${name}`));
  });
  return labels;
}

export function useRecipesFilters() {
  const [q, setQ] = useState("");
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedEthnicities, setSelectedEthnicities] = useState<string[]>([]);
  const [selectedDiets, setSelectedDiets] = useState<string[]>([]);
  const [selectedMealTypes, setSelectedMealTypes] = useState<string[]>([]);

  const ethnicityLabels = useMemo(() => makeEthnicityLabels(), []);

  const toggle = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const getQueryParams = () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (selectedCuisines.length) params.set("cuisines", selectedCuisines.join(","));
    if (selectedEthnicities.length) params.set("ethnicities", selectedEthnicities.join(","));
    if (selectedDiets.length) params.set("diets", selectedDiets.join(","));
    if (selectedMealTypes.length) params.set("mealTypes", selectedMealTypes.join(","));
    params.set("pageSize", "24");
    params.set("offset", "0");
    return params;
  };

  const reset = () => {
    setQ("");
    setSelectedCuisines([]);
    setSelectedEthnicities([]);
    setSelectedDiets([]);
    setSelectedMealTypes([]);
  };

  return {
    // state
    q,
    setQ,
    selectedCuisines,
    selectedEthnicities,
    selectedDiets,
    selectedMealTypes,
    // toggles
    toggleCuisine: (label: string) => toggle(selectedCuisines, label, setSelectedCuisines),
    toggleEthnicity: (label: string) => toggle(selectedEthnicities, label, setSelectedEthnicities),
    toggleDiet: (label: string) => toggle(selectedDiets, label, setSelectedDiets),
    toggleMealType: (label: string) => toggle(selectedMealTypes, label, setSelectedMealTypes),
    // catalogs
    catalogs: {
      CUISINES,
      MEAL_TYPES,
      DIETARY,
      ETHNICITY_REGIONS,
      ETHNICITY_LABELS: ethnicityLabels,
    },
    // helpers
    getQueryParams,
    reset,
  };
}
