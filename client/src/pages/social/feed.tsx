// client/src/pages/feed.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PostCard from "@/components/post-card";
import { BitesRow } from "@/components/BitesRow";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, Clock, X, MessageCircle } from "lucide-react";
import CommentsSection from "@/components/CommentsSection";
import { useQuery as useQueryClientLikes } from "@tanstack/react-query";
import type { PostWithUser, User, Recipe } from "@shared/schema";
import DailyQuests from "@/components/DailyQuests";
import AISuggestions from "@/components/AISuggestions";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useUser } from "@/contexts/UserContext";

const demoTrendingRecipes = [
  {
    id: "1",
    title: "Creamy Mushroom Risotto",
    cookTime: 35,
    post: {
      id: "post-1",
      imageUrl:
        "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400&h=400&fit=crop&auto=format",
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
      imageUrl:
        "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=400&h=400&fit=crop&auto=format",
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
      imageUrl:
        "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&h=400&fit=crop&auto=format",
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
      imageUrl:
        "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=400&fit=crop&auto=format",
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
      imageUrl:
        "https://images.unsplash.com/photo-1551248429-40975aa4de74?w=400&h=400&fit=crop&auto=format",
      user: { id: "chef-5", displayName: "Julia Green" },
      likesCount: 134,
    },
  },
];

const demoSuggestedUsers = [
  {
    id: "chef-6",
    displayName: "Gordon Ramsay",
    specialty: "Fine Dining",
    avatar:
      "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=100&h=100&fit=crop&auto=format",
  },
  {
    id: "chef-7",
    displayName: "Nadia Singh",
    specialty: "Indian Cuisine",
    avatar:
      "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&auto=format",
  },
  {
    id: "chef-8",
    displayName: "Carlos Rodriguez",
    specialty: "Mexican Street Food",
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&auto=format",
  },
  {
    id: "chef-9",
    displayName: "Sakura Tanaka",
    specialty: "Japanese Fusion",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&auto=format",
  },
  {
    id: "chef-10",
    displayName: "Oliver Bennett",
    specialty: "Plant-Based",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&auto=format",
  },
];

