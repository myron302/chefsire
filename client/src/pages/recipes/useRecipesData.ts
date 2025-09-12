// client/src/pages/recipes/useRecipesData.ts
import { useQuery } from "@tanstack/react-query";
import { buildApiQuery, normalizeApiRecipe, passesLocalRules, NormalizedRecipePost } from "@/lib/recipesApiAdapter";
import { useRecipesFilters } from "./useRecipesFilters";

/**
 * This hook tries to call /api/recipes/search (your backend aggregator).
 * If that 404s/503s or returns nothing, it falls back to a small in-memory demo list
 * so your UI stays populated while you wire up the real provider calls.
 */
export function useRecipesData() {
  const { state } = useRecipesFilters();

  return useQuery<NormalizedRecipePost[]>({
    queryKey: ["/api/recipes/search", state],
    queryFn: async () => {
      const q = buildApiQuery(state);

      // Build querystring your backend could understand later
      const params = new URLSearchParams();
      q.cuisines.forEach((c) => params.append("cuisine", c));
      q.diets.forEach((d) => params.append("diet", d));
      q.mealTypes.forEach((m) => params.append("meal", m));
      if (q.maxReadyMinutes) params.set("maxReadyMinutes", String(q.maxReadyMinutes));
      params.set("pageSize", String(q.pageSize));
      params.set("sortBy", q.sortBy);

      // Try backend aggregator (safe to fail)
      try {
        const res = await fetch(`/api/recipes/search?${params.toString()}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const raw = Array.isArray(data?.results) ? data.results : [];
          const normalized: NormalizedRecipePost[] = raw.map(normalizeApiRecipe);
          const filtered = normalized.filter((n) => passesLocalRules(n, state));
          return sortClient(filtered, q.sortBy);
        }
      } catch {
        // ignore and fall back
      }

      // Fallback: demo items (so you always see content)
      const demo = getDemoRecipes();
      const filtered = demo.filter((n) => passesLocalRules(n, state));
      return sortClient(filtered, q.sortBy);
    },
    staleTime: 30_000,
    keepPreviousData: true,
  });
}

function sortClient(items: NormalizedRecipePost[], sortBy: string) {
  if (sortBy === "rating") {
    return [...items].sort((a, b) => (b.recipe.ratingSpoons ?? 0) - (a.recipe.ratingSpoons ?? 0));
  }
  if (sortBy === "likes") {
    return [...items].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
  }
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function getDemoRecipes(): NormalizedRecipePost[] {
  // Mirrors the six demo posts you had earlier, normalized to our shape
  return [
    {
      id: "demo-1",
      isRecipe: true,
      createdAt: "2025-09-08T12:00:00Z",
      image: "https://images.unsplash.com/photo-1548365328-8b84986da7b3?q=80&w=1200&auto=format&fit=crop",
      user: { displayName: "Giulia" },
      likes: 223,
      comments: 12,
      recipe: {
        title: "Margherita Pizza",
        cookTime: 25,
        servings: 2,
        difficulty: "Easy",
        cuisine: "Italian",
        mealType: "Dinner",
        ingredients: ["Pizza dough", "Tomato sauce", "Mozzarella", "Basil"],
        instructions: ["Stretch dough", "Add toppings", "Bake 10–12 min"],
        ratingSpoons: 5,
        dietTags: ["Vegetarian"],
        ethnicities: ["Italian"],
      },
    },
    {
      id: "demo-2",
      isRecipe: true,
      createdAt: "2025-09-07T10:00:00Z",
      image: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?q=80&w=1200&auto=format&fit=crop",
      user: { displayName: "Ava" },
      likes: 150,
      comments: 8,
      recipe: {
        title: "Rainbow Salad",
        cookTime: 10,
        servings: 2,
        difficulty: "Easy",
        cuisine: "Healthy",
        mealType: "Lunch",
        ingredients: ["Mixed greens", "Tomatoes", "Cucumber", "Peppers"],
        instructions: ["Chop veggies", "Toss with dressing"],
        ratingSpoons: 4,
        dietTags: ["Vegan", "Gluten-Free"],
      },
    },
    {
      id: "demo-3",
      isRecipe: true,
      createdAt: "2025-09-05T18:30:00Z",
      image: "https://images.unsplash.com/photo-1541781286675-09c7e9d404bc?q=80&w=1200&auto=format&fit=crop",
      user: { displayName: "Noah" },
      likes: 512,
      comments: 44,
      recipe: {
        title: "Choco Truffles",
        cookTime: 45,
        servings: 12,
        difficulty: "Medium",
        cuisine: "Desserts",
        mealType: "Dessert",
        ingredients: ["Chocolate", "Cream", "Cocoa powder"],
        instructions: ["Melt", "Chill", "Roll"],
        ratingSpoons: 5,
        dietTags: ["Vegetarian"],
      },
    },
    {
      id: "demo-4",
      isRecipe: true,
      createdAt: "2025-09-03T21:15:00Z",
      image: "https://images.unsplash.com/photo-1546549039-49cc4f5b3c89?q=80&w=1200&auto=format&fit=crop",
      user: { displayName: "Rin" },
      likes: 340,
      comments: 19,
      recipe: {
        title: "Spicy Ramen",
        cookTime: 30,
        servings: 1,
        difficulty: "Medium",
        cuisine: "Asian",
        mealType: "Dinner",
        ingredients: ["Ramen noodles", "Broth", "Chili oil", "Egg"],
        instructions: ["Boil noodles", "Simmer broth", "Assemble bowl"],
        ratingSpoons: 4,
      },
    },
    {
      id: "demo-5",
      isRecipe: true,
      createdAt: "2025-09-09T14:45:00Z",
      image: "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop",
      user: { displayName: "Mason" },
      likes: 98,
      comments: 7,
      recipe: {
        title: "BBQ Brisket",
        cookTime: 240,
        servings: 6,
        difficulty: "Hard",
        cuisine: "BBQ",
        mealType: "Dinner",
        ingredients: ["Brisket", "Rub", "BBQ sauce"],
        instructions: ["Season", "Smoke low & slow"],
        ratingSpoons: 4,
      },
    },
    {
      id: "demo-6",
      isRecipe: true,
      createdAt: "2025-09-10T08:05:00Z",
      image: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=1200&auto=format&fit=crop",
      user: { displayName: "Ivy" },
      likes: 77,
      comments: 3,
      recipe: {
        title: "Avocado Toast",
        cookTime: 8,
        servings: 1,
        difficulty: "Easy",
        cuisine: "Breakfast",
        mealType: "Breakfast",
        ingredients: ["Bread", "Avocado", "Salt", "Pepper"],
        instructions: ["Toast bread", "Mash avocado", "Assemble"],
        ratingSpoons: 3,
        dietTags: ["Vegetarian"],
      },
    },
  ];
}
