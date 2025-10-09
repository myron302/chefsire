import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import PostCard from "@/components/post-card";
import { Grid, Heart, Bookmark, Users, MapPin, Link as LinkIcon, Calendar, GlassWater, Flame, Trophy, Award, TrendingUp, Apple } from "lucide-react";
import type { User, PostWithUser } from "@shared/schema";

export default function Profile() {
  const { userId } = useParams<{ userId?: string }>();
  const currentUserId = "user-1"; // In a real app, this would come from authentication
  const profileUserId = userId || currentUserId;

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/users", profileUserId],
  });

  const { data: posts, isLoading: postsLoading } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/user", profileUserId],
  });

  // NEW: Fetch user's custom drinks
  const { data: drinksData, isLoading: drinksLoading } = useQuery({
    queryKey: ["/api/custom-drinks/user", profileUserId],
    queryFn: async () => {
      const response = await fetch(`/api/custom-drinks/user/${profileUserId}`);
      if (!response.ok) throw new Error("Failed to fetch drinks");
      return response.json();
    },
  });

  // NEW: Fetch user drink stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/user-drink-stats", profileUserId],
    queryFn: async () => {
      const response = await fetch(`/api/user-drink-stats/${profileUserId}`);
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  // NEW: Fetch saved drinks
  const { data: savedDrinksData, isLoading: savedDrinksLoading } = useQuery({
    queryKey: ["/api/custom-drinks/saved", profileUserId],
    queryFn: async () => {
      const response = await fetch(`/api/custom-drinks/saved/${profileUserId}`);
      if (!response.ok) throw new Error("Failed to fetch saved drinks");
      return response.json();
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

  const userPosts = posts?.filter(post => !post.isRecipe) || [];
  const userRecipes = posts?.filter(post => post.isRecipe) || [];
  const customDrinks = drinksData?.drinks || [];
  const savedDrinks = savedDrinksData?.drinks || [];
  const drinkStats = statsData?.stats;

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
              <Button variant="outline" data-testid="button-edit-profile">
                Edit Profile
              </Button>
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
                <span className="font-semibold block">
                  {drinkStats.totalDrinksMade}
                </span>
                <span className="text-muted-foreground">Drinks</span>
              </div>
            )}
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
                Chef
              </Badge>
            )}
            {user.specialty && (
              <Badge variant="outline">{user.specialty}</Badge>
            )}
            {drinkStats && drinkStats.level > 1 && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                Level {drinkStats.level} Mixologist
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="posts" className="flex items-center space-x-2" data-testid="tab-posts">
            <Grid className="h-4 w-4" />
            <span className="hidden sm:inline">Posts</span>
          </TabsTrigger>
          <TabsTrigger value="recipes" className="flex items-center space-x-2" data-testid="tab-recipes">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Recipes</span>
          </TabsTrigger>
          <TabsTrigger value="drinks" className="flex items-center space-x-2" data-testid="tab-drinks">
            <GlassWater className="h-4 w-4" />
            <span className="hidden sm:inline">Drinks</span>
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center space-x-2" data-testid="tab-saved">
            <Bookmark className="h-4 w-4" />
            <span className="hidden sm:inline">Saved</span>
          </TabsTrigger>
        </TabsList>

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
              <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
              <p className="text-muted-foreground">
                {isOwnProfile ? "Start sharing your culinary creations!" : "No posts to show."}
              </p>
            </div>
          )}
        </TabsContent>

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
                      <img
                        src={post.imageUrl}
                        alt={post.caption || "Recipe"}
                        className="w-full h-64 object-cover"
                      />
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
              <h3 className="text-lg font-semibold mb-2">No recipes yet</h3>
              <p className="text-muted-foreground">
                {isOwnProfile ? "Share your favorite recipes with the community!" : "No recipes to show."}
              </p>
            </div>
          )}
        </TabsContent>

        {/* NEW DRINKS TAB */}
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
                <Card className="bg-gradient-to-r from-purple-50 to-pink-50">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-purple-600" />
                      Mixology Stats
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {drinkStats.totalDrinksMade}
                        </div>
                        <div className="text-sm text-gray-600">Drinks Made</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          Level {drinkStats.level}
                        </div>
                        <div className="text-sm text-gray-600">{drinkStats.totalPoints} XP</div>
                        <Progress 
                          value={(drinkStats.totalPoints % 1000) / 10} 
                          className="mt-2 h-2" 
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {drinkStats.currentStreak}
                        </div>
                        <div className="text-sm text-gray-600">Day Streak</div>
                        <div className="flex justify-center gap-1 mt-2">
                          {[...Array(7)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-4 h-4 rounded ${
                                i < drinkStats.currentStreak
                                  ? 'bg-orange-400'
                                  : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {drinkStats.badges?.length || 0}
                        </div>
                        <div className="text-sm text-gray-600">Badges Earned</div>
                      </div>
                    </div>
                    
                    {/* Category Breakdown */}
                    <div className="mt-6 pt-6 border-t">
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
                            <img
                              src={drink.imageUrl}
                              alt={drink.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-lg">{drink.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {drink.category}
                            </Badge>
                          </div>
                          {drink.description && (
                            <p className="text-sm text-gray-600 mb-3">{drink.description}</p>
                          )}
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
                  {isOwnProfile && (
                    <Button onClick={() => window.location.href = '/drinks/smoothies'}>
                      Create Your First Drink
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>

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
                        <img
                          src={drink.imageUrl}
                          alt={drink.name}
                          className="w-full h-full object-cover"
                        />
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
              <Bookmark className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No saved items yet</h3>
              <p className="text-muted-foreground">
                {isOwnProfile ? "Your saved posts and drinks will appear here." : "This section is private."}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
