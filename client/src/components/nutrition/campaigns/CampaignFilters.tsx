import { SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { NutritionCampaignBudget, NutritionCampaignDifficulty, NutritionCampaignPrepIntensity, NutritionDietType } from "@/pages/nutrition/campaigns/mockCampaigns";

export type CampaignSort = "trending" | "popular" | "new" | "completion";
export type CalorieFilter = "all" | "under-1800" | "1800-2300" | "over-2300";
export type ProteinFilter = "all" | "100-plus" | "140-plus" | "170-plus";
export type DurationFilter = "all" | "14" | "21" | "28-plus";

export interface NutritionCampaignFiltersState {
  dietType: "all" | NutritionDietType;
  difficulty: "all" | NutritionCampaignDifficulty;
  prepIntensity: "all" | NutritionCampaignPrepIntensity;
  calories: CalorieFilter;
  protein: ProteinFilter;
  budget: "all" | NutritionCampaignBudget;
  duration: DurationFilter;
  sort: CampaignSort;
}

interface CampaignFiltersProps {
  filters: NutritionCampaignFiltersState;
  resultCount: number;
  onChange: (filters: NutritionCampaignFiltersState) => void;
}

const defaultFilters: NutritionCampaignFiltersState = {
  dietType: "all",
  difficulty: "all",
  prepIntensity: "all",
  calories: "all",
  protein: "all",
  budget: "all",
  duration: "all",
  sort: "trending",
};

const dietOptions: Array<{ value: NutritionCampaignFiltersState["dietType"]; label: string }> = [
  { value: "all", label: "All diets" },
  { value: "fat-loss", label: "Fat loss" },
  { value: "high-protein", label: "High protein" },
  { value: "vegan", label: "Vegan" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "family", label: "Family" },
  { value: "athlete", label: "Athlete" },
  { value: "keto", label: "Keto" },
  { value: "meal-prep", label: "Meal prep" },
  { value: "student", label: "Student" },
  { value: "anti-inflammatory", label: "Anti-inflammatory" },
];

export { defaultFilters };

export default function CampaignFilters({ filters, resultCount, onChange }: CampaignFiltersProps) {
  const updateFilter = <Key extends keyof NutritionCampaignFiltersState>(key: Key, value: NutritionCampaignFiltersState[Key]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="sticky top-4 z-20 rounded-[1.5rem] border border-white/70 bg-white/85 p-4 shadow-xl shadow-emerald-950/5 backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-700">
            <SlidersHorizontal className="h-4 w-4" /> Discovery filters
          </div>
          <p className="text-sm text-slate-500">{resultCount} campaigns match your current nutrition system lens.</p>
        </div>

        <Tabs value={filters.sort} onValueChange={(value) => updateFilter("sort", value as CampaignSort)}>
          <TabsList className="grid w-full grid-cols-4 rounded-full bg-slate-100 p-1 lg:w-auto">
            <TabsTrigger value="trending" className="rounded-full">Trending</TabsTrigger>
            <TabsTrigger value="popular" className="rounded-full">Popular</TabsTrigger>
            <TabsTrigger value="new" className="rounded-full">New</TabsTrigger>
            <TabsTrigger value="completion" className="rounded-full">Completion</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Select value={filters.dietType} onValueChange={(value) => updateFilter("dietType", value as NutritionCampaignFiltersState["dietType"])}>
          <SelectTrigger className="rounded-xl bg-white"><SelectValue placeholder="Diet type" /></SelectTrigger>
          <SelectContent>
            {dietOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.difficulty} onValueChange={(value) => updateFilter("difficulty", value as NutritionCampaignFiltersState["difficulty"])}>
          <SelectTrigger className="rounded-xl bg-white"><SelectValue placeholder="Difficulty" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All difficulties</SelectItem>
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.calories} onValueChange={(value) => updateFilter("calories", value as CalorieFilter)}>
          <SelectTrigger className="rounded-xl bg-white"><SelectValue placeholder="Calories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All calories</SelectItem>
            <SelectItem value="under-1800">Under 1,800</SelectItem>
            <SelectItem value="1800-2300">1,800–2,300</SelectItem>
            <SelectItem value="over-2300">Over 2,300</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.protein} onValueChange={(value) => updateFilter("protein", value as ProteinFilter)}>
          <SelectTrigger className="rounded-xl bg-white"><SelectValue placeholder="Protein" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All protein</SelectItem>
            <SelectItem value="100-plus">100g+</SelectItem>
            <SelectItem value="140-plus">140g+</SelectItem>
            <SelectItem value="170-plus">170g+</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.duration} onValueChange={(value) => updateFilter("duration", value as DurationFilter)}>
          <SelectTrigger className="rounded-xl bg-white"><SelectValue placeholder="Duration" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All durations</SelectItem>
            <SelectItem value="14">14 days</SelectItem>
            <SelectItem value="21">21 days</SelectItem>
            <SelectItem value="28-plus">28+ days</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="justify-between rounded-xl bg-white">
              More filters <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Prep intensity</DropdownMenuLabel>
            {(["all", "light", "moderate", "high"] as const).map((value) => (
              <DropdownMenuCheckboxItem key={value} checked={filters.prepIntensity === value} onCheckedChange={() => updateFilter("prepIntensity", value)}>
                <span className="capitalize">{value === "all" ? "All prep" : value}</span>
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Budget level</DropdownMenuLabel>
            {(["all", "student", "budget", "balanced", "premium"] as const).map((value) => (
              <DropdownMenuCheckboxItem key={value} checked={filters.budget === value} onCheckedChange={() => updateFilter("budget", value)}>
                <span className="capitalize">{value === "all" ? "All budgets" : value}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup
          type="single"
          value={filters.prepIntensity === "all" ? "" : filters.prepIntensity}
          onValueChange={(value) => updateFilter("prepIntensity", (value || "all") as NutritionCampaignFiltersState["prepIntensity"])}
          className="justify-start overflow-x-auto"
        >
          <ToggleGroupItem value="light" className="rounded-full">Light prep</ToggleGroupItem>
          <ToggleGroupItem value="moderate" className="rounded-full">Moderate</ToggleGroupItem>
          <ToggleGroupItem value="high" className="rounded-full">High prep</ToggleGroupItem>
        </ToggleGroup>
        <Button variant="ghost" size="sm" className="w-fit gap-2 rounded-full" onClick={() => onChange(defaultFilters)}>
          <X className="h-4 w-4" /> Reset filters
        </Button>
      </div>
    </div>
  );
}
