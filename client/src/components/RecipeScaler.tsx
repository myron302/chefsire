// client/src/components/RecipeScaler.tsx
import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Minus, Plus, RotateCcw, ArrowLeftRight } from "lucide-react";
import { autoConvert, scaleAmount, type UnitSystem } from "@/lib/unitConversions";

interface Ingredient {
  amount: number;
  unit: string;
  item: string;
  note?: string;
}

interface RecipeScalerProps {
  ingredients: Ingredient[];
  originalServings: number;
  onServingsChange?: (servings: number) => void;
  className?: string;
}

export function RecipeScaler({
  ingredients,
  originalServings,
  onServingsChange,
  className = "",
}: RecipeScalerProps) {
  const [servings, setServings] = useState(originalServings);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customServings, setCustomServings] = useState(originalServings.toString());

  const multiplier = servings / originalServings;

  const updateServings = (newServings: number) => {
    const clamped = Math.max(1, Math.min(99, newServings));
    setServings(clamped);
    setCustomServings(clamped.toString());
    onServingsChange?.(clamped);
  };

  const handleQuickScale = (scale: number) => {
    const newServings = Math.round(originalServings * scale);
    updateServings(newServings);
    setShowCustomInput(false);
  };

  const handleCustomSubmit = () => {
    const parsed = parseInt(customServings, 10);
    if (!isNaN(parsed) && parsed > 0) {
      updateServings(parsed);
    }
    setShowCustomInput(false);
  };

  const handleReset = () => {
    updateServings(originalServings);
    setShowCustomInput(false);
  };

  const scaledIngredients = ingredients.map((ing) => {
    const scaledAmount = ing.amount * multiplier;
    const converted = autoConvert(scaledAmount, ing.unit, unitSystem);

    return {
      ...ing,
      displayAmount: typeof converted.amount === "number" && converted.amount < 10
        ? scaleAmount(converted.amount, 1)
        : converted.amount.toFixed(converted.amount >= 100 ? 0 : 1),
      displayUnit: converted.unit,
    };
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Recipe Calculator</span>
          <Badge variant="secondary">
            {servings} serving{servings !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Servings Adjuster */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Adjust Servings</Label>

          {/* Quick Scale Buttons */}
          {!showCustomInput && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateServings(servings - 1)}
                disabled={servings <= 1}
              >
                <Minus className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="min-w-[60px] font-semibold"
              >
                {servings}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => updateServings(servings + 1)}
                disabled={servings >= 99}
              >
                <Plus className="w-4 h-4" />
              </Button>

              <div className="w-full h-[1px] bg-border my-1" />

              {/* Common multipliers */}
              {[0.5, 2, 3, 4].map((scale) => {
                const targetServings = Math.round(originalServings * scale);
                return (
                  <Button
                    key={scale}
                    variant={servings === targetServings ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleQuickScale(scale)}
                  >
                    {scale}x
                  </Button>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCustomInput(true)}
              >
                Custom
              </Button>

              {servings !== originalServings && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="ml-auto"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          )}

          {/* Custom Input */}
          {showCustomInput && (
            <div className="flex gap-2">
              <Input
                type="number"
                min="1"
                max="99"
                value={customServings}
                onChange={(e) => setCustomServings(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                className="w-24"
                autoFocus
              />
              <Button onClick={handleCustomSubmit} size="sm">
                Apply
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCustomInput(false)}
                size="sm"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {/* Unit System Toggle */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" />
            Unit System
          </Label>
          <RadioGroup
            value={unitSystem}
            onValueChange={(value) => setUnitSystem(value as UnitSystem)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="imperial" id="imperial" />
              <Label htmlFor="imperial" className="font-normal cursor-pointer">
                Imperial (cups, oz, °F)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="metric" id="metric" />
              <Label htmlFor="metric" className="font-normal cursor-pointer">
                Metric (ml, g, °C)
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Scaled Ingredients */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Ingredients</Label>
          <ul className="space-y-1.5 text-sm">
            {scaledIngredients.map((ing, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-medium text-gray-700 min-w-[80px]">
                  {ing.displayAmount} {ing.displayUnit}
                </span>
                <span className="flex-1">
                  {ing.item}
                  {ing.note && (
                    <span className="text-gray-600 italic"> — {ing.note}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Scaling Info */}
        {servings !== originalServings && (
          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
            Scaled {multiplier < 1 ? "down" : "up"} by {multiplier.toFixed(2)}x from{" "}
            {originalServings} serving{originalServings !== 1 ? "s" : ""}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact inline scaler for recipe cards
interface CompactScalerProps {
  currentServings: number;
  originalServings: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onReset: () => void;
}

export function CompactScaler({
  currentServings,
  originalServings,
  onIncrease,
  onDecrease,
  onReset,
}: CompactScalerProps) {
  return (
    <div className="inline-flex items-center gap-2 border rounded-md p-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={onDecrease}
        disabled={currentServings <= 1}
        className="h-7 w-7 p-0"
      >
        <Minus className="w-3 h-3" />
      </Button>
      <span className="text-sm font-medium min-w-[40px] text-center">
        {currentServings}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onIncrease}
        disabled={currentServings >= 99}
        className="h-7 w-7 p-0"
      >
        <Plus className="w-3 h-3" />
      </Button>
      {currentServings !== originalServings && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-7 w-7 p-0"
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}
