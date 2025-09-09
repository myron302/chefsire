import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { 
  Search, 
  Grid, 
  List, 
  SlidersHorizontal, 
  Heart, 
  MessageCircle, 
  Clock, 
  Users,
  TrendingUp,
  Calendar,
  Filter,
  X,
  ChefHat,
  Star,
  Sparkles
} from "lucide-react";

const MOCK_POSTS = [
  {
    id: "1",
    caption: "Creamy Tuscan Chicken with sun-dried tomatoes and spinach",
    imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&h=600&fit=crop",
    isRecipe: true,
    user: {
      displayName: "Chef Maria",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      verified: true
    },
    likesCount: 245,
    commentsCount: 32,
    tags: ["Italian", "Chicken", "Healthy"],
    difficulty: "Medium",
    prepTime: 15,
    cookTime: 25,
    calories: 420
  },
  {
    id: "2",
    caption: "Vegan Buddha Bowl with quinoa and tahini dressing",
    imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop",
    isRecipe: true,
    user: {
      displayName: "GreenKitchen",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      verified: false
    },
    likesCount: 189,
    commentsCount: 28,
    tags: ["Vegan", "Healthy", "Quick"],
    difficulty: "Easy",
    prepTime: 20,
    cookTime: 0,
    calories: 350
  },
  {
    id: "3",
    caption: "Chocolate lava cake that melts in your mouth",
    imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop",
    isRecipe: true,
    user: {
      displayName: "SweetTooth",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      verified: true
    },
    likesCount: 567,
    commentsCount: 89,
    tags: ["Desserts", "Chocolate"],
    difficulty: "Hard",
    prepTime: 30,
    cookTime: 15,
    calories: 650
  },
  {
    id: "4",
    caption: "Fresh sushi rolls with salmon and avocado",
    imageUrl: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&h=600&fit=crop",
    isRecipe: true,
    user: {
      displayName: "Tokyo Chef",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      verified: true
    },
    likesCount: 334,
    commentsCount: 45,
    tags: ["Asian", "Seafood", "Healthy"],
    difficulty: "Medium",
    prepTime: 45,
    cookTime: 0,
    calories: 280
  },
  {
    id: "5",
    caption: "Mediterranean grilled vegetables with herbs",
    imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&h=600&fit=crop",
    isRecipe: true,
    user: {
      displayName: "Mediterranean Life",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
      verified: false
    },
    likesCount: 156,
    commentsCount: 23,
    tags: ["Healthy", "Vegan", "Mediterranean"],
    difficulty: "Easy",
    prepTime: 15,
    cookTime: 20,
    calories: 180
  },
  {
    id: "6",
    caption: "Classic Italian carbonara with pancetta",
    imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc136d52a?w=800&h=600&fit=crop",
    isRecipe: true,
    user: {
      displayName: "Nonna's Kitchen",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      verified: true
    },
    likesCount: 789,
    commentsCount: 134,
    tags: ["Italian", "Pasta", "Traditional"],
    difficulty: "Medium",
    prepTime: 10,
    cookTime: 15,
    calories: 520
  }
];

const CATEGORIES = ["All", "Italian", "Healthy", "Desserts", "Quick", "Vegan", "Seafood", "Asian", "Mediterranean"];
const POPULAR_DIETS = ["Vegan", "Gluten-Free", "Keto", "Low-Carb"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      setStoredValue(value);
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [key]);

  return [storedValue, setValue];
}

