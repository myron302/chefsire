import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import PostCard from "@/components/post-card";
import {
  Image,
  ChefHat,
  Sparkles,
  Trophy,
  Star,
  Users,
  Heart,
  Bookmark,
  MapPin,
  Link as LinkIcon,
  Calendar,
  GlassWater,
  Flame,
  Award,
  TrendingUp,
  Apple,
  Timer,
  Crown,
  Target,
  Zap,
  Plus,
} from "lucide-react";
import type { User, PostWithUser } from "@shared/schema";

/** Store type for the Store tab */
type Store = {
  id: string;
  userId: string;
  handle: string;
  name: string;
  bio: string;
  layout: unknown | null;
  published: boolean;
  updatedAt?: string;
};

export default function Profile() {
  const { userId } = useParams<{ userId?: string }>();
  const currentUserId = "user-1"; // Updated to match Alexandra
  const profileUserId = userId || currentUserId;

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/users", profileUserId],
  });

  const { data: posts, isLoading: postsLoading } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/user", profileUserId],
  });

  // Fetch user's custom drinks
  const { data: drinksData, isLoading: drinksLoading } = useQuery({
    queryKey: ["/api/custom-drinks/user", profileUserId],
    queryFn: async () => {
      const response = await fetch(`/api/custom-drinks/user/${profileUserId}`);
      if (!response.ok) {
        // Mock data if API doesn't exist
        return { drinks: [] };
      }
      return response.json();
    },
  });

  // Fetch user drink stats with fallback mock data
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/user-drink-stats", profileUserId],
    queryFn: async () => {
      const response = await fetch(`/api/user-drink-stats/${profileUserId}`);
      if (!response.ok) {
        // Return mock stats if API doesn't exist yet
        return {
          stats: {
            totalDrinksMade: 47,
            level: 5,
            totalPoints: 2350,
            currentStreak: 4,
            badges: ["early-bird", "smoothie-master", "health-guru"],
            smoothiesMade: 18,
            proteinShakesMade: 12,
            detoxesMade: 9,
            cocktailsMade: 8,
          },
        };
      }
      return response.json();
    },
  });

  // Fetch saved drinks
  const { data: savedDrinksData, isLoading: savedDrinksLoading } = useQuery({
    queryKey: ["/api/custom-drinks/saved", profileUserId],
    queryFn: async () => {
      const response = await fetch(`/api/custom-drinks/saved/${profileUserId}`);
      if (!response.ok) {
        return { drinks: [] };
      }
      return response.json();
    },
  });

  // Fetch user's competitions/cookoffs
  const { data: competitionsData, isLoading: competitionsLoading } = useQuery({
    queryKey: ["/api/competitions/user", profileUserId],
    queryFn: async () => {
      const response = await fetch(`/api/competitions/user/${profileUserId}`);
      if (!response.ok) {
        // Mock data if endpoint doesn't exist yet
        return {
          competitions: [
            {
              id: "1",
              title: "Midnight Pasta Showdown",
              themeName: "Italian Night",
              status: "completed",
              placement: 1,
              participants: 6,
              createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: "2",
              title: "Taco Fiesta Challenge",
              themeName: "Taco Tuesday",
              status: "judging",
              placement: 2,
              participants: 8,
              createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: "3",
              title: "Quick 30-Min Sprint",
              themeName: "Quick 30-Min",
              status: "live",
              participants: 5,
              createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            },
          ],
        };
      }
      return response.json();
    },
  });

  // ✅ Fetch this user's Storefront
  const { data: storeData, isLoading: storeLoading } = useQuery<{ store: Store | null }>({
    queryKey: ["/api/stores/by-user", profileUserId],
    queryFn: async () => {
      const res = await fetch(`/api/stores/by-user/${profileUserId}`);
      if (!res.ok) return { store: null };
      return res.json();
    },
  });

  const isOwnProfile = profileUserId === currentUserId;

  if (userLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="animate-pulse">
          <div className="flex flex-col md:flex-row items-start space-y-4 md:space-y-0 md:space-x-8 mb-8">
            <div className="w-32 h-32 bg-muted rounded-full" />
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <div className="w-48 h-6 bg-muted rounded" />
                <div className="w-32 h-4 bg-muted rounded" />
              </div>
              <div className="w-full h-20 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 text-center">
        <h1 className="text-2xl font-bold mb-4">User not found</h1>
        <p className="text-muted-foreground">The profile you're looking for doesn't exist.</p>
      </div>
    );
  }

  const userPosts = posts?.filter((post) => !post.isRecipe) || [];
  const userRecipes = posts?.filter((post) => post.isRecipe) || [];
  const customDrinks = drinksData?.drinks || [];
  const savedDrinks = savedDrinksData?.drinks || [];
  const drinkStats = statsData?.stats;
  const userCompetitions = competitionsData?.competitions || [];

  const getStatusBadge = (status: string) => {
    const styles = {
      live: "bg-gradient-to-r from-green-500 to-emerald-500 text-white animate-pulse",
      judging: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
      completed: "bg-gradient-to-r from-blue-500 to-purple-500 text-white",
      upcoming: "bg-gradient-to-r from-gray-500 to-slate-500 text-white",
    };
    return styles[status as keyof typeof styles] || styles.upcoming;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-start space-y-4 md:space-y-0 md:space-x-8 mb-8">
        <Avatar className="w-32 h-32">
          <AvatarImage src={user.avatar || ""} alt={user.displayName} />
          <AvatarFallback className="text-2xl">{user.displayName[0]}</AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold" data-testid={`text-profile-name-${user.id}`}>
                {user.displayName}
              </h1>
              <p className="text-muted-foreground">@{user.username}</p>
            </div>

            {isOwnProfile ? (
              <div className="flex flex-col items-end gap-2">
                <Button variant="outline" data-testid="button-edit-profile">
                  Edit Profile
                </Button>
                {/* Optional quick link to the user's store */}
                <Button variant="ghost" className="mt-0" onClick={() => (window.location.href = "/store/me")}>
                  View My Store
                </Button>
              </div>
            ) : (
              <Button className="bg-primary text-primary-foreground" data-testid={`button-follow-user-${user.id}`}>
                Follow
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="flex space-x-6 mb-4 text-sm">
            <div className="text-center">
              <span className="font-semibold block" data-testid={`text-posts-count-${user.id}`}>
                {user.postsCount}
              </span>
              <span className="text-muted-foreground">Posts</span>
            </div>
            <div className="text-center">
              <span className="font-semibold block" data-testid={`text-followers-count-${user.id}`}>
                {user.followersCount}
              </span>
              <span className="text-muted-foreground">Followers</span>
            </div>
            <div className="text-center">
              <span className="font-semibold block" data-testid={`text-following-count-${user.id}`}>
                {user.followingCount}
              </span>
              <span className="text-muted-foreground">Following</span>
            </div>
            {drinkStats && (
              <div className="text-center">
                <span className="font-semibold block">{drinkStats.totalDrinksMade}</span>
                <span className="text-muted-foreground">Drinks</span>
              </div>
            )}
            <div className="text-center">
              <span className="font-semibold block">{userCompetitions.length}</span>
              <span className="text-muted-foreground">Cookoffs</span>
            </div>
          </div>

          {/* Bio */}
          {user.bio && (
            <p className="text-sm mb-4" data-testid={`text-bio-${user.id}`}>
              {user.bio}
            </p>
          )}

          {/* Chef Badge & Specialty */}
          <div className="flex flex-wrap gap-2 mb-4">
            {user.isChef && (
              <Badge variant="secondary" className="bg-accent text-accent-foreground">
                <ChefHat className="w-3 h-3 mr-1" />
                Chef
              </Badge>
            )}
            {user.specialty && <Badge variant="outline">{user.specialty}</Badge>}
            {drinkStats && drinkStats.level > 1 && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                <Sparkles className="w-3 h-3 mr-1" />
                Level {drinkStats.level} • {drinkStats.totalPoints} XP
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        {/* 👇 grid-cols bumped from 5 → 6 to fit the Store tab */}
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="posts" className="flex items-center space-x-2" data-testid="tab-posts">
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline">Posts</span>
          </TabsTrigger>
          <TabsTrigger value="recipes" className="flex items-center space-x-2" data-testid="tab-recipes">
            <ChefHat className="h-4 w-4" />
            <span className="hidden sm:inline">Recipes</span>
          </TabsTrigger>
          <TabsTrigger value="drinks" className="flex items-center space-x-2" data-testid="tab-drinks">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Drinks</span>
          </TabsTrigger>
          <TabsTrigger value="cookoffs" className="flex items-center space-x-2" data-testid="tab-cookoffs">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Cookoffs</span>
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center space-x-2" data-testid="tab-saved">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Saved</span>
          </TabsTrigger>
          {/* 🆕 Store tab trigger */}
          <TabsTrigger value="store" className="flex items-center space-x-2" data-testid="tab-store">
            <LinkIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Store</span>
          </TabsTrigger>
        </TabsList>

        {/* POSTS TAB */}
        <TabsContent value="posts" className="mt-6">
          {postsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : userPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userPosts.map((post) => (
                <Card key={post.id} className="group cursor-pointer hover:shadow-lg transition-shadow">
                  <div className="relative overflow-hidden aspect-square">
                    <img
                      src={post.imageUrl}
                      alt="Post"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      data-testid={`img-user-post-${post.id}`}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex items-center space-x-4 text-white">
                        <span className="flex items-center space-x-1">
                          <Heart className="h-5 w-5" />
                          <span>{post.likesCount}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Users className="h-5 w-5" />
                          <span>{post.commentsCount}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Image className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
              <p className="text-muted-foreground">
                {isOwnProfile ? "Start sharing your culinary creations!" : "No posts to show."}
              </p>
            </div>
          )}
        </TabsContent>

        {/* RECIPES TAB */}
        <TabsContent value="recipes" className="mt-6">
          {postsLoading ? (
            <div className="space-y-8">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="w-full h-96 bg-muted" />
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="w-3/4 h-6 bg-muted rounded" />
                      <div className="w-full h-20 bg-muted rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : userRecipes.length > 0 ? (
            <div className="space-y-8">
              {userRecipes.map((post) => (
                <Card key={post.id} className="overflow-hidden">
                  <div className="relative">
                    {post.imageUrl ? (
                      <img src={post.imageUrl} alt={post.caption || "Recipe"} className="w-full h-64 object-cover" />
                    ) : (
                      <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
                        <Heart className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-6">
                    <h3 className="text-xl font-semibold mb-2">{post.caption || "Recipe"}</h3>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span className="flex items-center space-x-1">
                        <Heart className="w-4 h-4" />
                        <span>{post.likesCount} likes</span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ChefHat className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No recipes yet</h3>
              <p className="text-muted-foreground">
                {isOwnProfile ? "Share your favorite recipes with the community!" : "No recipes to show."}
              </p>
            </div>
          )}
        </TabsContent>

        {/* DRINKS TAB */}
        <TabsContent value="drinks" className="mt-6">
          {drinksLoading ? (
            <div className="space-y-6">
              <div className="animate-pulse">
                <div className="w-full h-32 bg-muted rounded-lg mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-48 bg-muted rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Drink Stats Card */}
              {drinkStats && (
                <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      Mixology Stats
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{drinkStats.totalDrinksMade}</div>
                        <div className="text-sm text-gray-600">Drinks Made</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">Level {drinkStats.level}</div>
                        <div className="text-sm text-gray-600 font-semibold">{drinkStats.totalPoints} XP</div>
                        <Progress value={(drinkStats.totalPoints % 1000) / 10} className="mt-2 h-2" />
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{drinkStats.currentStreak} 🔥</div>
                        <div className="text-sm text-gray-600">Day Streak</div>
                        <div className="flex justify-center gap-1 mt-2">
                          {[...Array(7)].map((_, i) => (
                            <div key={i} className={`w-4 h-4 rounded ${i < drinkStats.currentStreak ? "bg-orange-400" : "bg-gray-200"}`} />
                          ))}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{drinkStats.badges?.length || 0} 🏅</div>
                        <div className="text-sm text-gray-600">Badges Earned</div>
                      </div>
                    </div>

                    {/* Category Breakdown */}
                    <div className="mt-6 pt-6 border-t border-purple-200">
                      <h4 className="font-semibold mb-3 text-sm">Drinks by Category</h4>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div>
                          <Apple className="w-4 h-4 mx-auto mb-1 text-green-500" />
                          <div className="font-semibold">{drinkStats.smoothiesMade}</div>
                          <div className="text-gray-500">Smoothies</div>
                        </div>
                        <div>
                          <Flame className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                          <div className="font-semibold">{drinkStats.proteinShakesMade}</div>
                          <div className="text-gray-500">Protein</div>
                        </div>
                        <div>
                          <TrendingUp className="w-4 h-4 mx-auto mb-1 text-teal-500" />
                          <div className="font-semibold">{drinkStats.detoxesMade}</div>
                          <div className="text-gray-500">Detoxes</div>
                        </div>
                        <div>
                          <GlassWater className="w-4 h-4 mx-auto mb-1 text-purple-500" />
                          <div className="font-semibold">{drinkStats.cocktailsMade}</div>
                          <div className="text-gray-500">Cocktails</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Custom Drinks Grid */}
              {customDrinks.length > 0 ? (
                <div>
                  <h3 className="text-lg font-bold mb-4">Custom Drinks ({customDrinks.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customDrinks.map((drink: any) => (
                      <Card key={drink.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        {drink.imageUrl && (
                          <div className="relative h-48">
                            <img src={drink.imageUrl} alt={drink.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-lg">{drink.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {drink.category}
                            </Badge>
                          </div>
                          {drink.description && <p className="text-sm text-gray-600 mb-3">{drink.description}</p>}
                          <div className="grid grid-cols-3 gap-2 text-xs text-center py-2 bg-gray-50 rounded">
                            <div>
                              <div className="font-semibold text-orange-600">{drink.calories}</div>
                              <div className="text-gray-500">cal</div>
                            </div>
                            <div>
                              <div className="font-semibold text-blue-600">{drink.protein}g</div>
                              <div className="text-gray-500">protein</div>
                            </div>
                            <div>
                              <div className="font-semibold text-green-600">{drink.fiber}g</div>
                              <div className="text-gray-500">fiber</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Heart className="w-4 h-4" />
                              {drink.likesCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <Bookmark className="w-4 h-4" />
                              {drink.savesCount}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <GlassWater className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold mb-2">No custom drinks yet</h3>
                  <p className="text-muted-foreground mb-4">
                    {isOwnProfile ? "Start creating your signature drinks!" : "No drinks to show."}
                  </p>
                  {isOwnProfile && <Button onClick={() => (window.location.href = "/drinks/smoothies")}>Create Your First Drink</Button>}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* COOKOFFS TAB */}
        <TabsContent value="cookoffs" className="mt-6">
          {competitionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : userCompetitions.length > 0 ? (
            <div className="space-y-6">
              {/* Competition Stats Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200">
                  <CardContent className="p-4 text-center">
                    <Crown className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                    <div className="text-2xl font-bold text-yellow-600">
                      {userCompetitions.filter((c: any) => c.placement === 1).length}
                    </div>
                    <div className="text-xs text-gray-600">1st Place Wins</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <Trophy className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                    <div className="text-2xl font-bold text-blue-600">
                      {userCompetitions.filter((c: any) => c.placement <= 3).length}
                    </div>
                    <div className="text-xs text-gray-600">Top 3 Finishes</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
                  <CardContent className="p-4 text-center">
                    <Flame className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                    <div className="text-2xl font-bold text-purple-600">{userCompetitions.length}</div>
                    <div className="text-xs text-gray-600">Total Battles</div>
                  </CardContent>
                </Card>
              </div>

              {/* Competition History */}
              <div>
                <h3 className="text-lg font-bold mb-4">Competition History</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userCompetitions.map((comp: any) => (
                    <Card
                      key={comp.id}
                      className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                      onClick={() => (window.location.href = `/competitions/${comp.id}`)}
                    >
                      <div
                        className={`h-2 bg-gradient-to-r ${
                          comp.status === "live"
                            ? "from-green-500 to-emerald-500"
                            : comp.status === "judging"
                            ? "from-amber-500 to-orange-500"
                            : comp.status === "completed"
                            ? "from-blue-500 to-purple-500"
                            : "from-gray-400 to-slate-500"
                        }`}
                      ></div>

                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-bold text-lg mb-1">{comp.title}</h4>
                            <p className="text-sm text-gray-600">{comp.themeName}</p>
                          </div>
                          {comp.placement && comp.placement <= 3 && (
                            <div
                              className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                                comp.placement === 1
                                  ? "bg-yellow-100 text-yellow-700"
                                  : comp.placement === 2
                                  ? "bg-gray-100 text-gray-700"
                                  : "bg-orange-100 text-orange-700"
                              }`}
                            >
                              {comp.placement === 1 ? (
                                <Crown className="w-4 h-4" />
                              ) : comp.placement === 2 ? (
                                <Award className="w-4 h-4" />
                              ) : (
                                <Target className="w-4 h-4" />
                              )}
                              <span className="text-xs font-bold">#{comp.placement}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{comp.participants} chefs</span>
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadge(comp.status)}`}>
                            {comp.status === "live" && <Zap className="inline w-3 h-3 mr-1" />}
                            {comp.status.toUpperCase()}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(comp.createdAt).toLocaleDateString()}
                          </div>
                          <span className="text-purple-600 font-semibold hover:underline">View Details →</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No cookoffs yet</h3>
              <p className="text-muted-foreground mb-4">
                {isOwnProfile ? "Ready to compete? Join or create your first cookoff!" : "No competitions to show."}
              </p>
              {isOwnProfile && (
                <div className="flex justify-center gap-3">
                  <Button onClick={() => (window.location.href = "/competitions")} variant="outline">
                    Browse Cookoffs
                  </Button>
                  <Button onClick={() => (window.location.href = "/competitions/new")} className="bg-gradient-to-r from-purple-500 to-pink-500">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Cookoff
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* SAVED TAB */}
        <TabsContent value="saved" className="mt-6">
          {savedDrinksLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : savedDrinks.length > 0 ? (
            <div>
              <h3 className="text-lg font-bold mb-4">Saved Drinks ({savedDrinks.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedDrinks.map((drink: any) => (
                  <Card key={drink.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    {drink.imageUrl && (
                      <div className="relative h-48">
                        <img src={drink.imageUrl} alt={drink.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-lg">{drink.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {drink.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mb-2">by @{drink.user?.username}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs text-center py-2 bg-gray-50 rounded">
                        <div>
                          <div className="font-semibold text-orange-600">{drink.calories}</div>
                          <div className="text-gray-500">cal</div>
                        </div>
                        <div>
                          <div className="font-semibold text-blue-600">{drink.protein}g</div>
                          <div className="text-gray-500">protein</div>
                        </div>
                        <div>
                          <div className="font-semibold text-green-600">{drink.fiber}g</div>
                          <div className="text-gray-500">fiber</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Star className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No saved items yet</h3>
              <p className="text-muted-foreground">
                {isOwnProfile ? "Your saved posts and drinks will appear here." : "This section is private."}
              </p>
            </div>
          )}
        </TabsContent>

        {/* 🆕 STORE TAB */}
        <TabsContent value="store" className="mt-6">
          {storeLoading ? (
            <div className="h-40 bg-muted rounded-lg animate-pulse" />
          ) : storeData?.store ? (
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">{storeData.store.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <LinkIcon className="w-4 h-4" />
                      <a href={`/store/${storeData.store.handle}`} className="underline hover:no-underline">
                        /store/{storeData.store.handle}
                      </a>
                    </div>
                    {storeData.store.bio && <p className="text-sm text-gray-600 mt-3">{storeData.store.bio}</p>}
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <Badge
                      variant={storeData.store.published ? "default" : "secondary"}
                      className={storeData.store.published ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800"}
                    >
                      {storeData.store.published ? "Published" : "Unpublished"}
                    </Badge>

                    {storeData.store.updatedAt && (
                      <span className="text-xs text-gray-500">
                        Updated {new Date(storeData.store.updatedAt).toLocaleDateString()}
                      </span>
                    )}

                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" onClick={() => (window.location.href = `/store/${storeData.store.handle}`)}>
                        View Store
                      </Button>
                      {isOwnProfile && (
                        <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={() => (window.location.href = "/store")}>
                          Edit Store
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12">
              <LinkIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No store yet</h3>
              <p className="text-muted-foreground mb-4">
                {isOwnProfile ? "Create your storefront to showcase products and services." : "This user hasn’t created a store yet."}
              </p>
              {isOwnProfile && (
                <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={() => (window.location.href = "/store")}>
                  Create Your Store
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
