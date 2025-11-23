// client/src/lib/unitConversions.ts

/**
 * Comprehensive unit conversion system for recipes
 * Handles volume, weight, and temperature conversions between metric and imperial
 */

// ==================== TYPES ====================

export type UnitSystem = 'imperial' | 'metric';

export type VolumeUnit =
  | 'tsp' | 'teaspoon' | 'teaspoons'
  | 'tbsp' | 'tablespoon' | 'tablespoons'
  | 'fl oz' | 'fluid ounce' | 'fluid ounces'
  | 'cup' | 'cups'
  | 'pint' | 'pints' | 'pt'
  | 'quart' | 'quarts' | 'qt'
  | 'gallon' | 'gallons' | 'gal'
  | 'ml' | 'milliliter' | 'milliliters'
  | 'l' | 'liter' | 'liters';

export type WeightUnit =
  | 'oz' | 'ounce' | 'ounces'
  | 'lb' | 'pound' | 'pounds'
  | 'g' | 'gram' | 'grams'
  | 'kg' | 'kilogram' | 'kilograms';

export type TemperatureUnit = 'f' | 'fahrenheit' | 'c' | 'celsius';

export type Unit = VolumeUnit | WeightUnit | TemperatureUnit | string;

// ==================== CONVERSION CONSTANTS ====================

// Volume conversions (to ml)
const VOLUME_TO_ML: Record<string, number> = {
  'tsp': 4.92892,
  'teaspoon': 4.92892,
  'teaspoons': 4.92892,
  'tbsp': 14.7868,
  'tablespoon': 14.7868,
  'tablespoons': 14.7868,
  'fl oz': 29.5735,
  'fluid ounce': 29.5735,
  'fluid ounces': 29.5735,
  'cup': 236.588,
  'cups': 236.588,
  'pint': 473.176,
  'pints': 473.176,
  'pt': 473.176,
  'quart': 946.353,
  'quarts': 946.353,
  'qt': 946.353,
  'gallon': 3785.41,
  'gallons': 3785.41,
  'gal': 3785.41,
  'ml': 1,
  'milliliter': 1,
  'milliliters': 1,
  'l': 1000,
  'liter': 1000,
  'liters': 1000,
};

