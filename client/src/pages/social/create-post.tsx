import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Camera, Upload, Plus, Minus, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";

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

type PostType = "post" | "recipe" | "review";
type IngredientRow = { amount: string; unit: string; name: string };

function ingredientRowsToStrings(rows: IngredientRow[]): string[] {
  return rows
    .map((r) =>
      [r.amount, r.unit, r.name]
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .join(" ")
        .trim()
    )
    .filter(Boolean);
}

function normalizeSteps(steps: string[]): string[] {
  return steps.map((s) => (s ?? "").trim()).filter(Boolean);
}

export default function CreatePost() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user } = useUser();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const [formData, setFormData] = useState({
    postType: "post" as PostType,
    caption: "",
    imageUrl: "",
    tags: [""],
    // Recipe fields
    recipeTitle: "",
    ingredients: [{ amount: "", unit: "", name: "" }] as IngredientRow[],
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

      const isRecipe = formData.postType === "recipe";

      // Treat review as normal post, but tag it so you can badge it in UI
      const baseTags = formData.tags.map((t) => t.trim()).filter(Boolean);
      const tags =
        formData.postType === "review"
          ? Array.from(new Set([...baseTags, "review"]))
          : baseTags;

      // Create the post
      const postData = {
        userId: user.id,
        caption: formData.caption,
        imageUrl: formData.imageUrl,
        tags,
        isRecipe,
      };

      const postResponse = await apiRequest("POST", "/api/posts", postData);
      if (!postResponse.ok) {
        const err = await postResponse.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to create post");
      }
      const post = await postResponse.json();

      // If it's a recipe, create the recipe data (linked to post.id)
      if (isRecipe && formData.recipeTitle) {
        const ingredients = ingredientRowsToStrings(formData.ingredients);
        const instructions = normalizeSteps(formData.instructions);

        const recipeData = {
          postId: post.id,
          title: formData.recipeTitle,
          ingredients,
          instructions,
          cookTime: formData.cookTime ? parseInt(formData.cookTime) : null,
          servings: formData.servings ? parseInt(formData.servings) : null,
          difficulty: formData.difficulty,
          imageUrl: formData.imageUrl || null,
        };

        const recipeRes = await apiRequest("POST", "/api/recipes", recipeData);
        if (!recipeRes.ok) {
          const err = await recipeRes.json().catch(() => ({}));
          throw new Error(err?.message || "Failed to create recipe");
        }
      }

      return post;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        description:
          formData.postType === "recipe"
            ? "Recipe shared successfully!"
            : formData.postType === "review"
            ? "Review posted successfully!"
            : "Post created successfully!",
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
        description: "Please add an image (upload or URL)",
      });
      return;
    }

    if (formData.postType === "recipe") {
      if (!formData.recipeTitle.trim()) {
        toast({
          variant: "destructive",
          description: "Please add a recipe title",
        });
        return;
      }

      const ingredients = ingredientRowsToStrings(formData.ingredients);
      const instructions = normalizeSteps(formData.instructions);

      if (ingredients.length === 0) {
        toast({
          variant: "destructive",
          description: "Please add at least one ingredient",
        });
        return;
      }
      if (instructions.length === 0) {
        toast({
          variant: "destructive",
          description: "Please add at least one instruction step",
        });
        return;
      }
    }

    createPostMutation.mutate();
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        // Store as data URL (same pattern used elsewhere in your app)
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

  const addTag = () =>
    setFormData((prev) => ({ ...prev, tags: [...prev.tags, ""] }));

  const removeTag = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  };

  const updateTag = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.map((tag, i) => (i === index ? value : tag)),
    }));
  };

  const addIngredient = () => {
    setFormData((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { amount: "", unit: "", name: "" }],
    }));
  };

  const removeIngredient = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      ingredients:
        prev.ingredients.length <= 1
          ? prev.ingredients
          : prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const updateIngredient = (index: number, patch: Partial<IngredientRow>) => {
    setFormData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((row, i) =>
        i === index ? { ...row, ...patch } : row
      ),
    }));
  };

  const addInstruction = () => {
    setFormData((prev) => ({ ...prev, instructions: [...prev.instructions, ""] }));
  };

  const removeInstruction = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      instructions:
        prev.instructions.length <= 1
          ? prev.instructions
          : prev.instructions.filter((_, i) => i !== index),
    }));
  };

  const updateInstruction = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      instructions: prev.instructions.map((instruction, i) =>
        i === index ? value : instruction
      ),
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
            {/* Post Type */}
            <div className="space-y-2">
              <Label>Post type</Label>
              <Select
                value={formData.postType}
                onValueChange={(v) => handleChange("postType", v as PostType)}
              >
                <SelectTrigger data-testid="select-post-type">
                  <SelectValue placeholder="Choose type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">Post</SelectItem>
                  <SelectItem value="recipe">Recipe</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                        target.style.display = "none";
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
                    <p className="text-sm text-muted-foreground mb-4">
                      Take a photo or choose from your device
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          document.getElementById("camera-input")?.click()
                        }
                        className="flex-1"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Camera
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          document.getElementById("file-input")?.click()
                        }
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

                    <p className="text-xs text-muted-foreground mb-2">
                      or paste an image URL
                    </p>
                    <Input
                      id="imageUrl"
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={formData.imageUrl}
                      onChange={(e) => {
                        const url = e.target.value;
                        handleChange("imageUrl", url);
                        if (url) setImagePreview(url);
                      }}
                      data-testid="input-image-url"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <Label htmlFor="caption">
                {formData.postType === "review" ? "Review" : "Caption"}
              </Label>
              <Textarea
                id="caption"
                placeholder={
                  formData.postType === "review"
                    ? "Write your review..."
                    : "Write a caption for your post..."
                }
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

            {formData.postType === "recipe" && (
              <>
                <Separator />

                {/* Recipe Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Recipe Details</h3>

                  <div className="space-y-2">
                    <Label htmlFor="recipeTitle">Recipe Title *</Label>
                    <Input
                      id="recipeTitle"
                      placeholder="Enter the recipe name"
                      value={formData.recipeTitle}
                      onChange={(e) => handleChange("recipeTitle", e.target.value)}
                      data-testid="input-recipe-title"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cookTime">Cook Time (minutes)</Label>
                      <Input
                        id="cookTime"
                        type="number"
                        inputMode="numeric"
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
                        inputMode="numeric"
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
                    <div className="flex items-center justify-between">
                      <Label>Ingredients *</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addIngredient}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {formData.ingredients.map((row, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-12 gap-2 items-center"
                        >
                          <div className="col-span-4 sm:col-span-3">
                            <Select
                              value={row.amount}
                              onValueChange={(v) =>
                                updateIngredient(index, { amount: v })
                              }
                            >
                              <SelectTrigger
                                className="h-9"
                                data-testid={`select-ingredient-amount-${index}`}
                              >
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
                                updateIngredient(index, { unit: v })
                              }
                            >
                              <SelectTrigger
                                className="h-9"
                                data-testid={`select-ingredient-unit-${index}`}
                              >
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
                              placeholder="Ingredient"
                              value={row.name}
                              onChange={(e) =>
                                updateIngredient(index, { name: e.target.value })
                              }
                              className="h-9"
                              data-testid={`input-ingredient-name-${index}`}
                            />
                          </div>

                          <div className="col-span-12 sm:col-span-1 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeIngredient(index)}
                              disabled={formData.ingredients.length <= 1}
                              data-testid={`button-remove-ingredient-${index}`}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Instructions *</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addInstruction}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add step
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {formData.instructions.map((instruction, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Input
                            placeholder={`Step ${index + 1}`}
                            value={instruction}
                            onChange={(e) =>
                              updateInstruction(index, e.target.value)
                            }
                            data-testid={`input-instruction-${index}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeInstruction(index)}
                            disabled={formData.instructions.length <= 1}
                            data-testid={`button-remove-instruction-${index}`}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={createPostMutation.isPending}
              data-testid="button-submit-post"
            >
              {createPostMutation.isPending ? "Posting..." : "Post"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
