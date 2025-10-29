// client/src/pages/profile.tsx
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import PostCard from "@/components/post-card";
import { useUser } from "@/contexts/UserContext";
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
  Store,
  ShoppingBag,
  Eye,
} from "lucide-react";
import type { User, PostWithUser } from "@shared/schema";

/** Store type for the Store tab */
type StoreT = {
  id: string;
  userId: string;
  handle: string;
  name: string;
  bio: string;
  logo: string | null;
  theme: string;
  is_published: boolean;
  subscription_tier: "free" | "pro" | "enterprise";
  product_limit: number;
  current_products: number;
  trial_ends_at?: string;
  layout: unknown | null;
  published: boolean;
  updatedAt?: string;
};

/** Map royalTitle -> nice label + emoji for header */
const TITLE_META: Record<
  string,
  { label: string; emoji: string }
> = {
  king: { label: "King", emoji: "👑" },
  queen: { label: "Queen", emoji: "👑" },
  prince: { label: "Prince", emoji: "🤴" },
  princess: { label: "Princess", emoji: "👸" },
  sire: { label: "Sire", emoji: "⚔️" },
  "your-majesty": { label: "Your Majesty", emoji: "🏰" },
  "your-highness": { label: "Your Highness", emoji: "💎" },
  duke: { label: "Duke", emoji: "🎩" },
  duchess: { label: "Duchess", emoji: "💍" },
  lord: { label: "Lord", emoji: "⚜️" },
  lady: { label: "Lady", emoji: "🌹" },
  knight: { label: "Sir Knight", emoji: "🛡️" },
  dame: { label: "Dame", emoji: "🌟" },
  "royal-chef": { label: "Royal Chef", emoji: "🍳" },
  "court-master": { label: "Court Master", emoji: "🎭" },
  "noble-chef": { label: "Noble Chef", emoji: "🌟" },
  "imperial-chef": { label: "Imperial Chef", emoji: "👨‍🍳" },
  "majestic-chef": { label: "Majestic Chef", emoji: "✨" },
  chef: { label: "Chef", emoji: "👨‍🍳" },
};

