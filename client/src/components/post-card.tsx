import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Heart, 
  MessageCircle, 
  Share, 
  Bookmark, 
  MoreHorizontal,
  Play,
  Trash2,
  ImageOff
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import type { PostWithUser } from "@shared/schema";

interface PostCardProps {
  post: PostWithUser;
  currentUserId?: string;
}

export default function PostCard({ post, currentUserId }: PostCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);

  // Use the actual current user ID from context
  const actualUserId = user?.id || currentUserId || "user-1";
  
  // Check if current user owns this post
  const isOwner = actualUserId === post.userId;

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (isLiked) {
        await apiRequest("DELETE", `/api/posts/likes/${actualUserId}/${post.id}`);
      } else {
        await apiRequest("POST", "/api/posts/likes", {
          userId: actualUserId,
          postId: post.id,
        });
      }
    },
    onSuccess: () => {
      setIsLiked(!isLiked);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        description: isLiked ? "Post unliked" : "Post liked!",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Failed to update like status",
      });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/posts/${post.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        description: "Post deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.message || "Failed to delete post",
      });
    },
  });

  const removeMediaMutation = useMutation({
    mutationFn: async () => {
      // Extract filename from image URL
      if (post.imageUrl && (post.imageUrl.startsWith('/uploads/') || post.imageUrl.includes('/uploads/'))) {
        const urlParts = post.imageUrl.split('/uploads/');
        if (urlParts.length > 1) {
          const filename = urlParts[1].split('?')[0];
          
          // Delete the file from server
          await apiRequest("DELETE", `/api/upload/${filename}`);
        }
      }
      
      // Update post to remove imageUrl
      await apiRequest("PATCH", `/api/posts/${post.id}`, {
        imageUrl: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        description: "Media removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.message || "Failed to remove media",
      });
    },
  });

  const handleLike = () => {
    likeMutation.mutate();
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
      deletePostMutation.mutate();
    }
  };

  const handleRemoveMedia = () => {
    if (window.confirm("Are you sure you want to remove the media from this post? The post will remain but without the image/video.")) {
      removeMediaMutation.mutate();
    }
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    toast({
      description: isSaved ? "Post unsaved" : "Post saved!",
    });
  };

  const handleShare = () => {
    toast({
      description: "Share functionality coming soon!",
    });
  };

  const isVideo = post.imageUrl.includes("video") || post.imageUrl.includes(".mp4");

  return (
    <Card className="w-full bg-card border border-border shadow-sm">
      {/* Post Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={post.user.avatar || ""} alt={post.user.displayName} />
            <AvatarFallback>{post.user.displayName[0]}</AvatarFallback>
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
        <div className="flex items-center space-x-2">
          {post.isRecipe && (
            <Badge variant="secondary" className="bg-accent text-accent-foreground">
              Recipe
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-2 hover:bg-muted rounded-full"
                data-testid={`button-options-${post.id}`}
              >
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isOwner && (
                <>
                  <DropdownMenuItem 
                    onClick={handleDelete}
                    className="text-destructive focus:text-destructive cursor-pointer"
                    data-testid={`button-delete-${post.id}`}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Post
                  </DropdownMenuItem>
                  {post.imageUrl && (post.imageUrl.startsWith('/uploads/') || post.imageUrl.includes('/uploads/')) && (
                    <DropdownMenuItem 
                      onClick={handleRemoveMedia}
                      className="cursor-pointer"
                      data-testid={`button-remove-media-${post.id}`}
                    >
                      <ImageOff className="mr-2 h-4 w-4" />
                      Remove Media
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem className="cursor-pointer">
                Share
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Post Image/Video */}
      <div className="relative">
        <img 
          src={post.imageUrl} 
          alt="Post content" 
          className="w-full h-96 object-cover"
          data-testid={`img-post-${post.id}`}
        />
        {isVideo && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <Button 
              variant="ghost"
              className="w-16 h-16 bg-white/90 rounded-full hover:bg-white"
              data-testid={`button-play-${post.id}`}
            >
              <Play className="h-6 w-6 text-gray-800 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Post Content */}
      <CardContent className="p-4">
        {/* Actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={`flex items-center space-x-1 p-0 h-auto ${
                isLiked ? "text-destructive" : "text-muted-foreground hover:text-destructive"
              }`}
              data-testid={`button-like-${post.id}`}
            >
              <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
              <span className="text-sm font-medium">{post.likesCount}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center space-x-1 text-muted-foreground hover:text-foreground p-0 h-auto"
              data-testid={`button-comment-${post.id}`}
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm">{post.commentsCount}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="text-muted-foreground hover:text-foreground p-0 h-auto"
              data-testid={`button-share-${post.id}`}
            >
              <Share className="h-5 w-5" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            className={`p-0 h-auto ${
              isSaved ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`}
            data-testid={`button-save-${post.id}`}
          >
            <Bookmark className={`h-5 w-5 ${isSaved ? "fill-current" : ""}`} />
          </Button>
        </div>

        {/* Caption */}
        {post.caption && (
          <div className="space-y-2">
            <p className="text-sm" data-testid={`text-caption-${post.id}`}>
              <span className="font-semibold">{post.user.displayName}</span> {post.caption}
            </p>
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {post.tags.map((tag, index) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="text-xs text-secondary bg-secondary/10 border-secondary/20"
                    data-testid={`tag-${tag}-${post.id}`}
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
