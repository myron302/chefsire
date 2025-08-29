import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Camera, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreatePostModal({ open, onOpenChange }: CreatePostModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    caption: "",
    imageUrl: "",
    tags: "",
    isRecipe: false,
    recipeTitle: "",
    ingredients: "",
    instructions: "",
    cookTime: "",
    servings: "",
    difficulty: "Easy",
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/posts", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        description: "Post created successfully!",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Failed to create post",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      caption: "",
      imageUrl: "",
      tags: "",
      isRecipe: false,
      recipeTitle: "",
      ingredients: "",
      instructions: "",
      cookTime: "",
      servings: "",
      difficulty: "Easy",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.imageUrl) {
      toast({
        variant: "destructive",
        description: "Please add an image URL",
      });
      return;
    }

    const postData = {
      userId: "user-1", // In a real app, this would come from authentication
      caption: formData.caption,
      imageUrl: formData.imageUrl,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      isRecipe: formData.isRecipe,
    };

    createPostMutation.mutate(postData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Post</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image Upload Placeholder */}
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-2">Add image URL</p>
            <Input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={formData.imageUrl}
              onChange={(e) => handleChange("imageUrl", e.target.value)}
              className="mt-2"
              data-testid="input-image-url"
            />
          </div>

          {/* Caption */}
          <Textarea
            placeholder="Write a caption..."
            value={formData.caption}
            onChange={(e) => handleChange("caption", e.target.value)}
            rows={3}
            className="resize-none"
            data-testid="textarea-caption"
          />

          {/* Recipe Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isRecipe"
              checked={formData.isRecipe}
              onCheckedChange={(checked) => handleChange("isRecipe", checked)}
              data-testid="checkbox-is-recipe"
            />
            <Label htmlFor="isRecipe" className="text-sm">This is a recipe</Label>
          </div>

          {/* Recipe Details */}
          {formData.isRecipe && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <Input
                placeholder="Recipe title"
                value={formData.recipeTitle}
                onChange={(e) => handleChange("recipeTitle", e.target.value)}
                data-testid="input-recipe-title"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Cook time (min)"
                  type="number"
                  value={formData.cookTime}
                  onChange={(e) => handleChange("cookTime", e.target.value)}
                  data-testid="input-cook-time"
                />
                <Input
                  placeholder="Servings"
                  type="number"
                  value={formData.servings}
                  onChange={(e) => handleChange("servings", e.target.value)}
                  data-testid="input-servings"
                />
              </div>
              <Textarea
                placeholder="Ingredients (one per line)"
                value={formData.ingredients}
                onChange={(e) => handleChange("ingredients", e.target.value)}
                rows={3}
                data-testid="textarea-ingredients"
              />
              <Textarea
                placeholder="Instructions (one per line)"
                value={formData.instructions}
                onChange={(e) => handleChange("instructions", e.target.value)}
                rows={3}
                data-testid="textarea-instructions"
              />
            </div>
          )}

          {/* Tags */}
          <Input
            placeholder="Add tags (e.g., italian, pasta, homemade)"
            value={formData.tags}
            onChange={(e) => handleChange("tags", e.target.value)}
            data-testid="input-tags"
          />

          {/* Submit */}
          <Button 
            type="submit" 
            className="w-full bg-primary text-primary-foreground hover:opacity-90"
            disabled={createPostMutation.isPending}
            data-testid="button-share-post"
          >
            {createPostMutation.isPending ? "Sharing..." : "Share Post"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
