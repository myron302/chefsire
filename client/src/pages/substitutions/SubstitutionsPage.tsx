import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  BookOpen, 
  ChefHat, 
  Star, 
  Trophy, 
  Heart, 
  Share2, 
  Bookmark, 
  Zap, 
  Target, 
  Award,
  TrendingUp,
  Users,
  Clock,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Lightbulb,
  Fire
} from "lucide-react";
import { 
  ingredientSubstitutions, 
  createSearchableIngredients, 
  searchIngredientSubstitutions,
  type IngredientSubstitution 
} from "@/data/ingredient-substitutions";

type Alt = { name: string; note?: string; confidence?: number; tags?: string[] };
type SuggestItem = { original: string; alternatives: Alt[] };
type SuggestResponse = { items: SuggestItem[]; info: { diet: string | null; avoid: string[]; engine: string } };

// Gamification data
interface UserStats {
  searchCount: number;
  favoriteCount: number;
  level: number;
  xp: number;
  streak: number;
  lastVisit: string;
  achievements: string[];
  weeklyGoal: number;
  weeklyProgress: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  requirement: number;
  unlocked: boolean;
}

// Fun cooking tips and facts
const cookingTips = [
  "💡 Room temperature eggs whip better than cold ones!",
  "🔥 Salt your pasta water - it should taste like the sea!",
  "⏰ Let meat rest after cooking to redistribute juices",
  "🧄 Remove garlic's green germ to avoid bitterness",
  "🍰 Measure flour by weight for consistent baking results",
  "❄️ Chill your bowl when whipping cream for better results",
  "🌿 Add herbs at the end to preserve their flavor",
  "🔪 A sharp knife is safer than a dull one!",
];

const dailyChallenges = [
  "Try a vegan substitute today!",
  "Find 3 gluten-free alternatives",
  "Discover substitutes for 5 ingredients",
  "Share a substitution with a friend",
  "Save 3 new substitutions to favorites",
  "Try making a recipe with only substitutes",
  "Learn about a new international substitute",
];

