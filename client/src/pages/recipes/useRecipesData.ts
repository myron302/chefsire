import { useMemo } from "react";
import { useRecipesFilters } from "./useRecipesFilters";

export type RecipesPost = {
  id: string | number;
  title?: string;
  caption?: string;
  image?: string | null;
  imageUrl?: string | null;
  cuisine?: string;
  category?: string;
  isRecipe?: boolean;
  author?: string;
  user?: { displayName?: string; avatar?: string };
  cookTime?: number;
  rating?: number; // 0..5
  likes?: number;
  difficulty?: "Easy" | "Medium" | "Hard";
  mealType?: string;
  dietary?: string[];
  createdAt?: string;
  recipe?: {
    title: string;
    cookTime?: number;
    servings?: number;
    difficulty?: "Easy" | "Medium" | "Hard";
    cuisine?: string;
    ingredients: string[];
    instructions: string[];
    ratingSpoons?: number;
    dietTags?: string[];
    allergens?: string[];
  };
};

// Demo feed (always shows while backend is wiring up)
const DEMO: RecipesPost[] = [
  {
    id: "1",
    title: "Margherita Pizza",
    image: "https://images.unsplash.com/photo-1548365328-8b84986da7b3?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Italian",
    isRecipe: true,
    author: "Giulia",
    cookTime: 25,
    difficulty: "Easy",
    rating: 4.7,
    likes: 223,
    mealType: "Dinner",
    dietary: ["Vegetarian"],
    createdAt: "2025-09-08T12:00:00Z",
    user: { displayName: "Giulia" },
    recipe: {
      title: "Margherita Pizza",
      cookTime: 25,
      servings: 2,
      difficulty: "Easy",
      cuisine: "Italian",
      ingredients: ["Pizza dough","Tomato sauce","Mozzarella","Basil","Olive oil","Salt"],
      instructions: [
        "Preheat oven to 500°F / 260°C.",
        "Stretch dough, add sauce and mozzarella.",
        "Bake 7–10 min. Finish with basil and oil.",
      ],
      ratingSpoons: 4.7,
      dietTags: ["Vegetarian"],
      allergens: ["Gluten","Dairy"],
    },
  },
  {
    id: "2",
    title: "Rainbow Salad",
    image: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Healthy",
    isRecipe: true,
    author: "Ava",
    cookTime: 10,
    difficulty: "Easy",
    rating: 4.2,
    likes: 150,
    mealType: "Lunch",
    dietary: ["Vegan","Gluten-Free"],
    createdAt: "2025-09-07T10:00:00Z",
    user: { displayName: "Ava" },
    recipe: {
      title: "Rainbow Salad",
      cookTime: 10,
      servings: 2,
      difficulty: "Easy",
      cuisine: "Healthy",
      ingredients: ["Lettuce","Cherry tomatoes","Cucumber","Bell pepper","Corn","Olive oil","Lemon"],
      instructions: [
        "Chop veggies.",
        "Whisk oil and lemon.",
        "Toss and season.",
      ],
      ratingSpoons: 4.2,
      dietTags: ["Vegan","Gluten-Free"],
      allergens: [],
    },
  },
  {
    id: "3",
    title: "Choco Truffles",
    image: "https://images.unsplash.com/photo-1541781286675-09c7e9d404bc?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Desserts",
    isRecipe: true,
    author: "Noah",
    cookTime: 45,
    difficulty: "Medium",
    rating: 4.9,
    likes: 512,
    mealType: "Dessert",
    dietary: ["Vegetarian"],
    createdAt: "2025-09-05T18:30:00Z",
    user: { displayName: "Noah" },
    recipe: {
      title: "Choco Truffles",
      cookTime: 45,
      servings: 6,
      difficulty: "Medium",
      cuisine: "Desserts",
      ingredients: ["Dark chocolate","Cream","Butter","Cocoa powder","Salt"],
      instructions: [
        "Heat cream, pour over chocolate.",
        "Stir, chill, scoop balls.",
        "Roll in cocoa.",
      ],
      ratingSpoons: 4.9,
      dietTags: ["Vegetarian"],
      allergens: ["Dairy"],
    },
  },
  {
    id: "4",
    title: "Spicy Ramen",
    image: "https://images.unsplash.com/photo-1546549039-49cc4f5b3c89?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Asian",
    isRecipe: true,
    author: "Rin",
    cookTime: 30,
    difficulty: "Medium",
    rating: 4.5,
    likes: 340,
    mealType: "Dinner",
    dietary: [],
    createdAt: "2025-09-03T21:15:00Z",
    user: { displayName: "Rin" },
    recipe: {
      title: "Spicy Ramen",
      cookTime: 30,
      servings: 1,
      difficulty: "Medium",
      cuisine: "Asian",
      ingredients: ["Ramen noodles","Stock","Chili paste","Soy sauce","Egg","Scallions"],
      instructions: [
        "Simmer stock with chili and soy.",
        "Boil noodles, add to bowl.",
        "Top with egg and scallions.",
      ],
      ratingSpoons: 4.5,
      dietTags: [],
      allergens: ["Gluten","Eggs","Soy"],
    },
  },
  {
    id: "5",
    title: "BBQ Brisket",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop",
    cuisine: "BBQ",
    isRecipe: false,
    author: "Mason",
    cookTime: 240,
    difficulty: "Hard",
    rating: 4.1,
    likes: 98,
    mealType: "Dinner",
    dietary: [],
    createdAt: "2025-09-09T14:45:00Z",
    user: { displayName: "Mason" },
    recipe: {
      title: "BBQ Brisket",
      cookTime: 240,
      servings: 6,
      difficulty: "Hard",
      cuisine: "BBQ",
      ingredients: ["Beef brisket","BBQ rub","Smoke wood","Sauce","Salt"],
      instructions: [
        "Rub brisket, rest overnight.",
        "Smoke low & slow till tender.",
        "Slice and serve with sauce.",
      ],
      ratingSpoons: 4.1,
      dietTags: [],
      allergens: [],
    },
  },
  {
    id: "6",
    title: "Avocado Toast",
    image: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Breakfast",
    isRecipe: true,
    author: "Ivy",
    cookTime: 8,
    difficulty: "Easy",
    rating: 4.0,
    likes: 77,
    mealType: "Breakfast",
    dietary: ["Vegetarian"],
    createdAt: "2025-09-10T08:05:00Z",
    user: { displayName: "Ivy" },
    recipe: {
      title: "Avocado Toast",
      cookTime: 8,
      servings: 1,
      difficulty: "Easy",
      cuisine: "Breakfast",
      ingredients: ["Bread","Avocado","Lemon","Chili flakes","Salt","Olive oil"],
      instructions: ["Toast bread","Mash avocado with lemon","Assemble and season"],
      ratingSpoons: 4.0,
      dietTags: ["Vegetarian"],
      allergens: ["Gluten"],
    },
  },
];

