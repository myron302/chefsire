// client/src/contexts/DrinksContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

// Types
export interface DrinkItem {
  id: string;
  name: string;
  category: 'smoothies' | 'protein-shakes' | 'detoxes' | 'potent-potables';
  description?: string;
  image?: string;
  ingredients?: string[];
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  difficulty?: 'Easy' | 'Medium' | 'Hard';
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

// Sample data for all categories
const SAMPLE_DRINKS: DrinkItem[] = [
  // Smoothies
  {
    id: 'smoothie-1',
    name: 'Green Goddess Smoothie',
    category: 'smoothies',
    description: 'Nutrient-packed green smoothie with spinach and mango',
    image: 'https://images.unsplash.com/photo-1638176066666-ffb2f013c7dd?w=400&h=300&fit=crop',
    ingredients: ['Spinach', 'Mango', 'Banana', 'Coconut water', 'Chia seeds'],
    nutrition: { calories: 220, protein: 6, carbs: 45, fat: 4 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.8,
    reviews: 324,
    tags: ['Green', 'Antioxidants', 'Energy'],
    featured: true,
    trending: true,
    fitnessGoal: 'Energy & Recovery',
    bestTime: 'Morning'
  },
  {
    id: 'smoothie-2',
    name: 'Chocolate Peanut Butter Protein',
    category: 'smoothies',
    description: 'Rich and creamy post-workout smoothie',
    ingredients: ['Chocolate protein powder', 'Peanut butter', 'Banana', 'Almond milk'],
    nutrition: { calories: 380, protein: 25, carbs: 35, fat: 12 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.9,
    reviews: 567,
    tags: ['Protein', 'Post-workout', 'Chocolate'],
    featured: false,
    trending: false,
    fitnessGoal: 'Muscle Building',
    bestTime: 'Post-workout'
  },

  // Protein Shakes
  {
    id: 'protein-1',
    name: 'Classic Vanilla Whey',
    category: 'protein-shakes',
    description: 'Simple and effective whey protein shake',
    ingredients: ['Whey protein isolate', 'Vanilla extract', 'Water', 'Ice'],
    nutrition: { calories: 140, protein: 30, carbs: 2, fat: 1 },
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 890,
    tags: ['Whey', 'Quick', 'Low-carb'],
    featured: true,
    trending: false,
    fitnessGoal: 'Muscle Building',
    bestTime: 'Post-workout'
  },
  {
    id: 'protein-2',
    name: 'Plant Power Green',
    category: 'protein-shakes',
    description: 'Vegan protein with greens and superfoods',
    ingredients: ['Pea protein', 'Spirulina', 'Spinach', 'Coconut milk', 'Hemp seeds'],
    nutrition: { calories: 280, protein: 22, carbs: 18, fat: 8 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.4,
    reviews: 234,
    tags: ['Vegan', 'Superfoods', 'Green'],
    featured: false,
    trending: true,
    fitnessGoal: 'General Health',
    bestTime: 'Morning'
  },

  // Detoxes
  {
    id: 'detox-1',
    name: 'Lemon Ginger Cleanse',
    category: 'detoxes',
    description: 'Traditional cleansing blend with metabolism boost',
    ingredients: ['Lemon juice', 'Fresh ginger', 'Cayenne pepper', 'Maple syrup', 'Water'],
    nutrition: { calories: 45, protein: 0, carbs: 12, fat: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.3,
    reviews: 678,
    tags: ['Cleanse', 'Metabolism', 'Traditional'],
    featured: true,
    trending: false,
    fitnessGoal: 'Detox',
    bestTime: 'Morning'
  },
  {
    id: 'detox-2',
    name: 'Green Detox Smoothie',
    category: 'detoxes',
    description: 'Gentle green cleanse with fruits',
    ingredients: ['Cucumber', 'Celery', 'Green apple', 'Spinach', 'Lemon'],
    nutrition: { calories: 95, protein: 2, carbs: 22, fat: 1 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.5,
    reviews: 445,
    tags: ['Green', 'Gentle', 'Hydrating'],
    featured: false,
    trending: true,
    fitnessGoal: 'Detox',
    bestTime: 'Afternoon'
  },

  // Potent Potables
  {
    id: 'cocktail-1',
    name: 'Classic Old Fashioned',
    category: 'potent-potables',
    description: 'Timeless whiskey cocktail with bitters',
    ingredients: ['Bourbon whiskey', 'Sugar cube', 'Angostura bitters', 'Orange peel'],
    nutrition: { calories: 185, protein: 0, carbs: 4, fat: 0 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    reviews: 1234,
    tags: ['Classic', 'Whiskey', 'Sophisticated'],
    featured: true,
    trending: false,
    bestTime: 'Evening'
  },
  {
    id: 'mocktail-1',
    name: 'Virgin Mojito',
    category: 'potent-potables',
    description: 'Refreshing mint and lime mocktail',
    ingredients: ['Fresh mint', 'Lime juice', 'Sugar', 'Club soda', 'Ice'],
    nutrition: { calories: 65, protein: 0, carbs: 17, fat: 0 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.4,
    reviews: 567,
    tags: ['Mocktail', 'Refreshing', 'Mint'],
    featured: false,
    trending: true,
    bestTime: 'Afternoon'
  }
];

export function DrinksProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DrinkItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [favorites, setFavorites] = useState<DrinkItem[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<DrinkItem[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress>({
    totalDrinksMade: 47,
    totalPoints: 2850,
    level: 12,
    currentStreak: 5,
    achievements: ['First Drink', 'Green Goddess', 'Protein Master', 'Week Warrior'],
    favoriteCategories: ['smoothies', 'protein-shakes'],
    dailyGoalProgress: 75
  });

  // Load saved data from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('drinksFavorites');
    const savedProgress = localStorage.getItem('userProgress');
    const savedRecentlyViewed = localStorage.getItem('recentlyViewed');

    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
    if (savedProgress) {
      setUserProgress(JSON.parse(savedProgress));
    }
    if (savedRecentlyViewed) {
      setRecentlyViewed(JSON.parse(savedRecentlyViewed));
    }
  }, []);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('drinksFavorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('userProgress', JSON.stringify(userProgress));
  }, [userProgress]);

  useEffect(() => {
    localStorage.setItem('recentlyViewed', JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

  // Search functionality
  const searchAllCategories = async (query: string): Promise<DrinkItem[]> => {
    setIsSearching(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const results = SAMPLE_DRINKS.filter(drink =>
      drink.name.toLowerCase().includes(query.toLowerCase()) ||
      drink.description?.toLowerCase().includes(query.toLowerCase()) ||
      drink.ingredients?.some(ingredient => 
        ingredient.toLowerCase().includes(query.toLowerCase())
      ) ||
      drink.tags?.some(tag => 
        tag.toLowerCase().includes(query.toLowerCase())
      )
    );
    
    setSearchResults(results);
    setIsSearching(false);
    return results;
  };

  // Update search when query changes
  useEffect(() => {
    if (searchQuery.length > 0) {
      searchAllCategories(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Favorites management
  const addToFavorites = (drink: DrinkItem) => {
    if (!isFavorite(drink.id)) {
      setFavorites(prev => [...prev, drink]);
      addPoints(10); // Reward for favoriting
    }
  };

  const removeFromFavorites = (drinkId: string) => {
    setFavorites(prev => prev.filter(drink => drink.id !== drinkId));
  };

  const isFavorite = (drinkId: string) => {
    return favorites.some(drink => drink.id === drinkId);
  };

  // Recently viewed management
  const addToRecentlyViewed = (drink: DrinkItem) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(item => item.id !== drink.id);
      return [drink, ...filtered].slice(0, 10); // Keep only last 10
    });
  };

  const clearRecentlyViewed = () => {
    setRecentlyViewed([]);
  };

  // User progress management
  const addPoints = (points: number) => {
    setUserProgress(prev => {
      const newPoints = prev.totalPoints + points;
      const newLevel = Math.floor(newPoints / 250) + 1;
      
      return {
        ...prev,
        totalPoints: newPoints,
        level: newLevel
      };
    });
  };

  const incrementDrinksMade = () => {
    setUserProgress(prev => ({
      ...prev,
      totalDrinksMade: prev.totalDrinksMade + 1,
      dailyGoalProgress: Math.min(100, prev.dailyGoalProgress + 25)
    }));
    addPoints(50); // Reward for making a drink
  };

  const updateStreak = () => {
    setUserProgress(prev => ({
      ...prev,
      currentStreak: prev.currentStreak + 1
    }));
  };

  const unlockAchievement = (achievement: string) => {
    setUserProgress(prev => {
      if (!prev.achievements.includes(achievement)) {
        addPoints(100); // Bonus for achievements
        return {
          ...prev,
          achievements: [...prev.achievements, achievement]
        };
      }
      return prev;
    });
  };

  // Recommendation system
  const getRecommendations = (category?: string) => {
    let pool = SAMPLE_DRINKS;
    
    if (category) {
      pool = SAMPLE_DRINKS.filter(drink => drink.category === category);
    }
    
    // Prioritize featured and trending drinks
    return pool
      .filter(drink => drink.featured || drink.trending)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 6);
  };

  const getTrendingDrinks = () => {
    return SAMPLE_DRINKS
      .filter(drink => drink.trending)
      .sort((a, b) => (b.reviews || 0) - (a.reviews || 0))
      .slice(0, 8);
  };

  const value: DrinksContextType = {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    favorites,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    userProgress,
    addPoints,
    incrementDrinksMade,
    updateStreak,
    unlockAchievement,
    recentlyViewed,
    addToRecentlyViewed,
    clearRecentlyViewed,
    searchAllCategories,
    getRecommendations,
    getTrendingDrinks
  };

  return (
    <DrinksContext.Provider value={value}>
      {children}
    </DrinksContext.Provider>
  );
}

export function useDrinks() {
  const context = useContext(DrinksContext);
  if (context === undefined) {
    throw new Error('useDrinks must be used within a DrinksProvider');
  }
  return context;
}
