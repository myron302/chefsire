// client/src/contexts/DrinksContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/* =========================
   Types
   ========================= */
export interface DrinkItem {
  id: string;
  name: string;
  category: "smoothies" | "protein-shakes" | "detoxes" | "potent-potables";
  description?: string;
  image?: string;
  ingredients?: string[];
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  difficulty?: "Easy" | "Medium" | "Hard";
  prepTime?: number;
  rating?: number;
  reviews?: number;
  tags?: string[];
  featured?: boolean;
  trending?: boolean;
  fitnessGoal?: string;
  bestTime?: string;
}

export interface UserProgress {
  totalDrinksMade: number;
  totalPoints: number;
  level: number;
  currentStreak: number;
  achievements: string[];
  favoriteCategories: string[];
  dailyGoalProgress: number;
}

interface DrinksContextType {
  // Search functionality
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: DrinkItem[];
  isSearching: boolean;

  // Favorites system
  favorites: DrinkItem[];
  addToFavorites: (drink: DrinkItem) => void;
  removeFromFavorites: (drinkId: string) => void;
  isFavorite: (drinkId: string) => boolean;

  // User progress tracking
  userProgress: UserProgress;
  addPoints: (points: number) => void;
  incrementDrinksMade: () => void;
  updateStreak: () => void;
  unlockAchievement: (achievement: string) => void;

  // Cross-page functionality
  recentlyViewed: DrinkItem[];
  addToRecentlyViewed: (drink: DrinkItem) => void;
  clearRecentlyViewed: () => void;

  // Global actions
  searchAllCategories: (query: string) => Promise<DrinkItem[]>;
  getRecommendations: (category?: string) => DrinkItem[];
  getTrendingDrinks: () => DrinkItem[];
}

const DrinksContext = createContext<DrinksContextType | undefined>(undefined);

/* =========================
   Helpers (safe storage + sanitize)
   ========================= */
const num = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

const safeLoadJSON = <T,>(key: string, fallback: T): T => {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const safeSaveJSON = (key: string, value: any) => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

// Known categories guard
const validCategory = new Set([
  "smoothies",
  "protein-shakes",
  "detoxes",
  "potent-potables",
]);

const sanitizeDrink = (d: any): DrinkItem => ({
  id: String(d?.id ?? cryptoRandomId()),
  name: String(d?.name ?? "Untitled"),
  category: validCategory.has(d?.category) ? d.category : "smoothies",
  description: typeof d?.description === "string" ? d.description : undefined,
  image: typeof d?.image === "string" ? d.image : undefined,
  ingredients: Array.isArray(d?.ingredients)
    ? d.ingredients.map(String)
    : undefined,
  nutrition: {
    calories: typeof d?.nutrition?.calories === "number" ? d.nutrition.calories : undefined,
    protein: typeof d?.nutrition?.protein === "number" ? d.nutrition.protein : undefined,
    carbs: typeof d?.nutrition?.carbs === "number" ? d.nutrition.carbs : undefined,
    fat: typeof d?.nutrition?.fat === "number" ? d.nutrition.fat : undefined,
  },
  difficulty: ["Easy", "Medium", "Hard"].includes(d?.difficulty) ? d.difficulty : undefined,
  prepTime: typeof d?.prepTime === "number" ? d.prepTime : undefined,
  rating: typeof d?.rating === "number" ? d.rating : undefined,
  reviews: typeof d?.reviews === "number" ? d.reviews : undefined,
  tags: Array.isArray(d?.tags) ? d.tags.filter((t: any) => typeof t === "string") : undefined,
  featured: !!d?.featured,
  trending: !!d?.trending,
  fitnessGoal: typeof d?.fitnessGoal === "string" ? d.fitnessGoal : undefined,
  bestTime: typeof d?.bestTime === "string" ? d.bestTime : undefined,
});

const sanitizeProgress = (p: any): UserProgress => ({
  totalDrinksMade: num(p?.totalDrinksMade, 0),
  totalPoints: num(p?.totalPoints, 0),
  level: Math.max(1, num(p?.level, 1)),
  currentStreak: num(p?.currentStreak, 0),
  achievements: Array.isArray(p?.achievements)
    ? p.achievements.filter((x: any) => typeof x === "string")
    : [],
  favoriteCategories: Array.isArray(p?.favoriteCategories)
    ? p.favoriteCategories.filter((c: any) => typeof c === "string" && validCategory.has(c))
    : [],
  dailyGoalProgress: clamp(num(p?.dailyGoalProgress, 0), 0, 100),
});

const cryptoRandomId = () =>
  Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 7);

