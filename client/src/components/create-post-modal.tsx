import { useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, X, Plus, Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";

type PostType = "post" | "recipe" | "review";

type IngredientRow = {
  name: string;
  amount: string;
  unit: string;
};

const MEASUREMENT_UNITS = [
  "tsp",
  "tbsp",
  "cup",
  "fl oz",
  "oz",
  "lb",
  "g",
  "kg",
  "ml",
  "l",
  "pinch",
  "dash",
  "to taste",
  "piece(s)",
] as const;

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreatePostModal({ open, onOpenChange }: CreatePostModalProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const [postType, setPostType] = useState<PostType>("post");

  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");

  // Recipe fields
  const [recipeTitle, setRecipeTitle] = useState("");
  const [cookTime, setCookTime] = useState<string>("");
  const [servings, setServings] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("Easy");
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { name: "", amount: "", unit: "cup" },
  ]);
  const [instructions, setInstructions] = useState<string[]>([""]);

  // Review fields
  const [reviewSubject, setReviewSubject] = useState("");
  const [reviewRating, setReviewRating] = useState<string>("5");
  const [reviewPros, setReviewPros] = useState("");
  const [reviewCons, setReviewCons] = useState("");
  const [reviewVerdict, setReviewVerdict] = useState("");

  const cleanedTags = useMemo(
    () => tags.split(",").map((t) => t.trim()).filter(Boolean),
    [tags]
  );

  const createPostMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/posts", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ description: "Post created successfully!" });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        description: `Failed to create post: ${error.message}`,
      });
    },
  });

  const resetForm = () => {
    setPostType("post");
    setCaption("");
    setImageUrl("");
    setTags("");

    setRecipeTitle("");
    setCookTime("");
    setServings("");
    setDifficulty("Easy");
    setIngredients([{ name: "", amount: "", unit: "cup" }]);
    setInstructions([""]);

    setReviewSubject("");
    setReviewRating("5");
    setReviewPros("");
    setReviewCons("");
    setReviewVerdict("");

    setImageFile(null);
    setImagePreview("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      // NOTE: demo uses base64 as imageUrl; in production upload to storage/CDN
      setImageUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const buildRecipePayload = () => {
    const ingredientLines = ingredients
      .map((r) => {
        const name = r.name.trim();
        if (!name) return "";
        const amount = r.amount.trim();
        const unit = r.unit.trim();
        const left = [amount, unit].filter(Boolean).join(" ").trim();
        return left ? `${left} ${name}` : name;
      })
      .filter(Boolean);

    const steps = instructions.map((s) => s.trim()).filter(Boolean);

    return {
      title: recipeTitle.trim(),
      imageUrl: imageUrl || undefined,
      ingredients: ingredientLines,
      instructions: steps,
      cookTime: cookTime ? Number(cookTime) : undefined,
      servings: servings ? Number(servings) : undefined,
      difficulty: difficulty || undefined,
    };
  };

  const buildReviewCaption = () => {
    const rating = Number(reviewRating || "0");
    const stars = "★★★★★".slice(0, Math.max(0, Math.min(5, rating))) + "☆☆☆☆☆".slice(0, 5 - Math.max(0, Math.min(5, rating)));
    const parts: string[] = [];
    parts.push(`REVIEW • ${reviewSubject.trim() || "Untitled"}`);
    parts.push(`${stars} (${rating}/5)`);
    if (reviewPros.trim()) parts.push(`Pros: ${reviewPros.trim()}`);
    if (reviewCons.trim()) parts.push(`Cons: ${reviewCons.trim()}`);
    if (reviewVerdict.trim()) parts.push(`Verdict: ${reviewVerdict.trim()}`);
    if (caption.trim()) parts.push(`\n${caption.trim()}`);
    return parts.join("\n");
  };

  const validate = () => {
    if (!user?.id) {
      toast({ variant: "destructive", description: "You must be logged in to create a post" });
      return false;
    }
    if (!imageUrl) {
      toast({ variant: "destructive", description: "Please add an image (upload or paste URL)" });
      return false;
    }

    if (postType === "recipe") {
      if (!recipeTitle.trim()) {
        toast({ variant: "destructive", description: "Please add a recipe title" });
        return false;
      }
      const payload = buildRecipePayload();
      if (!payload.ingredients.length) {
        toast({ variant: "destructive", description: "Please add at least 1 ingredient" });
        return false;
      }
      if (!payload.instructions.length) {
        toast({ variant: "destructive", description: "Please add at least 1 instruction step" });
        return false;
      }
    }

    if (postType === "review") {
      if (!reviewSubject.trim()) {
        toast({ variant: "destructive", description: "Please add what you're reviewing (subject)" });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const baseTags = [...cleanedTags];
    const payload: any = {
      userId: user!.id,
      imageUrl,
      tags: baseTags,
      caption: caption,
      isRecipe: postType === "recipe",
    };

    if (postType === "recipe") {
      payload.recipe = buildRecipePayload();
      // Helpful tags
      if (!payload.tags.includes("Recipe")) payload.tags.push("Recipe");
    }

    if (postType === "review") {
      payload.caption = buildReviewCaption();
      if (!payload.tags.includes("Review")) payload.tags.push("Review");
    }

    createPostMutation.mutate(payload);
  };

  const updateIngredient = (idx: number, patch: Partial<IngredientRow>) => {
    setIngredients((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const addIngredient = () => setIngredients((prev) => [...prev, { name: "", amount: "", unit: "tbsp" }]);
  const removeIngredient = (idx: number) =>
    setIngredients((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const updateInstruction = (idx: number, value: string) => {
    setInstructions((prev) => prev.map((s, i) => (i === idx ? value : s)));
  };
  const addInstruction = () => setInstructions((prev) => [...prev, ""]);
  const removeInstruction = (idx: number) =>
    setInstructions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Post</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image Upload */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />

            {imagePreview ? (
              <div className="space-y-2">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-h-48 object-cover rounded-lg mx-auto"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview("");
                    setImageUrl("");
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Take a photo or choose from library</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("camera-input")?.click()}
                    className="flex-1"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Camera
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("file-input")?.click()}
                    className="flex-1"
                  >
                    Upload
                  </Button>
                </div>

                <input
                  id="camera-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <p className="text-xs text-muted-foreground">or paste URL</p>
                <Input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    if (e.target.value) setImagePreview(e.target.value);
                  }}
                />
              </div>
            )}
          </div>

          {/* Post Type */}
          <div className="space-y-2">
            <Label className="text-sm">Post Type</Label>
            <Select value={postType} onValueChange={(v) => setPostType(v as PostType)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="post">Post</SelectItem>
                <SelectItem value="recipe">Recipe</SelectItem>
                <SelectItem value="review">Review</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Caption / Notes */}
          <div className="space-y-2">
            <Label className="text-sm">
              {postType === "review" ? "Notes (optional)" : postType === "recipe" ? "Story / Notes (optional)" : "Caption (optional)"}
            </Label>
            <Textarea
              placeholder={postType === "review" ? "Add any details you'd like to include..." : "Write something..."}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Recipe Template */}
          {postType === "recipe" && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-xl border">
              <div className="space-y-2">
                <Label className="text-sm">Recipe Title</Label>
                <Input value={recipeTitle} onChange={(e) => setRecipeTitle(e.target.value)} placeholder="e.g., Lemon Garlic Pasta" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-sm">Cook Time (min)</Label>
                  <Input type="number" value={cookTime} onChange={(e) => setCookTime(e.target.value)} placeholder="30" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Servings</Label>
                  <Input type="number" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="4" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">Ingredients</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>

                <div className="space-y-2">
                  {ingredients.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        className="col-span-6"
                        placeholder="Ingredient"
                        value={row.name}
                        onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                      />
                      <Input
                        className="col-span-3"
                        placeholder="Amt"
                        value={row.amount}
                        onChange={(e) => updateIngredient(idx, { amount: e.target.value })}
                      />
                      <div className="col-span-3 flex items-center gap-2">
                        <Select value={row.unit} onValueChange={(v) => updateIngredient(idx, { unit: v })}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {MEASUREMENT_UNITS.map((u) => (
                              <SelectItem key={u} value={u}>
                                {u}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeIngredient(idx)}
                          aria-label="Remove ingredient"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">Instructions</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addInstruction}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add step
                  </Button>
                </div>

                <div className="space-y-2">
                  {instructions.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="mt-2 h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {idx + 1}
                      </div>
                      <Textarea
                        value={step}
                        onChange={(e) => updateInstruction(idx, e.target.value)}
                        rows={2}
                        placeholder="Describe the step..."
                        className="resize-none"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeInstruction(idx)}
                        aria-label="Remove step"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Review Template */}
          {postType === "review" && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-xl border">
              <div className="space-y-2">
                <Label className="text-sm">What are you reviewing?</Label>
                <Input value={reviewSubject} onChange={(e) => setReviewSubject(e.target.value)} placeholder="e.g., Mario's Pizza (NYC)" />
              </div>

              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Rating
                </Label>
                <Select value={reviewRating} onValueChange={setReviewRating}>
                  <SelectTrigger>
                    <SelectValue placeholder="Rating" />
                  </SelectTrigger>
                  <SelectContent>
                    {["5", "4", "3", "2", "1"].map((v) => (
                      <SelectItem key={v} value={v}>
                        {v} / 5
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-2">
                  <Label className="text-sm">Pros</Label>
                  <Textarea value={reviewPros} onChange={(e) => setReviewPros(e.target.value)} rows={2} placeholder="What did you like?" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Cons</Label>
                  <Textarea value={reviewCons} onChange={(e) => setReviewCons(e.target.value)} rows={2} placeholder="What could be better?" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Verdict</Label>
                  <Textarea value={reviewVerdict} onChange={(e) => setReviewVerdict(e.target.value)} rows={2} placeholder="Would you recommend it?" />
                </div>
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-sm">Tags (comma separated)</Label>
            <Input
              placeholder="e.g., italian, pasta, homemade"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:opacity-90"
            disabled={createPostMutation.isPending}
          >
            {createPostMutation.isPending ? "Sharing..." : postType === "recipe" ? "Share Recipe" : postType === "review" ? "Share Review" : "Share Post"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
