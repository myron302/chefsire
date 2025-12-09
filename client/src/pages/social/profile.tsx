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

// Simple helper to check if a URL is likely a video based on extension
const isVideoUrl = (url: string) => {
  const videoExtensions = [".mp4", ".mov", ".webm", ".ogg"];
  return videoExtensions.some((ext) => url.toLowerCase().endsWith(ext));
};

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

  // Fetch user posts from API + show mock data as fallback
  const { data: posts, isLoading: postsLoading } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/user", profileUserId],
    queryFn: async () => {
      // Try to fetch real posts first
      try {
        const response = await fetch(`/api/posts/user/${profileUserId}`, {
          credentials: "include",
        });
        if (response.ok) {
          const realPosts = await response.json();

          // If we have real posts, return them
          if (realPosts && realPosts.length > 0) {
            return realPosts;
          }
        }
      } catch (error) {
        console.log("No real posts yet, showing mock data");
      }

      // Fallback to mock posts if no real posts exist
      const mockPosts: PostWithUser[] = [
        {
          id: "mock-1",
          userId: profileUserId!,
          caption: "Delicious homemade pasta!",
          imageUrl: "https://images.unsplash.com/photo-1551183053-bf91a1d81141",
          likesCount: 24,
          commentsCount: 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isRecipe: false,
          user: user || (currentUser as User),
        },
        {
          id: "mock-2",
          userId: profileUserId!,
          caption: "My signature smoothie recipe",
          imageUrl: "https://images.unsplash.com/photo-1570197788417-0e82375c9371",
          likesCount: 42,
          commentsCount: 8,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isRecipe: true,
          user: user || (currentUser as User),
        },
      ];
      return mockPosts;
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
        <div className="flex flex-col md:flex-row items-start gap-4 md:gap-8 mb-8">
          <div className="w-32 h-32 bg-gray-200 rounded-full animate-pulse" />
          <div className="flex-1 space-y-4 pt-4">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="h-10 w-28 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 text-center">
        <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h1 className="text-2xl font-bold mb-2">User Not Found</h1>
        <p className="text-muted-foreground">The profile you are looking for does not exist or has been deleted.</p>
        <Button onClick={() => setLocation("/feed")} className="mt-4">
          Go to Feed
        </Button>
      </div>
    );
  }

  const displayUser = user || currentUser;
  const primaryName = displayUser.firstName || displayUser.lastName
    ? `${displayUser.firstName || ""} ${displayUser.lastName || ""}`.trim()
    : displayUser.displayName || displayUser.username;
  const profileHeading = primaryName;
  const title = displayUser.royalTitle ? titleCase(displayUser.royalTitle) : null;
  const bio = displayUser.bio || "No bio yet.";

  // Post filtering
  const allPosts = posts || [];
  const photoPosts = allPosts.filter(
    (post) => !post.isRecipe && !isVideoUrl(post.imageUrl)
  );
  const bitePosts = allPosts.filter(
    (post) => !post.isRecipe && isVideoUrl(post.imageUrl)
  );
  const recipePosts = allPosts.filter((post) => post.isRecipe);

  // Helper for competition status badge
  const getCompetitionStatusStyles = (status: string) => {
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
              <h1 className="text-3xl font-bold flex items-center gap-2 mb-1">
                {profileHeading}
              </h1>

              {/* Royal Title Badge (if exists) */}
              {title && (
                <Badge className="mb-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                  <Crown className="w-3 h-3 mr-1" />
                  {title}
                </Badge>
              )}
              <p className="text-xl text-muted-foreground">@{displayUser.username}</p>
            </div>
            {/* Follow / Edit Profile Button Group */}
            <div className="flex gap-2 mt-4 sm:mt-0">
              {isOwnProfile ? (
                <>
                  <Button onClick={() => setLocation("/create-post")} variant="secondary" data-testid="button-create-post">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Post
                  </Button>
                  <Button onClick={() => setLocation("/settings/profile")}>
                    <Eye className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                </>
              ) : (
                <Button variant="outline">
                  <Heart className="w-4 h-4 mr-2" />
                  Follow
                </Button>
              )}
              {/* <Button variant="outline"><MessageCircle className="w-4 h-4" /></Button> */}
            </div>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{bio}</p>

          <div className="flex gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span className="font-semibold">{displayUser.followersCount || 0}</span> Followers
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              <span className="font-semibold">{displayUser.totalLikes || 0}</span> Likes
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Joined {new Date(displayUser.createdAt).getFullYear()}
            </span>
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
          <TabsTrigger value="store" className="flex items-center space-x-2" data-testid="tab-store">
            <StoreIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Store</span>
          </TabsTrigger>

          {/* Own Profile Only Tabs */}
          {isOwnProfile && (
            <>
              <TabsTrigger value="saved" className="flex items-center space-x-2" data-testid="tab-saved">
                <Bookmark className="h-4 w-4" />
                <span className="hidden sm:inline">Saved</span>
              </TabsTrigger>
              <TabsTrigger value="messages" className="flex items-center space-x-2" data-testid="tab-messages">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Messages</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center space-x-2" data-testid="tab-analytics">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Photos Tab Content */}
        <TabsContent value="photos" className="mt-6">
          {postsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : photoPosts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photoPosts.map((post) => (
                <Card key={post.id} className="group cursor-pointer hover:shadow-lg transition-shadow">
                  <div className="relative overflow-hidden aspect-square">
                    <img
                      src={post.imageUrl}
                      alt={post.caption || "Post image"}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      data-testid={`img-user-photo-${post.id}`}
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="flex items-center space-x-4 text-white">
                        <span className="flex items-center space-x-1">
                          <Heart className="h-5 w-5 fill-white" />
                          <span className="font-bold">{post.likesCount}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <MessageCircle className="h-5 w-5" />
                          <span className="font-bold">{post.commentsCount}</span>
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
              {isOwnProfile ? (
                <p className="text-muted-foreground">Share your first meal or creation!</p>
              ) : (
                <p className="text-muted-foreground">This user hasn't posted any photos.</p>
              )}
            </div>
          )}
        </TabsContent>

        {/* Bites Tab Content (Video Posts) */}
        <TabsContent value="bites" className="mt-6">
          {postsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : bitePosts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {bitePosts.map((post) => (
                <Card key={post.id} className="group cursor-pointer hover:shadow-lg transition-shadow">
                  <div className="relative overflow-hidden aspect-square bg-black">
                    <video src={post.imageUrl} className="w-full h-full object-cover" data-testid={`video-user-bite-${post.id}`} />
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
              <h3 className="text-lg font-semibold mb-2">No video bites yet</h3>
              {isOwnProfile ? (
                <p className="text-muted-foreground">Record a quick cooking tip or meal highlight!</p>
              ) : (
                <p className="text-muted-foreground">This user hasn't posted any video bites.</p>
              )}
            </div>
          )}
        </TabsContent>

        {/* Recipes Tab Content */}
        <TabsContent value="recipes" className="mt-6">
          {postsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-40 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recipePosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recipePosts.map((post) => (
                <Card key={post.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-4">
                    <img
                      src={post.imageUrl}
                      alt={post.caption || "Recipe image"}
                      className="w-20 h-20 object-cover rounded-md"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold line-clamp-1">{post.caption || "Untitled Recipe"}</h4>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          <ChefHat className="w-3 h-3 mr-1" /> Recipe
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {/* Placeholder for recipe details or first line of caption */}
                        A quick and easy dish ready in 30 minutes.
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {post.likesCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          4.5
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ChefHat className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No recipes published</h3>
              {isOwnProfile ? (
                <p className="text-muted-foreground">Turn your favorite meals into shareable recipes!</p>
              ) : (
                <p className="text-muted-foreground">This user has not shared any recipes.</p>
              )}
            </div>
          )}
        </TabsContent>

        {/* Drinks Tab Content */}
        <TabsContent value="drinks" className="mt-6">
          {drinksLoading || statsLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {statsData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground flex items-center">
                        <GlassWater className="w-4 h-4 mr-1" /> Total Drinks
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">{statsData.stats.totalDrinksMade}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground flex items-center">
                        <Award className="w-4 h-4 mr-1" /> Level
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">{statsData.stats.level}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground flex items-center">
                        <Zap className="w-4 h-4 mr-1" /> Points
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">{statsData.stats.totalPoints}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground flex items-center">
                        <Flame className="w-4 h-4 mr-1" /> Streak
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">{statsData.stats.currentStreak} days</CardContent>
                  </Card>
                </div>
              )}

              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Custom Drinks</h2>
              {drinksData.drinks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {drinksData.drinks.map((d: any) => (
                    <Card key={d.id} className="overflow-hidden">
                      <div className="aspect-video overflow-hidden">
                        <img src={d.imageUrl} alt={d.name} className="w-full h-full object-cover" />
                      </div>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold text-lg">{d.name}</h3>
                          <Badge variant="outline">{d.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{d.description}</p>
                        <div className="flex justify-between items-center mt-3 text-sm">
                          <span className="flex items-center gap-1 text-red-500">
                            <Heart className="w-4 h-4" /> {d.likesCount}
                          </span>
                          <span className="text-xs text-right">
                            {d.calories} kcal
                            <br />
                            {d.protein}g Protein
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <GlassWater className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold mb-2">No custom drinks</h3>
                  {isOwnProfile ? (
                    <p className="text-muted-foreground">Start creating your own recipes in the Drink Builder!</p>
                  ) : (
                    <p className="text-muted-foreground">This user has not published any custom drinks.</p>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Cookoffs Tab Content */}
        <TabsContent value="cookoffs" className="mt-6">
          {competitionsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : competitionsData.competitions.length > 0 ? (
            <div className="space-y-4">
              {competitionsData.competitions.map((comp: any) => (
                <Card key={comp.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full ${getCompetitionStatusStyles(comp.status)}`}>
                        <Trophy className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{comp.title}</h4>
                        <p className="text-sm text-muted-foreground">{comp.themeName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {comp.placement ? (
                        <p className="text-2xl font-bold text-yellow-600">{comp.placement}
                          <span className="text-sm font-normal">
                            {comp.placement === 1 ? "st" : comp.placement === 2 ? "nd" : comp.placement === 3 ? "rd" : "th"}
                          </span>
                        </p>
                      ) : (
                        <p className="text-lg font-semibold text-gray-500">{titleCase(comp.status)}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{comp.participants} participants</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No competition history</h3>
              <p className="text-muted-foreground">
                {isOwnProfile ? "Join a Cookoff today and start competing!" : "This user has not participated in any Cookoffs."}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Store Tab Content */}
        <TabsContent value="store" className="mt-6">
          {storeData?.store ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <StoreIcon className="w-6 h-6" /> {storeData.store.name}
                  </CardTitle>
                  <Badge className={storeData.store.published ? "bg-green-500 hover:bg-green-500" : "bg-red-500 hover:bg-red-500"}>
                    {storeData.store.published ? "Live" : "Hidden"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{storeData.store.bio}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-primary" />
                      <span>{storeProductsData?.count} Products Listed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span>{titleCase(storeData.store.subscription_tier)} Tier</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-primary" />
                      <a href={`/${storeData.store.handle}`} className="text-primary hover:underline">View Store Page</a>
                    </div>
                    {isOwnProfile && (
                      <Button variant="outline" size="sm" onClick={() => setLocation("/dashboard/store")}>
                        Manage Store
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Store Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
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

        {/* Saved Tab Content (Own Profile Only) */}
        {isOwnProfile && (
          <TabsContent value="saved" className="mt-6">
            {savedDrinksLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-40 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : savedDrinksData.drinks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Render saved items (recipes, drinks, posts) here */}
              </div>
            ) : (
              <div className="text-center py-12">
                <Bookmark className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold mb-2">No saved items yet</h3>
                <p className="text-muted-foreground">
                  Save recipes and drinks to find them quickly later.
                </p>
              </div>
            )}
          </TabsContent>
        )}

        {/* Messages Tab Content (Own Profile Only) */}
        {isOwnProfile && (
          <TabsContent value="messages" className="mt-6">
            <Card className="p-6 text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-blue-500" />
              <h3 className="text-xl font-semibold mb-2">Private Messages</h3>
              <p className="text-muted-foreground mb-4">
                Manage your direct messages with followers, friends, and collaborators.
              </p>
              <Button onClick={() => setLocation("/messages")}>
                Go to Inbox
              </Button>
            </Card>
          </TabsContent>
        )}

        {/* Analytics Tab Content (Own Profile Only) */}
        {isOwnProfile && (
          <TabsContent value="analytics" className="mt-6">
            <AnalyticsDashboard profileUserId={profileUserId!} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