/* =========================
   Sample data (unchanged)
   ========================= */
const SAMPLE_DRINKS: DrinkItem[] = [
  // Smoothies
  {
    id: "smoothie-1",
    name: "Green Goddess Smoothie",
    category: "smoothies",
    description: "Nutrient-packed green smoothie with spinach and mango",
    image:
      "https://images.unsplash.com/photo-1638176066666-ffb2f013c7dd?w=400&h=300&fit=crop",
    ingredients: ["Spinach", "Mango", "Banana", "Coconut water", "Chia seeds"],
    nutrition: { calories: 220, protein: 6, carbs: 45, fat: 4 },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.8,
    reviews: 324,
    tags: ["Green", "Antioxidants", "Energy"],
    featured: true,
    trending: true,
    fitnessGoal: "Energy & Recovery",
    bestTime: "Morning",
  },
  {
    id: "smoothie-2",
    name: "Chocolate Peanut Butter Protein",
    category: "smoothies",
    description: "Rich and creamy post-workout smoothie",
    ingredients: ["Chocolate protein powder", "Peanut butter", "Banana", "Almond milk"],
    nutrition: { calories: 380, protein: 25, carbs: 35, fat: 12 },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.9,
    reviews: 567,
    tags: ["Protein", "Post-workout", "Chocolate"],
    featured: false,
    trending: false,
    fitnessGoal: "Muscle Building",
    bestTime: "Post-workout",
  },

  // Protein Shakes
  {
    id: "protein-1",
    name: "Classic Vanilla Whey",
    category: "protein-shakes",
    description: "Simple and effective whey protein shake",
    ingredients: ["Whey protein isolate", "Vanilla extract", "Water", "Ice"],
    nutrition: { calories: 140, protein: 30, carbs: 2, fat: 1 },
    difficulty: "Easy",
    prepTime: 2,
    rating: 4.6,
    reviews: 890,
    tags: ["Whey", "Quick", "Low-carb"],
    featured: true,
    trending: false,
    fitnessGoal: "Muscle Building",
    bestTime: "Post-workout",
  },
  {
    id: "protein-2",
    name: "Plant Power Green",
    category: "protein-shakes",
    description: "Vegan protein with greens and superfoods",
    ingredients: ["Pea protein", "Spirulina", "Spinach", "Coconut milk", "Hemp seeds"],
    nutrition: { calories: 280, protein: 22, carbs: 18, fat: 8 },
    difficulty: "Medium",
    prepTime: 5,
    rating: 4.4,
    reviews: 234,
    tags: ["Vegan", "Superfoods", "Green"],
    featured: false,
    trending: true,
    fitnessGoal: "General Health",
    bestTime: "Morning",
  },

  // Detoxes
  {
    id: "detox-1",
    name: "Lemon Ginger Cleanse",
    category: "detoxes",
    description: "Traditional cleansing blend with metabolism boost",
    ingredients: ["Lemon juice", "Fresh ginger", "Cayenne pepper", "Maple syrup", "Water"],
    nutrition: { calories: 45, protein: 0, carbs: 12, fat: 0 },
    difficulty: "Easy",
    prepTime: 3,
    rating: 4.3,
    reviews: 678,
    tags: ["Cleanse", "Metabolism", "Traditional"],
    featured: true,
    trending: false,
    fitnessGoal: "Detox",
    bestTime: "Morning",
  },
  {
    id: "detox-2",
    name: "Green Detox Smoothie",
    category: "detoxes",
    description: "Gentle green cleanse with fruits",
    ingredients: ["Cucumber", "Celery", "Green apple", "Spinach", "Lemon"],
    nutrition: { calories: 95, protein: 2, carbs: 22, fat: 1 },
    difficulty: "Easy",
    prepTime: 5,
    rating: 4.5,
    reviews: 445,
    tags: ["Green", "Gentle", "Hydrating"],
    featured: false,
    trending: true,
    fitnessGoal: "Detox",
    bestTime: "Afternoon",
  },

  // Potent Potables
  {
    id: "cocktail-1",
    name: "Classic Old Fashioned",
    category: "potent-potables",
    description: "Timeless whiskey cocktail with bitters",
    ingredients: ["Bourbon whiskey", "Sugar cube", "Angostura bitters", "Orange peel"],
    nutrition: { calories: 185, protein: 0, carbs: 4, fat: 0 },
    difficulty: "Medium",
    prepTime: 5,
    rating: 4.7,
    reviews: 1234,
    tags: ["Classic", "Whiskey", "Sophisticated"],
    featured: true,
    trending: false,
    bestTime: "Evening",
  },
  {
    id: "mocktail-1",
    name: "Virgin Mojito",
    category: "potent-potables",
    description: "Refreshing mint and lime mocktail",
    ingredients: ["Fresh mint", "Lime juice", "Sugar", "Club soda", "Ice"],
    nutrition: { calories: 65, protein: 0, carbs: 17, fat: 0 },
    difficulty: "Easy",
    prepTime: 3,
    rating: 4.4,
    reviews: 567,
    tags: ["Mocktail", "Refreshing", "Mint"],
    featured: false,
    trending: true,
    bestTime: "Afternoon",
  },
];

