import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LayoutGrid, List, Heart, MessageCircle } from "lucide-react";

// If your project has a data hook for explore feed, use it:
import { useExploreData } from "./useExploreData";

// Placeholder if an image field is missing or fails to load
const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1200&auto=format&fit=crop";

/** Try hard to find the first valid image URL on a post */
function resolveImageUrl(post: any): string {
  // Common flat fields
  const flat =
    post?.imageUrl ||
    post?.image ||
    post?.coverUrl ||
    post?.photoUrl ||
    post?.thumbnail?.url ||
    post?.thumbUrl;

  if (typeof flat === "string" && flat.trim()) return flat;

  // Arrays/objects often used
  const fromImagesArray =
    post?.images?.[0]?.url || post?.images?.[0] || post?.media?.[0]?.url || post?.media?.url;

  if (typeof fromImagesArray === "string" && fromImagesArray.trim()) return fromImagesArray;

  // If there is a recipe object with its own media fields
  const recipeFlat =
    post?.recipe?.imageUrl ||
    post?.recipe?.image ||
    post?.recipe?.coverUrl ||
    post?.recipe?.photoUrl ||
    post?.recipe?.thumbnail?.url;

  if (typeof recipeFlat === "string" && recipeFlat.trim()) return recipeFlat;

  const recipeFromArray =
    post?.recipe?.images?.[0]?.url || post?.recipe?.images?.[0] || post?.recipe?.media?.[0]?.url;

  if (typeof recipeFromArray === "string" && recipeFromArray.trim()) return recipeFromArray;

  // As a last resort
  return PLACEHOLDER_IMG;
}

type Post = {
  id: string | number;
  isRecipe?: boolean;
  title?: string;
  caption?: string;
  likes?: number;
  comments?: number;
};

function ExploreTile({ post }: { post: Post & Record<string, any> }) {
  const [src, setSrc] = React.useState<string>(() => resolveImageUrl(post));
  return (
    <Card className="relative overflow-hidden group">
      <div className="aspect-square">
        <img
          src={src}
          alt={post.title || post.caption || "post"}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 block"
          loading="lazy"
          decoding="async"
          onError={() => setSrc(PLACEHOLDER_IMG)}
        />
      </div>
      {/* overlay stats */}
      <div className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      <div className="absolute bottom-2 left-2 flex gap-3 text-white drop-shadow">
        <span className="inline-flex items-center gap-1 text-sm">
          <Heart className="h-4 w-4 fill-current" /> {post.likes ?? 0}
        </span>
        <span className="inline-flex items-center gap-1 text-sm">
          <MessageCircle className="h-4 w-4" /> {post.comments ?? 0}
        </span>
      </div>
    </Card>
  );
}

export default function ExplorePage() {
  const [view, setView] = React.useState<"grid" | "list">("grid");

  // ✅ Use your live explore data (falls back to empty array gracefully)
  const { data, isLoading, isError, error } = useExploreData?.() ?? {
    data: [],
    isLoading: false,
    isError: false,
    error: null,
  };

  const feed: Array<Post & Record<string, any>> = Array.isArray(data) ? (data as any) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Explore</h1>
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

      {/* States */}
      {isLoading && (
        <div className="rounded-lg border py-8 text-center text-sm text-muted-foreground">
          Loading explore…
        </div>
      )}

      {isError && (
        <div className="rounded-lg border py-8 text-center text-sm text-red-600">
          Failed to load explore feed{(error as any)?.message ? `: ${(error as any).message}` : ""}.
        </div>
      )}

      {/* Results */}
      {!isLoading && !isError && (
        <>
          {feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
              <p className="text-sm text-muted-foreground">No posts… yet.</p>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {feed.map((p) => (
                <ExploreTile key={p.id ?? resolveImageUrl(p)} post={p} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {feed.map((p) => (
                <div key={p.id ?? resolveImageUrl(p)}>
                {/* list view uses same tile for now; you can swap to a horizontal layout later */}
                  <ExploreTile post={p} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
