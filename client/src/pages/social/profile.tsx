import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useUser } from "@/contexts/UserContext";
import { ProfileCompletion } from "@/components/ProfileCompletion";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import {
  Image,
  ChefHat,
  Sparkles,
  Trophy,
  Star,
  Users,
  Heart,
  Calendar,
  GlassWater,
  Flame,
  Award,
  TrendingUp,
  Apple,
  Crown,
  Target,
  Zap,
  Plus,
  Store as StoreIcon,
  ShoppingBag,
  Eye,
  Bookmark,
  Link as LinkIcon,
  Video,
  Play,
  MessageCircle,
  BarChart3,
} from "lucide-react";
import type { User, PostWithUser } from "@shared/schema";

/** Store type for the Store tab (client-side shape for UI) */
type Store = {
  id: string;
  userId: string;
  handle: string;
  name: string;
  bio: string;
  logo: string | null;
  theme: string | unknown;
  is_published?: boolean;
  subscription_tier?: "free" | "pro" | "enterprise";
  product_limit?: number;
  current_products?: number;
  trial_ends_at?: string;
  layout: unknown | null;
  published: boolean;
  updatedAt?: string;
};

function titleCase(s?: string | null) {
  if (!s) return "";
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

export default function Profile() {
  const { userId } = useParams<{ userId?: string }>();
  const [, setLocation] = useLocation();
  const { user: currentUser } = useUser();
  const profileUserId = userId || currentUser?.id;

  // Fetch user (use currentUser when looking at self)
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/users", profileUserId],
    queryFn: async () => {
      if (profileUserId === currentUser?.id && currentUser) return currentUser;
      const response = await fetch(`/api/users/${profileUserId}`);
      if (!response.ok) {
        if (profileUserId === currentUser?.id && currentUser) return currentUser;
        throw new Error("User not found");
      }
      return response.json();
    },
    enabled: !!profileUserId,
  });

  // Fetch user posts from API
  const { data: posts, isLoading: postsLoading } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/user", profileUserId],
    queryFn: async () => {
      const response = await fetch(`/api/posts/user/${profileUserId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }
      return response.json();
    },
    enabled: !!profileUserId && !!user,
  });

  // Custom drinks (mock)
  const { data: drinksData, isLoading: drinksLoading } = useQuery({
    queryKey: ["/api/custom-drinks/user", profileUserId],
    queryFn: async () => {
      return {
        drinks: [
          {
            id: "1",
            name: "Tropical Sunrise",
            category: "Smoothie",
            description: "Refreshing tropical smoothie with mango and pineapple",
            calories: 180,
            protein: 3,
            fiber: 5,
            likesCount: 15,
            savesCount: 8,
            imageUrl: "https://images.unsplash.com/photo-1570197788417-0e82375c9371",
          },
          {
            id: "2",
            name: "Protein Power Shake",
            category: "Protein Shake",
            description: "High protein shake for post-workout recovery",
            calories: 220,
            protein: 25,
            fiber: 2,
            likesCount: 23,
            savesCount: 12,
            imageUrl: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea",
          },
        ],
      };
    },
    enabled: !!profileUserId,
  });

  // Drink stats (mock)
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/user-drink-stats", profileUserId],
    queryFn: async () => {
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
    },
    enabled: !!profileUserId,
  });

  // Saved drinks (mock)
  const { data: savedDrinksData, isLoading: savedDrinksLoading } = useQuery({
    queryKey: ["/api/custom-drinks/saved", profileUserId],
    queryFn: async () => ({ drinks: [] }),
    enabled: !!profileUserId,
  });

  // Competitions / cookoffs (mock)
  const { data: competitionsData, isLoading: competitionsLoading } = useQuery({
    queryKey: ["/api/competitions/user", profileUserId],
    queryFn: async () => ({
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
    }),
    enabled: !!profileUserId,
  });

  // Store (mock)
  const { data: storeData } = useQuery<{ store: Store | null }>({
    queryKey: ["/api/stores/user", profileUserId],
    queryFn: async () => ({
      store: {
        id: "store-1",
        userId: profileUserId!,
        handle: user?.username || "demo",
        name: `${user?.displayName || "User"}'s Store`,
        bio: "Quality ingredients and kitchen tools",
        logo: user?.avatar || null,
        theme: "default",
        is_published: true,
        subscription_tier: "free",
        product_limit: 10,
        current_products: 3,
        layout: null,
        published: true,
        updatedAt: new Date().toISOString(),
      },
    }),
    enabled: !!profileUserId,
  });

  // Store products count (mock)
  const { data: storeProductsData } = useQuery({
    queryKey: ["/api/stores/products/count", profileUserId],
    queryFn: async () => ({ count: 3 }),
    enabled: !!storeData?.store,
  });

  const isOwnProfile = profileUserId === currentUser?.id;

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

  const displayUser = user || (isOwnProfile ? currentUser : null);
  if (!displayUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 text-center">
        <h1 className="text-2xl font-bold mb-4">User not found</h1>
        <p className="text-muted-foreground">The profile you're looking for doesn't exist.</p>
      </div>
    );
  }

  // ---------- NAME + TITLE RENDERING (Fix) ----------
  const title = titleCase(displayUser.royalTitle);
  const primaryName =
    displayUser.showFullName && displayUser.firstName && displayUser.lastName
      ? `${displayUser.firstName} ${displayUser.lastName}`
      : displayUser.displayName || displayUser.username;
  const profileHeading = `${title ? `${title} ` : ""}${primaryName}`.trim();

  // Helper function to check if a URL is a video
  const isVideoUrl = (url: string) => {
    const videoExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];
    return videoExtensions.some(ext => url?.toLowerCase().includes(ext));
  };

  const allUserPosts = posts?.filter((p) => !p.isRecipe) || [];
  const userPhotos = allUserPosts.filter((p) => !isVideoUrl(p.imageUrl));
  const userVideos = allUserPosts.filter((p) => isVideoUrl(p.imageUrl));
  const userRecipes = posts?.filter((p) => p.isRecipe) || [];
  const customDrinks = drinksData?.drinks || [];
  const savedDrinks = savedDrinksData?.drinks || [];
  const drinkStats = statsData?.stats;
  const userCompetitions = competitionsData?.competitions || [];
  const storeProductsCount = storeProductsData?.count || 0;

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
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start gap-4 md:gap-8 mb-8">
        <Avatar className="w-32 h-32">
          <AvatarImage src={displayUser.avatar || ""} alt={profileHeading} />
          <AvatarFallback className="text-2xl">
            {(primaryName || "U").slice(0, 1)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              {/* Royal Title Badge (if exists) */}
              {title && (
                <Badge className="mb-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                  <Crown className="w-3 h-3 mr-1" />
                  {title}
                </Badge>
              )}

              {/* Name */}
              <h1
                className="text-2xl font-bold"
                data-testid={`text-profile-name-${displayUser.id}`}
              >
                {primaryName}
              </h1>

              {/* Optional subtitle: show specialty if present (NOT @username) */}
              {displayUser.specialty && (
                <p className="text-sm text-muted-foreground mt-1">
                  {displayUser.specialty}
                </p>
              )}
            </div>

            {isOwnProfile ? (
              <div className="flex flex-col items-end gap-2">
                <Button
                  variant="outline"
                  data-testid="button-edit-profile"
                  onClick={() => setLocation("/settings")}
                >
                  Edit Profile
                </Button>
                {storeData?.store && (
                  <Button
                    variant="ghost"
                    className="mt-0"
                    onClick={() =>
                      (window.location.href = "/vendor/dashboard?tab=store")
                    }
                  >
                    Manage My Store
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/messages?new=${displayUser.username}`)}
                  data-testid={`button-message-user-${displayUser.id}`}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Message
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  data-testid={`button-follow-user-${displayUser.id}`}
                >
                  Follow
                </Button>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-6 mb-4 text-sm">
            <div className="text-center">
              <span
                className="font-semibold block"
                data-testid={`text-posts-count-${displayUser.id}`}
              >
                {displayUser.postsCount || 0}
              </span>
              <span className="text-muted-foreground">Posts</span>
            </div>
            <div className="text-center">
              <span
                className="font-semibold block"
                data-testid={`text-followers-count-${displayUser.id}`}
              >
                {displayUser.followersCount || 0}
              </span>
              <span className="text-muted-foreground">Followers</span>
            </div>
            <div className="text-center">
              <span
                className="font-semibold block"
                data-testid={`text-following-count-${displayUser.id}`}
              >
                {displayUser.followingCount || 0}
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
            <div className="text-center">
              <span className="font-semibold block">{userCompetitions.length}</span>
              <span className="text-muted-foreground">Cookoffs</span>
            </div>
            {storeData?.store && (
              <div className="text-center">
                <span className="font-semibold block">{storeProductsCount}</span>
                <span className="text-muted-foreground">Products</span>
              </div>
            )}
          </div>

          {/* Bio */}
          {displayUser.bio && (
            <p className="text-sm mb-4" data-testid={`text-bio-${displayUser.id}`}>
              {displayUser.bio}
            </p>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {displayUser.isChef && (
              <Badge variant="secondary" className="bg-accent text-accent-foreground">
                <ChefHat className="w-3 h-3 mr-1" />
                Chef
              </Badge>
            )}
            {drinkStats && drinkStats.level > 1 && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                <Sparkles className="w-3 h-3 mr-1" />
                Level {drinkStats.level} • {drinkStats.totalPoints} XP
              </Badge>
            )}
            {storeData?.store && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                <StoreIcon className="w-3 h-3 mr-1" />
                Shop Owner
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Profile Completion Prompt - only show on own profile */}
      {isOwnProfile && (
        <div className="mb-6">
          <ProfileCompletion />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="photos" className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:grid-cols-9">
          <TabsTrigger value="photos" className="flex items-center space-x-2" data-testid="tab-photos">
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline">Photos</span>
          </TabsTrigger>
          <TabsTrigger value="bites" className="flex items-center space-x-2" data-testid="tab-bites">
            <Video className="h-4 w-4" />
            <span className="hidden sm:inline">Bites</span>
          </TabsTrigger>
          <TabsTrigger value="recipes" className="flex items-center space-x-2" data-testid="tab-recipes">
            <ChefHat className="h-4 w-4" />
            <span className="hidden sm:inline">Recipes</span>
          </TabsTrigger>
          <TabsTrigger value="drinks" className="flex items-center space-x-2" data-testid="tab-drinks">
            <GlassWater className="h-4 w-4" />
            <span className="hidden sm:inline">Drinks</span>
          </TabsTrigger>
          <TabsTrigger value="cookoffs" className="flex items-center space-x-2" data-testid="tab-cookoffs">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Cookoffs</span>
          </TabsTrigger>
          {isOwnProfile && (
            <TabsTrigger value="messages" className="flex items-center space-x-2" data-testid="tab-messages">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="saved" className="flex items-center space-x-2" data-testid="tab-saved">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Saved</span>
          </TabsTrigger>
          {isOwnProfile && (
            <TabsTrigger value="analytics" className="flex items-center space-x-2" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="store" className="flex items-center space-x-2" data-testid="tab-store">
            <StoreIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Store</span>
          </TabsTrigger>
        </TabsList>

        {/* PHOTOS */}
        <TabsContent value="photos" className="mt-6">
          {postsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : userPhotos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userPhotos.map((post) => (
                <Card key={post.id} className="group cursor-pointer hover:shadow-lg transition-shadow">
                  <div className="relative overflow-hidden aspect-square">
                    <img
                      src={post.imageUrl}
                      alt={post.caption || "Photo"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      data-testid={`img-user-photo-${post.id}`}
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
              <h3 className="text-lg font-semibold mb-2">No photos yet</h3>
              <p className="text-muted-foreground">
                {isOwnProfile ? "Start sharing your culinary creations!" : "No photos to show."}
              </p>
            </div>
          )}
        </TabsContent>

        {/* BITES (VIDEOS) */}
        <TabsContent value="bites" className="mt-6">
          {postsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : userVideos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userVideos.map((post) => (
                <Card key={post.id} className="group cursor-pointer hover:shadow-lg transition-shadow">
                  <div className="relative overflow-hidden aspect-square bg-black">
                    <video
                      src={post.imageUrl}
                      className="w-full h-full object-cover"
                      data-testid={`video-user-bite-${post.id}`}
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors duration-300 flex items-center justify-center">
                      <Play className="w-12 h-12 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                      <div className="flex items-center space-x-4 text-white text-sm">
                        <span className="flex items-center space-x-1">
                          <Heart className="h-4 w-4" />
                          <span>{post.likesCount}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{post.commentsCount}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  {post.caption && (
                    <CardContent className="p-3">
                      <p className="text-sm line-clamp-2">{post.caption}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Video className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No bites yet</h3>
              <p className="text-muted-foreground">
                {isOwnProfile ? "Start sharing your video bites!" : "No video bites to show."}
              </p>
              {isOwnProfile && (
                <Button className="mt-4" onClick={() => setLocation("/create")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Bite
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* RECIPES */}
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

        {/* DRINKS */}
        <TabsContent value="drinks" className="mt-6">
          {drinksLoading || statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {statsData?.stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Total Drinks</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">{statsData.stats.totalDrinksMade}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Level</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">{statsData.stats.level}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Points</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">{statsData.stats.totalPoints}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Streak</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">{statsData.stats.currentStreak} days</CardContent>
                  </Card>
                </div>
              )}

              {customDrinks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customDrinks.map((d) => (
                    <Card key={d.id} className="overflow-hidden">
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={d.imageUrl}
                          alt={d.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{d.name}</h3>
                          <Badge variant="outline">{d.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {d.description}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <Flame className="w-4 h-4" /> {d.calories} cal
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-4 h-4" /> {d.likesCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Bookmark className="w-4 h-4" /> {d.savesCount}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <GlassWater className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold mb-2">No drinks yet</h3>
                  <p className="text-muted-foreground">
                    {isOwnProfile ? "Start crafting your signature drinks!" : "No drinks to show."}
                  </p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* COOKOFFS */}
        <TabsContent value="cookoffs" className="mt-6">
          {competitionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : userCompetitions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userCompetitions.map((c) => (
                <Card key={c.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{c.title}</h3>
                      <p className="text-sm text-muted-foreground">{c.themeName}</p>
                    </div>
                    <Badge className={getStatusBadge(c.status)}>{c.status}</Badge>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" /> {c.participants}
                    </span>
                    {c.placement ? (
                      <span className="flex items-center gap-1">
                        <Award className="w-4 h-4" /> #{c.placement}
                      </span>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No cookoffs yet</h3>
              <p className="text-muted-foreground">
                {isOwnProfile ? "Join a weekly cooking competition!" : "No cookoffs to show."}
              </p>
            </div>
          )}
        </TabsContent>

        {/* SAVED */}
        <TabsContent value="saved" className="mt-6">
          {savedDrinksLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : savedDrinks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {savedDrinks.map((d: any) => (
                <Card key={d.id} className="overflow-hidden">
                  <div className="aspect-square overflow-hidden">
                    <img src={d.imageUrl} alt={d.name} className="w-full h-full object-cover" />
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{d.name}</h3>
                      <Badge variant="outline">{d.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{d.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Star className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No saved items yet</h3>
              <p className="text-muted-foreground">
                {isOwnProfile ? "Save recipes and drinks to find them quickly later." : "No saved items to show."}
              </p>
            </div>
          )}
        </TabsContent>

        {/* MESSAGES */}
        {isOwnProfile && (
          <TabsContent value="messages" className="mt-6">
            <Card className="border-2 border-amber-200 bg-gradient-to-br from-orange-50/50 to-red-50/50">
              <CardHeader className="border-b border-amber-200">
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-600" />
                  <span className="bg-gradient-to-r from-orange-700 to-red-700 bg-clip-text text-transparent">
                    Royal Table Talk
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 text-amber-400" />
                  <h3 className="text-lg font-semibold mb-2">Your Royal Conversations</h3>
                  <p className="text-muted-foreground mb-4">
                    Manage your messages and connect with fellow chefs
                  </p>
                  <Button
                    onClick={() => setLocation("/messages")}
                    className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold shadow-md"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Open Messages
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ANALYTICS */}
        {isOwnProfile && (
          <TabsContent value="analytics" className="mt-6">
            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-purple-50/50">
              <CardHeader className="border-b border-blue-200">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <span className="bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent">
                    Your Analytics Dashboard
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <AnalyticsDashboard />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* STORE */}
        <TabsContent value="store" className="mt-6">
          {storeData?.store ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <StoreIcon className="w-5 h-5" />
                    {storeData.store.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="secondary">{storeData.store.published ? "Published" : "Draft"}</Badge>
                    <Badge variant="outline">Products: {storeProductsCount}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{storeData.store.bio}</p>
                  {isOwnProfile && (
                    <Button
                      className="mt-4"
                      onClick={() => (window.location.href = "/vendor/dashboard?tab=store")}
                    >
                      Open Store Dashboard
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">At a glance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Handle</span>
                    <span className="font-mono text-sm">/{storeData.store.handle}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <span className="font-medium">
                      {storeData.store.published ? "Live" : "Hidden"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Updated</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(storeData.store.updatedAt || "").toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12">
              <StoreIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No store yet</h3>
              {isOwnProfile ? (
                <p className="text-muted-foreground">
                  Create your storefront from the dashboard to start selling.
                </p>
              ) : (
                <p className="text-muted-foreground">This user doesn't have a public store.</p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
