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
import { useQuery as useQueryClientLikes } from "@tanstack/react-query";
import type { PostWithUser, User, Recipe } from "@shared/schema";
import DailyQuests from "@/components/DailyQuests";
import AISuggestions from "@/components/AISuggestions";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useUser } from "@/contexts/UserContext";
import { Link } from "wouter";
import CommentsSection from "./CommentsSection";

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
          <Link href={`/profile/${post.user?.id}`}>
            <a>
              <Avatar className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity">
                <AvatarImage
                  src={post.user?.avatar || ""}
                  alt={post.user?.displayName}
                />
                <AvatarFallback>
                  {post.user?.displayName?.[0] || "U"}
                </AvatarFallback>
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

// ─── Landing hero shown to visitors who aren't signed in ───────────────────

function LandingHero() {
  return (
    <div className="w-full">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-yellow-950/10 border border-orange-100 dark:border-orange-900/30 p-8 mb-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/40 rounded-2xl">
            <ChefHat className="w-10 h-10 text-orange-500" />
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-50 mb-3">
          Where Chefs Come Together
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto mb-6">
          Share recipes, discover drinks, join cook-off battles, and connect
          with a community that lives and breathes food.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/auth">
            <a>
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto px-8">
                Join ChefSire — it's free
              </Button>
            </a>
          </Link>
          <Link href="/auth">
            <a>
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8">
                Sign in
              </Button>
            </a>
          </Link>
        </div>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {[
          {
            icon: <BookOpen className="w-5 h-5 text-green-500" />,
            bg: "bg-green-50 dark:bg-green-950/30",
            title: "Recipes",
            desc: "Post, save & remix recipes from chefs worldwide",
          },
          {
            icon: <Utensils className="w-5 h-5 text-blue-500" />,
            bg: "bg-blue-50 dark:bg-blue-950/30",
            title: "Drinks Hub",
            desc: "Smoothies, cocktails, detoxes — all in one place",
          },
          {
            icon: <Trophy className="w-5 h-5 text-amber-500" />,
            bg: "bg-amber-50 dark:bg-amber-950/30",
            title: "Cook-Off Arena",
            desc: "Compete live, earn badges, climb the leaderboard",
          },
          {
            icon: <Users className="w-5 h-5 text-purple-500" />,
            bg: "bg-purple-50 dark:bg-purple-950/30",
            title: "Chef Clubs",
            desc: "Join or start clubs around any cuisine or style",
          },
          {
            icon: <Sparkles className="w-5 h-5 text-pink-500" />,
            bg: "bg-pink-50 dark:bg-pink-950/30",
            title: "Quests & XP",
            desc: "Daily quests and rewards to keep cooking fresh",
          },
          {
            icon: <ChefHat className="w-5 h-5 text-orange-500" />,
            bg: "bg-orange-50 dark:bg-orange-950/30",
            title: "Meal Planning",
            desc: "Plan, track macros and build weekly meal blueprints",
          },
        ].map((f) => (
          <div
            key={f.title}
            className={`${f.bg} rounded-xl p-4 border border-transparent`}
          >
            <div className="mb-2">{f.icon}</div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">{f.title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Divider before community posts */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-border" />
        <span className="text-sm text-muted-foreground font-medium">Latest from the community</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

// ─── Empty state shown when no community posts exist yet ────────────────────

function EmptyPublicFeed() {
  return (
    <div className="text-center py-12 px-4">
      <div className="flex justify-center mb-4">
        <div className="p-4 bg-muted rounded-2xl">
          <ChefHat className="w-8 h-8 text-muted-foreground" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
        Be the first to share
      </h3>
      <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
        No posts yet — sign up and share your first recipe to get the community started.
      </p>
      <Link href="/auth">
        <a>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white">
            Join ChefSire
          </Button>
        </a>
      </Link>
    </div>
  );
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
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

  // Posts feed
  // - If logged in: /api/posts/feed?userId=... returns your posts + followed users
  // - If logged out: /api/posts/feed falls back to explore (all public posts)
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

  // Suggested users (sidebar — logged-in only)
  const {
    data: suggestedUsers = [],
    error: usersError,
  } = useQuery<User[]>({
    queryKey: ["/api/users", currentUserId, "suggested"],
    queryFn: () => fetchJSON<User[]>(`/api/users/${encodeURIComponent(currentUserId)}/suggested?limit=5`),
    enabled: !!currentUserId,
    retry: false,
  });

  // Trending recipes (sidebar)
  const {
    data: trendingRecipes = [],
    error: recipesError,
  } = useQuery<(Recipe & { post: PostWithUser })[]>({
    queryKey: ["/api/recipes/trending"],
    queryFn: async () => {
      const response = await fetchJSON<{ ok: boolean; recipes: (Recipe & { post: PostWithUser })[] }>("/api/recipes/trending?limit=5");
      return response.recipes;
    },
    retry: false,
  });

  const displayPosts = posts ?? [];
  const displaySuggestedUsers = suggestedUsers;
  const displayTrendingRecipes = trendingRecipes;
  const isGuest = !currentUserId;

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
        {/* Show landing hero for guests, bites row for logged-in users */}
        {isGuest ? (
          <LandingHero />
        ) : (
          <BitesRow />
        )}

        {/* Posts */}
        <div className="space-y-8">
          {postsError ? (
            <Card>
              <CardContent className="p-4 text-sm text-destructive">
                {postsError instanceof Error ? postsError.message : "Unable to load posts right now."}
              </CardContent>
            </Card>
          ) : null}

          {displayPosts.map((post) =>
            post.isRecipe ? (
              <SimpleRecipeCard key={post.id} post={post} currentUserId={currentUserId} onCardClick={setSelectedPost} />
            ) : (
              <PostCard key={post.id} post={post} currentUserId={currentUserId} onCardClick={setSelectedPost} />
            )
          )}

          {displayPosts.length === 0 && !postsLoading && !postsError && (
            isGuest ? (
              <EmptyPublicFeed />
            ) : (
              <p className="text-center text-muted-foreground py-8">No posts yet. Start following chefs!</p>
            )
          )}
        </div>

        {displayPosts.length > 0 && (
          <div className="flex justify-center mt-8">
            <Button variant="outline" className="px-6 py-3" data-testid="button-load-more">
              Load More Posts
            </Button>
          </div>
        )}

        {/* Bottom CTA for guests who scrolled through posts */}
        {isGuest && displayPosts.length > 0 && (
          <div className="mt-10 rounded-2xl border border-orange-100 dark:border-orange-900/30 bg-orange-50 dark:bg-orange-950/20 p-6 text-center">
            <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Enjoying the feed?</p>
            <p className="text-sm text-muted-foreground mb-4">Sign up free to like, comment, save recipes and more.</p>
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
          {/* Guest sidebar CTA */}
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

          {/* Phase 1: Daily Addiction Features (logged-in only) */}
          {!isGuest && (
            <>
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
                {usersError ? (
                  <p className="mb-3 text-xs text-muted-foreground">Suggested chefs are unavailable right now.</p>
                ) : null}
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
                          <p className="text-xs text-muted-foreground">
                            {(u as any).specialty || "Expert Chef"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-primary text-primary-foreground hover:opacity-90"
                        data-testid={`button-follow-${u.id}`}
                      >
                        Follow
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <section className="mb-8">
            <h3 className="font-semibold mb-4">Trending Recipes</h3>
            {recipesError ? (
              <p className="mb-3 text-xs text-muted-foreground">Trending recipes are unavailable right now.</p>
            ) : null}
            {displayTrendingRecipes.length === 0 && !recipesError ? (
              <p className="text-xs text-muted-foreground">No trending recipes yet.</p>
            ) : null}
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
                  <Link href={`/profile/${selectedPost.user.id}`}>
                    <a>
                      <Avatar className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity">
                        <AvatarImage
                          src={selectedPost.user.avatar || ""}
                          alt={selectedPost.user.displayName}
                        />
                        <AvatarFallback>
                          {(selectedPost.user.displayName || "U")[0]}
                        </AvatarFallback>
                      </Avatar>
                    </a>
                  </Link>
                  <div>
                    <Link href={`/profile/${selectedPost.user.id}`}>
                      <a className="font-semibold text-sm hover:underline cursor-pointer">
                        {selectedPost.user.displayName}
                      </a>
                    </Link>
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

                {/* Comments section */}
                <CommentsSection postId={selectedPost.id} currentUserId={currentUserId} />

                {/* Delete button for post owner */}
                {currentUserId === selectedPost.user?.id && (
                  <div className="mt-6 pt-4 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={async () => {
                        if (!confirm("Delete this post? This action cannot be undone.")) return;
                        try {
                          const res = await fetch(`/api/posts/${selectedPost.id}`, {
                            method: "DELETE",
                            credentials: "include",
                          });

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