export default function SubstitutionsPage() {
  const [ingredients, setIngredients] = useState("milk,butter,egg");
  const [diet, setDiet] = useState<"none" | "vegan">("none");
  const [avoid, setAvoid] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Interactive state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<IngredientSubstitution[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientSubstitution | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showCopied, setShowCopied] = useState<string | null>(null);
  const [currentTip, setCurrentTip] = useState(0);
  const [activeTab, setActiveTab] = useState("search");
  
  // Gamification state
  const [userStats, setUserStats] = useState<UserStats>({
    searchCount: 0,
    favoriteCount: 0,
    level: 1,
    xp: 0,
    streak: 0,
    lastVisit: new Date().toISOString(),
    achievements: [],
    weeklyGoal: 20,
    weeklyProgress: 0
  });
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState("");

  // Create autocomplete suggestions
  const searchableIngredients = useMemo(() => createSearchableIngredients(), []);
  
  const autocompleteSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    
    const query = searchQuery.toLowerCase();
    return searchableIngredients
      .filter(ingredient => ingredient.includes(query))
      .slice(0, 8);
  }, [searchQuery, searchableIngredients]);

  // Achievements system
  const achievements: Achievement[] = [
    {
      id: "first_search",
      title: "Getting Started",
      description: "Perform your first ingredient search",
      icon: <Search className="w-4 h-4" />,
      requirement: 1,
      unlocked: userStats.searchCount >= 1
    },
    {
      id: "explorer",
      title: "Ingredient Explorer",
      description: "Search for 10 different ingredients",
      icon: <Target className="w-4 h-4" />,
      requirement: 10,
      unlocked: userStats.searchCount >= 10
    },
    {
      id: "collector",
      title: "Substitute Collector",
      description: "Save 5 substitutions to favorites",
      icon: <Heart className="w-4 h-4" />,
      requirement: 5,
      unlocked: userStats.favoriteCount >= 5
    },
    {
      id: "master_chef",
      title: "Master Chef",
      description: "Reach level 5",
      icon: <ChefHat className="w-4 h-4" />,
      requirement: 5,
      unlocked: userStats.level >= 5
    },
    {
      id: "streak_master",
      title: "Streak Master",
      description: "Visit 7 days in a row",
      icon: <Fire className="w-4 h-4" />,
      requirement: 7,
      unlocked: userStats.streak >= 7
    }
  ];

  // Load user data from localStorage
  useEffect(() => {
    const savedStats = localStorage.getItem('chefsire-substitution-stats');
    const savedFavorites = localStorage.getItem('chefsire-favorites');
    const savedRecentSearches = localStorage.getItem('chefsire-recent-searches');
    
    if (savedStats) {
      setUserStats(JSON.parse(savedStats));
    }
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
    if (savedRecentSearches) {
      setRecentSearches(JSON.parse(savedRecentSearches));
    }

    // Set daily challenge
    const today = new Date().toDateString();
    const savedChallenge = localStorage.getItem(`chefsire-daily-challenge-${today}`);
    if (savedChallenge) {
      setDailyChallenge(savedChallenge);
    } else {
      const randomChallenge = dailyChallenges[Math.floor(Math.random() * dailyChallenges.length)];
      setDailyChallenge(randomChallenge);
      localStorage.setItem(`chefsire-daily-challenge-${today}`, randomChallenge);
    }

    // Rotate cooking tips
    const tipInterval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % cookingTips.length);
    }, 10000);

    return () => clearInterval(tipInterval);
  }, []);

  // Save user data
  useEffect(() => {
    localStorage.setItem('chefsire-substitution-stats', JSON.stringify(userStats));
  }, [userStats]);

  useEffect(() => {
    localStorage.setItem('chefsire-favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('chefsire-recent-searches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  // XP and level calculation
  const xpForNextLevel = userStats.level * 100;
  const xpProgress = (userStats.xp % 100);

  // Add XP and check for level up
  const addXP = (amount: number) => {
    const newXP = userStats.xp + amount;
    const newLevel = Math.floor(newXP / 100) + 1;
    
    if (newLevel > userStats.level) {
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 3000);
    }

    setUserStats(prev => ({
      ...prev,
      xp: newXP,
      level: newLevel,
      weeklyProgress: Math.min(prev.weeklyProgress + 1, prev.weeklyGoal)
    }));
  };

  // Check for new achievements
  const checkAchievements = () => {
    achievements.forEach(achievement => {
      if (achievement.unlocked && !userStats.achievements.includes(achievement.id)) {
        setUserStats(prev => ({
          ...prev,
          achievements: [...prev.achievements, achievement.id]
        }));
        setNewAchievement(achievement);
        setTimeout(() => setNewAchievement(null), 4000);
        addXP(50); // Bonus XP for achievements
      }
    });
  };

  // Search ingredient database with gamification
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const results = searchIngredientSubstitutions(searchQuery);
      setSearchResults(results);
      
      // Track search
      if (!recentSearches.includes(searchQuery)) {
        setRecentSearches(prev => [searchQuery, ...prev.slice(0, 4)]);
        setUserStats(prev => ({ ...prev, searchCount: prev.searchCount + 1 }));
        addXP(10);
      }
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Check achievements when stats change
  useEffect(() => {
    checkAchievements();
  }, [userStats.searchCount, userStats.favoriteCount, userStats.level]);

  const fetchSuggest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams();
      params.set("ingredients", ingredients);
      if (diet !== "none") params.set("diet", diet);
      if (avoid.trim()) params.set("avoid", avoid.trim());

      const res = await fetch(`/api/substitutions/suggest?${params.toString()}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Request failed (${res.status})`);
      }
      const json: SuggestResponse = await res.json();
      setResult(json);
      addXP(25); // More XP for API calls
    } catch (e: any) {
      setError(e?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleIngredientSelect = (ingredient: string) => {
    setSearchQuery(ingredient);
    setShowSuggestions(false);
    
    const found = ingredientSubstitutions.find(
      item => item.ingredient.toLowerCase() === ingredient.toLowerCase()
    );
    if (found) {
      setSelectedIngredient(found);
      addXP(15);
    }
  };

  const addToIngredientList = (ingredient: string) => {
    const currentIngredients = ingredients.split(',').map(i => i.trim()).filter(Boolean);
    if (!currentIngredients.includes(ingredient)) {
      setIngredients([...currentIngredients, ingredient].join(','));
      addXP(5);
    }
  };

  const toggleFavorite = (ingredient: string) => {
    if (favorites.includes(ingredient)) {
      setFavorites(prev => prev.filter(fav => fav !== ingredient));
      setUserStats(prev => ({ ...prev, favoriteCount: prev.favoriteCount - 1 }));
    } else {
      setFavorites(prev => [...prev, ingredient]);
      setUserStats(prev => ({ ...prev, favoriteCount: prev.favoriteCount + 1 }));
      addXP(20);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setShowCopied(id);
      setTimeout(() => setShowCopied(null), 2000);
      addXP(5);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const shareSubstitution = async (ingredient: string, substitute: string) => {
    const text = `💡 Did you know? You can substitute ${ingredient} with ${substitute}! Found this on Chefsire 🍳`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Ingredient Substitution',
          text: text,
          url: window.location.href
        });
        addXP(15);
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      copyToClipboard(text, `share-${ingredient}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      {/* Level Up Animation */}
      {showLevelUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-8 py-4 rounded-lg shadow-xl animate-bounce">
            <div className="flex items-center gap-3 text-xl font-bold">
              <Sparkles className="w-6 h-6" />
              LEVEL UP! You're now level {userStats.level}!
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* New Achievement Animation */}
      {newAchievement && (
        <div className="fixed top-4 right-4 z-50 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-lg shadow-xl animate-slide-in-right">
          <div className="flex items-center gap-3">
            <Award className="w-5 h-5" />
            <div>
              <div className="font-semibold">Achievement Unlocked!</div>
              <div className="text-sm">{newAchievement.title}</div>
            </div>
          </div>
        </div>
      )}

      {/* Header with Stats */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <ChefHat className="text-primary" />
            Ingredient Substitutions
          </h1>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Level {userStats.level}</div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="font-semibold">{userStats.xp} XP</span>
            </div>
          </div>
        </div>

        {/* Progress and Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">Level Progress</span>
              </div>
              <Progress value={xpProgress} className="mb-1" />
              <div className="text-xs text-muted-foreground">
                {xpProgress}/100 XP to level {userStats.level + 1}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Weekly Goal</span>
              </div>
              <Progress value={(userStats.weeklyProgress / userStats.weeklyGoal) * 100} className="mb-1" />
              <div className="text-xs text-muted-foreground">
                {userStats.weeklyProgress}/{userStats.weeklyGoal} searches
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Fire className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium">Streak</span>
              </div>
              <div className="text-2xl font-bold">{userStats.streak}</div>
              <div className="text-xs text-muted-foreground">days</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-pink-500" />
                <span className="text-sm font-medium">Favorites</span>
              </div>
              <div className="text-2xl font-bold">{favorites.length}</div>
              <div className="text-xs text-muted-foreground">saved</div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Challenge & Tip */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-purple-500" />
                <span className="font-semibold text-purple-700">Daily Challenge</span>
              </div>
              <div className="text-sm">{dailyChallenge}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-green-500" />
                <span className="font-semibold text-green-700">Cooking Tip</span>
              </div>
              <div className="text-sm">{cookingTips[currentTip]}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Search
          </TabsTrigger>
          <TabsTrigger value="favorites" className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Favorites ({favorites.length})
          </TabsTrigger>
          <TabsTrigger value="achievements" className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Achievements
          </TabsTrigger>
          <TabsTrigger value="trending" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Trending
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-6">
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="w-5 h-5" />
                  Recent Searches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((search, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => setSearchQuery(search)}
                    >
                      {search}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ingredient Database Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Search Ingredient Database
                <Badge variant="secondary" className="ml-auto">
                  {ingredientSubstitutions.length}+ ingredients
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Search for ingredients (e.g., butter, milk, eggs)..."
                  className="w-full"
                />
                
                {/* Autocomplete Suggestions */}
                {showSuggestions && autocompleteSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {autocompleteSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        className="w-full px-4 py-2 text-left hover:bg-muted capitalize flex items-center justify-between"
                        onClick={() => handleIngredientSelect(suggestion)}
                      >
                        <span>{suggestion}</span>
                        <Sparkles className="w-3 h-3 text-primary" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    Search Results:
                    <Badge>{searchResults.length} found</Badge>
                  </h3>
                  {searchResults.slice(0, 5).map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-muted/50 hover:bg-muted/70 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{item.ingredient}</h4>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleFavorite(item.ingredient)}
                            className={favorites.includes(item.ingredient) ? "text-pink-500" : ""}
                          >
                            <Heart className={`w-3 h-3 ${favorites.includes(item.ingredient) ? "fill-current" : ""}`} />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addToIngredientList(item.ingredient)}
                          >
                            Add to List
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedIngredient(item)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Amount: {item.amount}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item.substitutes.slice(0, 3).map((sub, subIndex) => (
                          <Badge key={subIndex} variant="secondary" className="text-xs">
                            {sub.substitute.split(',')[0]} ({sub.amount})
                          </Badge>
                        ))}
                        {item.substitutes.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{item.substitutes.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Ingredient Details */}
          {selectedIngredient && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    {selectedIngredient.ingredient} Substitutions
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleFavorite(selectedIngredient.ingredient)}
                      className={favorites.includes(selectedIngredient.ingredient) ? "text-pink-500" : ""}
                    >
                      <Heart className={`w-4 h-4 ${favorites.includes(selectedIngredient.ingredient) ? "fill-current" : ""}`} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareSubstitution(selectedIngredient.ingredient, selectedIngredient.substitutes[0]?.substitute || "")}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  Original amount: {selectedIngredient.amount}
                </p>
                <div className="space-y-3">
                  {selectedIngredient.substitutes.map((sub, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-background hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-medium">{sub.substitute}</div>
                          <div className="text-sm text-primary font-semibold mt-1">
                            Amount: {sub.amount}
                          </div>
                          {sub.note && (
                            <div className="text-sm text-muted-foreground mt-2">
                              Note: {sub.note}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`${selectedIngredient.ingredient} → ${sub.substitute} (${sub.amount})`, `copy-${index}`)}
                          >
                            {showCopied === `copy-${index}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addToIngredientList(selectedIngredient.ingredient)}
                          >
                            Add to List
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* API Suggestion Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                AI-Powered Suggestions
                <Badge variant="secondary">Beta</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Ingredients (comma-separated)</label>
                    <Textarea
                      value={ingredients}
                      onChange={(e) => setIngredients(e.target.value)}
                      placeholder="e.g. milk,butter,egg"
                      rows={3}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Diet</label>
                    <div className="mt-1">
                      <Select value={diet} onValueChange={(v: "none" | "vegan") => setDiet(v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select diet" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="vegan">Vegan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="mt-4">
                      <label className="text-sm font-medium">Avoid (comma-separated)</label>
                      <Input
                        value={avoid}
                        onChange={(e) => setAvoid(e.target.value)}
                        placeholder="e.g. nut,dairy"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={fetchSuggest} disabled={loading} className="flex items-center gap-2">
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Suggesting...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Get AI Suggestions
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIngredients("");
                      setAvoid("");
                      setDiet("none");
                      setResult(null);
                      setError(null);
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 text-sm rounded-md bg-red-50 text-red-700 border border-red-200">
                  {error}
                </div>
              )}

              {result && (
                <div className="mt-6 space-y-4">
                  {result.items.map((it) => (
                    <div key={it.original} className="border rounded-lg p-4 bg-card border-border">
                      <div className="font-semibold mb-2">{it.original}</div>
                      {it.alternatives.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No suggestions.</div>
                      ) : (
                        <ul className="space-y-2">
                          {it.alternatives.map((a, idx) => (
                            <li key={idx} className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">{a.name}</div>
                                {a.note && <div className="text-sm text-muted-foreground">{a.note}</div>}
                                {a.tags?.length ? (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {a.tags.map((t) => (
                                      <span
                                        key={t}
                                        className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              {typeof a.confidence === "number" && (
                                <div className="text-xs text-muted-foreground self-center">
                                  {(a.confidence * 100).toFixed(0)}%
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="favorites" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-500" />
                Your Favorite Substitutions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {favorites.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No favorites yet! Start exploring ingredients to save your favorites.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {favorites.map((fav, index) => {
                    const ingredient = ingredientSubstitutions.find(
                      item => item.ingredient.toLowerCase() === fav.toLowerCase()
                    );
                    return ingredient ? (
                      <div key={index} className="border rounded-lg p-4 bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{ingredient.ingredient}</h4>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleFavorite(fav)}
                            className="text-pink-500"
                          >
                            <Heart className="w-4 h-4 fill-current" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {ingredient.substitutes.length} substitution{ingredient.substitutes.length > 1 ? 's' : ''} available
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedIngredient(ingredient)}
                        >
                          View Details
                        </Button>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Achievements
                <Badge>{userStats.achievements.length}/{achievements.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={`border rounded-lg p-4 ${
                      achievement.unlocked 
                        ? "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200" 
                        : "bg-muted/30 border-muted"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${
                        achievement.unlocked ? "bg-yellow-500 text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        {achievement.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-semibold ${
                          achievement.unlocked ? "text-yellow-700" : "text-muted-foreground"
                        }`}>
                          {achievement.title}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {achievement.description}
                        </p>
                        {achievement.unlocked && userStats.achievements.includes(achievement.id) && (
                          <Badge variant="secondary" className="mt-2">
                            Unlocked!
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Trending Substitutions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ingredientSubstitutions.slice(0, 8).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <div className="font-medium">{item.ingredient}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.substitutes.length} substitute{item.substitutes.length > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleFavorite(item.ingredient)}
                        className={favorites.includes(item.ingredient) ? "text-pink-500" : ""}
                      >
                        <Heart className={`w-3 h-3 ${favorites.includes(item.ingredient) ? "fill-current" : ""}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedIngredient(item)}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
