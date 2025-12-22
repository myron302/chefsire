import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  userId: string;
  postId: string;
  text: string;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    avatar?: string;
  };
}

interface CommentsSectionProps {
  postId: string;
  currentUserId: string;
}

export default function CommentsSection({ postId, currentUserId }: CommentsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");

  // Fetch comments
  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ["/api/posts", postId, "comments"],
    queryFn: async () => {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch comments");
      return response.json();
    },
  });

  // Add comment mutation
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
          comments.map((comment) => (
            <div key={comment.id} className="flex space-x-2">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={comment.user.avatar || ""} alt={comment.user.displayName} />
                <AvatarFallback>{(comment.user.displayName || "U")[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="bg-muted rounded-lg p-2">
                  <p className="font-semibold text-xs">{comment.user.displayName}</p>
                  <p className="text-sm">{comment.text}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
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
