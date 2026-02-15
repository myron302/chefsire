import React, { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import type { PostWithUser, Recipe } from "@shared/schema";
import { MoreHorizontal, Plus, Minus } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { shareContent, getPostShareUrl } from "@/lib/share";
import { Link } from "wouter";

// Import UI primitives from their individual modules (do not import the directory)
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AMOUNT_OPTIONS = [
  "",
  "1/8",
  "1/4",
  "1/3",
  "1/2",
  "2/3",
  "3/4",
  "1",
  "1 1/2",
  "2",
  "3",
  "4",
  "5",
];

const UNIT_OPTIONS = [
  "",
  "tsp",
  "tbsp",
  "cup",
  "oz",
  "lb",
  "g",
  "kg",
  "ml",
  "l",
  "pinch",
  "dash",
  "clove",
  "slice",
  "can",
  "package",
  "bunch",
  "piece",
];

type IngredientInputRow = { amount: string; unit: string; name: string };

function parseIngredientRow(raw: string): IngredientInputRow {
  const s = (raw ?? "").trim();
  if (!s) return { amount: "", unit: "", name: "" };

  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { amount: "", unit: "", name: s };

  // Heuristic: first token (or first two if "1 1/2") is amount
  let amount = "";
  let unit = "";
  let nameStartIdx = 0;

  const first = parts[0];
  const second = parts[1] ?? "";

  const looksLikeFraction = (t: string) => /^\d+\/\d+$/.test(t);
  const looksLikeNumber = (t: string) => /^\d+(\.\d+)?$/.test(t);

  if (looksLikeNumber(first) || looksLikeFraction(first)) {
    // If next token is also fraction, treat both as amount (e.g., "1 1/2")
    if (looksLikeFraction(second)) {
      amount = `${first} ${second}`;
      nameStartIdx = 2;
    } else {
      amount = first;
      nameStartIdx = 1;
    }
  } else if (AMOUNT_OPTIONS.includes(first)) {
    amount = first;
    nameStartIdx = 1;
  }

  // Unit token
  const candidateUnit = parts[nameStartIdx] ?? "";
  if (UNIT_OPTIONS.includes(candidateUnit)) {
    unit = candidateUnit;
    nameStartIdx += 1;
  }

  const name = parts.slice(nameStartIdx).join(" ").trim();
  return { amount, unit, name: name || s };
}

function ingredientRowsToStrings(rows: IngredientInputRow[]): string[] {
  return rows
    .map((r) => {
      const joined = [r.amount, r.unit, r.name]
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .join(" ");
      return joined.trim();
    })
    .filter(Boolean);
}

function normalizeSteps(steps: string[]): string[] {
  return steps.map((s) => (s ?? "").trim()).filter(Boolean);
}

interface PostCardProps {
  post: PostWithUser;
  currentUserId?: string;
  onCardClick?: (post: PostWithUser) => void;
  onDelete?: () => void;
}

export default function PostCard({
  post,
  currentUserId,
  onCardClick,
  onDelete,
}: PostCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const effectiveUserId = currentUserId ?? user?.id;

  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  // NEW STATE for the Edit Modal
  const [isEditing, setIsEditing] = useState(false);

  const [editCaption, setEditCaption] = useState(post.caption ?? "");

  // Recipe edit state (used when post.isRecipe is true)
  const [recipeTitle, setRecipeTitle] = useState(post.recipe?.title ?? "");
  const [cookTime, setCookTime] = useState<string>(
    post.recipe?.cookTime ? String(post.recipe.cookTime) : ""
  );
  const [servings, setServings] = useState<string>(
    post.recipe?.servings ? String(post.recipe.servings) : ""
  );
  const [difficulty, setDifficulty] = useState<string>(
    post.recipe?.difficulty ?? "Easy"
  );
  const [ingredientRows, setIngredientRows] = useState<IngredientInputRow[]>(
    (post.recipe?.ingredients ?? []).map(parseIngredientRow).length
      ? (post.recipe?.ingredients ?? []).map(parseIngredientRow)
      : [{ amount: "", unit: "", name: "" }]
  );
  const [instructionSteps, setInstructionSteps] = useState<string[]>(
    (post.recipe?.instructions ?? []).length
      ? post.recipe?.instructions ?? []
      : [""]
  );

  // Menu state for the More button
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpen]);

  const editMutation = useMutation({
    mutationFn: async (updatedData: { caption: string }) => {
      const res = await apiRequest("PATCH", `/api/posts/${post.id}`, updatedData);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to edit post");
      }
      return res.json();
    },
  });

  // Load the recipe from the API when editing (keeps edit state accurate)
  const { data: recipeData, isLoading: recipeLoading } = useQuery<Recipe | null>({
    queryKey: ["/api/recipes/by-post", post.id],
    queryFn: async () => {
      const res = await fetch(`/api/recipes/by-post/${post.id}`, {
        credentials: "include",
      });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isEditing && !!effectiveUserId && !!post.isRecipe,
  });

  useEffect(() => {
    if (!isEditing) return;

    // Always reset caption when opening
    setEditCaption(post.caption ?? "");

    if (!post.isRecipe) return;

    const base = recipeData ?? post.recipe ?? null;

    setRecipeTitle(base?.title ?? "");
    setCookTime(base?.cookTime ? String(base.cookTime) : "");
    setServings(base?.servings ? String(base.servings) : "");
    setDifficulty(base?.difficulty ?? "Easy");

    const parsedIngredients = (base?.ingredients ?? [])
      .map(parseIngredientRow)
      .filter((r) => r.amount || r.unit || r.name);
    setIngredientRows(
      parsedIngredients.length
        ? parsedIngredients
        : [{ amount: "", unit: "", name: "" }]
    );

    const steps = (base?.instructions ?? []).filter(Boolean);
    setInstructionSteps(steps.length ? steps : [""]);
  }, [isEditing, post.caption, post.isRecipe, post.recipe, recipeData]);

  const recipeUpdateMutation = useMutation({
    mutationFn: async ({ recipeId, payload }: { recipeId: string; payload: any }) => {
      const res = await apiRequest("PATCH", `/api/recipes/${recipeId}`, payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to update recipe");
      }
      return res.json();
    },
  });

  const recipeCreateMutation = useMutation({
    mutationFn: async ({ postId, payload }: { postId: string; payload: any }) => {
      const res = await apiRequest("POST", `/api/recipes`, { postId, ...payload });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to create recipe");
      }
      return res.json();
    },
  });

  // Delete post mutation (owner-only)
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/posts/${post.id}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete post");
      }
      return res.json();
    },
    onSuccess: () => {
      // IMPORTANT: These invalidation calls ensure the profile page refreshes
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/users", effectiveUserId, "posts"],
      });
      // Also refresh explore and user-specific lists used in feed/profile
      queryClient.invalidateQueries({ queryKey: ["/api/posts/explore"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/posts/explore", effectiveUserId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/posts/user", effectiveUserId],
      });
      toast({ description: "Post deleted" });
      // Close modal if open
      onDelete?.();
    },
    onError: () => {
      toast({ variant: "destructive", description: "Failed to delete post" });
    },
  });

  // Like/unlike post mutation
  const likeMutation = useMutation({
    mutationFn: async (shouldLike: boolean) => {
      if (!effectiveUserId) {
        throw new Error("User ID missing");
      }

      if (shouldLike) {
        const res = await apiRequest("POST", `/api/posts/likes`, {
          userId: effectiveUserId,
          postId: post.id,
        });
        if (!res.ok) throw new Error("Failed to like post");
        return res.json();
      } else {
        const res = await apiRequest(
          "DELETE",
          `/api/posts/likes/${effectiveUserId}/${post.id}`
        );
        if (!res.ok) throw new Error("Failed to unlike post");
        return res.json();
      }
    },
    onMutate: async (shouldLike: boolean) => {
      // Optimistically update UI
      setIsLiked(shouldLike);
    },
    onSuccess: () => {
      // Invalidate queries to refresh like counts
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/users", effectiveUserId, "posts"],
      });
      // Also invalidate the explore and user-specific posts so other views update
      queryClient.invalidateQueries({ queryKey: ["/api/posts/explore"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/posts/explore", effectiveUserId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/posts/user", effectiveUserId],
      });
      // Refresh the list of users who liked this post
      queryClient.invalidateQueries({ queryKey: ["/api/posts", post.id, "likes"] });
    },
    onError: (_error, shouldLike) => {
      // Revert on error
      setIsLiked(!shouldLike);
      toast({ variant: "destructive", description: "Failed to update like status" });
    },
  });

  // Save/unsave recipe mutation
  const saveRecipeMutation = useMutation({
    mutationFn: async (shouldSave: boolean) => {
      if (!post.recipe?.id || !effectiveUserId) {
        throw new Error("Recipe ID or User ID missing");
      }

      if (shouldSave) {
        const res = await apiRequest("POST", `/api/recipes/${post.recipe.id}/save`, {
          userId: effectiveUserId,
        });
        if (!res.ok) throw new Error("Failed to save recipe");
        return res.json();
      } else {
        const res = await apiRequest(
          "DELETE",
          `/api/recipes/${post.recipe.id}/save?userId=${effectiveUserId}`
        );
        if (!res.ok) throw new Error("Failed to unsave recipe");
        return res.json();
      }
    },
    onMutate: async (shouldSave: boolean) => {
      // Optimistically update UI
      setIsSaved(shouldSave);
    },
    onSuccess: (_data, shouldSave) => {
      toast({ description: shouldSave ? "Recipe saved!" : "Recipe unsaved" });
    },
    onError: (_error, shouldSave) => {
      // Revert on error
      setIsSaved(!shouldSave);
      toast({ variant: "destructive", description: "Failed to update save status" });
    },
  });

  // Fetch the list of users who liked this post.
  const { data: likeUsers = [] } = useQuery<
    { id: string; displayName: string; avatar?: string }[]
  >({
    queryKey: ["/api/posts", post.id, "likes"],
    queryFn: async () => {
      const response = await fetch(`/api/posts/${post.id}/likes`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  const handleLikeClick = () => {
    if (!effectiveUserId) {
      toast({ description: "Please log in to like posts" });
      return;
    }
    likeMutation.mutate(!isLiked);
  };

  const handleSaveClick = () => {
    if (!post.recipe?.id) {
      toast({ description: "This post doesn't have a recipe to save" });
      return;
    }
    if (!effectiveUserId) {
      toast({ description: "Please log in to save recipes" });
      return;
    }
    saveRecipeMutation.mutate(!isSaved);
  };

  const handleShare = async () => {
    const shareUrl = getPostShareUrl(post.id);
    const result = await shareContent({
      title: post.caption || "Check out this post!",
      text: `${post.user.displayName} shared: ${post.caption || ""}`,
      url: shareUrl,
    });

    if (result.success) {
      if (result.method === "share") {
        toast({ description: "Post shared successfully!" });
      } else if (result.method === "clipboard") {
        toast({ description: "Link copied to clipboard!" });
      }
    } else if (result.method !== "cancelled") {
      toast({ variant: "destructive", description: "Failed to share" });
    }
    setMenuOpen(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleDelete = () => {
    if (!confirm("Delete this post? This action cannot be undone.")) return;
    deleteMutation.mutate();
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((s) => !s);
  };

  const isVideo =
    post.imageUrl?.includes("video") || post.imageUrl?.includes(".mp4");

  return (
    <Card className="w-full bg-card border border-border shadow-sm">
      {/* Post Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3">
          <Link href={`/profile/${post.user.id}`}>
            <a>
              <Avatar className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity">
                <AvatarImage
                  src={post.user.avatar || ""}
                  alt={post.user.displayName}
                />
                <AvatarFallback>
                  {(post.user.displayName || "U")[0]}
                </AvatarFallback>
              </Avatar>
            </a>
          </Link>
          <div>
            <Link href={`/profile/${post.user.id}`}>
              <a>
                <h3
                  className="font-semibold text-sm cursor-pointer hover:underline"
                  data-testid={`text-username-${post.id}`}
                >
                  {post.user.displayName}
                </h3>
              </a>
            </Link>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* More menu */}
        <div className="relative" ref={menuRef}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMoreClick}
            className="p-2"
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>

          {menuOpen && (
            <div className="absolute right-0 top-10 bg-white border border-slate-200 rounded-md shadow-lg z-50 w-44">
              <ul className="py-1 text-sm">
                <li>
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-slate-100"
                    onClick={() => {
                      handleShare();
                      setMenuOpen(false);
                    }}
                  >
                    Share
                  </button>
                </li>

                {effectiveUserId === post.user.id && (
                  <>
                    <li>
                      <button
                        className="w-full text-left px-3 py-2 hover:bg-slate-100"
                        onClick={() => {
                          handleEdit();
                          setMenuOpen(false);
                        }}
                        data-testid={`menu-edit-${post.id}`}
                      >
                        Edit Post
                      </button>
                    </li>
                    <li>
                      <button
                        className="w-full text-left px-3 py-2 hover:bg-slate-100 text-red-600"
                        onClick={() => {
                          handleDelete();
                          setMenuOpen(false);
                        }}
                        data-testid={`menu-delete-${post.id}`}
                      >
                        Delete Post
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Post Image/Video */}
      <div className="relative cursor-pointer" onClick={() => onCardClick?.(post)}>
        {isVideo ? (
          <video
            src={post.imageUrl}
            controls
            className="w-full h-96 object-cover"
          />
        ) : (
          <img
            src={post.imageUrl}
            alt="Post content"
            className="w-full h-96 object-cover"
            data-testid={`img-post-${post.id}`}
          />
        )}
      </div>

      {/* Post body / caption */}
      <div className="px-4 pt-3 pb-2">
        <div className="text-sm">
          <Link href={`/profile/${post.user.id}`}>
            <a className="font-semibold hover:underline cursor-pointer">
              {post.user.displayName}
            </a>
          </Link>{" "}
          <span>{post.caption}</span>
        </div>

        {/* Small badges */}
        <div className="mt-2 flex flex-wrap gap-2">
          {post.isRecipe && <Badge variant="secondary">Recipe</Badge>}
          {(post.tags || []).slice(0, 3).map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>
      </div>

      {/* Action buttons - Instagram-inspired layout */}
      <div className="px-4 pb-2">
        <div className="flex items-center justify-between">
          {/* Left side: Like, Comment, Share icons with counts */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLikeClick}
              data-testid={`button-like-${post.id}`}
              className="p-0 h-auto hover:bg-transparent hover:opacity-70 transition-opacity flex items-center gap-1"
            >
              <span className="text-2xl">{isLiked ? "❤️" : "🤍"}</span>
              <span className="text-sm font-semibold">{post.likesCount || 0}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCardClick?.(post)}
              data-testid={`button-comment-${post.id}`}
              className="p-0 h-auto hover:bg-transparent hover:opacity-70 transition-opacity flex items-center gap-1"
            >
              <span className="text-2xl">💬</span>
              <span className="text-sm font-semibold">{post.commentsCount || 0}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="p-0 h-auto hover:bg-transparent hover:opacity-70 transition-opacity flex items-center gap-1"
            >
              <span className="text-2xl">📤</span>
              <span className="text-sm font-semibold">0</span>
            </Button>
          </div>

          {/* Right side: Save/Bookmark icon - always visible */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveClick}
            data-testid={`button-save-${post.id}`}
            className="p-0 h-auto hover:bg-transparent hover:opacity-70 transition-opacity"
          >
            <span className="text-2xl">{isSaved ? "🔖" : "📑"}</span>
          </Button>
        </div>
      </div>

      {/* Comment preview - single line */}
      <CommentPreview
        postId={post.id}
        totalComments={post.commentsCount || 0}
        onViewAll={() => onCardClick?.(post)}
      />

      {/* EDIT MODAL */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Edit Post</h2>
                  <p className="text-sm text-muted-foreground">
                    Update your caption{post.isRecipe ? " and recipe details" : ""}.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  Close
                </Button>
              </div>

              <Separator className="my-4" />

              <form
                onSubmit={async (e) => {
                  e.preventDefault();

                  try {
                    // Update caption if changed
                    const originalCaption = post.caption ?? "";
                    if (editCaption.trim() !== originalCaption.trim()) {
                      await editMutation.mutateAsync({ caption: editCaption });
                    }

                    // Update recipe (if this is a recipe post)
                    if (post.isRecipe) {
                      const title = recipeTitle.trim();
                      const ingredients = ingredientRowsToStrings(ingredientRows);
                      const instructions = normalizeSteps(instructionSteps);

                      if (!title) {
                        toast({ variant: "destructive", description: "Recipe title is required" });
                        return;
                      }
                      if (ingredients.length === 0) {
                        toast({ variant: "destructive", description: "Add at least one ingredient" });
                        return;
                      }
                      if (instructions.length === 0) {
                        toast({ variant: "destructive", description: "Add at least one instruction step" });
                        return;
                      }

                      const payload: any = {
                        title,
                        ingredients,
                        instructions,
                        cookTime: cookTime ? Number(cookTime) : null,
                        servings: servings ? Number(servings) : null,
                        difficulty: difficulty || "Easy",
                      };

                      if (recipeData?.id) {
                        await recipeUpdateMutation.mutateAsync({ recipeId: recipeData.id, payload });
                      } else {
                        // Fallback: recipe row missing but post is marked recipe — create it
                        await recipeCreateMutation.mutateAsync({ postId: post.id, payload });
                      }
                    }

                    // Refresh feed and close
                    queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/users", effectiveUserId, "posts"] });
                    toast({ description: "Saved changes" });
                    setIsEditing(false);
                  } catch (err: any) {
                    toast({ variant: "destructive", description: err?.message || "Failed to save changes" });
                  }
                }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Caption</label>
                    <Textarea
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      rows={4}
                      className="mt-2"
                    />
                  </div>

                  {post.isRecipe && (
                    <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold">Recipe Details</h3>
                        {recipeLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium">Recipe title</label>
                          <Input
                            value={recipeTitle}
                            onChange={(e) => setRecipeTitle(e.target.value)}
                            placeholder="e.g., Grandma’s Mac & Cheese"
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium">Difficulty</label>
                          <div className="mt-2">
                            <Select value={difficulty} onValueChange={(v) => setDifficulty(v)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select difficulty" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Easy">Easy</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Hard">Hard</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium">Cook time (minutes)</label>
                          <Input
                            value={cookTime}
                            onChange={(e) => setCookTime(e.target.value)}
                            type="number"
                            inputMode="numeric"
                            placeholder="e.g., 30"
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium">Servings</label>
                          <Input
                            value={servings}
                            onChange={(e) => setServings(e.target.value)}
                            type="number"
                            inputMode="numeric"
                            placeholder="e.g., 4"
                            className="mt-2"
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Ingredients</h4>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setIngredientRows((prev) => [...prev, { amount: "", unit: "", name: "" }])}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {ingredientRows.map((row, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-4 sm:col-span-3">
                                <Select
                                  value={row.amount}
                                  onValueChange={(v) =>
                                    setIngredientRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, amount: v } : r))
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Amt" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {AMOUNT_OPTIONS.map((opt) => (
                                      <SelectItem key={opt || "__blank"} value={opt}>
                                        {opt || "—"}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="col-span-4 sm:col-span-3">
                                <Select
                                  value={row.unit}
                                  onValueChange={(v) =>
                                    setIngredientRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, unit: v } : r))
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {UNIT_OPTIONS.map((opt) => (
                                      <SelectItem key={opt || "__blank"} value={opt}>
                                        {opt || "—"}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="col-span-4 sm:col-span-5">
                                <Input
                                  value={row.name}
                                  onChange={(e) =>
                                    setIngredientRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r))
                                    )
                                  }
                                  placeholder="Ingredient"
                                  className="h-9"
                                />
                              </div>

                              <div className="col-span-12 sm:col-span-1 flex justify-end">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setIngredientRows((prev) => prev.filter((_, i) => i !== idx))}
                                  disabled={ingredientRows.length === 1}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Instructions</h4>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setInstructionSteps((prev) => [...prev, ""])}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add step
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {instructionSteps.map((step, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input
                                value={step}
                                onChange={(e) =>
                                  setInstructionSteps((prev) =>
                                    prev.map((s, i) => (i === idx ? e.target.value : s))
                                  )
                                }
                                placeholder={`Step ${idx + 1}`}
                                className="h-9"
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => setInstructionSteps((prev) => prev.filter((_, i) => i !== idx))}
                                disabled={instructionSteps.length === 1}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={editMutation.isPending || recipeUpdateMutation.isPending || recipeCreateMutation.isPending}
                    >
                      {editMutation.isPending || recipeUpdateMutation.isPending || recipeCreateMutation.isPending
                        ? "Saving..."
                        : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}

// Comment Preview Component
interface CommentPreviewProps {
  postId: string;
  totalComments: number;
  onViewAll?: () => void;
}

interface Comment {
  id: string;
  userId: string;
  postId: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    avatar?: string;
  };
}

function CommentPreview({ postId, totalComments, onViewAll }: CommentPreviewProps) {
  // Fetch first comment for preview
  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ["/api/posts", postId, "comments", "preview"],
    queryFn: async () => {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      const allComments = await response.json();
      // Return only first comment for Instagram-style preview
      return allComments.slice(0, 1);
    },
    enabled: totalComments > 0,
  });

  if (totalComments === 0) return null;

  return (
    <div className="px-4 pb-4 space-y-1">
      {/* Show "View all" link first if there are multiple comments */}
      {totalComments > 1 && (
        <button
          onClick={onViewAll}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors block"
        >
          View all {totalComments} comments
        </button>
      )}

      {/* Show first comment preview on single line */}
      {comments.length > 0 && comments[0] && (
        <div className="text-sm truncate">
          <Link href={`/profile/${comments[0].user.id}`}>
            <a className="font-semibold hover:underline cursor-pointer">
              {comments[0].user.displayName}
            </a>
          </Link>{" "}
          <span className="text-muted-foreground">{comments[0].content}</span>
        </div>
      )}
    </div>
  );
}
