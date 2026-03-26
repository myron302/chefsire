import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, List, Heart, MessageCircle } from "lucide-react";
import RecipeCard from "@/components/recipe-card";
import UserSearchResults from "@/components/UserSearchResults";

type Post = {
  id: string | number;
  title?: string;
  caption?: string;
  image?: string | null;
  imageUrl?: string | null;
  cuisine?: string;
  isRecipe?: boolean;
  author?: string;
  user?: { displayName?: string; avatar?: string };
  cookTime?: number;
  rating?: number;
  likes?: number;
  comments?: number;
  difficulty?: "Easy" | "Medium" | "Hard";
  mealType?: string;
  dietary?: string[];
  createdAt?: string;
  recipe?: {
    title: string;
    cookTime?: number;
    servings?: number;
    difficulty?: "Easy" | "Medium" | "Hard";
    cuisine?: string;
    ingredients: string[];
    instructions: string[];
    ratingSpoons?: number;
    dietTags?: string[];
    allergens?: string[];
  };
};

const SAMPLE_EXPLORE_POSTS: Post[] = [
  {
    id: "sample-explore-1",
    title: "Sample: Weeknight Pasta",
    caption: "Sample post preview for rollout environments.",
    imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&q=80",
    likes: 24,
    comments: 4,
  },
  {
    id: "sample-explore-2",
    title: "Sample: Garden Bowl",
    caption: "Sample post preview for rollout environments.",
    imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
    likes: 18,
    comments: 2,
  },
];

function ExploreTile({ post }: { post: Post }) {
  const imageUrl = post.image || post.imageUrl || "";
  
  return (
    <div className="relative w-full bg-white border rounded-lg shadow-sm overflow-hidden group">
      <div 
        className="w-full h-48 bg-gray-200 relative overflow-hidden"
        style={{ aspectRatio: "1/1" }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={post.title || "post"}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              console.log("Image failed to load:", imageUrl);
              e.currentTarget.style.display = "none";
            }}
            onLoad={() => console.log("Image loaded:", imageUrl)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            No Image
          </div>
        )}
        
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        
        <div className="absolute bottom-2 left-2 flex gap-3 text-white">
          <span className="inline-flex items-center gap-1 text-sm bg-black/50 px-2 py-1 rounded">
            <Heart className="h-4 w-4 fill-current" /> {post.likes ?? 0}
          </span>
          <span className="inline-flex items-center gap-1 text-sm bg-black/50 px-2 py-1 rounded">
            <MessageCircle className="h-4 w-4" /> {post.comments ?? 0}
          </span>
        </div>
        
        {post.title && (
          <div className="absolute top-2 left-2 right-2">
            <div className="bg-black/70 backdrop-blur-sm rounded px-2 py-1">
              <p className="text-white text-sm font-medium truncate">{post.title}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const {
    data: feed = [],
    isLoading,
    isError,
    error,
  } = useQuery<Post[]>({
    queryKey: ["/api/posts/explore"],
    queryFn: async () => {
      const response = await fetch("/api/posts/explore?offset=0&limit=24", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || `Failed to load explore posts (${response.status})`);
      }
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.items)) return payload.items;
      return [];
    },
  });
  const useSampleFallback = !isLoading && (isError || feed.length === 0);
  const postsToRender = useSampleFallback ? SAMPLE_EXPLORE_POSTS : feed;

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-4 space-y-4">
      <h1 className="text-2xl font-bold">Explore</h1>

      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={view === "grid" ? "default" : "outline"}
                onClick={() => setView("grid")}
                className="gap-2"
              >
                <LayoutGrid className="h-4 w-4" />
                Grid
              </Button>
              <Button
                variant={view === "list" ? "default" : "outline"}
                onClick={() => setView("list")}
                className="gap-2"
              >
                <List className="h-4 w-4" />
                List
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
              <p className="text-sm text-muted-foreground">Loading posts…</p>
            </div>
          ) : view === "grid" ? (
            <>
            {useSampleFallback ? (
              <Card className="p-3 text-xs text-amber-700 bg-amber-50 border-amber-200">
                {isError ? (
                  <>Live explore posts are unavailable ({error instanceof Error ? error.message : "request failed"}). Showing sample posts.</>
                ) : (
                  <>No live explore posts yet. Showing sample posts.</>
                )}
              </Card>
            ) : null}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {postsToRender.map((p) => (
                <ExploreTile key={p.id} post={p} />
              ))}
            </div>
            </>
          ) : (
            <>
            {useSampleFallback ? (
              <Card className="p-3 text-xs text-amber-700 bg-amber-50 border-amber-200">
                {isError ? (
                  <>Live explore posts are unavailable ({error instanceof Error ? error.message : "request failed"}). Showing sample posts.</>
                ) : (
                  <>No live explore posts yet. Showing sample posts.</>
                )}
              </Card>
            ) : null}
            <div className="space-y-3">
              {postsToRender.map((p) => (
                <div key={p.id}>
                  <ExploreTile post={p} />
                </div>
              ))}
            </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="users" className="py-4">
          <UserSearchResults />
        </TabsContent>
      </Tabs>
    </div>
  );
}
