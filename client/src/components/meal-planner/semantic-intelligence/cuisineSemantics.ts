import type { CuisineSemanticIdentity } from './semanticTypes';

export const deriveCuisineIdentity = (meal: any): string[] => {
  const text = `${meal?.title || meal?.name || ''} ${meal?.description || ''}`.toLowerCase();
  const matches: string[] = [];
  if (/mediterranean|greek|hummus|tzatziki/.test(text)) matches.push('Mediterranean');
  if (/ramen|udon|pho|noodle/.test(text)) matches.push('Asian noodle comfort');
  if (/taco|burrito|salsa|mexican/.test(text)) matches.push('Fresh Mexican bowls');
  if (/casserole|meatloaf|mac/.test(text)) matches.push('Comfort American');
  if (/roast|stew|winter/.test(text)) matches.push('Hearty winter meals');
  if (/salad|citrus|grilled/.test(text)) matches.push('Bright summer meals');
  return matches.length ? matches : ['General home cooking'];
};

export const deriveFlavorArchetypes = (meal: any): string[] => {
  const text = `${meal?.title || meal?.name || ''} ${meal?.description || ''}`.toLowerCase();
  const flavors: string[] = [];
  if (/spicy|chili|hot/.test(text)) flavors.push('spicy-heat');
  if (/citrus|lemon|lime|vinegar/.test(text)) flavors.push('bright-acidic');
  if (/cream|butter|cheese/.test(text)) flavors.push('rich-creamy');
  if (/herb|fresh|mint|basil/.test(text)) flavors.push('herbaceous-fresh');
  if (/smoke|bbq|grill/.test(text)) flavors.push('smoky-savory');
  return flavors.length ? flavors : ['balanced-savory'];
};

export const deriveIngredientSemanticClusters = (meal: any): string[] => {
  const items = (meal?.mealItems || []).map((item: any) => String(item?.name || item || '').toLowerCase());
  const clusters: string[] = [];
  if (items.some((item: string) => /beans|lentil|chickpea/.test(item))) clusters.push('plant-protein');
  if (items.some((item: string) => /rice|quinoa|grain|pasta|noodle/.test(item))) clusters.push('carb-foundation');
  if (items.some((item: string) => /chicken|beef|pork|salmon|tofu/.test(item))) clusters.push('centerpiece-protein');
  if (items.some((item: string) => /spinach|kale|lettuce|tomato|pepper/.test(item))) clusters.push('fresh-produce');
  if (items.some((item: string) => /broth|stock/.test(item))) clusters.push('restorative-liquid-base');
  return clusters.length ? clusters : ['mixed-ingredients'];
};

export const deriveCuisineSemanticProfile = (meal: any): CuisineSemanticIdentity => ({
  cuisineFamilies: deriveCuisineIdentity(meal),
  flavorArchetypes: deriveFlavorArchetypes(meal),
  ingredientClusters: deriveIngredientSemanticClusters(meal),
});
