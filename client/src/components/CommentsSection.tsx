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
}

/**
 * The CommentsSection component lists all comments on a post and allows
 * authenticated users to add new comments and like or unlike existing
 * comments.  Each comment displays its author, timestamp, content, and
 * like information (including a preview of which users have liked it).
 */
export default function CommentsSection({ postId, currentUserId }: CommentsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");

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

  // Mutation for adding a new comment.  On success it invalidates the
  // comments query for this post to refresh the list and resets the text
  // box.  On failure it displays an error toast.
  const addCommentMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/posts/comments", {
        userId: currentUserId,
        postId,
        text,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts", postId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setCommentText("");
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
          const res = await fetch(`/api/posts/comments/likes/${currentUserId}/${comment.id}`);
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
          const res = await fetch(`/api/posts/comments/${comment.id}/likes`);
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
          if (!res.ok) throw new Error("Failed to like comment");
          return res.json();
        } else {
          const res = await apiRequest(
            "DELETE",
            `/api/posts/comments/likes/${currentUserId}/${comment.id}`
          );
          if (!res.ok) throw new Error("Failed to unlike comment");
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
        toast({ variant: "destructive", description: "Failed to update comment like status" });
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
            <p className="font-semibold text-xs">{comment.user.displayName}</p>
            <p className="text-sm">{comment.content}</p>
          </div>
          <div className="flex items-center space-x-2 mt-1 text-xs text-muted-foreground">
            <span>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
            <button
              onClick={handleLike}
              className="focus:outline-none text-primary hover:underline"
            >
              {isLiked ? "♥" : "♡"} Like
            </button>
            {likeUsers.length > 0 && (
              <span className="text-muted-foreground">
                Liked by {likeUsers.slice(0, 2).map((u) => u.displayName).join(", ")}
                {likeUsers.length > 2 && ` and ${likeUsers.length - 2} others`}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t pt-4">
      <h3 className="font-semibold text-sm mb-3">Comments</h3>
      {/* Comments list */}
      <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment) => <CommentItem key={comment.id} comment={comment} />)
        )}
      </div>
      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write a comment..."
          className="resize-none text-sm"
          rows={2}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!commentText.trim() || addCommentMutation.isPending}
          className="w-full"
        >
          {addCommentMutation.isPending ? "Posting..." : "Post Comment"}
        </Button>
      </form>
    </div>
  );
}