/* =========================
   Provider
   ========================= */
export function DrinksProvider({ children }: { children: React.ReactNode }) {
  // ---- Load synchronously (prevents first-render flicker/crash) ----
  const initialFavorites = safeLoadJSON<DrinkItem[]>("drinksFavorites", []).map(
    sanitizeDrink
  );
  const initialRecentlyViewed = safeLoadJSON<DrinkItem[]>("recentlyViewed", []).map(
    sanitizeDrink
  );
  const initialProgress = sanitizeProgress(
    safeLoadJSON<UserProgress>("userProgress", {
      totalDrinksMade: 47,
      totalPoints: 2850,
      level: 12,
      currentStreak: 5,
      achievements: ["First Drink", "Green Goddess", "Protein Master", "Week Warrior"],
      favoriteCategories: ["smoothies", "protein-shakes"],
      dailyGoalProgress: 75,
    })
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DrinkItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [favorites, setFavorites] = useState<DrinkItem[]>(initialFavorites);
  const [recentlyViewed, setRecentlyViewed] =
    useState<DrinkItem[]>(initialRecentlyViewed);
  const [userProgress, setUserProgress] = useState<UserProgress>(initialProgress);

  // ---- Proactively clean known bad date keys (prevents site-wide “Invalid time value”) ----
  useEffect(() => {
    try {
      const resetAt = localStorage.getItem("cs.resetAt");
      if (resetAt && isNaN(new Date(resetAt).getTime())) localStorage.removeItem("cs.resetAt");
      const lastDrinkAt = localStorage.getItem("cs.lastDrinkAt");
      if (lastDrinkAt && isNaN(new Date(lastDrinkAt).getTime()))
        localStorage.removeItem("cs.lastDrinkAt");
    } catch {}
  }, []);

  // ---- Persist safely ----
  useEffect(() => safeSaveJSON("drinksFavorites", favorites), [favorites]);
  useEffect(() => safeSaveJSON("recentlyViewed", recentlyViewed), [recentlyViewed]);
  useEffect(() => safeSaveJSON("userProgress", userProgress), [userProgress]);

  // ---- Search ----
  const searchAllCategories = async (query: string): Promise<DrinkItem[]> => {
    setIsSearching(true);
    await new Promise((r) => setTimeout(r, 300)); // simulate API
    const q = query.toLowerCase();
    const results = SAMPLE_DRINKS.filter(
      (drink) =>
        drink.name.toLowerCase().includes(q) ||
        drink.description?.toLowerCase().includes(q) ||
        drink.ingredients?.some((ing) => ing.toLowerCase().includes(q)) ||
        drink.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
    setSearchResults(results);
    setIsSearching(false);
    return results;
  };

  useEffect(() => {
    if (searchQuery.trim().length) void searchAllCategories(searchQuery);
    else setSearchResults([]);
  }, [searchQuery]);

  // ---- Favorites ----
  const isFavorite = (drinkId: string) => favorites.some((d) => d.id === drinkId);

  const addToFavorites = (drink: DrinkItem) => {
    if (!isFavorite(drink.id)) {
      setFavorites((prev) => [sanitizeDrink(drink), ...prev]);
      addPoints(10);
    }
  };

  const removeFromFavorites = (drinkId: string) => {
    setFavorites((prev) => prev.filter((d) => d.id !== drinkId));
  };

  // ---- Recently viewed ----
  const addToRecentlyViewed = (drink: DrinkItem) => {
    const clean = sanitizeDrink(drink);
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((i) => i.id !== clean.id);
      return [clean, ...filtered].slice(0, 10);
    });
  };
  const clearRecentlyViewed = () => setRecentlyViewed([]);

  // ---- Progress / XP ----
  const addPoints = (points: number) => {
    setUserProgress((prev) => {
      const totalPoints = num(prev.totalPoints, 0) + num(points, 0);
      const level = Math.max(1, Math.floor(totalPoints / 250) + 1);
      return { ...prev, totalPoints, level };
    });
  };

  const incrementDrinksMade = () => {
    setUserProgress((prev) => ({
      ...prev,
      totalDrinksMade: num(prev.totalDrinksMade, 0) + 1,
      dailyGoalProgress: clamp(num(prev.dailyGoalProgress, 0) + 25, 0, 100),
    }));
    addPoints(50);
  };

  const updateStreak = () => {
    setUserProgress((prev) => ({
      ...prev,
      currentStreak: num(prev.currentStreak, 0) + 1,
    }));
  };

  const unlockAchievement = (achievement: string) => {
    setUserProgress((prev) => {
      if (!prev.achievements.includes(achievement)) {
        // award first, then append achievement
        const next = {
          ...prev,
          achievements: [...prev.achievements, achievement],
        };
        // addPoints uses setState; call it after returning next to avoid stale reads
        setTimeout(() => addPoints(100), 0);
        return next;
      }
      return prev;
    });
  };

  // ---- Recommendations ----
  const getRecommendations = (category?: string) => {
    const pool = category
      ? SAMPLE_DRINKS.filter((d) => d.category === category)
      : SAMPLE_DRINKS;
    return pool
      .filter((d) => d.featured || d.trending)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 6);
  };

  const getTrendingDrinks = () =>
    SAMPLE_DRINKS.filter((d) => d.trending)
      .sort((a, b) => (b.reviews || 0) - (a.reviews || 0))
      .slice(0, 8);

  const value: DrinksContextType = useMemo(
    () => ({
      // search
      searchQuery,
      setSearchQuery,
      searchResults,
      isSearching,
      // favorites
      favorites,
      addToFavorites,
      removeFromFavorites,
      isFavorite,
      // progress
      userProgress,
      addPoints,
      incrementDrinksMade,
      updateStreak,
      unlockAchievement,
      // cross-page
      recentlyViewed,
      addToRecentlyViewed,
      clearRecentlyViewed,
      // global
      searchAllCategories,
      getRecommendations,
      getTrendingDrinks,
    }),
    [
      searchQuery,
      searchResults,
      isSearching,
      favorites,
      userProgress,
      recentlyViewed,
    ]
  );

  return <DrinksContext.Provider value={value}>{children}</DrinksContext.Provider>;
}

export function useDrinks() {
  const ctx = useContext(DrinksContext);
  if (!ctx) throw new Error("useDrinks must be used within a DrinksProvider");
  return ctx;
}
