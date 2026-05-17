import { Activity, Beef, Flame, Wheat } from "lucide-react";

import type { NutritionCampaignMacros } from "@/pages/nutrition/campaigns/mockCampaigns";

const macroItems = [
  { key: "caloriesPerDay", label: "Cal/day", icon: Flame, suffix: "" },
  { key: "proteinPerDay", label: "Protein", icon: Beef, suffix: "g" },
  { key: "carbsPerDay", label: "Carbs", icon: Wheat, suffix: "g" },
  { key: "fatPerDay", label: "Fat", icon: Activity, suffix: "g" },
] as const;

export default function CampaignMacroPreview({ macros }: { macros: NutritionCampaignMacros }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {macroItems.map(({ key, label, icon: Icon, suffix }) => (
        <div key={key} className="rounded-2xl border border-white/70 bg-white/75 p-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <Icon className="h-3.5 w-3.5 text-emerald-600" />
            {label}
          </div>
          <div className="mt-1 text-base font-bold text-slate-950">
            {macros[key].toLocaleString()}{suffix}
          </div>
        </div>
      ))}
    </div>
  );
}
