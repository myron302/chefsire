import React, { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import type { PostWithUser } from "@shared/schema";
import { MoreHorizontal } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// Import UI primitives from their individual modules (do not import the directory)
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PostCardProps {
  post: PostWithUser;
  currentUserId?: string;
  onCardClick?: (post: PostWithUser) => void;
}

export default function PostCard({ post, currentUserId, onCardClick }: PostCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const effectiveUserId = currentUserId ?? user?.id;

  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  // NEW STATE for the Edit Modal
  const [isEditing, setIsEditing] = useState(false);

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

  // NEW MUTATION: For updating the post content (caption, etc.)
  const editMutation = useMutation({
    mutationFn: async (updatedData: { caption: string }) => {
      const res = await apiRequest("PATCH", `/api/posts/${post.id}`, updatedData);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to edit post");
      }
      return res.json();
    },
    onSuccess: () => {
      // IMPORTANT: Invalidate queries for both the general feed and the user's profile posts
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", effectiveUserId, "posts"] });
      toast({ description: "Post updated successfully" });
      setIsEditing(false); // Close the modal on success
    },
    onError: () => {
      toast({ variant: "destructive", description: "Failed to save edits" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/users", effectiveUserId, "posts"] });
      toast({ description: "Post deleted" });
    },
    onError: () => {
      toast({ variant: "destructive", description: "Failed to delete post" });
    },
  });

  // Save/unsave recipe mutation
  const saveRecipeMutation = useMutation({
    mutationFn: async (shouldSave: boolean) => {
      if (!post.recipe?.id || !effectiveUserId) {
        throw new Error("Recipe ID or User ID missing");
      }
      
      if (shouldSave) {
        const res = await apiRequest("POST", `/api/recipes/${post.recipe.id}/save`, { userId: effectiveUserId });
        if (!res.ok) throw new Error("Failed to save recipe");
        return res.json();
      } else {
        const res = await apiRequest("DELETE", `/api/recipes/${post.recipe.id}/save?userId=${effectiveUserId}`);
        if (!res.ok) throw new Error("Failed to unsave recipe");
        return res.json();
      }
    },
    onMutate: async (shouldSave: boolean) => {
      // Optimistically update UI
      setIsSaved(shouldSave);
    },
    onSuccess: (data, shouldSave) => {
      toast({ description: shouldSave ? "Recipe saved!" : "Recipe unsaved" });
    },
    onError: (error, shouldSave) => {
      // Revert on error
      setIsSaved(!shouldSave);
      toast({ variant: "destructive", description: "Failed to update save status" });
    },
  });

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

  // NEW HANDLER
  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleDelete = () => {
    if (!confirm("Delete this post? This action cannot be undone.")) return;
    deleteMutation.mutate();
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("More button clicked for post", post.id);
    setMenuOpen((s) => !s);
  };

  const isVideo = post.imageUrl?.includes("video") || post.imageUrl?.includes(".mp4");

  return (
    <Card className="w-full bg-card border border-border shadow-sm">
      {/* Post Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={post.user.avatar || ""} alt={post.user.displayName} />
            <AvatarFallback>{(post.user.displayName || "U")[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-sm" data-testid={`text-username-${post.id}`}>
              {post.user.displayName}
            </h3>
            <p className="text-xs text-muted-foreground" data-testid={`text-timestamp-${post.id}`}>
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <div className="flex items-center space-x-2">
            {post.isRecipe && (
              <Badge variant="secondary" className="bg-accent text-accent-foreground">
                Recipe
              </Badge>
            )}

            {/* More button */}
            <Button
              variant="ghost"
              size="sm"
              className="p-2 hover:bg-muted rounded-full"
              onClick={handleMoreClick}
              data-testid={`button-options-${post.id}`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Dropdown menu */}
          {menuOpen && (
            <div
              role="menu"
              aria-label="Post options"
              className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-md z-50"
              data-testid={`menu-${post.id}`}
            >
              <ul className="p-1">
                <li>
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-slate-100"
                    onClick={() => {
                      toast({ description: "Share functionality coming soon!" });
                      setMenuOpen(false);
                    }}
                    data-testid={`menu-share-${post.id}`}
                  >
                    Share
                  </button>
                </li>

                <li>
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-slate-100"
                    onClick={() => {
                      setIsLiked((s) => !s);
                      setMenuOpen(false);
                    }}
                    data-testid={`menu-like-${post.id}`}
                  >
                    {isLiked ? "Unlike" : "Like"}
                  </button>
                </li>

                {effectiveUserId === post.user?.id && (
                  <>
                    {/* NEW: EDIT POST BUTTON */}
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
      <div
        className="relative cursor-pointer"
        onClick={() => onCardClick?.(post)}
      >
        {isVideo ? (
          <video src={post.imageUrl} controls className="w-full h-96 object-cover" />
        ) : (
          <img src={post.imageUrl} alt="Post content" className="w-full h-96 object-cover" data-testid={`img-post-${post.id}`} />
        )}
      </div>

      {/* Post body / caption */}
      <div className="p-4">
        <p className="text-sm">{post.caption}</p>
      </div>

      {/* Footer / actions area (optional) */}
      <div className="p-4 border-t flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={() => setIsLiked((s) => !s)} data-testid={`button-like-${post.id}`}>
            {isLiked ? "♥" : "♡"} Like
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSaveClick} data-testid={`button-save-${post.id}`}>
            {isSaved ? "Saved" : "Save"}
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">{post.likesCount || 0} likes</div>
      </div>

      {/* NEW: MODAL FOR EDITING POST */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-1">Edit Post</h2>
              <p className="text-sm text-muted-foreground mb-4">Edit your caption and details.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  // Get the new caption from the textarea
                  const newCaption = (e.currentTarget.elements.namedItem('caption') as HTMLTextAreaElement).value;
                  editMutation.mutate({ caption: newCaption });
                }}
              >
                <div className="space-y-4">
                  <label className="text-sm font-medium">Caption</label>
                  <textarea // You may need to replace this with your Textarea UI component
                      name="caption"
                      defaultValue={post.caption}
                      rows={4}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={editMutation.isPending}
                  >
                    {editMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}