// Weight conversions (to grams)
const WEIGHT_TO_GRAMS: Record<string, number> = {
  'oz': 28.3495,
  'ounce': 28.3495,
  'ounces': 28.3495,
  'lb': 453.592,
  'pound': 453.592,
  'pounds': 453.592,
  'g': 1,
  'gram': 1,
  'grams': 1,
  'kg': 1000,
  'kilogram': 1000,
  'kilograms': 1000,
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Normalize unit names (lowercase, remove periods)
 */
function normalizeUnit(unit: string): string {
  return unit.toLowerCase().replace(/\./g, '').trim();
}

/**
 * Check if a unit is a volume unit
 */
export function isVolumeUnit(unit: string): boolean {
  return normalizeUnit(unit) in VOLUME_TO_ML;
}

/**
 * Check if a unit is a weight unit
 */
export function isWeightUnit(unit: string): boolean {
  return normalizeUnit(unit) in WEIGHT_TO_GRAMS;
}

/**
 * Check if a unit is a temperature unit
 */
export function isTemperatureUnit(unit: string): boolean {
  const normalized = normalizeUnit(unit);
  return ['f', 'fahrenheit', 'c', 'celsius'].includes(normalized);
}

/**
 * Determine if a unit is metric or imperial
 */
export function getUnitSystem(unit: string): UnitSystem | null {
  const normalized = normalizeUnit(unit);

  const metricUnits = ['ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'c', 'celsius'];
  const imperialUnits = ['tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons', 'fl oz', 'fluid ounce', 'fluid ounces', 'cup', 'cups', 'pint', 'pints', 'pt', 'quart', 'quarts', 'qt', 'gallon', 'gallons', 'gal', 'oz', 'ounce', 'ounces', 'lb', 'pound', 'pounds', 'f', 'fahrenheit'];

  if (metricUnits.includes(normalized)) return 'metric';
  if (imperialUnits.includes(normalized)) return 'imperial';
  return null;
}

// ==================== CONVERSION FUNCTIONS ====================

/**
 * Convert volume between units
 */
export function convertVolume(amount: number, fromUnit: string, toUnit: string): number {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (!isVolumeUnit(from) || !isVolumeUnit(to)) {
    return amount; // Can't convert
  }

  // Convert to ml first, then to target unit
  const ml = amount * VOLUME_TO_ML[from];
  return ml / VOLUME_TO_ML[to];
}

/**
 * Convert weight between units
 */
export function convertWeight(amount: number, fromUnit: string, toUnit: string): number {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (!isWeightUnit(from) || !isWeightUnit(to)) {
    return amount; // Can't convert
  }

  // Convert to grams first, then to target unit
  const grams = amount * WEIGHT_TO_GRAMS[from];
  return grams / WEIGHT_TO_GRAMS[to];
}

/**
 * Convert temperature between Fahrenheit and Celsius
 */
export function convertTemperature(amount: number, fromUnit: string, toUnit: string): number {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (!isTemperatureUnit(from) || !isTemperatureUnit(to)) {
    return amount;
  }

  // F to C
  if ((from === 'f' || from === 'fahrenheit') && (to === 'c' || to === 'celsius')) {
    return (amount - 32) * 5 / 9;
  }

  // C to F
  if ((from === 'c' || from === 'celsius') && (to === 'f' || to === 'fahrenheit')) {
    return (amount * 9 / 5) + 32;
  }

  return amount; // Same unit
}

/**
 * Convert any unit to target system
 */
export function convertUnit(amount: number, fromUnit: string, toUnit: string): number {
  if (isVolumeUnit(fromUnit) && isVolumeUnit(toUnit)) {
    return convertVolume(amount, fromUnit, toUnit);
  }
  if (isWeightUnit(fromUnit) && isWeightUnit(toUnit)) {
    return convertWeight(amount, fromUnit, toUnit);
  }
  if (isTemperatureUnit(fromUnit) && isTemperatureUnit(toUnit)) {
    return convertTemperature(amount, fromUnit, toUnit);
  }
  return amount; // Can't convert between different types
}

/**
 * Smart auto-conversion to target unit system (metric or imperial)
 * Chooses appropriate unit based on amount
 */
export function autoConvert(amount: number, unit: string, targetSystem: UnitSystem): { amount: number; unit: string } {
  const normalized = normalizeUnit(unit);
  const currentSystem = getUnitSystem(unit);

  // Already in target system
  if (currentSystem === targetSystem) {
    return { amount, unit };
  }

  // Can't convert (not a known unit)
  if (!currentSystem) {
    return { amount, unit };
  }

  // VOLUME CONVERSIONS
  if (isVolumeUnit(normalized)) {
    if (targetSystem === 'metric') {
      const ml = amount * VOLUME_TO_ML[normalized];

      // Choose best metric unit
      if (ml >= 1000) {
        return { amount: Math.round(ml / 1000 * 10) / 10, unit: 'l' };
      }
      return { amount: Math.round(ml), unit: 'ml' };
    } else {
      // Convert to imperial
      const ml = amount * VOLUME_TO_ML[normalized];

      // Choose best imperial unit
      if (ml >= 3785) { // gallon
        return { amount: Math.round(ml / 3785.41 * 10) / 10, unit: 'gallon' };
      }
      if (ml >= 946) { // quart
        return { amount: Math.round(ml / 946.353 * 10) / 10, unit: 'quart' };
      }
      if (ml >= 473) { // pint
        return { amount: Math.round(ml / 473.176 * 10) / 10, unit: 'pint' };
      }
      if (ml >= 236) { // cup
        return { amount: Math.round(ml / 236.588 * 10) / 10, unit: 'cup' };
      }
      if (ml >= 29.5) { // fl oz
        return { amount: Math.round(ml / 29.5735 * 10) / 10, unit: 'fl oz' };
      }
      if (ml >= 14.8) { // tbsp
        return { amount: Math.round(ml / 14.7868 * 10) / 10, unit: 'tbsp' };
      }
      return { amount: Math.round(ml / 4.92892 * 10) / 10, unit: 'tsp' };
    }
  }

  // WEIGHT CONVERSIONS
  if (isWeightUnit(normalized)) {
    if (targetSystem === 'metric') {
      const grams = amount * WEIGHT_TO_GRAMS[normalized];

      // Choose best metric unit
      if (grams >= 1000) {
        return { amount: Math.round(grams / 1000 * 100) / 100, unit: 'kg' };
      }
      return { amount: Math.round(grams), unit: 'g' };
    } else {
      // Convert to imperial
      const grams = amount * WEIGHT_TO_GRAMS[normalized];

      // Choose best imperial unit
      if (grams >= 453) { // pound
        return { amount: Math.round(grams / 453.592 * 100) / 100, unit: 'lb' };
      }
      return { amount: Math.round(grams / 28.3495 * 10) / 10, unit: 'oz' };
    }
  }

  // TEMPERATURE CONVERSIONS
  if (isTemperatureUnit(normalized)) {
    if (targetSystem === 'metric') {
      return { amount: Math.round(convertTemperature(amount, unit, 'c')), unit: '°C' };
    } else {
      return { amount: Math.round(convertTemperature(amount, unit, 'f')), unit: '°F' };
    }
  }

  return { amount, unit };
}

/**
 * Format a number to nice fraction for display (1/4, 1/2, 3/4)
 */
export function toNiceFraction(value: number): string {
  const rounded = Math.round(value * 4) / 4;
  const whole = Math.trunc(rounded);
  const frac = Math.round((rounded - whole) * 4);
  const fracMap: Record<number, string> = { 0: '', 1: '¼', 2: '½', 3: '¾' };
  const fracStr = fracMap[frac];
  if (!whole && fracStr) return fracStr;
  if (whole && fracStr) return `${whole} ${fracStr}`;
  return `${whole}`;
}

/**
 * Scale an ingredient amount by a multiplier
 */
export function scaleAmount(amount: number, multiplier: number): string {
  return toNiceFraction(amount * multiplier);
}
