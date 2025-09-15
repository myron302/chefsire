import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  MessageCircle,
  Share,
  Bookmark,
  MoreHorizontal,
  Clock,
  Users,
  Signal,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PostWithUser } from "@shared/schema";

/** ------------------------------------------------
 * Optional pantry match info (for Instagram-style discovery)
 * Pass this if your list page computes pantry matching
 * ------------------------------------------------- */
type MatchInfo = {
  have: number;
  missing: number;
  total: number;
};

interface RecipeCardProps {
  post: PostWithUser;
  currentUserId?: string;
  /** Optional: show On-hand / Missing line */
  matchInfo?: MatchInfo;
  /** Optional: open your substitution UI for this post */
  onSuggestSubs?: (post: PostWithUser) => void;
}

/** Safe helpers */
const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>
      <rect width='100%' height='100%' fill='#eee'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#999' font-family='sans-serif' font-size='20'>No image</text>
    </svg>`
  );

function getImg(post: PostWithUser | undefined) {
  return (
    (post?.imageUrl && String(post.imageUrl).trim()) ||
    (post?.recipe as any)?.imageUrl ||
    (post as any)?.photoUrl ||
    PLACEHOLDER_IMG
  );
}
function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src !== PLACEHOLDER_IMG) img.src = PLACEHOLDER_IMG;
}

/** Spoon icon (swap to your knife+spoon SVG later if you like) */
function Spoon({ dim = 18, faded = false }: { dim?: number; faded?: boolean }) {
  return (
    <span
      style={{ fontSize: dim, lineHeight: 1 }}
      className={faded ? "opacity-30" : ""}
      aria-hidden
    >
      🥄
    </span>
  );
}

// Safe helper to ensure we get an array
function safeArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    // Split string into array if it's a string
    return value.split(/\r?\n/).filter(item => item.trim());
  }
  return [];
}

export default function RecipeCard({
  post,
  currentUserId = "user-1",
  matchInfo,
  onSuggestSubs,
}: RecipeCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const safeUser = post?.user ?? { displayName: "Unknown", avatar: "" };
  const userInitial =
    (safeUser.displayName?.[0] || safeUser["username"]?.[0] || "?").toUpperCase();

  const [isLiked, setIsLiked] = useState(Boolean(post?.isLiked));
  const [isSaved, setIsSaved] = useState(Boolean(post?.isSaved));
  const [showFullRecipe, setShowFullRecipe] = useState(false);

  // in case backend doesn't always send spoons, compute a fallback
  const spoonRating = useMemo(() => {
    const r =
      (post as any)?.recipe?.ratingSpoons ??
      (post as any)?.rating ??
      0;
    const n = Number(r);
    return Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0;
  }, [post]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!post?.id) return;
      if (isLiked) {
        await apiRequest("DELETE", `/api/likes/${currentUserId}/${post.id}`);
      } else {
        await apiRequest("POST", "/api/likes", {
          userId: currentUserId,
          postId: post.id,
        });
      }
    },
    onSuccess: () => {
      setIsLiked((v) => !v);
      // keep it broad so it updates feeds
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const handleLike = () => likeMutation.mutate();
  const handleSave = () => {
    setIsSaved((v) => !v);
    toast({ description: !isSaved ? "Recipe saved!" : "Recipe unsaved" });
  };

  if (!post?.recipe) return null;

  const img = getImg(post);
  const createdAt = post?.createdAt ? new Date(post.createdAt) : null;

  // Use safe array helpers to prevent crashes
  const ing = safeArray(post.recipe.ingredients);
  const steps = safeArray(post.recipe.instructions);
  const dietTags = safeArray((post.recipe as any).dietTags || (post as any).dietary);
  const allergens = safeArray((post.recipe as any).allergens || (post as any).allergens);
  const cuisine = post.recipe.cuisine || (post as any).cuisine || (post as any).category || "—";

  return (
    <Card className="w-full bg-card border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={safeUser.avatar || ""} alt={safeUser.displayName || "Chef"} />
            <AvatarFallback>{userInitial}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-sm" data-testid={`text-chef-${post.id ?? "x"}`}>
              {safeUser.displayName || safeUser["username"] || "Unknown Chef"}
            </h3>
            <p className="text-xs text-muted-foreground" data-testid={`text-timestamp-${post.id ?? "x"}`}>
              {createdAt ? formatDistanceToNow(createdAt, { addSuffix: true }) : "Just now"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-accent text-accent-foreground">Recipe</Badge>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Image */}
      <div className="w-full overflow-hidden">
        <img
          src={img}
          onError={onImgError}
          alt={post.recipe.title || "Recipe image"}
          className="w-full h-96 object-cover"
          loading="lazy"
          decoding="async"
          data-testid={`img-recipe-${post.id ?? "x"}`}
        />
      </div>

      {/* Content */}
      <CardContent className="p-4">
        {/* Title */}
        <h2 className="text-lg font-bold mb-2" data-testid={`text-recipe-title-${post.id ?? "x"}`}>
          {post.recipe.title || "Untitled Recipe"}
        </h2>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 mb-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span data-testid={`text-cook-time-${post.id ?? "x"}`}>
              {post.recipe.cookTime ?? 0} min
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span data-testid={`text-servings-${post.id ?? "x"}`}>
              {(post.recipe as any).servings ?? 1} servings
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Signal className="h-4 w-4" />
            <span data-testid={`text-difficulty-${post.id ?? "x"}`}>
              {(post.recipe as any).difficulty || "—"}
            </span>
          </span>

          {/* Spoons rating */}
          <span className="ml-auto inline-flex items-center gap-1 text-foreground">
            {/* render 5 spoons, fade those above rating */}
            {Array.from({ length: 5 }).map((_, i) => (
              <Spoon key={i} faded={spoonRating < i + 1} />
            ))}
            <span className="text-xs text-muted-foreground">({spoonRating.toFixed(1)})</span>
          </span>
        </div>

        {/* Pantry match (optional) */}
        {matchInfo && (
          <div className="mb-3 text-xs text-muted-foreground">
            ✅ On-hand: {matchInfo.have}/{matchInfo.total} · 🧂 Missing: {matchInfo.missing}{" "}
            {matchInfo.missing > 0 && onSuggestSubs && (
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto ml-1 text-primary"
                onClick={() => onSuggestSubs(post)}
              >
                See substitutions
              </Button>
            )}
          </div>
        )}

        {/* Badges: cuisine / diets / allergens */}
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="outline">{cuisine}</Badge>
          {dietTags.slice(0, 4).map((d: string, index: number) => (
            <Badge key={`diet-${index}`} variant="secondary">
              {d}
            </Badge>
          ))}
          {allergens.slice(0, 3).map((a: string, index: number) => (
            <Badge key={`allergen-${index}`} variant="destructive" className="bg-destructive/10 text-destructive border-destructive/30">
              {a}
            </Badge>
          ))}
        </div>

        {/* Ingredients */}
        <div className="mb-4">
          <h4 className="font-semibold text-sm mb-2">Ingredients:</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            {showFullRecipe ? (
              ing.map((ingredient, index) => (
                <p key={index} data-testid={`ingredient-${index}-${post.id ?? "x"}`}>
                  • {ingredient}
                </p>
              ))
            ) : (
              <>
                {ing.slice(0, 3).map((ingredient, index) => (
                  <p key={index} data-testid={`ingredient-preview-${index}-${post.id ?? "x"}`}>
                    • {ingredient}
                  </p>
                ))}
                {ing.length > 3 && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowFullRecipe(true)}
                    className="text-primary text-xs p-0 h-auto hover:underline"
                    data-testid={`button-show-full-recipe-${post.id ?? "x"}`}
                  >
                    + View full recipe
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Instructions */}
        {showFullRecipe && steps.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold text-sm mb-2">Instructions:</h4>
            <div className="text-sm text-muted-foreground space-y-2">
              {steps.map((instruction, index) => (
                <p key={index} data-testid={`instruction-${index}-${post.id ?? "x"}`}>
                  {index + 1}. {instruction}
                </p>
              ))}
            </div>
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setShowFullRecipe(false)}
              >
                Hide recipe
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={`flex items-center space-x-1 p-0 h-auto ${
                isLiked ? "text-destructive" : "text-muted-foreground hover:text-destructive"
              }`}
              data-testid={`button-like-recipe-${post.id ?? "x"}`}
            >
              <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
              <span className="text-sm font-medium">{post?.likesCount ?? 0}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center space-x-1 text-muted-foreground hover:text-foreground p-0 h-auto"
              data-testid={`button-comment-recipe-${post.id ?? "x"}`}
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm">{post?.commentsCount ?? 0}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground p-0 h-auto"
              data-testid={`button-share-recipe-${post.id ?? "x"}`}
            >
              <Share className="h-5 w-5" />
            </Button>
          </div>
          <Button
            onClick={handleSave}
            className={`text-sm px-4 py-2 rounded-lg transition-opacity ${
              isSaved
                ? "bg-primary/20 text-primary border border-primary"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
            data-testid={`button-save-recipe-${post.id ?? "x"}`}
          >
            <Bookmark className="h-4 w-4 mr-1" />
            {isSaved ? "Saved" : "Save Recipe"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