// Demo posts fallback (5)
const demoPosts: PostWithUser[] = [
  {
    id: "demo-post-1",
    caption: "Creamy Mushroom Risotto",
    imageUrl:
      "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400&h=400&fit=crop&auto=format",
    isRecipe: true,
    likesCount: 245,
    commentsCount: 0,
    tags: [],
    userId: "chef-1",
    createdAt: new Date(),
    user: {
      id: "chef-1",
      username: "marco.romano",
      email: "marco@example.com",
      password: "",
      displayName: "Marco Romano",
      firstName: null,
      lastName: null,
      royalTitle: null,
      showFullName: false,
      bio: null,
      avatar:
        "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=100&h=100&fit=crop&auto=format",
      specialty: "Italian",
      isChef: true,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      cateringEnabled: false,
      cateringLocation: null,
      cateringRadius: 25,
      cateringBio: null,
      cateringAvailable: true,
      subscriptionTier: "free",
      subscriptionStatus: "active",
      subscriptionEndsAt: null,
      monthlyRevenue: "0",
      nutritionPremium: false,
      nutritionTrialEndsAt: null,
      dailyCalorieGoal: null,
      macroGoals: null,
      dietaryRestrictions: [],
      emailVerifiedAt: null,
      createdAt: new Date(),
    },
  },
  {
    id: "demo-post-2",
    caption: "Classic Fish & Chips",
    imageUrl:
      "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=400&h=400&fit=crop&auto=format",
    isRecipe: true,
    likesCount: 189,
    commentsCount: 0,
    tags: [],
    userId: "chef-2",
    createdAt: new Date(),
    user: {
      id: "chef-2",
      username: "emma.w",
      email: "emma@example.com",
      password: "",
      displayName: "Emma Watson",
      firstName: null,
      lastName: null,
      royalTitle: null,
      showFullName: false,
      bio: null,
      avatar:
        "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=100&h=100&fit=crop&auto=format",
      specialty: "British",
      isChef: true,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      cateringEnabled: false,
      cateringLocation: null,
      cateringRadius: 25,
      cateringBio: null,
      cateringAvailable: true,
      subscriptionTier: "free",
      subscriptionStatus: "active",
      subscriptionEndsAt: null,
      monthlyRevenue: "0",
      nutritionPremium: false,
      nutritionTrialEndsAt: null,
      dailyCalorieGoal: null,
      macroGoals: null,
      dietaryRestrictions: [],
      emailVerifiedAt: null,
      createdAt: new Date(),
    },
  },
  {
    id: "demo-post-3",
    caption: "Spicy Thai Green Curry",
    imageUrl:
      "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&h=400&fit=crop&auto=format",
    isRecipe: true,
    likesCount: 312,
    commentsCount: 0,
    tags: [],
    userId: "chef-3",
    createdAt: new Date(),
    user: {
      id: "chef-3",
      username: "anong",
      email: "anong@example.com",
      password: "",
      displayName: "Anong Siriporn",
      firstName: null,
      lastName: null,
      royalTitle: null,
      showFullName: false,
      bio: null,
      avatar:
        "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=100&h=100&fit=crop&auto=format",
      specialty: "Thai",
      isChef: true,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      cateringEnabled: false,
      cateringLocation: null,
      cateringRadius: 25,
      cateringBio: null,
      cateringAvailable: true,
      subscriptionTier: "free",
      subscriptionStatus: "active",
      subscriptionEndsAt: null,
      monthlyRevenue: "0",
      nutritionPremium: false,
      nutritionTrialEndsAt: null,
      dailyCalorieGoal: null,
      macroGoals: null,
      dietaryRestrictions: [],
      emailVerifiedAt: null,
      createdAt: new Date(),
    },
  },
  {
    id: "demo-post-4",
    caption: "Chocolate Lava Cake",
    imageUrl:
      "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=400&fit=crop&auto=format",
    isRecipe: true,
    likesCount: 567,
    commentsCount: 0,
    tags: [],
    userId: "chef-4",
    createdAt: new Date(),
    user: {
      id: "chef-4",
      username: "pierre",
      email: "pierre@example.com",
      password: "",
      displayName: "Pierre Dubois",
      firstName: null,
      lastName: null,
      royalTitle: null,
      showFullName: false,
      bio: null,
      avatar:
        "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=100&h=100&fit=crop&auto=format",
      specialty: "Pastry",
      isChef: true,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      cateringEnabled: false,
      cateringLocation: null,
      cateringRadius: 25,
      cateringBio: null,
      cateringAvailable: true,
      subscriptionTier: "free",
      subscriptionStatus: "active",
      subscriptionEndsAt: null,
      monthlyRevenue: "0",
      nutritionPremium: false,
      nutritionTrialEndsAt: null,
      dailyCalorieGoal: null,
      macroGoals: null,
      dietaryRestrictions: [],
      emailVerifiedAt: null,
      createdAt: new Date(),
    },
  },
  {
    id: "demo-post-5",
    caption: "Fresh Caesar Salad",
    imageUrl:
      "https://images.unsplash.com/photo-1551248429-40975aa4de74?w=400&h=400&fit=crop&auto=format",
    isRecipe: true,
    likesCount: 134,
    commentsCount: 0,
    tags: [],
    userId: "chef-5",
    createdAt: new Date(),
    user: {
      id: "chef-5",
      username: "julia.green",
      email: "julia@example.com",
      password: "",
      displayName: "Julia Green",
      firstName: null,
      lastName: null,
      royalTitle: null,
      showFullName: false,
      bio: null,
      avatar:
        "https://images.unsplash.com/photo-1551248429-40975aa4de74?w=100&h=100&fit=crop&auto=format",
      specialty: "Salads",
      isChef: true,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      cateringEnabled: false,
      cateringLocation: null,
      cateringRadius: 25,
      cateringBio: null,
      cateringAvailable: true,
      subscriptionTier: "free",
      subscriptionStatus: "active",
      subscriptionEndsAt: null,
      monthlyRevenue: "0",
      nutritionPremium: false,
      nutritionTrialEndsAt: null,
      dailyCalorieGoal: null,
      macroGoals: null,
      dietaryRestrictions: [],
      emailVerifiedAt: null,
      createdAt: new Date(),
    },
  },
];

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
      <div
        className="relative cursor-pointer"
        onClick={() => onCardClick?.(post)}
      >
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
        <div className="flex items-center space-x-3 mb-4">
          <Avatar className="w-10 h-10">
            <AvatarImage
              src={post.user?.avatar || ""}
              alt={post.user?.displayName}
            />
            <AvatarFallback>
              {post.user?.displayName?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{post.user?.displayName || "Unknown Chef"}</p>
            <p className="text-sm text-gray-500">Recipe</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-2">
          {post.caption || "Recipe"}
        </h3>

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

// Helper to validate dates and prevent crashes
function isValidDate(dateStr: string | undefined | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100;
}

export default function Feed() {
  const { user } = useUser();
  const currentUserId = user?.id || "";
  const [selectedPost, setSelectedPost] = useState<PostWithUser | null>(null);

  // Fetch list of users who liked the currently selected post (for modal)
  const { data: selectedPostLikes = [] } = useQueryClientLikes<{ id: string; displayName: string; avatar?: string }[]>({
    queryKey: ["/api/posts", selectedPost?.id, "likes"],
    queryFn: async () => {
      if (!selectedPost?.id) return [];
      const response = await fetch(`/api/posts/${selectedPost.id}/likes`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch post likes");
      return response.json();
    },
    enabled: !!selectedPost?.id,
  });

  // Posts feed - fetch explore posts (all posts) so user sees their own posts too
  const {
    data: posts,
    isLoading: postsLoading,
    error: postsError,
  } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/explore"],
    queryFn: () => fetchJSON<PostWithUser[]>("/api/posts/explore"),
    retry: false,
  });

  // Suggested users (sidebar) — falls back to demo if error
  const {
    data: suggestedUsers,
    error: usersError,
  } = useQuery<User[]>({
    queryKey: ["/api/users", currentUserId, "suggested"],
    queryFn: () => fetchJSON<User[]>("/api/users/suggested?limit=5"),
    retry: false,
  });

  // Trending recipes (sidebar) — falls back to demo if error
  const {
    data: trendingRecipes,
    error: recipesError,
  } = useQuery<(Recipe & { post: PostWithUser })[]>({
    queryKey: ["/api/recipes/trending"],
    queryFn: async () => {
      const response = await fetchJSON<{ ok: boolean; recipes: (Recipe & { post: PostWithUser })[] }>("/api/recipes/trending?limit=5");
      return response.recipes;
    },
    retry: false,
  });

  // Use real data only, no demo fallback
  const displayPosts = posts ?? [];
  const displaySuggestedUsers = suggestedUsers ?? [];
  const displayTrendingRecipes = trendingRecipes ?? [];

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
        <BitesRow />

        {/* Posts */}
        <div className="space-y-8">
          {/* Removed the visible error banner; we silently fall back */}
          {displayPosts.map((post) =>
            post.isRecipe ? (
              <SimpleRecipeCard key={post.id} post={post} currentUserId={currentUserId} onCardClick={setSelectedPost} />
            ) : (
              <PostCard key={post.id} post={post} currentUserId={currentUserId} onCardClick={setSelectedPost} />
            )
          )}

          {displayPosts.length === 0 && !postsLoading && !postsError && (
            <p className="text-center text-muted-foreground py-8">No posts yet. Start following chefs!</p>
          )}
        </div>

        <div className="flex justify-center mt-8">
          <Button variant="outline" className="px-6 py-3" data-testid="button-load-more">
            Load More Posts
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="hidden xl:block w-80 bg-card border-l border-border overflow-y-auto max-h-screen no-scrollbar">
        <div className="p-6 space-y-8">
          {/* Phase 1: Daily Addiction Features */}
          <section>
            <ErrorBoundary>
              <DailyQuests />
            </ErrorBoundary>
          </section>

          <section>
            <ErrorBoundary>
              <AISuggestions />
            </ErrorBoundary>
          </section>

          <section className="mb-8">
            <h3 className="font-semibold mb-4">Suggested Chefs</h3>
            <div className="space-y-3">
              {displaySuggestedUsers.slice(0, 5).map((user) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user.avatar || ""} alt={user.displayName} />
                      <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium" data-testid={`text-suggested-chef-${user.id}`}>
                        {user.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(user as any).specialty || "Expert Chef"}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground hover:opacity-90"
                    data-testid={`button-follow-${user.id}`}
                  >
                    Follow
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h3 className="font-semibold mb-4">Trending Recipes</h3>
            <div className="space-y-4">
              {displayTrendingRecipes.slice(0, 5).map((recipe) => (
                <div
                  key={recipe.id}
                  className="flex space-x-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                  data-testid={`trending-recipe-${recipe.id}`}
                >
                  <img
                    src={recipe.post.imageUrl}
                    alt={recipe.title}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{recipe.title}</p>
                    <p className="text-xs text-muted-foreground">by {recipe.post.user.displayName}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-destructive">♥ {recipe.post.likesCount}</span>
                      <span className="text-xs text-muted-foreground">• {recipe.cookTime} min</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-4">Popular Categories</h3>
            <div className="flex flex-wrap gap-2">
              {["Italian", "Healthy", "Desserts", "Quick", "Vegan"].map((category) => (
                <Badge
                  key={category}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/20 transition-colors"
                  data-testid={`category-${category.toLowerCase()}`}
                >
                  #{category}
                </Badge>
              ))}
            </div>
          </section>
        </div>
      </aside>

      {/* Expandable Post Modal */}
      {selectedPost && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPost(null)}
        >
          <div
            className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
              {/* Image section - 2/3 width */}
              <div className="md:w-2/3 bg-black flex items-center justify-center relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-4 right-4 text-white hover:bg-white/20"
                  onClick={() => setSelectedPost(null)}
                >
                  <X className="h-6 w-6" />
                </Button>
                {selectedPost.imageUrl?.includes("video") ||
                selectedPost.imageUrl?.includes(".mp4") ? (
                  <video
                    src={selectedPost.imageUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={selectedPost.imageUrl}
                    alt={selectedPost.caption || "Post"}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              {/* Details section - 1/3 width */}
              <div className="md:w-1/3 p-6 overflow-y-auto">
                {/* User info */}
                <div className="flex items-center space-x-3 mb-4">
                  <Avatar className="w-10 h-10">
                    <AvatarImage
                      src={selectedPost.user.avatar || ""}
                      alt={selectedPost.user.displayName}
                    />
                    <AvatarFallback>
                      {(selectedPost.user.displayName || "U")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-sm">
                      {selectedPost.user.displayName}
                    </h3>
                    {selectedPost.isRecipe && (
                      <Badge variant="secondary" className="mt-1">
                        Recipe
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Caption */}
                <div className="mb-4">
                  <p className="text-sm">{selectedPost.caption}</p>
                </div>

                {/* Tags */}
                {selectedPost.tags && selectedPost.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {selectedPost.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="text-xs text-secondary bg-secondary/10 border-secondary/20"
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Engagement stats */}
                <div className="flex flex-col space-y-2 text-sm text-muted-foreground border-t pt-4">
                  <div className="flex items-center space-x-1">
                    <Heart className="h-4 w-4" />
                    <span>{selectedPost.likesCount || 0} likes</span>
                  </div>
                  {selectedPostLikes.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Liked by {selectedPostLikes.slice(0, 2).map((u) => u.displayName).join(", ")}
                      {selectedPostLikes.length > 2 && ` and ${selectedPostLikes.length - 2} others`}
                    </span>
                  )}
                  <div className="flex items-center space-x-1">
                    <MessageCircle className="h-4 w-4" />
                    <span>{selectedPost.commentsCount || 0} comments</span>
                  </div>
                </div>

                {/* Comments section */}
                <CommentsSection postId={selectedPost.id} currentUserId={currentUserId} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
