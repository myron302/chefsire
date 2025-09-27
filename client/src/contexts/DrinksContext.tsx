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
  tags?: string[];
}

export interface UserProgress {
  totalDrinks: number;
  favoriteCategory: string;
  currentStreak: number;
  level: number;
  points: number;
  achievements: string[];
}

interface DrinksContextType {
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: DrinkItem[];
  isSearching: boolean;
  
  // Favorites
  favorites: Set<string>;
  addToFavorites: (drinkId: string) => void;
  removeFromFavorites: (drinkId: string) => void;
  isFavorite: (drinkId: string) => boolean;
  
  // User Progress
  userProgress: UserProgress;
  updateProgress: (update: Partial<UserProgress>) => void;
  addPoints: (points: number) => void;
  
  // Recently Viewed
  recentlyViewed: DrinkItem[];
  addToRecentlyViewed: (drink: DrinkItem) => void;
  
  // Global actions
  clearAll: () => void;
}

const DrinksContext = createContext<DrinksContextType | undefined>(undefined);

// Mock data for search results across all categories
const mockDrinks: DrinkItem[] = [
  // Smoothies
  {
    id: 'smoothie-1',
    name: 'Green Goddess Bowl',
    category: 'smoothies',
    description: 'Nutrient-packed green smoothie bowl',
    image: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=300&h=200&fit=crop',
    nutrition: { calories: 280, protein: 12, carbs: 45, fat: 8 },
    difficulty: 'Easy',
    prepTime: 5,
    rating: 4.8,
    tags: ['Antioxidants', 'Energy', 'Green', 'Healthy'],
    ingredients: ['Spinach', 'Banana', 'Mango', 'Coconut milk', 'Chia seeds']
  },
  {
    id: 'smoothie-2',
    name: 'Berry Blast Workout',
    category: 'smoothies',
    description: 'Pre-workout energy smoothie',
    image: 'https://images.unsplash.com/photo-1553530979-451d0aa3ad9f?w=300&h=200&fit=crop',
    nutrition: { calories: 320, protein: 15, carbs: 52, fat: 6 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.7,
    tags: ['Pre-workout', 'Berries', 'Energy'],
    ingredients: ['Mixed berries', 'Protein powder', 'Oats', 'Almond milk']
  },
  
  // Protein Shakes
  {
    id: 'protein-1',
    name: 'Beast Mode Builder',
    category: 'protein-shakes',
    description: 'High-protein muscle building shake',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop',
    nutrition: { calories: 380, protein: 35, carbs: 25, fat: 12 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.9,
    tags: ['Muscle Building', 'Post-workout', 'High Protein'],
    ingredients: ['Whey protein', 'Banana', 'Peanut butter', 'Milk', 'Oats']
  },
  {
    id: 'protein-2',
    name: 'Plant Power Recovery',
    category: 'protein-shakes',
    description: 'Vegan protein recovery blend',
    image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=300&h=200&fit=crop',
    nutrition: { calories: 290, protein: 25, carbs: 20, fat: 8 },
    difficulty: 'Easy',
    prepTime: 3,
    rating: 4.6,
    tags: ['Vegan', 'Recovery', 'Plant-based'],
    ingredients: ['Pea protein', 'Almond milk', 'Spinach', 'Berries', 'Hemp seeds']
  },
  
  // Detoxes
  {
    id: 'detox-1',
    name: 'Green Detox Elixir',
    category: 'detoxes',
    description: 'Cleansing green vegetable juice',
    nutrition: { calories: 120, protein: 3, carbs: 28, fat: 1 },
    difficulty: 'Medium',
    prepTime: 10,
    rating: 4.4,
    tags: ['Cleansing', 'Detox', 'Green', 'Vegetables'],
    ingredients: ['Kale', 'Cucumber', 'Celery', 'Lemon', 'Ginger', 'Apple']
  },
  
  // Potent Potables
  {
    id: 'cocktail-1',
    name: 'Cosmic Martini',
    category: 'potent-potables',
    description: 'Elegant blue cocktail with a cosmic twist',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=300&h=200&fit=crop',
    nutrition: { calories: 180 },
    difficulty: 'Medium',
    prepTime: 5,
    rating: 4.7,
    tags: ['Elegant', 'Party', 'Blue', 'Vodka'],
    ingredients: ['Vodka', 'Blue curacao', 'Lime juice', 'Simple syrup']
  }
];

export function DrinksProvider({ children }: { children: React.ReactNode }) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DrinkItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Favorites state (stored in localStorage)
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  
  // User progress state
  const [userProgress, setUserProgress] = useState<UserProgress>({
    totalDrinks: 127,
    favoriteCategory: 'smoothies',
    currentStreak: 12,
    level: 8,
    points: 3420,
    achievements: ['protein-pro', 'smoothie-starter']
  });
  
  // Recently viewed state
  const [recentlyViewed, setRecentlyViewed] = useState<DrinkItem[]>([]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem('drinks-favorites');
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)));
    }
    
    const savedProgress = localStorage.getItem('drinks-progress');
    if (savedProgress) {
      setUserProgress(JSON.parse(savedProgress));
    }
    
    const savedRecent = localStorage.getItem('drinks-recent');
    if (savedRecent) {
      setRecentlyViewed(JSON.parse(savedRecent));
    }
  }, []);

  // Save favorites to localStorage when changed
  useEffect(() => {
    localStorage.setItem('drinks-favorites', JSON.stringify([...favorites]));
  }, [favorites]);

  // Save progress to localStorage when changed
  useEffect(() => {
    localStorage.setItem('drinks-progress', JSON.stringify(userProgress));
  }, [userProgress]);

  // Save recent to localStorage when changed
  useEffect(() => {
    localStorage.setItem('drinks-recent', JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

  // Search functionality
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    // Simulate API delay
    const timer = setTimeout(() => {
      const results = mockDrinks.filter(drink => 
        drink.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        drink.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        drink.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        drink.ingredients?.some(ing => ing.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setSearchResults(results);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Favorites functions
  const addToFavorites = (drinkId: string) => {
    setFavorites(prev => new Set([...prev, drinkId]));
    addPoints(5); // Reward for favoriting
  };

  const removeFromFavorites = (drinkId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      newFavorites.delete(drinkId);
      return newFavorites;
    });
  };

  const isFavorite = (drinkId: string) => favorites.has(drinkId);

  // Progress functions
  const updateProgress = (update: Partial<UserProgress>) => {
    setUserProgress(prev => ({ ...prev, ...update }));
  };

  const addPoints = (points: number) => {
    setUserProgress(prev => {
      const newPoints = prev.points + points;
      const newLevel = Math.floor(newPoints / 500) + 1; // Level up every 500 points
      return {
        ...prev,
        points: newPoints,
        level: newLevel
      };
    });
  };

  // Recently viewed functions
  const addToRecentlyViewed = (drink: DrinkItem) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(item => item.id !== drink.id);
      return [drink, ...filtered].slice(0, 10); // Keep only last 10
    });
  };

  // Clear all data
  const clearAll = () => {
    setFavorites(new Set());
    setRecentlyViewed([]);
    setSearchQuery('');
    localStorage.removeItem('drinks-favorites');
    localStorage.removeItem('drinks-progress');
    localStorage.removeItem('drinks-recent');
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
    updateProgress,
    addPoints,
    recentlyViewed,
    addToRecentlyViewed,
    clearAll
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

// Export the mock data for use in individual pages
export { mockDrinks };