export default function Explore() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useLocalStorage("explore:category", null);
  const [viewMode, setViewMode] = useLocalStorage("explore:viewMode", "grid");
  const [sortBy, setSortBy] = useLocalStorage("explore:sortBy", "trending");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  
  const [selectedDiets, setSelectedDiets] = useLocalStorage("explore:diets", []);
  const [selectedDifficulties, setSelectedDifficulties] = useLocalStorage("explore:difficulties", []);
  const [timeRange, setTimeRange] = useLocalStorage("explore:timeRange", [0, 60]);
  const [calorieRange, setCalorieRange] = useLocalStorage("explore:calorieRange", [0, 800]);
  const [verifiedOnly, setVerifiedOnly] = useLocalStorage("explore:verifiedOnly", false);

  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['explore', debouncedSearch, selectedCategory, sortBy, selectedDiets, selectedDifficulties, timeRange, calorieRange, verifiedOnly],
    queryFn: async ({ pageParam = 0 }) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let filtered = [...MOCK_POSTS];
      
      if (debouncedSearch) {
        filtered = filtered.filter(post => 
          post.caption.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          post.user.displayName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          post.tags.some(tag => tag.toLowerCase().includes(debouncedSearch.toLowerCase()))
        );
      }
      
      if (selectedCategory && selectedCategory !== "All") {
        filtered = filtered.filter(post => 
          post.tags.some(tag => tag.toLowerCase() === selectedCategory.toLowerCase())
        );
      }
      
      if (selectedDiets.length > 0) {
        filtered = filtered.filter(post =>
          selectedDiets.some(diet => post.tags.includes(diet))
        );
      }
      
      if (selectedDifficulties.length > 0) {
        filtered = filtered.filter(post =>
          selectedDifficulties.includes(post.difficulty)
        );
      }
      
      if (verifiedOnly) {
        filtered = filtered.filter(post => post.user.verified);
      }
      
      filtered = filtered.filter(post => {
        const totalTime = post.prepTime + post.cookTime;
        return totalTime >= timeRange[0] && totalTime <= timeRange[1];
      });
      
      filtered = filtered.filter(post =>
        post.calories >= calorieRange[0] && post.calories <= calorieRange[1]
      );
      
      if (sortBy === "newest") {
        filtered.reverse();
      } else if (sortBy === "most_liked") {
        filtered.sort((a, b) => b.likesCount - a.likesCount);
      }
      
      const pageSize = 6;
      const start = pageParam * pageSize;
      const items = filtered.slice(start, start + pageSize);
      
      return {
        items,
        nextCursor: start + pageSize < filtered.length ? pageParam + 1 : undefined,
        total: filtered.length
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor
  });

  const allPosts = useMemo(
    () => data?.pages.flatMap(page => page.items) || [],
    [data]
  );

  const total = data?.pages[0]?.total || 0;

  const sentinelRef = useRef();
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '100px' }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedCategory(null);
    setSelectedDiets([]);
    setSelectedDifficulties([]);
    setTimeRange([0, 60]);
    setCalorieRange([0, 800]);
    setVerifiedOnly(false);
    setSortBy("trending");
  };

  const activeFiltersCount = [
    selectedCategory && selectedCategory !== "All" ? 1 : 0,
    selectedDiets.length,
    selectedDifficulties.length,
    verifiedOnly ? 1 : 0,
    timeRange[0] !== 0 || timeRange[1] !== 60 ? 1 : 0,
    calorieRange[0] !== 0 || calorieRange[1] !== 800 ? 1 : 0
  ].reduce((sum, count) => sum + count, 0);

  if (isLoading && allPosts.length === 0) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl">
              <ChefHat className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                Explore Recipes
              </h1>
              <p className="text-muted-foreground">Discover amazing dishes from talented chefs worldwide</p>
            </div>
          </div>

          <div className="relative mb-6 max-w-2xl">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              type="text"
              placeholder="Search for recipes, ingredients, or chefs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 h-12 text-lg border-2 border-orange-100 focus:border-orange-300 rounded-xl bg-white/80 backdrop-blur-sm"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map((category) => {
              const isActive = selectedCategory === category || (!selectedCategory && category === "All");
              return (
                <Badge
                  key={category}
                  variant={isActive ? "default" : "outline"}
                  className={`cursor-pointer px-4 py-2 text-sm transition-all duration-200 hover:scale-105 ${
                    isActive 
                      ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg" 
                      : "bg-white/80 hover:bg-orange-50 border-orange-200"
                  }`}
                  onClick={() => setSelectedCategory(
                    isActive && category !== "All" ? null : category
                  )}
                >
                  {category}
                </Badge>
              );
            })}
          </div>
