import { useState } from "react";
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
  Signal
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PostWithUser } from "@shared/schema";

interface RecipeCardProps {
  post: PostWithUser;
  currentUserId?: string;
}

export default function RecipeCard({ post, currentUserId = "user-1" }: RecipeCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [showFullRecipe, setShowFullRecipe] = useState(false);

  const likeMutation = useMutation({
    mutationFn: async () => {
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
      setIsLiked(!isLiked);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const handleLike = () => {
    likeMutation.mutate();
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    toast({
      description: isSaved ? "Recipe unsaved" : "Recipe saved!",
    });
  };

  if (!post.recipe) {
    return null;
  }

  return (
    <Card className="w-full bg-card border border-border shadow-sm">
      {/* Recipe Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={post.user.avatar || ""} alt={post.user.displayName} />
            <AvatarFallback>{post.user.displayName[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-sm" data-testid={`text-chef-${post.id}`}>
              {post.user.displayName}
            </h3>
            <p className="text-xs text-muted-foreground" data-testid={`text-timestamp-${post.id}`}>
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        <Badge className="bg-accent text-accent-foreground">Recipe</Badge>
      </div>

      {/* Recipe Image */}
      <img 
        src={post.imageUrl} 
        alt={post.recipe.title} 
        className="w-full h-96 object-cover"
        data-testid={`img-recipe-${post.id}`}
      />

      {/* Recipe Content */}
      <CardContent className="p-4">
        <h2 className="text-lg font-bold mb-2" data-testid={`text-recipe-title-${post.id}`}>
          {post.recipe.title}
        </h2>
        
        {/* Recipe Stats */}
        <div className="flex items-center space-x-4 mb-4 text-sm text-muted-foreground">
          <span className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span data-testid={`text-cook-time-${post.id}`}>{post.recipe.cookTime} min</span>
          </span>
          <span className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span data-testid={`text-servings-${post.id}`}>{post.recipe.servings} servings</span>
          </span>
          <span className="flex items-center space-x-1">
            <Signal className="h-4 w-4" />
            <span data-testid={`text-difficulty-${post.id}`}>{post.recipe.difficulty}</span>
          </span>
        </div>

        {/* Ingredients Preview */}
        <div className="mb-4">
          <h4 className="font-semibold text-sm mb-2">Ingredients:</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            {showFullRecipe ? (
              post.recipe.ingredients.map((ingredient, index) => (
                <p key={index} data-testid={`ingredient-${index}-${post.id}`}>
                  • {ingredient}
                </p>
              ))
            ) : (
              <>
                {post.recipe.ingredients.slice(0, 3).map((ingredient, index) => (
                  <p key={index} data-testid={`ingredient-preview-${index}-${post.id}`}>
                    • {ingredient}
                  </p>
                ))}
                {post.recipe.ingredients.length > 3 && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowFullRecipe(true)}
                    className="text-primary text-xs p-0 h-auto hover:underline"
                    data-testid={`button-show-full-recipe-${post.id}`}
                  >
                    + View full recipe
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Full Recipe Instructions */}
        {showFullRecipe && (
          <div className="mb-4">
            <h4 className="font-semibold text-sm mb-2">Instructions:</h4>
            <div className="text-sm text-muted-foreground space-y-2">
              {post.recipe.instructions.map((instruction, index) => (
                <p key={index} data-testid={`instruction-${index}-${post.id}`}>
                  {index + 1}. {instruction}
                </p>
              ))}
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
              data-testid={`button-like-recipe-${post.id}`}
            >
              <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
              <span className="text-sm font-medium">{post.likesCount}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center space-x-1 text-muted-foreground hover:text-foreground p-0 h-auto"
              data-testid={`button-comment-recipe-${post.id}`}
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm">{post.commentsCount}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground p-0 h-auto"
              data-testid={`button-share-recipe-${post.id}`}
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
            data-testid={`button-save-recipe-${post.id}`}
          >
            <Bookmark className="h-4 w-4 mr-1" />
            {isSaved ? "Saved" : "Save Recipe"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
