export type DrinkRecipe = {
  id: string;
  name: string;
  description?: string;
  ingredients?: any;
  instructions?: any;
  imageUrl?: string;
  tags?: string[];
  [key: string]: any;
};

export function slugifyDrinkName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
