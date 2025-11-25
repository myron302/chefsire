// client/src/pages/feed.tsx
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PostCard from "@/components/post-card";
import { BitesRow } from "@/components/BitesRow";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, Clock } from "lucide-react";
import type { PostWithUser, User, Recipe } from "@shared/schema";
import DailyQuests from "@/components/DailyQuests";
import AISuggestions from "@/components/AISuggestions";
import ErrorBoundary, { SectionErrorBoundary } from "@/components/ErrorBoundary";

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

// Demo posts fallback (add more as needed)
const demoPosts: PostWithUser[] = [
  {
    id: "demo-post-1",
    caption: "Just made this amazing pasta! 🍝",
    imageUrl:
      "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=400&h=400&fit=crop&auto=format",
    isRecipe: false,
    likesCount: 42,
    commentsCount: 0,
    tags: [],
    userId: "user-2",
    createdAt: new Date(),
    user: {
      id: "user-2",
      username: "alice_chef",
      email: "alice@example.com",
      password: "",
      displayName: "Alice Chef",
      firstName: null,
      lastName: null,
      royalTitle: null,
      showFullName: false,
      bio: null,
      avatar:
        "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&auto=format",
      specialty: null,
      isChef: false,
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
    caption: "Fresh salad for lunch 🌿",
    imageUrl:
      "https://images.unsplash.com/photo-1512568400610-3f3f73e78e14?w=400&h=400&fit=crop&auto=format",
    isRecipe: true,
    likesCount: 28,
    commentsCount: 0,
    tags: [],
    userId: "user-3",
    createdAt: new Date(),
    user: {
      id: "user-3",
      username: "bob_baker",
      email: "bob@example.com",
      password: "",
      displayName: "Bob Baker",
      firstName: null,
      lastName: null,
      royalTitle: null,
      showFullName: false,
      bio: null,
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&auto=format",
      specialty: null,
      isChef: false,
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
    caption: "Baking cookies tonight! 🍪",
    imageUrl:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&auto=format",
    isRecipe: true,
    likesCount: 156,
    commentsCount: 0,
    tags: [],
    userId: "user-4",
    createdAt: new Date(),
    user: {
      id: "user-4",
      username: "carol_cook",
      email: "carol@example.com",
      password: "",
      displayName: "Carol Cook",
      firstName: null,
      lastName: null,
      royalTitle: null,
      showFullName: false,
      bio: null,
      avatar:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&auto=format",
      specialty: null,
      isChef: false,
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
}: {
  post: PostWithUser;
  currentUserId: string;
}) {
  return (
    <Card className="overflow-hidden">
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
            <p className="font-medium">
              {post.user?.displayName || "Unknown Chef"}
            </p>
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
  const date = new Date(dateStr as any);
  return (
    !isNaN(date.getTime()) &&
    date.getFullYear() >= 1900 &&
    date.getFullYear() <= 2100
  );
}

export default function Feed() {
  const currentUserId = "user-1";

  // Posts feed
  const {
    data: posts,
    isLoading: postsLoading,
    error: postsError,
  } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/feed", currentUserId],
    queryFn: () =>
      fetchJSON<PostWithUser[]>(`/api/posts/feed?userId=${currentUserId}`),
  });

  // Suggested users (sidebar) — falls back to demo if error
  const {
    data: suggestedUsers,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery<User[]>({
    queryKey: ["/api/users", currentUserId, "suggested"],
    queryFn: () => fetchJSON<User[]>("/api/users/suggested?limit=5"),
  });

  // Trending recipes (sidebar) — falls back to demo if error
  const {
    data: trendingRecipes,
    isLoading: recipesLoading,
    error: recipesError,
  } = useQuery<(Recipe & { post: PostWithUser })[]>({
    queryKey: ["/api/recipes/trending"],
    queryFn: () =>
      fetchJSON<(Recipe & { post: PostWithUser })[]>(
        "/api/recipes/trending?limit=5"
      ),
  });

  // Use demo data as fallback
  const displayPosts = postsError ? demoPosts : posts ?? demoPosts;
  const displaySuggestedUsers = usersError
    ? demoSuggestedUsers
    : suggestedUsers ?? demoSuggestedUsers;
  const displayTrendingRecipes = recipesError
    ? demoTrendingRecipes
    : trendingRecipes ?? demoTrendingRecipes;

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
          {postsError && (
            <Card>
              <CardContent className="p-4 text-sm text-destructive">
                Error loading feed: {postsError.message}. Using demo posts
                below.
              </CardContent>
            </Card>
          )}

          {displayPosts
            .filter((post) =>
              isValidDate((post as any).createdAt || (post as any).updatedAt)
            )
            .map((post) =>
              post.isRecipe ? (
                <SimpleRecipeCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId}
                />
              ) : (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId}
                />
              )
            )}

          {displayPosts.length === 0 && !postsLoading && !postsError && (
            <p className="text-center text-muted-foreground py-8">
              No posts yet. Start following chefs!
            </p>
          )}
        </div>

        <div className="flex justify-center mt-8">
          <Button
            variant="outline"
            className="px-6 py-3"
            data-testid="button-load-more"
          >
            Load More Posts
          </Button>
        </div>
      </div>

      {/* Sidebar (fully isolated so it cannot block the feed) */}
      <ErrorBoundary
        fallbackComponent={({ resetError }) => (
          <aside className="hidden xl:block w-80 bg-card border-l border-border overflow-y-auto max-h-screen">
            <div className="p-6 space-y-4">
              <div className="text-sm text-muted-foreground">
                Sidebar features temporarily unavailable.
              </div>
              <Button size="sm" variant="outline" onClick={resetError}>
                Retry Sidebar
              </Button>
            </div>
          </aside>
        )}
      >
        <aside className="hidden xl:block w-80 bg-card border-l border-border overflow-y-auto max-h-screen">
          <div className="p-6 space-y-8">
            {/* Phase 1: Daily Addiction Features */}
            <section>
              <SectionErrorBoundary sectionName="Daily Quests">
                <DailyQuests />
              </SectionErrorBoundary>
            </section>

            <section>
              <SectionErrorBoundary sectionName="AI Suggestions">
                <AISuggestions />
              </SectionErrorBoundary>
            </section>

            <section className="mb-8">
              <h3 className="font-semibold mb-4">Suggested Chefs</h3>
              <div className="space-y-3">
                {displaySuggestedUsers.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage
                          src={user.avatar || ""}
                          alt={user.displayName}
                        />
                        <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p
                          className="text-sm font-medium"
                          data-testid={`text-suggested-chef-${user.id}`}
                        >
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
                      <p className="text-xs text-muted-foreground">
                        by {recipe.post.user.displayName}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-destructive">
                          ♥ {recipe.post.likesCount}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          • {recipe.cookTime} min
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="font-semibold mb-4">Popular Categories</h3>
              <div className="flex flex-wrap gap-2">
                {["Italian", "Healthy", "Desserts", "Quick", "Vegan"].map(
                  (category) => (
                    <Badge
                      key={category}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/20 transition-colors"
                      data-testid={`category-${category.toLowerCase()}`}
                    >
                      #{category}
                    </Badge>
                  )
                )}
              </div>
            </section>
          </div>
        </aside>
      </ErrorBoundary>
    </div>
  );
}
