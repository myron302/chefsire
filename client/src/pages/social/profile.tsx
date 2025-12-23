import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useUser } from "@/contexts/UserContext";
import { ProfileCompletion } from "@/components/ProfileCompletion";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import PostCard from "@/components/post-card";
// Import CommentsSection from the local file.  The original alias
// '@/components/CommentsSection' may not resolve here, so we import
// from the local CommentsSection component in the same directory.
import CommentsSection from "./CommentsSection";
import { shareContent, getPostShareUrl } from "@/lib/share";
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
  MessageCircle,
  X,
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
  User,
  EllipsisVertical,
  X,
  MoreHorizontal,
} from "lucide-react";
import type { User as UserType, PostWithUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profileUserId = userId || currentUser?.id;
  const isOwnProfile = profileUserId === currentUser?.id;
  const [selectedPost, setSelectedPost] = useState<PostWithUser | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<PostWithUser | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId]);

  // Edit post mutation
  const editPostMutation = useMutation({
    mutationFn: async ({ postId, caption }: { postId: string; caption: string }) => {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption }),
      });
      if (!response.ok) throw new Error("Failed to update post");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts/user", profileUserId] });
      toast({ description: "Post updated successfully" });
      setEditingPost(null);
    },
    onError: () => {
      toast({ variant: "destructive", description: "Failed to update post" });
    },
  });

  // Fetch user (use currentUser when looking at self)
  const { data: user, isLoading: userLoading } = useQuery<UserType>({
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
      const response = await fetch(`/api/posts/user/${profileUserId}?currentUserId=${currentUser?.id || ''}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }
      return response.json();
    },
    retry: false,
    enabled: !!profileUserId,
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
    enabled: !!profileUserId,
  });

  // Helper function to detect video URLs
  const isVideoUrl = (url: string) => {
    return url?.includes("video") || url?.includes(".mp4") || url?.includes(".webm") || url?.includes(".mov");
  };

  // Derive filtered post arrays
  const allUserPosts = posts || [];
  const userPhotos = allUserPosts.filter((p) => !isVideoUrl(p.imageUrl));
  const userVideos = allUserPosts.filter((p) => isVideoUrl(p.imageUrl));
  const userRecipes = posts?.filter((p) => p.isRecipe) || [];

  if (userLoading || !user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 text-center">
        <p>Loading profile...</p>
      </div>
    );
  }

  const displayUser = user;
  const primaryName = displayUser.displayName || displayUser.username;
  const profileHeading = primaryName;
  const followersCount = 1200;
  const followingCount = 450;
  const postCount = posts?.length || 0;
  const bio = displayUser.bio || "The culinary journey starts here.";
  const title = displayUser.title;

  const getCompetitionStatusStyle = (status: string) => {
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
                <Badge
                  className="mb-2 text-xs bg-yellow-400 text-yellow-950 hover:bg-yellow-500"
                  data-testid="profile-title"
                >
                  <Crown className="w-3 h-3 mr-1" />
                  {titleCase(title)}
                </Badge>
              )}
              <h1 className="text-3xl font-bold mb-1" data-testid="profile-display-name">
                {profileHeading}
              </h1>
              <p className="text-muted-foreground" data-testid="profile-username">
                @{displayUser.username}
              </p>
            </div>
            {isOwnProfile ? (
              <div className="flex gap-2 mt-3 sm:mt-0">
                <Button variant="outline" onClick={() => setLocation("/settings")}>
                  Settings
                </Button>
                <Button onClick={() => setLocation("/post/new")} data-testid="button-create-post">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Post
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 mt-3 sm:mt-0">
                <Button variant="outline">
                  <User className="w-4 h-4 mr-2" />
                  Follow
                </Button>
                <Button>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Message
                </Button>
              </div>
            )}
          </div>
          <p className="text-lg mb-4 max-w-xl" data-testid="profile-bio">
            {bio}
          </p>
          <div className="flex space-x-6 text-sm">
            <span className="font-semibold" data-testid="profile-posts-count">
              {postCount} Posts
            </span>
            <span className="font-semibold cursor-pointer hover:text-primary" data-testid="profile-followers-count">
              {followersCount.toLocaleString()} Followers
            </span>
            <span className="font-semibold cursor-pointer hover:text-primary" data-testid="profile-following-count">
              {followingCount.toLocaleString()} Following
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
          <TabsTrigger value="competitions" className="flex items-center space-x-2" data-testid="tab-competitions">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Cookoffs</span>
          </TabsTrigger>
          <TabsTrigger value="store" className="flex items-center space-x-2" data-testid="tab-store">
            <StoreIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Store</span>
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center space-x-2" data-testid="tab-saved">
            <Bookmark className="h-4 w-4" />
            <span className="hidden sm:inline">Saved</span>
          </TabsTrigger>
          {isOwnProfile && (
            <TabsTrigger value="stats" className="flex items-center space-x-2" data-testid="tab-stats">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Stats</span>
            </TabsTrigger>
          )}
          {isOwnProfile && (
            <TabsTrigger value="analytics" className="flex items-center space-x-2" data-testid="tab-analytics">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* --- PHOTOS TAB --- */}
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
                <Card
                  key={post.id}
                  className="group cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedPost(post)}
                >
                  <div className="relative overflow-hidden aspect-square">
                    {/* Three-dot menu for owner */}
                    {isOwnProfile && post.userId === currentUser?.id && (
                      <div className="absolute top-2 right-2 z-10" ref={openMenuId === post.id ? menuRef : null}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="bg-black/50 hover:bg-black/70 text-white p-0 h-8 w-8 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === post.id ? null : post.id);
                          }}
                          data-testid={`button-post-options-${post.id}`}
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </Button>
                        {openMenuId === post.id && (
                          <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-md">
                            <ul className="p-1">
                              <li>
                                <button
                                  className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const shareUrl = getPostShareUrl(post.id);
                                    const result = await shareContent({
                                      title: post.caption || "Check out this post!",
                                      text: `${post.user.displayName} shared: ${post.caption || ""}`,
                                      url: shareUrl,
                                    });
                                    if (result.success) {
                                      if (result.method === 'share') {
                                        toast({ description: "Post shared successfully!" });
                                      } else if (result.method === 'clipboard') {
                                        toast({ description: "Link copied to clipboard!" });
                                      }
                                    } else if (result.method !== 'cancelled') {
                                      toast({ variant: "destructive", description: "Failed to share" });
                                    }
                                    setOpenMenuId(null);
                                  }}
                                >
                                  Share
                                </button>
                              </li>
                              <li>
                                <button
                                  className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toast({ description: "Like added!" });
                                    setOpenMenuId(null);
                                  }}
                                >
                                  Like
                                </button>
                              </li>
                              <li>
                                <button
                                  className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingPost(post);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  Edit Post
                                </button>
                              </li>
                              <li>
                                <button
                                  className="w-full text-left px-3 py-2 hover:bg-slate-100 text-red-600 text-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm("Delete this post? This action cannot be undone.")) {
                                      fetch(`/api/posts/${post.id}`, { method: "DELETE", credentials: "include" })
                                        .then(() => {
                                          queryClient.invalidateQueries({ queryKey: ["/api/posts/user", profileUserId] });
                                          toast({ description: "Post deleted" });
                                        })
                                        .catch(() => toast({ variant: "destructive", description: "Failed to delete post" }));
                                    }
                                    setOpenMenuId(null);
                                  }}
                                >
                                  Delete Post
                                </button>
                              </li>
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    <img
                      src={post.imageUrl}
                      alt={post.caption}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      data-testid={`image-user-post-${post.id}`}
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex items-center space-x-4 text-white text-lg">
                        <span className="flex items-center space-x-1">
                          <Heart className="h-5 w-5" />
                          <span>{post.likesCount}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <MessageCircle className="h-5 w-5" />
                          <span>{post.commentsCount}</span>
                        </span>
                      </div>
                    </div>
                    {post.isRecipe && (
                      <Badge className="absolute top-2 left-2 bg-primary/90 hover:bg-primary">
                        <ChefHat className="w-3 h-3 mr-1" /> Recipe
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Image className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No photos yet</h3>
              {isOwnProfile && (
                <Button onClick={() => setLocation("/post/new")}>
                  <Plus className="w-4 h-4 mr-2" /> Upload Your First Post
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* --- BITES TAB --- */}
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
                <Card
                  key={post.id}
                  className="group cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedPost(post)}
                >
                  <div className="relative overflow-hidden aspect-square bg-black">
                    {/* Three-dot menu for owner */}
                    {isOwnProfile && post.userId === currentUser?.id && (
                      <div className="absolute top-2 right-2 z-10" ref={openMenuId === post.id ? menuRef : null}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="bg-black/50 hover:bg-black/70 text-white p-0 h-8 w-8 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === post.id ? null : post.id);
                          }}
                          data-testid={`button-bite-options-${post.id}`}
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </Button>
                        {openMenuId === post.id && (
                          <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-md">
                            <ul className="p-1">
                              <li>
                                <button
                                  className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const shareUrl = getPostShareUrl(post.id);
                                    const result = await shareContent({
                                      title: post.caption || "Check out this post!",
                                      text: `${post.user.displayName} shared: ${post.caption || ""}`,
                                      url: shareUrl,
                                    });
                                    if (result.success) {
                                      if (result.method === 'share') {
                                        toast({ description: "Post shared successfully!" });
                                      } else if (result.method === 'clipboard') {
                                        toast({ description: "Link copied to clipboard!" });
                                      }
                                    } else if (result.method !== 'cancelled') {
                                      toast({ variant: "destructive", description: "Failed to share" });
                                    }
                                    setOpenMenuId(null);
                                  }}
                                >
                                  Share
                                </button>
                              </li>
                              <li>
                                <button
                                  className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toast({ description: "Like added!" });
                                    setOpenMenuId(null);
                                  }}
                                >
                                  Like
                                </button>
                              </li>
                              <li>
                                <button
                                  className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingPost(post);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  Edit Post
                                </button>
                              </li>
                              <li>
                                <button
                                  className="w-full text-left px-3 py-2 hover:bg-slate-100 text-red-600 text-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm("Delete this post? This action cannot be undone.")) {
                                      fetch(`/api/posts/${post.id}`, { method: "DELETE", credentials: "include" })
                                        .then(() => {
                                          queryClient.invalidateQueries({ queryKey: ["/api/posts/user", profileUserId] });
                                          toast({ description: "Post deleted" });
                                        })
                                        .catch(() => toast({ variant: "destructive", description: "Failed to delete post" }));
                                    }
                                    setOpenMenuId(null);
                                  }}
                                >
                                  Delete Post
                                </button>
                              </li>
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
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
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Video className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No Bites (short videos) yet</h3>
              {isOwnProfile && (
                <Button onClick={() => setLocation("/post/new?type=bite")}>
                  <Plus className="w-4 h-4 mr-2" /> Create Your First Bite
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* --- RECIPES TAB --- */}
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
            <div className="space-y-6">
              {userRecipes.map((post) => (
                <PostCard key={post.id} post={post} currentUserId={currentUser?.id} onCardClick={setSelectedPost} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ChefHat className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No recipes posted yet</h3>
              {isOwnProfile && (
                <Button onClick={() => setLocation("/post/new?isRecipe=true")}>
                  <Plus className="w-4 h-4 mr-2" /> Share Your First Recipe
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* --- DRINKS TAB --- */}
        <TabsContent value="drinks" className="mt-6">
          {drinksLoading ? (
            <div className="text-center py-12">Loading drinks...</div>
          ) : drinksData && drinksData.drinks.length > 0 ? (
            <>
              <h2 className="text-xl font-semibold mb-4">Custom Drink Creations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drinksData.drinks.map((d) => (
                  <Card key={d.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
                    <div className="aspect-video overflow-hidden">
                      <img src={d.imageUrl} alt={d.name} className="w-full h-full object-cover" />
                    </div>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold line-clamp-1">{d.name}</h3>
                        <Badge variant="outline">{d.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{d.description}</p>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{d.calories} Cal</span>
                        <span>{d.protein}g Protein</span>
                        <span>{d.fiber}g Fiber</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <GlassWater className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No custom drinks created yet</h3>
              {isOwnProfile && (
                <Button onClick={() => setLocation("/drinks")}>
                  <Plus className="w-4 h-4 mr-2" /> Explore Drink Recipes
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* --- COMPETITIONS TAB --- */}
        <TabsContent value="competitions" className="mt-6">
          {competitionsLoading ? (
            <div className="text-center py-12">Loading competitions...</div>
          ) : competitionsData && competitionsData.competitions.length > 0 ? (
            <div className="space-y-4">
              {competitionsData.competitions.map((c) => (
                <Card
                  key={c.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setLocation(`/competitions/${c.id}`)}
                >
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">{c.title}</h3>
                      <p className="text-sm text-muted-foreground">{c.themeName}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      {c.placement && c.status === "completed" && (
                        <Badge className="bg-yellow-500 text-yellow-950 font-bold">
                          <Award className="w-4 h-4 mr-1" /> #{c.placement}
                        </Badge>
                      )}
                      <Badge className={getCompetitionStatusStyle(c.status)}>
                        {titleCase(c.status)}
                      </Badge>
                      <Trophy className="w-6 h-6 text-gray-500" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No cookoff entries yet</h3>
              <Button onClick={() => setLocation("/competitions")}>
                <Plus className="w-4 h-4 mr-2" /> Find a Competition
              </Button>
            </div>
          )}
        </TabsContent>

        {/* --- STORE TAB --- */}
        <TabsContent value="store" className="mt-6">
          {storeData && storeData.store ? (
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <StoreIcon className="w-5 h-5 mr-2" />
                    {storeData.store.name}
                  </CardTitle>
                  <CardDescription>
                    {storeData.store.bio || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <Button
                      onClick={() => setLocation(`/store/${storeData.store?.handle}`)}
                    >
                      <Eye className="w-4 h-4 mr-2" /> View Store
                    </Button>
                    {isOwnProfile && (
                      <Button
                        variant="outline"
                        onClick={() => setLocation("/store/dashboard")}
                      >
                        <BarChart3 className="w-4 h-4 mr-2" /> Manage Dashboard
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-3">
                  <div className="flex items-center justify-between">
                    <span>Products</span>
                    <span className="font-bold">
                      {storeProductsData?.count || 0}{" "}
                      {storeData.store.product_limit && storeData.store.product_limit !== -1
                        ? ` / ${storeData.store.product_limit}`
                        : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Subscription</span>
                    <Badge variant="secondary">
                      {titleCase(storeData.store.subscription_tier || "Free")}
                    </Badge>
                  </div>
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
                <p className="text-muted-foreground mb-4">
                  Create your storefront from the dashboard to start selling.
                </p>
              ) : (
                <p className="text-muted-foreground mb-4">This user doesn't have a public store.</p>
              )}
              {isOwnProfile && (
                <Button onClick={() => setLocation("/store/setup")}>
                  <Plus className="w-4 h-4 mr-2" /> Set Up Store
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* --- SAVED TAB --- */}
        <TabsContent value="saved" className="mt-6">
          {savedDrinksLoading ? (
            <div className="text-center py-12">Loading saved items...</div>
          ) : savedDrinksData && savedDrinksData.drinks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedDrinksData.drinks.map((d) => (
                <Card key={d.id} className="overflow-hidden">
                  <div className="aspect-video overflow-hidden">
                    <img src={d.imageUrl} alt={d.name} className="w-full h-full object-cover" />
                  </div>
                  <CardContent className="p-4">
                    <div className="flex justify-between">
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
              <Bookmark className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No saved items yet</h3>
              <p className="text-muted-foreground">
                Recipes, drinks, and products you bookmark will appear here.
              </p>
            </div>
          )}
        </TabsContent>

        {/* --- STATS TAB (OWN PROFILE ONLY) --- */}
        {isOwnProfile && (
          <TabsContent value="stats" className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Culinary Stats</h2>
            {statsLoading ? (
              <div className="text-center py-12">Loading stats...</div>
            ) : statsData && statsData.stats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">
                        Dishes Created
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">
                      {statsData.stats.totalDrinksMade}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Level</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">
                      {statsData.stats.level}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Points</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">
                      {statsData.stats.totalPoints}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Streak</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">
                      {statsData.stats.currentStreak} days
                    </CardContent>
                  </Card>
                </div>

                <h3 className="text-lg font-semibold mb-3">Badges & Achievements</h3>
                <div className="flex flex-wrap gap-2 mb-8">
                  {statsData.stats.badges.map((badge) => (
                    <Badge key={badge} className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                      <Star className="w-3 h-3 mr-1 fill-blue-800" />
                      {titleCase(badge)}
                    </Badge>
                  ))}
                </div>

                <h3 className="text-lg font-semibold mb-3">Category Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Smoothies</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">
                      {statsData.stats.smoothiesMade}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">
                        Protein Shakes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">
                      {statsData.stats.proteinShakesMade}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Detoxes</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">
                      {statsData.stats.detoxesMade}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Cocktails</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">
                      {statsData.stats.cocktailsMade}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold mb-2">No stats available</h3>
                <p className="text-muted-foreground">Start creating and tracking to see your stats!</p>
              </div>
            )}
          </TabsContent>
        )}

        {/* --- ANALYTICS TAB (OWN PROFILE ONLY) --- */}
        {isOwnProfile && (
          <TabsContent value="analytics" className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Post & Profile Analytics</h2>
            <AnalyticsDashboard userId={profileUserId!} />
          </TabsContent>
        )}
      </Tabs>

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
                <div className="flex items-center space-x-4 text-sm text-muted-foreground border-t pt-4 mb-4">
                  <div className="flex items-center space-x-1">
                    <Heart className="h-4 w-4" />
                    <span>{selectedPost.likesCount || 0} likes</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MessageCircle className="h-4 w-4" />
                    <span>{selectedPost.commentsCount || 0} comments</span>
                  </div>
                </div>

                {/* Comments Section */}
                <CommentsSection postId={selectedPost.id} currentUserId={currentUser?.id || ''} />

                {/* Delete button for post owner */}
                {currentUser?.id === selectedPost.user?.id && (
                  <div className="mt-6 pt-4 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={async () => {
                        if (!confirm("Delete this post? This action cannot be undone.")) return;
                        try {
                          console.log("=== DELETE POST DEBUG (PROFILE) ===");
                          console.log("Post ID:", selectedPost.id);
                          console.log("Current User ID:", currentUser?.id);
                          console.log("Post Owner ID:", selectedPost.user?.id);
                          console.log("Auth token cookie:", document.cookie);

                          const res = await fetch(`/api/posts/${selectedPost.id}`, {
                            method: "DELETE",
                            credentials: "include",
                          });

                          console.log("Response status:", res.status);
                          console.log("Response headers:", Object.fromEntries(res.headers.entries()));

                          const responseText = await res.text();
                          console.log("Response body:", responseText);

                          if (!res.ok) {
                            let errorMsg = `HTTP Status: ${res.status}\n\nResponse Body:\n${responseText}\n\nCookies:\n${document.cookie}`;
                            try {
                              const err = JSON.parse(responseText);
                              errorMsg = `HTTP Status: ${res.status}\n\nError Message: ${err.message || err.error || 'Unknown'}\n\nFull Response:\n${JSON.stringify(err, null, 2)}\n\nAuth Cookie:\n${document.cookie}`;
                            } catch (e) {
                              // Response wasn't JSON, use text
                            }
                            console.error("DELETE FAILED:", errorMsg);
                            alert(`❌ DELETE FAILED\n\n${errorMsg}`);
                            return;
                          }

                          console.log("✅ Delete successful");
                          setSelectedPost(null);
                          window.location.reload();
                        } catch (error) {
                          const errorMsg = error instanceof Error ? error.message : String(error);
                          const stack = error instanceof Error ? error.stack : 'N/A';
                          console.error("DELETE EXCEPTION:", error);
                          alert(`❌ DELETE EXCEPTION\n\nError: ${errorMsg}\n\nStack:\n${stack}\n\nCookies:\n${document.cookie}`);
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

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-1">Edit Post</h2>
              <p className="text-sm text-muted-foreground mb-4">Edit your caption and details.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const newCaption = (e.currentTarget.elements.namedItem('caption') as HTMLTextAreaElement).value;
                  editPostMutation.mutate({ postId: editingPost.id, caption: newCaption });
                }}
              >
                <div className="space-y-4">
                  <label className="text-sm font-medium">Caption</label>
                  <textarea
                    name="caption"
                    defaultValue={editingPost.caption}
                    rows={4}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingPost(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={editPostMutation.isPending}
                  >
                    {editPostMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