<div className="flex flex-wrap gap-2 mb-6">
            {POPULAR_DIETS.map((diet) => {
              const isActive = selectedDiets.includes(diet);
              return (
                <Badge
                  key={diet}
                  variant={isActive ? "default" : "outline"}
                  className={`cursor-pointer px-3 py-1 text-xs transition-all duration-200 hover:scale-105 ${
                    isActive 
                      ? "bg-green-500 text-white shadow-md" 
                      : "bg-white/80 hover:bg-green-50 border-green-200"
                  }`}
                  onClick={() => {
                    if (isActive) {
                      setSelectedDiets(selectedDiets.filter(d => d !== diet));
                    } else {
                      setSelectedDiets([...selectedDiets, diet]);
                    }
                  }}
                >
                  {diet}
                </Badge>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <p className="text-sm text-muted-foreground font-medium">
                <span className="text-orange-600 font-semibold">{total}</span> recipes found
              </p>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Filter className="h-3 w-3" />
                  {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFiltersOpen(true)}
                className="gap-2 bg-white/80 hover:bg-orange-50 border-orange-200"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 rounded-lg border border-orange-200 bg-white/80 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="trending">🔥 Trending</option>
                <option value="newest">📅 Newest</option>
                <option value="most_liked">❤️ Most Liked</option>
              </select>

              <div className="flex bg-white/80 rounded-lg border border-orange-200 p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className={`h-7 px-2 ${viewMode === "grid" ? "bg-orange-500 text-white" : ""}`}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className={`h-7 px-2 ${viewMode === "list" ? "bg-orange-500 text-white" : ""}`}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {allPosts.length > 0 ? (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allPosts.map((post, index) => (
                  <PostCard key={post.id} post={post} index={index} />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {allPosts.map((post, index) => (
                  <PostListItem key={post.id} post={post} index={index} />
                ))}
              </div>
            )}

            <div ref={sentinelRef} className="mt-8 flex justify-center">
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2 py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                  <span className="text-muted-foreground">Loading more recipes...</span>
                </div>
              ) : hasNextPage ? (
                <Button onClick={() => fetchNextPage()} variant="outline" className="mt-4">
                  Load More
                </Button>
              ) : allPosts.length > 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  🍽️ You've seen all recipes! Try adjusting your filters for more results.
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <EmptyState onReset={resetFilters} />
        )}

        <FiltersSheet
          isOpen={isFiltersOpen}
          onClose={() => setIsFiltersOpen(false)}
          selectedDiets={selectedDiets}
          setSelectedDiets={setSelectedDiets}
          selectedDifficulties={selectedDifficulties}
          setSelectedDifficulties={setSelectedDifficulties}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          calorieRange={calorieRange}
          setCalorieRange={setCalorieRange}
          verifiedOnly={verifiedOnly}
          setVerifiedOnly={setVerifiedOnly}
          onReset={resetFilters}
        />
      </div>
    </div>
  );
}

