import { createCanonicalIndexResolver } from "./canonical-index";

export type CanonicalPetFoodIndexEntry = {
  slug: string;
  name: string;
  route: string;
  sourceRoute: string;
  sourceTitle?: string;
  image?: string | null;
};

const petFoodIndexResolver = createCanonicalIndexResolver<CanonicalPetFoodIndexEntry>({
  generatedFileName: "pet-food-index.json",
});

export function getCanonicalPetFoodBySlug(slug: string): CanonicalPetFoodIndexEntry | null {
  return petFoodIndexResolver.getBySlug(slug);
}