export default function Profile() {
  const { userId } = useParams<{ userId?: string }>();
  const [, setLocation] = useLocation();
  const { user: currentUser } = useUser();
  const profileUserId = userId || currentUser?.id;

  // Use current user data if viewing own profile, otherwise fetch from API
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/users", profileUserId],
    queryFn: async () => {
      if (profileUserId === currentUser?.id && currentUser) {
        return currentUser;
      }
      const response = await fetch(`/api/users/${profileUserId}`);
      if (!response.ok) {
        if (profileUserId === currentUser?.id && currentUser) {
          return currentUser;
        }
        throw new Error("User not found");
      }
      return response.json();
    },
    enabled: !!profileUserId,
  });

  // Mock posts
  const { data: posts, isLoading: postsLoading } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/user", profileUserId],
    queryFn: async () => {
      const list: PostWithUser[] = [
        {
          id: "1",
          userId: profileUserId!,
          caption: "Delicious homemade pasta!",
          imageUrl: "https://images.unsplash.com/photo-1551183053-bf91a1d81141",
          likesCount: 24,
          commentsCount: 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isRecipe: false,
          user: user || currentUser!,
        },
        {
          id: "2",
          userId: profileUserId!,
          caption: "My signature smoothie recipe",
          imageUrl:
            "https://images.unsplash.com/photo-1570197788417-0e82375c9371",
          likesCount: 42,
          commentsCount: 8,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isRecipe: true,
          user: user || currentUser!,
        },
      ];
      return list;
    },
    enabled: !!profileUserId && !!user,
  });

  // Mock custom drinks
  const { data: drinksData } = useQuery({
    queryKey: ["/api/custom-drinks/user", profileUserId],
    queryFn: async () => {
      return {
        drinks: [
          {
            id: "1",
            name: "Tropical Sunrise",
            category: "Smoothie",
            description:
              "Refreshing tropical smoothie with mango and pineapple",
            calories: 180,
            protein: 3,
            fiber: 5,
            likesCount: 15,
            savesCount: 8,
            imageUrl:
              "https://images.unsplash.com/photo-1570197788417-0e82375c9371",
          },
          {
            id: "2",
            name: "Protein Power Shake",
            category: "Protein Shake",
            description:
              "High protein shake for post-workout recovery",
            calories: 220,
            protein: 25,
            fiber: 2,
            likesCount: 23,
            savesCount: 12,
            imageUrl:
              "https://images.unsplash.com/photo-1592924357228-91a4daadcfea",
          },
        ],
      };
    },
    enabled: !!profileUserId,
  });

  // Mock drink stats
  const { data: statsData } = useQuery({
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

  // Mock saved drinks
  const { data: savedDrinksData } = useQuery({
    queryKey: ["/api/custom-drinks/saved", profileUserId],
    queryFn: async () => {
      return { drinks: [] as any[] };
    },
    enabled: !!profileUserId,
  });

  // Mock competitions
  const { data: competitionsData } = useQuery({
    queryKey: ["/api/competitions/user", profileUserId],
    queryFn: async () => {
      return {
        competitions: [
          {
            id: "1",
            title: "Midnight Pasta Showdown",
            themeName: "Italian Night",
            status: "completed",
            placement: 1,
            participants: 6,
            createdAt: new Date(
              Date.now() - 2 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          {
            id: "2",
            title: "Taco Fiesta Challenge",
            themeName: "Taco Tuesday",
            status: "judging",
            placement: 2,
            participants: 8,
            createdAt: new Date(
              Date.now() - 1 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          {
            id: "3",
            title: "Quick 30-Min Sprint",
            themeName: "Quick 30-Min",
            status: "live",
            participants: 5,
            createdAt: new Date(
              Date.now() - 2 * 60 * 60 * 1000
            ).toISOString(),
          },
        ],
      };
    },
    enabled: !!profileUserId,
  });

  // Mock store
  const { data: storeData } = useQuery<{ store: StoreT | null }>({
    queryKey: ["/api/stores/by-user", profileUserId],
    queryFn: async () => {
      return {
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
      };
    },
    enabled: !!profileUserId,
  });

  const { data: storeProductsData } = useQuery({
    queryKey: ["/api/stores/products/count", profileUserId],
    queryFn: async () => {
      return { count: 3 };
    },
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

  // Use current user data as fallback if API fails but we're viewing own profile
  const displayUser = user || (isOwnProfile ? currentUser : null);

  if (!displayUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 text-center">
        <h1 className="text-2xl font-bold mb-4">User not found</h1>
        <p className="text-muted-foreground">
          The profile you're looking for doesn't exist.
        </p>
      </div>
    );
  }

  const userPosts = posts?.filter((post) => !post.isRecipe) || [];
  const userRecipes = posts?.filter((post) => post.isRecipe) || [];
  const customDrinks = drinksData?.drinks || [];
  const savedDrinks = savedDrinksData?.drinks || [];
  const drinkStats = statsData?.stats;
  const userCompetitions = competitionsData?.competitions || [];
  const storeProductsCount = storeProductsData?.count || 0;

  const titleMeta = displayUser.royalTitle
    ? TITLE_META[String(displayUser.royalTitle)]
    : undefined;

  // What to show as the big name line:
  // Prefer full name if allowed, else displayName, else username (no @).
  const nameLine =
    (displayUser.showFullName &&
      displayUser.firstName &&
      displayUser.lastName &&
      `${displayUser.firstName} ${displayUser.lastName}`) ||
    displayUser.displayName ||
    displayUser.username;

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
          <AvatarImage
            src={displayUser.avatar || ""}
            alt={displayUser.displayName || displayUser.username}
          />
          <AvatarFallback className="text-2xl">
            {displayUser.displayName?.[0] ||
              displayUser.username?.[0] ||
              "U"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              {/* === Single name line with optional royal title; NO @username line === */}
              <h1
                className="text-2xl font-bold flex items-center gap-2"
                data-testid={`text-profile-name-${displayUser.id}`}
              >
                {titleMeta && (
                  <span
                    title={titleMeta.label}
                    aria-label={titleMeta.label}
                    className="text-xl"
                  >
                    {titleMeta.emoji}
                  </span>
                )}
                {titleMeta && (
                  <span className="font-semibold">{titleMeta.label}</span>
                )}
                <span>{nameLine}</span>
              </h1>

              {/* Optional subline for specialty / anything else — NOT @username */}
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
              <Button className="bg-primary text-primary-foreground">
                Follow
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 mb-4 text-sm">
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
            <p
              className="text-sm mb-4"
              data-testid={`text-bio-${displayUser.id}`}
            >
              {displayUser.bio}
            </p>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-2">
            {displayUser.isChef && (
              <Badge
                variant="secondary"
                className="bg-accent text-accent-foreground"
              >
                <ChefHat className="w-3 h-3 mr-1" />
                Chef
              </Badge>
            )}
            {drinkStats && drinkStats.level > 1 && (
              <Badge
                variant="secondary"
                className="bg-purple-100 text-purple-800"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Level {drinkStats.level} • {drinkStats.totalPoints} XP
              </Badge>
            )}
            {storeData?.store && (
              <Badge
                variant="secondary"
                className="bg-orange-100 text-orange-800"
              >
                <Store className="w-3 h-3 mr-1" />
                Shop Owner
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="posts" className="flex items-center space-x-2">
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline">Posts</span>
          </TabsTrigger>
          <TabsTrigger value="recipes" className="flex items-center space-x-2">
            <ChefHat className="h-4 w-4" />
            <span className="hidden sm:inline">Recipes</span>
          </TabsTrigger>
          <TabsTrigger value="drinks" className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Drinks</span>
          </TabsTrigger>
          <TabsTrigger value="cookoffs" className="flex items-center space-x-2">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Cookoffs</span>
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center space-x-2">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Saved</span>
          </TabsTrigger>
          <TabsTrigger value="store" className="flex items-center space-x-2">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Store</span>
          </TabsTrigger>
        </TabsList>

        {/* POSTS */}
        <TabsContent value="posts" className="mt-6">
          {postsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-muted rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : userPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userPosts.map((post) => (
                <Card
                  key={post.id}
                  className="group cursor-pointer hover:shadow-lg transition-shadow"
                >
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
                {isOwnProfile
                  ? "Start sharing your culinary creations!"
                  : "No posts to show."}
              </p>
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
                    <h3 className="text-xl font-semibold mb-2">
                      {post.caption || "Recipe"}
                    </h3>
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
                {isOwnProfile
                  ? "Share your favorite recipes with the community!"
                  : "No recipes to show."}
              </p>
            </div>
          )}
        </TabsContent>

        {/* DRINKS */}
        <TabsContent value="drinks" className="mt-6">
          {customDrinks.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customDrinks.map((d: any) => (
                <Card key={d.id} className="overflow-hidden">
                  <div className="relative">
                    {d.imageUrl ? (
                      <img
                        src={d.imageUrl}
                        alt={d.name}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                        <GlassWater className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{d.name}</h3>
                      <Badge variant="secondary">{d.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {d.description}
                    </p>
                    <div className="flex gap-4 text-xs mt-3 text-muted-foreground">
                      <span>Calories: {d.calories}</span>
                      {"protein" in d && <span>Protein: {d.protein}g</span>}
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
                {isOwnProfile
                  ? "Create a custom drink and it will appear here."
                  : "No drinks to show."}
              </p>
            </div>
          )}
        </TabsContent>

        {/* COOKOFFS */}
        <TabsContent value="cookoffs" className="mt-6">
          {userCompetitions.length ? (
            <div className="space-y-4">
              {userCompetitions.map((c: any) => (
                <Card key={c.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{c.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Theme: {c.themeName}
                      </div>
                    </div>
                    <Badge className={getStatusBadge(c.status)}>
                      {c.status}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No cookoffs yet</h3>
              <p className="text-muted-foreground">
                {isOwnProfile
                  ? "Join a Weekly Cooking Competition to earn badges."
                  : "No cookoffs to show."}
              </p>
            </div>
          )}
        </TabsContent>

        {/* SAVED */}
        <TabsContent value="saved" className="mt-6">
          {savedDrinks.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedDrinks.map((d: any) => (
                <Card key={d.id} className="overflow-hidden">
                  <div className="relative">
                    {d.imageUrl ? (
                      <img
                        src={d.imageUrl}
                        alt={d.name}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                        <Star className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{d.name}</h3>
                      <Badge variant="secondary">{d.category}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Star className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No saved items</h3>
              <p className="text-muted-foreground">
                {isOwnProfile
                  ? "Save drinks or recipes to see them here."
                  : "No saved items to show."}
              </p>
            </div>
          )}
        </TabsContent>

        {/* STORE */}
        <TabsContent value="store" className="mt-6">
          {storeData?.store ? (
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage
                    src={storeData.store.logo || ""}
                    alt={storeData.store.name}
                  />
                  <AvatarFallback>
                    {storeData.store.name?.[0] || "S"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="text-lg font-semibold">
                    {storeData.store.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {storeData.store.bio}
                  </div>
                </div>
                <Button
                  variant="default"
                  onClick={() =>
                    (window.location.href = `/store/${storeData.store.handle}`)
                  }
                >
                  Visit Store
                </Button>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                Products: {storeProductsCount}
              </div>
            </Card>
          ) : (
            <div className="text-center py-12">
              <Store className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No store yet</h3>
              <p className="text-muted-foreground">
                {isOwnProfile
                  ? "Open your storefront from the vendor dashboard."
                  : "This user hasn’t opened a store yet."}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