function PostCard({ post, index }) {
  return (
    <Card className="group cursor-pointer overflow-hidden bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
      <div className="relative overflow-hidden">
        <img
          src={post.imageUrl}
          alt={post.caption}
          className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {post.isRecipe && (
          <Badge className="absolute top-3 right-3 bg-orange-500 text-white shadow-lg">
            <ChefHat className="h-3 w-3 mr-1" />
            Recipe
          </Badge>
        )}

        {post.user.verified && (
          <Badge className="absolute top-3 left-3 bg-blue-500 text-white shadow-lg">
            <Star className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        )}
      </div>

      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <img
            src={post.user.avatar}
            alt={post.user.displayName}
            className="w-8 h-8 rounded-full ring-2 ring-orange-100"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {post.user.displayName}
            </p>
            {post.difficulty && (
              <p className="text-xs text-muted-foreground">
                {post.difficulty} • {post.prepTime + post.cookTime} min
              </p>
            )}
          </div>
        </div>

        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
          {post.caption}
        </h3>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4 text-red-500" />
              {post.likesCount}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4 text-blue-500" />
              {post.commentsCount}
            </span>
          </div>
          {post.calories && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              {post.calories} cal
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PostListItem({ post, index }) {
  return (
    <Card className="group cursor-pointer overflow-hidden bg-white/80 backdrop-blur-sm border-0 shadow-md hover:shadow-xl transition-all duration-300">
      <div className="flex">
        <div className="relative w-48 h-32 overflow-hidden">
          <img
            src={post.imageUrl}
            alt={post.caption}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
          />
        </div>
        
        <CardContent className="flex-1 p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <img
                src={post.user.avatar}
                alt={post.user.displayName}
                className="w-6 h-6 rounded-full"
              />
              <span className="text-sm font-medium">{post.user.displayName}</span>
              {post.user.verified && <Star className="h-4 w-4 text-blue-500" />}
            </div>
            {post.isRecipe && (
              <Badge variant="secondary" className="text-xs">
                Recipe
              </Badge>
            )}
          </div>
          
          <h3 className="font-semibold text-lg mb-2 group-hover:text-orange-600 transition-colors">
            {post.caption}
          </h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className="h-4 w-4 text-red-500" />
                {post.likesCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4 text-blue-500" />
                {post.commentsCount}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {post.prepTime + post.cookTime} min
              </span>
            </div>
            {post.calories && (
              <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
                {post.calories} calories
              </span>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 bg-gradient-to-r from-orange-200 to-red-200 rounded-2xl animate-pulse" />
            <div>
              <div className="w-48 h-8 bg-gradient-to-r from-orange-200 to-red-200 rounded animate-pulse mb-2" />
              <div className="w-64 h-4 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="w-full max-w-2xl h-12 bg-gray-200 rounded-xl animate-pulse mb-6" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <div className="w-full h-48 bg-gray-200" />
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="w-3/4 h-4 bg-gray-200 rounded" />
                  <div className="w-1/2 h-3 bg-gray-200 rounded" />
                  <div className="flex justify-between">
                    <div className="w-20 h-3 bg-gray-200 rounded" />
                    <div className="w-16 h-3 bg-gray-200 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onReset }) {
  return (
    <div className="text-center py-16">
      <div className="w-24 h-24 mx-auto mb-6 opacity-50">
        <div className="w-full h-full bg-gradient-to-r from-orange-200 to-red-200 rounded-full flex items-center justify-center">
          <Search className="h-12 w-12 text-orange-500" />
        </div>
      </div>
      <h3 className="text-2xl font-semibold text-gray-900 mb-3">No recipes found</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        We couldn't find any recipes matching your criteria. Try adjusting your search terms or filters.
      </p>
      <Button onClick={onReset} className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600">
        Reset Filters
      </Button>
    </div>
  );
}

function FiltersSheet({ isOpen, onClose, selectedDiets, setSelectedDiets, selectedDifficulties, setSelectedDifficulties, timeRange, setTimeRange, calorieRange, setCalorieRange, verifiedOnly, setVerifiedOnly, onReset }) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Advanced Filters</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <div>
            <label className="text-sm font-medium mb-3 block">Dietary Preferences</label>
            <div className="flex flex-wrap gap-2">
              {POPULAR_DIETS.map((diet) => (
               <Badge
                 key={diet}
                 variant={selectedDiets.includes(diet) ? "default" : "outline"}
                 className="cursor-pointer"
                 onClick={() => {
                   if (selectedDiets.includes(diet)) {
                     setSelectedDiets(selectedDiets.filter(d => d !== diet));
                   } else {
                     setSelectedDiets([...selectedDiets, diet]);
                   }
                 }}
               >
                 {diet}
               </Badge>
             ))}
           </div>
         </div>

         <div>
           <label className="text-sm font-medium mb-3 block">Difficulty</label>
           <div className="flex flex-wrap gap-2">
             {DIFFICULTIES.map((difficulty) => (
               <Badge
                 key={difficulty}
                 variant={selectedDifficulties.includes(difficulty) ? "default" : "outline"}
                 className="cursor-pointer"
                 onClick={() => {
                   if (selectedDifficulties.includes(difficulty)) {
                     setSelectedDifficulties(selectedDifficulties.filter(d => d !== difficulty));
                   } else {
                     setSelectedDifficulties([...selectedDifficulties, difficulty]);
                   }
                 }}
               >
                 {difficulty}
               </Badge>
             ))}
           </div>
         </div>

         <div>
           <label className="text-sm font-medium mb-3 block">
             Total Time: {timeRange[0]} - {timeRange[1]} minutes
           </label>
           <Slider
             value={timeRange}
             onValueChange={setTimeRange}
             max={120}
             step={5}
             className="w-full"
           />
         </div>

         <div>
           <label className="text-sm font-medium mb-3 block">
             Calories: {calorieRange[0]} - {calorieRange[1]} per serving
           </label>
           <Slider
             value={calorieRange}
             onValueChange={setCalorieRange}
             max={1000}
             step={50}
             className="w-full"
           />
         </div>

         <div className="flex items-center justify-between">
           <label className="text-sm font-medium">Verified chefs only</label>
           <Switch checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
         </div>
       </div>

       <SheetFooter className="mt-8">
         <Button variant="outline" onClick={onReset} className="w-full">
           Reset All Filters
         </Button>
         <Button onClick={onClose} className="w-full">
           Apply Filters
         </Button>
       </SheetFooter>
     </SheetContent>
   </Sheet>
 );
}
