import { createCanonicalIndexResolver } from "./canonical-index";

export type CanonicalDrinkIndexEntry = {
  slug: string;
  name: string;
  route: string;
  sourceRoute: string;
  sourceTitle?: string;
  image?: string | null;
};

const drinkIndexResolver = createCanonicalIndexResolver<CanonicalDrinkIndexEntry>({
  generatedFileName: "drink-index.json",
  fallbackCollections: ["recipes"],
});

export function getCanonicalDrinkBySlug(slug: string): CanonicalDrinkIndexEntry | null {
  return drinkIndexResolver.getBySlug(slug);
}
