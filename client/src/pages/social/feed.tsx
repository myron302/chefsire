// client/src/pages/social/feed.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PostCard from "@/components/post-card";
import { BitesRow } from "@/components/BitesRow";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, Clock, X, MessageCircle, ChefHat, Utensils, Users, Trophy, Sparkles, BookOpen } from "lucide-react";
import CommentsSection from "./CommentsSection";
import { useQuery as useQueryClientLikes } from "@tanstack/react-query";
import type { PostWithUser, User, Recipe } from "@shared/schema";
import DailyQuests from "@/components/DailyQuests";
import AISuggestions from "@/components/AISuggestions";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useUser } from "@/contexts/UserContext";
import { Link } from "wouter";

// ─── Demo data — shown to guests when the DB has no real posts yet ───────────
// These make the site feel alive for new visitors before the community grows.
// Once real posts exist they are replaced automatically.

const DEMO_USER_BASE = {
  password: "",
  firstName: null,
  lastName: null,
  royalTitle: null,
  showFullName: false as const,
  bio: null,
  isPrivate: false as const,
  isChef: true as const,
  followersCount: 0,
  followingCount: 0,
  postsCount: 0,
  cateringEnabled: false as const,
  cateringLocation: null,
  cateringRadius: 25,
  cateringBio: null,
  cateringAvailable: true as const,
  subscriptionTier: "free",
  subscriptionStatus: "active",
  subscriptionEndsAt: null,
  monthlyRevenue: "0",
  nutritionPremium: false as const,
  nutritionTrialEndsAt: null,
  weddingTier: "free",
  weddingStatus: "inactive",
  weddingEndsAt: null,
  vendorTier: "free",
  vendorStatus: "inactive",
  vendorEndsAt: null,
  dailyCalorieGoal: null,
  macroGoals: null,
  dietaryRestrictions: [] as string[],
  googleId: null,
  facebookId: null,
  instagramId: null,
  tiktokId: null,
  provider: null,
  emailVerifiedAt: null,
  createdAt: new Date(),
};

const demoTrendingRecipes = [
  {
    id: "1",
    title: "Creamy Mushroom Risotto",
    cookTime: 35,
    post: {
      id: "post-1",
      imageUrl: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400&h=400&fit=crop&auto=format",
      user: { id: "chef-1", displayName: "Marco Romano" },
      likesCount: 245,
    },
  },
  {
    id: "2",
    title: "Classic Fish & Chips",
    cookTime: 25,
    post: {
      id: "post-2",
      imageUrl: "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=400&h=400&fit=crop&auto=format",
      user: { id: "chef-2", displayName: "Emma Watson" },
      likesCount: 189,
    },
  },
  {
    id: "3",
    title: "Spicy Thai Green Curry",
    cookTime: 30,
    post: {
      id: "post-3",
      imageUrl: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&h=400&fit=crop&auto=format",
      user: { id: "chef-3", displayName: "Anong Siriporn" },
      likesCount: 312,
    },
  },
  {
    id: "4",
    title: "Chocolate Lava Cake",
    cookTime: 20,
    post: {
      id: "post-4",
      imageUrl: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=400&fit=crop&auto=format",
      user: { id: "chef-4", displayName: "Pierre Dubois" },
      likesCount: 567,
    },
  },
  {
    id: "5",
    title: "Fresh Caesar Salad",
    cookTime: 15,
    post: {
      id: "post-5",
      imageUrl: "https://images.unsplash.com/photo-1551248429-40975aa4de74?w=400&h=400&fit=crop&auto=format",
      user: { id: "chef-5", displayName: "Julia Green" },
      likesCount: 134,
    },
  },
];

