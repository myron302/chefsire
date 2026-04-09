export type RecipeItem = {
  id: string;
  title: string;

  // images (varies by mapper)
  image?: string | null;
  imageUrl?: string | null;
  thumbnail?: string | null;

  // categorization
  cuisine?: string | null;
  mealType?: string | null;
  dietTags?: string[];

  // meta
  ratingSpoons?: number | null;
  averageRating?: string | number | null; // From local database recipes
  cookTime?: number | null;
  servings?: number | null;

  // instructions (many possible shapes)
  instructions?: string | string[] | null;
  instruction?: string | string[] | null;
  steps?: string[] | { step?: string }[] | null;
  analyzedInstructions?: { steps?: { step?: string }[] }[] | null;
  strInstructions?: string | null; // raw MealDB sometimes leaks through

  // source links (varies by mapper)
  sourceUrl?: string | null;
  sourceURL?: string | null;
  source_link?: string | null;
  url?: string | null;
  source?: "all" | "chefsire" | "external" | string | null; // sometimes a URL, sometimes just a label
};

export type SearchOk = { ok: true; total?: number; source?: string; items: RecipeItem[]; hasMore?: boolean };
export type SearchErr = { ok: false; error: string };
export type SearchResponse = SearchOk | SearchErr;
