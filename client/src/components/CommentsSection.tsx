import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

/**
 * A single comment record returned from the API.  Each comment includes
 * the author details for display purposes.
 */
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

/**
 * Props for the CommentsSection component.  A postId is required to fetch
 * comments for a particular post.  currentUserId should be passed if the
 * viewer is authenticated; it is used to determine like status and author
 * attribution when creating new comments.
 */
interface CommentsSectionProps {
  postId: string;
  currentUserId: string;
  /**
   * "modal" = full view (default). "inline" = compact feed view.
   */
  variant?: "modal" | "inline";
  /**
   * For inline mode, limit how many top-level comments are shown.
   */
  maxVisible?: number;
  /**
   * Show the composer (textarea + button). Default true.
   */
  showComposer?: boolean;
  /**
   * Optional handler to open the full post modal / comments view.
   */
  onViewAll?: () => void;
}

/**
 * The CommentsSection component lists all comments on a post and allows
 * authenticated users to add new comments and like or unlike existing
 * comments.  Each comment displays its author, timestamp, content, and
 * like information (including a preview of which users have liked it).
 */
export default function CommentsSection({
  postId,
  currentUserId,
  variant = "modal",
  maxVisible = 9999,
  showComposer = true,
  onViewAll,
}: CommentsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);

  // Fetch comments for the given post.  The query key includes the postId
  // so that comments are cached per-post.  We include credentials on the
  // request so that the API can determine the current user, if needed.
  const {
    data: comments = [],
    isLoading,
  } = useQuery<Comment[]>({
    queryKey: ["/api/posts", postId, "comments"],
    queryFn: async () => {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch comments");
      return response.json();
    },
  });

  const { topLevel, repliesByParent, visibleTopLevel, totalTopLevelCount } = useMemo(() => {
    const tl = comments.filter((c) => !c.parentCommentId);
    const map = new Map<string, Comment[]>();
    for (const c of comments) {
      if (!c.parentCommentId) continue;
      const arr = map.get(c.parentCommentId) ?? [];
      arr.push(c);
      map.set(c.parentCommentId, arr);
    }
    // Ensure stable order oldest->newest within each thread
    for (const [k, arr] of map) {
      arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      map.set(k, arr);
    }
    const visible = variant === "inline" ? tl.slice(0, Math.max(0, maxVisible)) : tl;
    return {
      topLevel: tl,
      repliesByParent: map,
      visibleTopLevel: visible,
      totalTopLevelCount: tl.length,
    };
  }, [comments, maxVisible, variant]);

  // Mutation for adding a new comment.  On success it invalidates the
  // comments query for this post to refresh the list and resets the text
  // box.  On failure it displays an error toast.
  const addCommentMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/posts/comments", {
        userId: currentUserId,
        postId,
        text,
        // Optional threaded replies (requires backend support).
        parentCommentId: replyTo?.id ?? null,
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Failed to add comment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts", postId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setCommentText("");
      setReplyTo(null);
      toast({ description: "Comment added!" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", description: `Failed to add comment: ${error.message}` });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (!currentUserId) {
      toast({ description: "Please log in to comment" });
      return;
    }
    addCommentMutation.mutate(commentText.trim());
  };

  const grouped = useMemo(() => {
    const byParent = new Map<string, Comment[]>();
    for (const c of comments) {
      const parent = c.parentCommentId;
      if (!parent) continue;
      const arr = byParent.get(parent) ?? [];
      arr.push(c);
      byParent.set(parent, arr);
    }
    const topLevel = comments.filter((c) => !c.parentCommentId);
    // Basic ordering: newest first for top-level; oldest first for replies
    topLevel.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    for (const [k, arr] of byParent.entries()) {
      arr.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
      byParent.set(k, arr);
    }
    return { topLevel, byParent };
  }, [comments]);

  /**
   * A nested component for displaying and interacting with a single comment.
   * It fetches the like status for the current user and the list of users
   * who have liked the comment.  Users can toggle their like by clicking
   * the heart button.  Queries are invalidated appropriately to refresh
   * state after a mutation.
   */
  function CommentItem({ comment }: { comment: Comment }) {
    // Determine if the current user has liked this comment
    const { data: likeStatus } = useQuery<{ isLiked: boolean }>({
      queryKey: ["/api/posts", "comments", "likes", currentUserId, comment.id],
      queryFn: async () => {
        if (!currentUserId) return { isLiked: false };
        try {
          const res = await fetch(`/api/posts/comments/likes/${currentUserId}/${comment.id}`, {
            credentials: "include",
          });
          if (!res.ok) return { isLiked: false };
          return res.json();
        } catch {
          return { isLiked: false };
        }
      },
      enabled: !!currentUserId,
    });

    // Retrieve list of users who have liked this comment
    const { data: likeUsers = [] } = useQuery<{
      id: string;
      displayName: string;
      avatar?: string;
    }[]>({
      queryKey: ["/api/posts", "comments", comment.id, "likes"],
      queryFn: async () => {
        try {
          const res = await fetch(`/api/posts/comments/${comment.id}/likes`, {
            credentials: "include",
          });
          if (!res.ok) return [];
          return res.json();
        } catch {
          return [];
        }
      },
    });

    // Mutation to toggle like/unlike on a comment
    const likeCommentMutation = useMutation({
      mutationFn: async (shouldLike: boolean) => {
        if (!currentUserId) throw new Error("Missing user");
        if (shouldLike) {
          const res = await apiRequest("POST", "/api/posts/comments/likes", {
            userId: currentUserId,
            commentId: comment.id,
          });
          if (!res.ok) {
            const msg = await res.text().catch(() => "");
            throw new Error(msg || "Failed to like comment");
          }
          return res.json();
        } else {
          const res = await apiRequest(
            "DELETE",
            `/api/posts/comments/likes/${currentUserId}/${comment.id}`
          );
          if (!res.ok) {
            const msg = await res.text().catch(() => "");
            throw new Error(msg || "Failed to unlike comment");
          }
          return res.json();
        }
      },
      onMutate: async (shouldLike: boolean) => {
        // Optimistically update local like status
        queryClient.setQueryData(
          ["/api/posts", "comments", "likes", currentUserId, comment.id],
          { isLiked: shouldLike }
        );
      },
      onSuccess: () => {
        // Invalidate queries to update counts and lists
        queryClient.invalidateQueries({ queryKey: ["/api/posts", postId, "comments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/posts", "comments", comment.id, "likes"] });
        queryClient.invalidateQueries({
          queryKey: ["/api/posts", "comments", "likes", currentUserId, comment.id],
        });
      },
      onError: (err: Error, shouldLike: boolean) => {
        // Revert optimistic update on failure
        queryClient.setQueryData(
          ["/api/posts", "comments", "likes", currentUserId, comment.id],
          { isLiked: !shouldLike }
        );
        toast({
          variant: "destructive",
          description: err.message || "Failed to update comment like status",
        });
      },
    });

    const handleLike = () => {
      if (!currentUserId) {
        toast({ description: "Please log in to like comments" });
        return;
      }
      likeCommentMutation.mutate(!(likeStatus?.isLiked));
    };

    const isLiked = likeStatus?.isLiked ?? false;

    return (
      <div className="flex space-x-2">
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage
            src={comment.user.avatar || ""}
            alt={comment.user.displayName}
          />
          <AvatarFallback>{(comment.user.displayName || "U")[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="bg-muted rounded-lg p-2">
            {/* Instagram-style: username and comment on the same line */}
            <p className="text-sm break-words">
              <span className="font-semibold mr-2">{comment.user.displayName}</span>
              {comment.content}
            </p>
          </div>
          <div className="flex items-center space-x-2 mt-1 text-xs text-muted-foreground">
            <span>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
            <button
              onClick={handleLike}
              className="focus:outline-none text-primary hover:underline"
            >
              {isLiked ? "♥" : "♡"} Like
            </button>
            <button
              onClick={() => {
                if (!currentUserId) {
                  toast({ description: "Please log in to reply" });
                  return;
                }
                setReplyTo({ id: comment.id, name: comment.user.displayName });
              }}
              className="focus:outline-none hover:underline"
            >
              Reply
            </button>
            {likeUsers.length > 0 && (
              <span className="text-muted-foreground">
                Liked by {likeUsers.slice(0, 2).map((u) => u.displayName).join(", ")}
                {likeUsers.length > 2 && ` and ${likeUsers.length - 2} others`}
              </span>
            )}
          </div>

          {/* Replies (threaded) */}
          {repliesByParent.get(comment.id)?.length ? (
            <div className="mt-2 ml-4 space-y-2">
              {repliesByParent.get(comment.id)!.slice(0, variant === "inline" ? 2 : 50).map((r) => (
                <div key={r.id} className="flex space-x-2">
                  <Avatar className="w-7 h-7 flex-shrink-0">
                    <AvatarImage src={r.user.avatar || ""} alt={r.user.displayName} />
                    <AvatarFallback>{(r.user.displayName || "U")[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="bg-muted rounded-lg p-2">
                      <p className="text-sm break-words">
                        <span className="font-semibold mr-2">{r.user.displayName}</span>
                        {r.content}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 mt-1 text-xs text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              ))}
              {variant === "inline" && (repliesByParent.get(comment.id)!.length > 2) && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={onViewAll}
                >
                  View all replies
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const listClasses =
    `space-y-3 overflow-y-auto ` +
    (variant === "modal" ? "mb-4 max-h-60" : "mb-3 max-h-40") +
    " [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  return (
    <div className={variant === "modal" ? "border-t pt-4" : "pt-3"}>
      {variant === "modal" && <h3 className="font-semibold text-sm mb-3">Comments</h3>}

      {/* Comments list (scrolls, but scrollbar is hidden like Instagram) */}
      <div className={listClasses}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading comments...</p>
        ) : totalTopLevelCount === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
        ) : (
          visibleTopLevel.map((comment) => <CommentItem key={comment.id} comment={comment} />)
        )}
      </div>

      {variant === "inline" && !!onViewAll && totalTopLevelCount > 3 && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:underline mb-2"
          onClick={onViewAll}
        >
          View all {totalTopLevelCount} comments
        </button>
      )}

      {/* Add comment / reply */}
      {showComposer && (
        <form onSubmit={handleSubmit} className="space-y-2">
          {replyTo && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Replying to <span className="font-semibold">{replyTo.name}</span></span>
              <button
                type="button"
                className="hover:underline"
                onClick={() => setReplyTo(null)}
              >
                Cancel
              </button>
            </div>
          )}
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={replyTo ? `Reply to ${replyTo.name}...` : "Write a comment..."}
            className="resize-none text-sm"
            rows={variant === "modal" ? 2 : 1}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!commentText.trim() || addCommentMutation.isPending}
            className="w-full"
          >
            {addCommentMutation.isPending ? "Posting..." : replyTo ? "Reply" : "Post Comment"}
          </Button>
        </form>
      )}
    </div>
  );
}
