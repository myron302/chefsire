import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Camera, Upload, Plus, Minus, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";

export default function CreatePost() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const [formData, setFormData] = useState({
    caption: "",
    imageUrl: "",
    tags: [""],
    isRecipe: false,
    recipeTitle: "",
    ingredients: [""],
    instructions: [""],
    cookTime: "",
    servings: "",
    difficulty: "Easy",
  });

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error("You must be logged in to create a post");
      }
      // Create the post
      const postData = {
        userId: user.id,
        caption: formData.caption,
        imageUrl: formData.imageUrl,
        tags: formData.tags.filter(tag => tag.trim() !== ""),
        isRecipe: formData.isRecipe,
      };

      const postResponse = await apiRequest("POST", "/api/posts", postData);
      const post = await postResponse.json();

      // If it's a recipe, create the recipe data
      if (formData.isRecipe && formData.recipeTitle) {
        const recipeData = {
          postId: post.id,
          title: formData.recipeTitle,
          ingredients: formData.ingredients.filter(ingredient => ingredient.trim() !== ""),
          instructions: formData.instructions.filter(instruction => instruction.trim() !== ""),
          cookTime: formData.cookTime ? parseInt(formData.cookTime) : null,
          servings: formData.servings ? parseInt(formData.servings) : null,
          difficulty: formData.difficulty,
        };

        await apiRequest("POST", "/api/recipes", recipeData);
      }

      return post;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        description: formData.isRecipe ? "Recipe shared successfully!" : "Post created successfully!",
      });
      setLocation("/feed");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        description: `Failed to create post: ${error.message}`,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.imageUrl.trim()) {
      toast({
        variant: "destructive",
        description: "Please add an image URL",
      });
      return;
    }

    if (formData.isRecipe && !formData.recipeTitle.trim()) {
      toast({
        variant: "destructive",
        description: "Please add a recipe title",
      });
      return;
    }

    createPostMutation.mutate();
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);

      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        // For demo purposes, we'll use the preview URL as the imageUrl
        // In production, you would upload this to a CDN/storage service
        handleChange("imageUrl", result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview("");
    handleChange("imageUrl", "");
  };

  const addTag = () => {
    setFormData(prev => ({ ...prev, tags: [...prev.tags, ""] }));
  };

  const removeTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  };

  const updateTag = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.map((tag, i) => i === index ? value : tag),
    }));
  };

  const addIngredient = () => {
    setFormData(prev => ({ ...prev, ingredients: [...prev.ingredients, ""] }));
  };

  const removeIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const updateIngredient = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ingredient, i) => i === index ? value : ingredient),
    }));
  };

  const addInstruction = () => {
    setFormData(prev => ({ ...prev, instructions: [...prev.instructions, ""] }));
  };

  const removeInstruction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index),
    }));
  };

  const updateInstruction = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions.map((instruction, i) => i === index ? value : instruction),
    }));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Create New Post</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image *</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                {imagePreview ? (
                  <div className="space-y-4">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full max-w-md mx-auto h-64 object-cover rounded-lg"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearImage}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remove Image
                    </Button>
                  </div>
                ) : (
                  <>
                    <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">Take a photo or choose from your device</p>
                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('camera-input')?.click()}
                        className="flex-1"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Camera
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('file-input')?.click()}
                        className="flex-1"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Photo
                      </Button>
                    </div>
                    <input
                      id="camera-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-camera"
                    />
                    <input
                      id="file-input"
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-file"
                    />
                    <p className="text-xs text-muted-foreground mb-2">or paste an image URL</p>
                    <Input
                      id="imageUrl"
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={formData.imageUrl}
                      onChange={(e) => {
                        const url = e.target.value;
                        handleChange("imageUrl", url);
                        if (url) {
                          setImagePreview(url);
                        }
                      }}
                      data-testid="input-image-url"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <Label htmlFor="caption">Caption</Label>
              <Textarea
                id="caption"
                placeholder="Write a caption for your post..."
                value={formData.caption}
                onChange={(e) => handleChange("caption", e.target.value)}
                rows={4}
                className="resize-none"
                data-testid="textarea-caption"
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="space-y-2">
                {formData.tags.map((tag, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      placeholder="Enter a tag (e.g., italian, pasta)"
                      value={tag}
                      onChange={(e) => updateTag(index, e.target.value)}
                      data-testid={`input-tag-${index}`}
                    />
                    {formData.tags.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeTag(index)}
                        data-testid={`button-remove-tag-${index}`}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTag}
                  className="w-full"
                  data-testid="button-add-tag"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tag
                </Button>
              </div>
            </div>

            {/* Recipe Toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isRecipe"
                checked={formData.isRecipe}
                onCheckedChange={(checked) => handleChange("isRecipe", checked)}
                data-testid="checkbox-is-recipe"
              />
              <Label htmlFor="isRecipe" className="text-sm font-medium">
                This is a recipe
              </Label>
            </div>

            {/* Recipe Details */}
            {formData.isRecipe && (
              <>
                <Separator />
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Recipe Details</h3>
                  
                  {/* Recipe Title */}
                  <div className="space-y-2">
                    <Label htmlFor="recipeTitle">Recipe Title *</Label>
                    <Input
                      id="recipeTitle"
                      placeholder="Enter recipe title"
                      value={formData.recipeTitle}
                      onChange={(e) => handleChange("recipeTitle", e.target.value)}
                      data-testid="input-recipe-title"
                    />
                  </div>

                  {/* Recipe Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cookTime">Cook Time (minutes)</Label>
                      <Input
                        id="cookTime"
                        type="number"
                        placeholder="30"
                        value={formData.cookTime}
                        onChange={(e) => handleChange("cookTime", e.target.value)}
                        data-testid="input-cook-time"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="servings">Servings</Label>
                      <Input
                        id="servings"
                        type="number"
                        placeholder="4"
                        value={formData.servings}
                        onChange={(e) => handleChange("servings", e.target.value)}
                        data-testid="input-servings"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="difficulty">Difficulty</Label>
                      <Select
                        value={formData.difficulty}
                        onValueChange={(value) => handleChange("difficulty", value)}
                      >
                        <SelectTrigger data-testid="select-difficulty">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Easy">Easy</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div className="space-y-2">
                    <Label>Ingredients</Label>
                    <div className="space-y-2">
                      {formData.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Input
                            placeholder="Enter ingredient (e.g., 2 cups flour)"
                            value={ingredient}
                            onChange={(e) => updateIngredient(index, e.target.value)}
                            data-testid={`input-ingredient-${index}`}
                          />
                          {formData.ingredients.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeIngredient(index)}
                              data-testid={`button-remove-ingredient-${index}`}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addIngredient}
                        className="w-full"
                        data-testid="button-add-ingredient"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Ingredient
                      </Button>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-2">
                    <Label>Instructions</Label>
                    <div className="space-y-2">
                      {formData.instructions.map((instruction, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <div className="flex-1">
                            <Textarea
                              placeholder={`Step ${index + 1}: Enter instruction`}
                              value={instruction}
                              onChange={(e) => updateInstruction(index, e.target.value)}
                              rows={2}
                              className="resize-none"
                              data-testid={`textarea-instruction-${index}`}
                            />
                          </div>
                          {formData.instructions.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeInstruction(index)}
                              className="mt-2"
                              data-testid={`button-remove-instruction-${index}`}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addInstruction}
                        className="w-full"
                        data-testid="button-add-instruction"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Instruction
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Submit Buttons */}
            <div className="flex items-center justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/feed")}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:opacity-90 px-8"
                disabled={createPostMutation.isPending}
                data-testid="button-share-post"
              >
                {createPostMutation.isPending 
                  ? "Sharing..." 
                  : formData.isRecipe 
                    ? "Share Recipe" 
                    : "Share Post"
                }
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
