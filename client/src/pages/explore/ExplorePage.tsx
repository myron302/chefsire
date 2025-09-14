import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LayoutGrid, List, Heart, MessageCircle } from "lucide-react";
import { useExploreData } from "./useExploreData";

type Post = {
  id?: string | number;
  title?: string;
  caption?: string;
  likes?: number;
  comments?: number;
  createdAt?: string;
  // plus any other fields your backend returns
};

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1200&auto=format&fit=crop";

/** Try hard to find an image URL no matter where the backend put it */
function resolveImageUrl(p: any): string {
  // flat strings
  const flat =
    p?.imageUrl ??
    p?.image ??
    p?.coverUrl ??
    p?.photoUrl ??
    p?.picture ??
    p?.thumbnail ?? // might be a string
    (typeof p?.thumbnail === "object" ? p?.thumbnail?.url : undefined) ??
    p?.thumbUrl ??
    p?.mediaUrl ??
    p?.previewUrl ??
    p?.heroImage ??
    p?.bannerUrl;

  if (typeof flat === "string" && flat.trim()) return flat;

  // common arrays/collections
  const fromArrays =
    p?.images?.[0]?.url ??
    p?.images?.[0]?.src ??
    p?.images?.[0] ??
    p?.photos?.[0]?.url ??
    p?.media?.[0]?.url ??
    p?.media?.[0]?.src ??
    p?.gallery?.[0]?.url ??
    p?.assets?.[0]?.url ??
    p?.attachments?.[0]?.url;
  if (typeof fromArrays === "string" && fromArrays.trim()) return fromArrays;

  // nested under recipe
  const recipeFlat =
    p?.recipe?.imageUrl ??
    p?.recipe?.image ??
    p?.recipe?.photoUrl ??
    p?.recipe?.coverUrl ??
    (typeof p?.recipe?.thumbnail === "object" ? p?.recipe?.thumbnail?.url : undefined);
  if (typeof recipeFlat === "string" && recipeFlat.trim()) return recipeFlat;

  const recipeArrays =
    p?.recipe?.images?.[0]?.url ??
    p?.recipe?.images?.[0] ??
    p?.recipe?.media?.[0]?.url ??
    p?.recipe?.photos?.[0]?.url;
  if (typeof recipeArrays === "string" && recipeArrays.trim()) return recipeArrays;

  // nested content blocks used by some CMSes
  const contentBlock =
    p?.content?.image?.url ??
    p?.content?.cover?.url ??
    p?.content?.media?.[0]?.url ??
    p?.content?.hero?.url;
  if (typeof contentBlock === "string" && contentBlock.trim()) return contentBlock;

  return PLACEHOLDER_IMG;
}

/** Normalize whatever the hook returns into an array of posts */
function extractPosts(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.posts)) return data.posts;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

/** A generic, resilient card that works for ANY post shape */
function GenericPostCard({ post }: { post: Post & Record<string, any> }) {
  const [src, setSrc] = React.useState(() => resolveImageUrl(post));
  const title =
    post.title ||
    post.caption ||
    post.recipe?.title ||
    post.recipe?.name ||
    post.name ||
    "Untitled";
  const likeCount = post.likes ?? post.likeCount ?? post.metrics?.likes ?? 0;
  const commentCount = post.comments ?? post.commentCount ?? post.metrics?.comments ?? 0;

  return (
    <Card className="relative overflow-hidden group">
      <div className="aspect-square bg-neutral-100">
        <img
          src={src}
          alt={title}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 block"
          loading="lazy"
          decoding="async"
          onError={() => setSrc(PLACEHOLDER_IMG)}
        />
      </div>

      {/* gradient + title overlay so it looks like a post, not just a tile */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2 text-white drop-shadow">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
        </div>
        <div className="flex gap-3 text-sm shrink-0">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-4 w-4 fill-current" /> {likeCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-4 w-4" /> {commentCount}
          </span>
        </div>
      </div>
    </Card>
  );
}

export default function ExplorePage() {
  const [view, setView] = React.useState<"grid" | "list">("grid");

  // Always call your data hook (keeps Hooks rules happy)
  const { data, isLoading, isError, error } = useExploreData();

  // Use whatever the hook returns; if empty, still render an empty state
  const feed = extractPosts(data) as Array<Post & Record<string, any>>;

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

      {/* Loading / Error */}
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
              {feed.map((p, i) => (
                <GenericPostCard key={(p.id as string) ?? p.createdAt ?? i} post={p} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {feed.map((p, i) => (
                <div key={(p.id as string) ?? p.createdAt ?? i} className="flex gap-3 items-center">
                  <div className="w-32 shrink-0">
                    <GenericPostCard post={p} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold truncate">
                      {p.title || p.caption || p.recipe?.title || p.name || "Untitled"}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {(p.caption || p.recipe?.summary || p.description || "").toString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
