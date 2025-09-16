import React from "react";
import { Lightbulb, ShoppingCart } from "lucide-react";

type Nutrition = {
  calories?: number;
  fat?: number;
  carbs?: number;
  protein?: number;
};

type SubstitutionCardProps = {
  substituteIngredient: string;
  ratio: string;
  category?: string;
  notes?: string;
  nutrition?: {
    original?: Nutrition;
    substitute?: Nutrition;
  };
};

export default function SubstitutionCard({
  substituteIngredient,
  ratio,
  category,
  notes,
  nutrition,
}: SubstitutionCardProps) {
  const hasNutrition = () =>
    !!nutrition?.original && !!nutrition?.substitute;

  const delta = (orig: number, sub: number) => {
    const diff = orig - sub; // positive = savings
    const sign = diff > 0 ? "-" : diff < 0 ? "+" : "±";
    return { diff, label: `${sign}${Math.abs(diff)}` };
  };

  const statBadge = (
    label: string,
    value: string | number,
    tone: "neutral" | "positive" | "negative" = "neutral"
  ) => {
    const tones: Record<typeof tone, string> = {
      neutral: "bg-gray-100 text-gray-800",
      positive: "bg-green-100 text-green-800",
      negative: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${tones[tone]} mr-2 mb-2`}
      >
        {label}: {value}
      </span>
    );
  };

  const original = nutrition?.original;
  const substitute = nutrition?.substitute;

  // Compute deltas if nutrition available
  const calDelta =
    original && substitute ? delta(original.calories || 0, substitute.calories || 0) : null;
  const fatDelta =
    original && substitute ? delta(original.fat || 0, substitute.fat || 0) : null;
  const carbDelta =
    original && substitute ? delta(original.carbs || 0, substitute.carbs || 0) : null;
  const proteinDelta =
    original && substitute ? delta(original.protein || 0, substitute.protein || 0) : null;

  // Choose tone for badges (positive if savings, negative if increase)
  const toneFor = (d?: { diff: number; label: string }) =>
    !d ? "neutral" : d.diff > 0 ? "positive" : d.diff < 0 ? "negative" : "neutral";

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {substituteIngredient}
          </h3>
          <div className="mt-1 text-sm text-gray-700">
            <span className="font-medium">Ratio:</span> {ratio}
          </div>
          {category && (
            <div className="mt-2">
              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                {category}
              </span>
            </div>
          )}
        </div>

        {/* Instacart button - show for all cards */}
        <div className="mt-2 md:mt-0">
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
            onClick={() => {
              // TODO: replace with affiliate link once approved
              alert("Instacart integration coming soon!");
            }}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Buy on Instacart
          </button>
        </div>
      </div>

      {/* Nutrition comparison - only show if both original and substitute nutrition exist */}
      {hasNutrition() && original && substitute && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-sm">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="font-medium text-gray-700 mb-1">Original</p>
              <p>Calories: {original.calories || 0}</p>
              <p>Fat: {original.fat || 0}g</p>
              <p>Carbs: {original.carbs || 0}g</p>
              <p>Protein: {original.protein || 0}g</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="font-medium text-gray-700 mb-1">Substitute</p>
              <p>Calories: {substitute.calories || 0}</p>
              <p>Fat: {substitute.fat || 0}g</p>
              <p>Carbs: {substitute.carbs || 0}g</p>
              <p>Protein: {substitute.protein || 0}g</p>
            </div>
          </div>

          {/* Savings badges */}
          <div className="mt-3">
            {calDelta && statBadge("Cal Δ", `${calDelta.label}`, toneFor(calDelta))}
            {fatDelta && statBadge("Fat Δ(g)", `${fatDelta.label}`, toneFor(fatDelta))}
            {carbDelta && statBadge("Carb Δ(g)", `${carbDelta.label}`, toneFor(carbDelta))}
            {proteinDelta && statBadge("Protein Δ(g)", `${proteinDelta.label}`, toneFor(proteinDelta))}
          </div>
        </>
      )}

      {/* Notes */}
      {notes && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start">
            <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
            <p className="text-sm text-blue-800">{notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}