const demoSuggestedUsers = [
  { id: "chef-6", displayName: "Gordon Ramsay", specialty: "Fine Dining", avatar: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=100&h=100&fit=crop&auto=format" },
  { id: "chef-7", displayName: "Nadia Singh", specialty: "Indian Cuisine", avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&auto=format" },
  { id: "chef-8", displayName: "Carlos Rodriguez", specialty: "Mexican Street Food", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&auto=format" },
  { id: "chef-9", displayName: "Sakura Tanaka", specialty: "Japanese Fusion", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&auto=format" },
  { id: "chef-10", displayName: "Oliver Bennett", specialty: "Plant-Based", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&auto=format" },
];

const demoPosts: PostWithUser[] = [
  {
    id: "demo-post-1", caption: "Creamy Mushroom Risotto", imageUrl: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400&h=400&fit=crop&auto=format",
    isRecipe: true, likesCount: 245, commentsCount: 0, tags: [], userId: "chef-1", createdAt: new Date(),
    user: { ...DEMO_USER_BASE, id: "chef-1", username: "marco.romano", email: "marco@example.com", displayName: "Marco Romano", specialty: "Italian", avatar: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=100&h=100&fit=crop&auto=format" },
  },
  {
    id: "demo-post-2", caption: "Classic Fish & Chips", imageUrl: "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=400&h=400&fit=crop&auto=format",
    isRecipe: true, likesCount: 189, commentsCount: 0, tags: [], userId: "chef-2", createdAt: new Date(),
    user: { ...DEMO_USER_BASE, id: "chef-2", username: "emma.w", email: "emma@example.com", displayName: "Emma Watson", specialty: "British", avatar: "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=100&h=100&fit=crop&auto=format" },
  },
  {
    id: "demo-post-3", caption: "Spicy Thai Green Curry", imageUrl: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&h=400&fit=crop&auto=format",
    isRecipe: true, likesCount: 312, commentsCount: 0, tags: [], userId: "chef-3", createdAt: new Date(),
    user: { ...DEMO_USER_BASE, id: "chef-3", username: "anong", email: "anong@example.com", displayName: "Anong Siriporn", specialty: "Thai", avatar: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=100&h=100&fit=crop&auto=format" },
  },
  {
    id: "demo-post-4", caption: "Chocolate Lava Cake", imageUrl: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=400&fit=crop&auto=format",
    isRecipe: true, likesCount: 567, commentsCount: 0, tags: [], userId: "chef-4", createdAt: new Date(),
    user: { ...DEMO_USER_BASE, id: "chef-4", username: "pierre", email: "pierre@example.com", displayName: "Pierre Dubois", specialty: "Pastry", avatar: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=100&h=100&fit=crop&auto=format" },
  },
  {
    id: "demo-post-5", caption: "Fresh Caesar Salad", imageUrl: "https://images.unsplash.com/photo-1551248429-40975aa4de74?w=400&h=400&fit=crop&auto=format",
    isRecipe: true, likesCount: 134, commentsCount: 0, tags: [], userId: "chef-5", createdAt: new Date(),
    user: { ...DEMO_USER_BASE, id: "chef-5", username: "julia.green", email: "julia@example.com", displayName: "Julia Green", specialty: "Salads", avatar: "https://images.unsplash.com/photo-1551248429-40975aa4de74?w=100&h=100&fit=crop&auto=format" },
  },
];

// ─── Guest welcome banner ─────────────────────────────────────────────────────

function GuestBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-yellow-950/10 border border-orange-100 dark:border-orange-900/30 p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 bg-orange-100 dark:bg-orange-900/40 rounded-xl">
          <ChefHat className="w-6 h-6 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-0.5">
            Welcome to ChefSire
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Share recipes, join cook-off battles, discover drinks, and connect with chefs worldwide.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link href="/auth">
            <a>
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
                Join free
              </Button>
            </a>
          </Link>
          <Link href="/auth">
            <a>
              <Button size="sm" variant="outline">Sign in</Button>
            </a>
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {[
          { icon: <BookOpen className="w-3 h-3" />, label: "Recipes" },
          { icon: <Utensils className="w-3 h-3" />, label: "Drinks Hub" },
          { icon: <Trophy className="w-3 h-3" />, label: "Cook-Off Arena" },
          { icon: <Users className="w-3 h-3" />, label: "Chef Clubs" },
          { icon: <Sparkles className="w-3 h-3" />, label: "Quests & XP" },
        ].map((f) => (
          <span key={f.label} className="inline-flex items-center gap-1 text-xs bg-white/70 dark:bg-white/10 text-gray-700 dark:text-gray-300 border border-orange-100 dark:border-orange-900/40 rounded-full px-2.5 py-1">
            {f.icon}{f.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── SimpleRecipeCard ─────────────────────────────────────────────────────────

function SimpleRecipeCard({
  post,
  currentUserId,
  onCardClick,
}: {
  post: PostWithUser;
  currentUserId: string;
  onCardClick?: (post: PostWithUser) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="relative cursor-pointer" onClick={() => onCardClick?.(post)}>
        {post.imageUrl ? (
          <img src={post.imageUrl} alt={post.caption || "Recipe"} className="w-full h-64 object-cover" />
        ) : (
          <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
            <Heart className="w-8 h-8 text-gray-400" />
          </div>
        )}
      </div>
      <CardContent className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Link href={`/profile/${post.user?.id}`}>
            <a>
              <Avatar className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity">
                <AvatarImage src={post.user?.avatar || ""} alt={post.user?.displayName} />
                <AvatarFallback>{post.user?.displayName?.[0] || "U"}</AvatarFallback>
              </Avatar>
            </a>
          </Link>
          <div>
            <Link href={`/profile/${post.user?.id}`}>
              <a className="font-medium hover:underline cursor-pointer">{post.user?.displayName || "Unknown Chef"}</a>
            </Link>
            <p className="text-sm text-gray-500">Recipe</p>
          </div>
        </div>
        <h3 className="text-xl font-semibold mb-2">{post.caption || "Recipe"}</h3>
        {post.caption ? (
          <p className="text-gray-600 mb-4">{post.caption}</p>
        ) : (
          <p className="text-gray-500 mb-4">Delicious home-cooked recipe.</p>
        )}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Heart className="w-4 h-4" />
            <span>{post.likesCount ?? 0} likes</span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>Recipe</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export default function Feed() {
  const { user } = useUser();
  const currentUserId = user?.id || "";
  const isGuest = !currentUserId;
  const [selectedPost, setSelectedPost] = useState<PostWithUser | null>(null);

  const { data: selectedPostLikes = [] } = useQueryClientLikes<{ id: string; displayName: string; avatar?: string }[]>({
    queryKey: ["/api/posts", selectedPost?.id, "likes"],
    queryFn: async () => {
      if (!selectedPost?.id) return [];
      const response = await fetch(`/api/posts/${selectedPost.id}/likes`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch post likes");
      return response.json();
    },
    enabled: !!selectedPost?.id,
  });

  // Logged in:  personal feed (followed users + own posts)
  // Guest:      explore fallback (all public posts)
  const {
    data: posts,
    isLoading: postsLoading,
    error: postsError,
  } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/feed", currentUserId],
    queryFn: () =>
      fetchJSON<PostWithUser[]>(
        `/api/posts/feed?offset=0&limit=25${currentUserId ? `&userId=${encodeURIComponent(currentUserId)}` : ""}`
      ),
    retry: false,
  });

  const { data: suggestedUsers, error: usersError } = useQuery<User[]>({
    queryKey: ["/api/users", currentUserId, "suggested"],
    queryFn: () => fetchJSON<User[]>(`/api/users/${encodeURIComponent(currentUserId)}/suggested?limit=5`),
    enabled: !!currentUserId,
    retry: false,
  });

  const { data: trendingRecipes, error: recipesError } = useQuery<(Recipe & { post: PostWithUser })[]>({
    queryKey: ["/api/recipes/trending"],
    queryFn: async () => {
      const response = await fetchJSON<{ ok: boolean; recipes: (Recipe & { post: PostWithUser })[] }>("/api/recipes/trending?limit=5");
      return response.recipes;
    },
    retry: false,
  });

  // For guests: fall back to demo content when the DB has no real posts yet.
  // Once real posts exist they replace the demo automatically.
  const realPosts = posts ?? [];
  const usingDemoFeed = isGuest && (!!postsError || realPosts.length === 0);
  const displayPosts = usingDemoFeed ? demoPosts : realPosts;
  const displaySuggestedUsers = suggestedUsers ?? [];
  const displayTrendingRecipes: any[] = trendingRecipes ?? (isGuest ? demoTrendingRecipes : []);

  if (postsLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-8">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="w-full animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-muted rounded-full" />
                  <div className="space-y-2">
                    <div className="w-24 h-3 bg-muted rounded" />
                    <div className="w-16 h-2 bg-muted rounded" />
                  </div>
                </div>
                <div className="w-full h-96 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-7xl mx-auto">
      <div className="flex-1 max-w-4xl px-4 py-6">
        {/* Guests see welcome banner; logged-in users see bites row */}
        {isGuest ? <GuestBanner /> : <BitesRow />}

        {/* Posts */}
        <div className="space-y-8">
          {displayPosts.map((post) =>
            post.isRecipe ? (
              <SimpleRecipeCard key={post.id} post={post} currentUserId={currentUserId} onCardClick={setSelectedPost} />
            ) : (
              <PostCard key={post.id} post={post} currentUserId={currentUserId} onCardClick={setSelectedPost} />
            )
          )}
          {displayPosts.length === 0 && !postsLoading && (
            <p className="text-center text-muted-foreground py-8">
              {isGuest ? "Be the first to share a recipe!" : "No posts yet. Start following chefs!"}
            </p>
          )}
        </div>

        <div className="flex justify-center mt-8">
          <Button variant="outline" className="px-6 py-3" data-testid="button-load-more">
            Load More Posts
          </Button>
        </div>

        {/* Bottom CTA for guests who scrolled the feed */}
        {isGuest && (
          <div className="mt-10 rounded-2xl border border-orange-100 dark:border-orange-900/30 bg-orange-50 dark:bg-orange-950/20 p-6 text-center">
            <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Ready to join the kitchen?</p>
            <p className="text-sm text-muted-foreground mb-4">Sign up free to like, comment, save recipes, and more.</p>
            <Link href="/auth">
              <a>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white px-8">
                  Create your free account
                </Button>
              </a>
            </Link>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside className="hidden xl:block w-80 bg-card border-l border-border overflow-y-auto max-h-screen no-scrollbar">
        <div className="p-6 space-y-8">

          {isGuest && (
            <section className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 border border-orange-100 dark:border-orange-900/30 p-4 text-center">
              <ChefHat className="w-7 h-7 text-orange-500 mx-auto mb-2" />
              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1">Join ChefSire</p>
              <p className="text-xs text-muted-foreground mb-3">Free to join. Start sharing your recipes today.</p>
              <Link href="/auth">
                <a>
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white w-full">
                    Sign up free
                  </Button>
                </a>
              </Link>
            </section>
          )}

          {!isGuest && (
            <>
              <section>
                <ErrorBoundary><DailyQuests /></ErrorBoundary>
              </section>
              <section>
                <ErrorBoundary><AISuggestions /></ErrorBoundary>
              </section>
              <section className="mb-8">
                <h3 className="font-semibold mb-4">Suggested Chefs</h3>
                {usersError && (
                  <p className="mb-3 text-xs text-muted-foreground">Suggested chefs are unavailable right now.</p>
                )}
                <div className="space-y-3">
                  {displaySuggestedUsers.slice(0, 5).map((u) => (
                    <div key={u.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Link href={`/profile/${u.id}`}>
                          <a>
                            <Avatar className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity">
                              <AvatarImage src={u.avatar || ""} alt={u.displayName} />
                              <AvatarFallback>{u.displayName[0]}</AvatarFallback>
                            </Avatar>
                          </a>
                        </Link>
                        <div>
                          <Link href={`/profile/${u.id}`}>
                            <a>
                              <p className="text-sm font-medium cursor-pointer hover:underline" data-testid={`text-suggested-chef-${u.id}`}>
                                {u.displayName}
                              </p>
                            </a>
                          </Link>
                          <p className="text-xs text-muted-foreground">{(u as any).specialty || "Expert Chef"}</p>
                        </div>
                      </div>
                      <Button size="sm" className="bg-primary text-primary-foreground hover:opacity-90" data-testid={`button-follow-${u.id}`}>
                        Follow
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <section className="mb-8">
            <h3 className="font-semibold mb-4">{isGuest ? "Trending Recipes" : "Trending Recipes"}</h3>
            {recipesError && (
              <p className="mb-3 text-xs text-muted-foreground">Trending recipes are unavailable right now.</p>
            )}
            <div className="space-y-4">
              {displayTrendingRecipes.slice(0, 5).map((recipe) => (
                <div
                  key={recipe.id}
                  className="flex space-x-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                  data-testid={`trending-recipe-${recipe.id}`}
                >
                  <img src={recipe.post.imageUrl} alt={recipe.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{recipe.title}</p>
                    <p className="text-xs text-muted-foreground">
                      by{" "}
                      <Link href={`/profile/${recipe.post.user.id}`}>
                        <a className="hover:underline cursor-pointer">{recipe.post.user.displayName}</a>
                      </Link>
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-destructive">♥ {recipe.post.likesCount}</span>
                      <span className="text-xs text-muted-foreground">• {recipe.cookTime} min</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {isGuest && (
            <section className="mb-8">
              <h3 className="font-semibold mb-4">Featured Chefs</h3>
              <div className="space-y-3">
                {demoSuggestedUsers.slice(0, 5).map((u) => (
                  <div key={u.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={u.avatar} alt={u.displayName} />
                        <AvatarFallback>{u.displayName[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{u.displayName}</p>
                        <p className="text-xs text-muted-foreground">{u.specialty}</p>
                      </div>
                    </div>
                    <Link href="/auth">
                      <a><Button size="sm" variant="outline">Follow</Button></a>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="font-semibold mb-4">Popular Categories</h3>
            <div className="flex flex-wrap gap-2">
              {["Italian", "Healthy", "Desserts", "Quick", "Vegan"].map((category) => (
                <Badge key={category} variant="outline" className="cursor-pointer hover:bg-primary/20 transition-colors" data-testid={`category-${category.toLowerCase()}`}>
                  #{category}
                </Badge>
              ))}
            </div>
          </section>
        </div>
      </aside>

      {/* Expandable Post Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPost(null)}>
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
              <div className="md:w-2/3 bg-black flex items-center justify-center relative">
                <Button variant="ghost" size="sm" className="absolute top-4 right-4 text-white hover:bg-white/20" onClick={() => setSelectedPost(null)}>
                  <X className="h-6 w-6" />
                </Button>
                {selectedPost.imageUrl?.includes("video") || selectedPost.imageUrl?.includes(".mp4") ? (
                  <video src={selectedPost.imageUrl} controls className="w-full h-full object-contain" />
                ) : (
                  <img src={selectedPost.imageUrl} alt={selectedPost.caption || "Post"} className="w-full h-full object-contain" />
                )}
              </div>

              <div className="md:w-1/3 p-6 overflow-y-auto">
                <div className="flex items-center space-x-3 mb-4">
                  <Link href={`/profile/${selectedPost.user.id}`}>
                    <a>
                      <Avatar className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity">
                        <AvatarImage src={selectedPost.user.avatar || ""} alt={selectedPost.user.displayName} />
                        <AvatarFallback>{(selectedPost.user.displayName || "U")[0]}</AvatarFallback>
                      </Avatar>
                    </a>
                  </Link>
                  <div>
                    <Link href={`/profile/${selectedPost.user.id}`}>
                      <a className="font-semibold text-sm hover:underline cursor-pointer">{selectedPost.user.displayName}</a>
                    </Link>
                    {selectedPost.isRecipe && <Badge variant="secondary" className="mt-1">Recipe</Badge>}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm">{selectedPost.caption}</p>
                </div>

                {selectedPost.tags && selectedPost.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {selectedPost.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs text-secondary bg-secondary/10 border-secondary/20">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex flex-col space-y-2 text-sm text-muted-foreground border-t pt-4">
                  <div className="flex items-center space-x-1">
                    <Heart className="h-4 w-4" />
                    <span>{selectedPost.likesCount || 0} likes</span>
                  </div>
                  {selectedPostLikes.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Liked by{" "}
                      {selectedPostLikes.slice(0, 2).map((u, index) => (
                        <span key={u.id}>
                          {index > 0 && ", "}
                          <Link href={`/profile/${u.id}`}>
                            <a className="hover:underline cursor-pointer">{u.displayName}</a>
                          </Link>
                        </span>
                      ))}
                      {selectedPostLikes.length > 2 && ` and ${selectedPostLikes.length - 2} others`}
                    </span>
                  )}
                  <div className="flex items-center space-x-1">
                    <MessageCircle className="h-4 w-4" />
                    <span>{selectedPost.commentsCount || 0} comments</span>
                  </div>
                </div>

                <CommentsSection postId={selectedPost.id} currentUserId={currentUserId} />

                {currentUserId === selectedPost.user?.id && (
                  <div className="mt-6 pt-4 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={async () => {
                        if (!confirm("Delete this post? This action cannot be undone.")) return;
                        try {
                          const res = await fetch(`/api/posts/${selectedPost.id}`, { method: "DELETE", credentials: "include" });
                          const responseText = await res.text();
                          if (!res.ok) {
                            let errorMsg = `HTTP Status: ${res.status}\n\nResponse Body:\n${responseText}`;
                            try {
                              const err = JSON.parse(responseText);
                              errorMsg = `HTTP Status: ${res.status}\n\nError: ${err.message || err.error || "Unknown"}`;
                            } catch (_) {}
                            alert(`❌ DELETE FAILED\n\n${errorMsg}`);
                            return;
                          }
                          setSelectedPost(null);
                          window.location.reload();
                        } catch (error) {
                          const errorMsg = error instanceof Error ? error.message : String(error);
                          alert(`❌ DELETE EXCEPTION\n\nError: ${errorMsg}`);
                        }
                      }}
                    >
                      Delete Post
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