// Very simple pantry matching for demo (looks for word overlap)
function matchAgainstPantry(ingredients: string[], pantry: string[]) {
  const total = ingredients.length || 1;
  let have = 0;
  for (const ing of ingredients) {
    const key = ing.toLowerCase().split(/[ ,()-]/)[0];
    if (pantry.some((p) => p.toLowerCase().includes(key))) have++;
  }
  return { have, missing: total - have, total };
}

export function useRecipesData() {
  const f = useRecipesFilters();

  // Demo pantry; replace with your real pantry hook later
  const pantryList: string[] = ["Salt","Olive oil","Bread","Egg","Tomato","Basil","Soy sauce"];

  const list = useMemo(() => {
    let arr = DEMO;

    // Filter logic
    arr = arr.filter((p) => {
      if (f.onlyRecipes && !p.isRecipe) return false;
      if (f.selectedCuisines.length && !f.selectedCuisines.includes(p.cuisine || p.recipe?.cuisine || "")) return false;
      if (f.selectedMealTypes.length && !f.selectedMealTypes.includes(p.mealType || "")) return false;
      if (f.selectedDietary.length) {
        const tags = p.recipe?.dietTags || p.dietary || [];
        if (!f.selectedDietary.every((d) => tags.includes(d))) return false;
      }
      if (f.selectedDifficulty && p.recipe?.difficulty !== f.selectedDifficulty) return false;
      if (f.maxCookTime && (p.recipe?.cookTime || p.cookTime || 0) > f.maxCookTime) return false;
      if (f.minRating && (p.recipe?.ratingSpoons || p.rating || 0) < f.minRating) return false;

      // Allergens exclusion
      if (f.excludedAllergens.length) {
        const al = p.recipe?.allergens || [];
        if (al.some((a) => f.excludedAllergens.includes(a))) return false;
      }
      // Ethnicities are descriptive; for demo we’ll treat them like cuisines—skip unless needed
      return true;
    });

    // Pantry mode
    let enriched = arr.map((p) => {
      const ingredients = p.recipe?.ingredients || [];
      const m = f.cookFromPantry ? matchAgainstPantry(ingredients, pantryList) : null;
      return { ...p, _match: m };
    });

    if (f.cookFromPantry) {
      enriched = enriched
        .filter((p) => (p as any)._match?.missing <= f.maxMissing)
        .sort((a: any, b: any) => (b._match?.have || 0) - (a._match?.have || 0));
    } else {
      // Sort
      enriched = [...enriched].sort((a, b) => {
        if (f.sortBy === "likes") return (b.likes || 0) - (a.likes || 0);
        if (f.sortBy === "rating")
          return (b.recipe?.ratingSpoons || b.rating || 0) - (a.recipe?.ratingSpoons || a.rating || 0);
        // newest
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
    }

    return enriched;
  }, [f]);

  return { items: list };
}
