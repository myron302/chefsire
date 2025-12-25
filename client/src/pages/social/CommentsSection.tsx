import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

interface CommentUser {
  id: string;
  displayName: string;
  avatar?: string;
}

interface Comment {
  id: string;
  userId: string;
  postId: string;
  parentId?: string | null;
  content: string;
  createdAt: string;
  user: CommentUser;
}

interface CommentsSectionProps {
  postId: string;
  currentUserId: string;
}

export default function CommentsSection({ postId, currentUserId }: CommentsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // CSS to hide scrollbar (Instagram-style). No global CSS edits required.
  const ScrollbarStyle = () => (
    <style>{`
      .cs-no-scrollbar::-webkit-scrollbar { display: none; }
      .cs-no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
  );

  // Fetch comments
  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ["/api/posts", postId, "comments"],
    queryFn: async () => {
      const response = await fetch(`/api/posts/${postId}/comments`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch comments");
      return response.json();
    },
  });

  // Build a threaded tree: parentId -> children[]
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Comment[]>();
    for (const c of comments) {
      const key = (c.parentId ?? null) as string | null;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    // Sort each thread by createdAt (oldest first)
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      map.set(k, arr);
    }
    return map;
  }, [comments]);

  function focusInput() {
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // Add comment / reply
  const addCommentMutation = useMutation({
    mutationFn: async (text: string) => {
      const payload = {
        userId: currentUserId,
        postId,
        parentId: replyTo?.id ?? null,
        text,
      };
      const res = await apiRequest("POST", "/api/posts/comments", payload);
      const body = await res.text();
      if (!res.ok) throw new Error(body || "Failed to add comment");
      return body ? JSON.parse(body) : null;
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

  function CommentItem({ comment, depth }: { comment: Comment; depth: number }) {
    // Like status (current user)
    const { data: likeStatus } = useQuery<{ isLiked: boolean }>({
      queryKey: ["/api/posts", "comments", "likes", currentUserId, comment.id],
      queryFn: async () => {
        if (!currentUserId) return { isLiked: false };
        const res = await fetch(`/api/posts/comments/likes/${currentUserId}/${comment.id}`, {
          credentials: "include",
        });
        if (!res.ok) return { isLiked: false };
        return res.json();
      },
      enabled: !!currentUserId,
    });

    // Who liked this comment
    const { data: likeUsers = [] } = useQuery<CommentUser[]>({
      queryKey: ["/api/posts", "comments", comment.id, "likes"],
      queryFn: async () => {
        const res = await fetch(`/api/posts/comments/${comment.id}/likes`, { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      },
    });

    const likeMutation = useMutation({
      mutationFn: async (shouldLike: boolean) => {
        if (!currentUserId) throw new Error("Please log in to like comments");
        if (shouldLike) {
          const res = await apiRequest("POST", "/api/posts/comments/likes", {
            userId: currentUserId,
            commentId: comment.id,
          });
          const body = await res.text();
          if (!res.ok) throw new Error(body || "Failed to like comment");
          return body ? JSON.parse(body) : null;
        } else {
          const res = await apiRequest("DELETE", `/api/posts/comments/likes/${currentUserId}/${comment.id}`);
          const body = await res.text();
          if (!res.ok) throw new Error(body || "Failed to unlike comment");
          return body ? JSON.parse(body) : null;
        }
      },
      onMutate: async (shouldLike) => {
        queryClient.setQueryData(
          ["/api/posts", "comments", "likes", currentUserId, comment.id],
          { isLiked: shouldLike }
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/posts", postId, "comments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/posts", "comments", comment.id, "likes"] });
        queryClient.invalidateQueries({
          queryKey: ["/api/posts", "comments", "likes", currentUserId, comment.id],
        });
      },
      onError: (err: Error, shouldLike) => {
        // revert optimistic
        queryClient.setQueryData(
          ["/api/posts", "comments", "likes", currentUserId, comment.id],
          { isLiked: !shouldLike }
        );
        toast({
          variant: "destructive",
          description: `Failed to update comment like status: ${err.message}`,
        });
      },
    });

    const isLiked = likeStatus?.isLiked ?? false;

    const likedPreview =
      likeUsers.length === 0
        ? ""
        : `Liked by ${likeUsers.slice(0, 2).map((u) => u.displayName).join(", ")}${
            likeUsers.length > 2 ? ` and ${likeUsers.length - 2} others` : ""
          }`;

    const children = childrenByParent.get(comment.id) ?? [];

    return (
      <div
        className="flex space-x-2"
        style={{
          marginLeft: depth * 16,
        }}
      >
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={comment.user.avatar || ""} alt={comment.user.displayName} />
          <AvatarFallback>{(comment.user.displayName || "U")[0]}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="bg-muted rounded-lg px-3 py-2">
            <span className="font-semibold text-xs mr-2">{comment.user.displayName}</span>
            <span className="text-sm break-words">{comment.content}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
            <span>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>

            <button
              type="button"
              onClick={() => likeMutation.mutate(!isLiked)}
              className="focus:outline-none text-primary hover:underline"
            >
              {isLiked ? "♥" : "♡"} Like
            </button>

            <button
              type="button"
              onClick={() => {
                setReplyTo({ id: comment.id, name: comment.user.displayName });
                focusInput();
              }}
              className="focus:outline-none hover:underline"
            >
              Reply
            </button>

            {likedPreview && <span className="text-muted-foreground">{likedPreview}</span>}
          </div>

          {/* Children (replies) */}
          {children.length > 0 && (
            <div className="mt-2 space-y-3 border-l pl-3">
              {children.map((child) => (
                <CommentItem key={child.id} comment={child} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const topLevel = childrenByParent.get(null) ?? [];

  return (
    <div className="border-t pt-4">
      <ScrollbarStyle />

      <h3 className="font-semibold text-sm mb-3">Comments</h3>

      {/* Comments list (scroll + hidden scrollbar) */}
      <div className="cs-no-scrollbar space-y-3 mb-4 max-h-60 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading comments...</p>
        ) : topLevel.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
        ) : (
          topLevel.map((comment) => <CommentItem key={comment.id} comment={comment} depth={0} />)
        )}
      </div>

      {/* Reply indicator */}
      {replyTo && (
        <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
          <span>
            Replying to <span className="font-semibold">{replyTo.name}</span>
          </span>
          <button type="button" className="hover:underline" onClick={() => setReplyTo(null)}>
            Cancel
          </button>
        </div>
      )}

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          ref={inputRef}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={replyTo ? `Reply to ${replyTo.name}...` : "Write a comment..."}
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
