// client/src/pages/social/create-post.tsx
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Camera, Upload, Plus, Minus, X, Video } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";

const EMPTY_SELECT = "__empty__";

const AMOUNT_OPTIONS = [
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
type MediaKind = "image" | "video" | "";

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

function isVideoUrl(url: string) {
  const u = (url || "").toLowerCase().trim();
  return (
    u.includes("video") ||
    u.endsWith(".mp4") ||
    u.endsWith(".mov") ||
    u.endsWith(".webm") ||
    u.endsWith(".m4v") ||
    u.endsWith(".ogg")
  );
}

function getCityStateLabelFromPlace(place: google.maps.places.PlaceResult) {
  const comps = place.address_components || [];
  const find = (type: string) =>
    comps.find((c) => c.types?.includes(type))?.long_name || "";
  const city =
    find("locality") ||
    find("sublocality") ||
    find("administrative_area_level_2");
  const state = find("administrative_area_level_1");
  const country = find("country");
  const parts = [city, state, country].filter(Boolean);
  return parts.join(", ");
}

function buildReviewCaption(input: {
  businessName: string;
  fullAddress?: string;
  locationLabel?: string;
  rating?: string;
  priceLevel?: string;
  pros?: string;
  cons?: string;
  verdict?: string;
  notes?: string;
  extra?: string;
}) {
  const business = (input.businessName || "").trim();
  const address = (input.fullAddress || "").trim();
  const loc = (input.locationLabel || "").trim();
  const rating = (input.rating || "").trim();
  const priceLevel = (input.priceLevel || "").trim();
  const pros = (input.pros || "").trim();
  const cons = (input.cons || "").trim();
  const verdict = (input.verdict || "").trim();
  const notes = (input.notes || "").trim();
  const extra = (input.extra || "").trim();

  const lines: string[] = [];

  lines.push(`📝 Review: ${business}${address ? `, ${address}` : ""}`);

  if (loc) lines.push(`📍 Location: ${loc}`);
  if (rating) lines.push(`⭐ Rating: ${rating}/5`);
  if (priceLevel) lines.push(`💰 Price: ${"$".repeat(Number(priceLevel))}`);
  if (pros) lines.push(`✅ Pros: ${pros}`);
  if (cons) lines.push(`⚠️ Cons: ${cons}`);
  if (verdict) lines.push(`💡 Verdict: ${verdict}`);
  if (notes) lines.push(`Notes: ${notes}`);

  if (extra) lines.push(extra);

  return lines.join("\n").trim();
}

export default function CreatePost() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user } = useUser();

  const isGoogleMapsLoaded = useGoogleMaps();

  // Media
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>("");
  const [mediaKind, setMediaKind] = useState<MediaKind>("");

  // Review autocomplete refs
  const businessInputRef = useRef<HTMLInputElement | null>(null);
  const locationInputRef = useRef<HTMLInputElement | null>(null);

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

    // Review fields
    reviewBusinessName: "",
    reviewFullAddress: "",
    reviewLocationLabel: "",
    reviewRating: "5",
    reviewPriceLevel: "" as "" | "1" | "2" | "3" | "4",
    reviewPros: "",
    reviewCons: "",
    reviewVerdict: "",
    reviewNotes: "",
  });

  const reviewCaptionPreview = useMemo(() => {
    if (formData.postType !== "review") return "";
    const business = formData.reviewBusinessName.trim();
    if (!business) return "";
    return buildReviewCaption({
      businessName: formData.reviewBusinessName,
      fullAddress: formData.reviewFullAddress,
      locationLabel: formData.reviewLocationLabel,
      rating: formData.reviewRating,
      priceLevel: formData.reviewPriceLevel,
      pros: formData.reviewPros,
      cons: formData.reviewCons,
      verdict: formData.reviewVerdict,
      notes: formData.reviewNotes,
      extra: formData.caption,
    });
  }, [formData]);

  // Wire up Google Places Autocomplete (business + location)
  useEffect(() => {
    if (!isGoogleMapsLoaded) return;
    if (!window.google?.maps?.places) return;

    // Business autocomplete (establishments)
    if (businessInputRef.current) {
      const ac = new google.maps.places.Autocomplete(businessInputRef.current, {
        types: ["establishment"],
        fields: ["name", "formatted_address", "address_components", "geometry"],
      });

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const name = place?.name || "";
        const addr = place?.formatted_address || "";
        const locLabel = place ? getCityStateLabelFromPlace(place) : "";

        setFormData((prev) => ({
          ...prev,
          reviewBusinessName: name || prev.reviewBusinessName,
          reviewFullAddress: addr || prev.reviewFullAddress,
          reviewLocationLabel: locLabel || prev.reviewLocationLabel,
        }));
      });
    }

    // Location autocomplete (cities / regions)
    if (locationInputRef.current) {
      const lac = new google.maps.places.Autocomplete(locationInputRef.current, {
        types: ["(cities)"],
        fields: ["name", "formatted_address", "address_components", "geometry"],
      });

      lac.addListener("place_changed", () => {
        const place = lac.getPlace();
        const locLabel = place ? getCityStateLabelFromPlace(place) : "";
        const name = place?.name || place?.formatted_address || "";

        setFormData((prev) => ({
          ...prev,
          reviewLocationLabel: locLabel || name || prev.reviewLocationLabel,
        }));
      });
    }
  }, [isGoogleMapsLoaded]);

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("You must be logged in to create a post");

      const isRecipe = formData.postType === "recipe";

      // Tags
      const baseTags = formData.tags.map((t) => t.trim()).filter(Boolean);
      const tags =
        formData.postType === "review"
          ? Array.from(new Set([...baseTags, "review"]))
          : baseTags;

      // Caption (review gets generated template)
      const captionToSend =
        formData.postType === "review"
          ? buildReviewCaption({
              businessName: formData.reviewBusinessName,
              fullAddress: formData.reviewFullAddress,
              locationLabel: formData.reviewLocationLabel,
              rating: formData.reviewRating,
              priceLevel: formData.reviewPriceLevel,
              pros: formData.reviewPros,
              cons: formData.reviewCons,
              verdict: formData.reviewVerdict,
              notes: formData.reviewNotes,
              extra: formData.caption,
            })
          : formData.caption;

      const postData = {
        userId: user.id,
        caption: captionToSend,
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

      // Recipe row (linked to post.id)
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
        description: "Please add a photo/video (upload or URL)",
      });
      return;
    }

    if (formData.postType === "recipe") {
      if (!formData.recipeTitle.trim()) {
        toast({ variant: "destructive", description: "Please add a recipe title" });
        return;
      }

      const ingredients = ingredientRowsToStrings(formData.ingredients);
      const instructions = normalizeSteps(formData.instructions);

      if (ingredients.length === 0) {
        toast({ variant: "destructive", description: "Please add at least one ingredient" });
        return;
      }
      if (instructions.length === 0) {
        toast({ variant: "destructive", description: "Please add at least one instruction step" });
        return;
      }
    }

    if (formData.postType === "review") {
      if (!formData.reviewBusinessName.trim()) {
        toast({ variant: "destructive", description: "Please choose a business" });
        return;
      }
      if (!formData.reviewRating.trim()) {
        toast({ variant: "destructive", description: "Please select a rating" });
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
    if (!file) return;

    setMediaFile(file);

    const kind: MediaKind = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
      ? "image"
      : "";

    if (!kind) {
      toast({ variant: "destructive", description: "Please select an image or video file" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setMediaPreview(result);
      setMediaKind(kind);
      handleChange("imageUrl", result);
    };
    reader.readAsDataURL(file);
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview("");
    setMediaKind("");
    handleChange("imageUrl", "");
  };

  const addTag = () => setFormData((prev) => ({ ...prev, tags: [...prev.tags, ""] }));

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

            {/* Media Upload */}
            <div className="space-y-2">
              <Label htmlFor="imageUrl">Photo/Video *</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                {mediaPreview ? (
                  <div className="space-y-4">
                    {mediaKind === "video" ? (
                      <video
                        src={mediaPreview}
                        controls
                        className="w-full max-w-md mx-auto h-64 object-cover rounded-lg"
                      />
                    ) : (
                      <img
                        src={mediaPreview}
                        alt="Preview"
                        className="w-full max-w-md mx-auto h-64 object-cover rounded-lg"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearMedia}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remove Media
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <Camera className="h-10 w-10 text-muted-foreground" />
                      <Video className="h-10 w-10 text-muted-foreground" />
                    </div>

                    <p className="text-sm text-muted-foreground mb-4">
                      Take a photo/video or choose from your device
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
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
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Media
                      </Button>
                    </div>

                    <input
                      id="camera-input"
                      type="file"
                      accept="image/*,video/*"
                      capture="environment"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-camera"
                    />
                    <input
                      id="file-input"
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-file"
                    />

                    <p className="text-xs text-muted-foreground mb-2">
                      or paste a media URL
                    </p>
                    <Input
                      id="imageUrl"
                      type="url"
                      placeholder="https://example.com/image.jpg or .mp4"
                      value={formData.imageUrl}
                      onChange={(e) => {
                        const url = e.target.value;
                        handleChange("imageUrl", url);
                        if (!url) {
                          setMediaPreview("");
                          setMediaKind("");
                          return;
                        }
                        setMediaPreview(url);
                        setMediaKind(isVideoUrl(url) ? "video" : "image");
                      }}
                      data-testid="input-image-url"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Review Fields */}
            {formData.postType === "review" && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Review Details</h3>

                  <div className="space-y-2">
                    <Label htmlFor="reviewBusinessName">Business *</Label>
                    <Input
                      id="reviewBusinessName"
                      ref={businessInputRef}
                      placeholder="Search a business (Google Places)…"
                      value={formData.reviewBusinessName}
                      onChange={(e) => handleChange("reviewBusinessName", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Start typing to use Google Places suggestions.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reviewFullAddress">Full address</Label>
                      <Input
                        id="reviewFullAddress"
                        placeholder="Auto-filled from selection"
                        value={formData.reviewFullAddress}
                        onChange={(e) => handleChange("reviewFullAddress", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reviewLocationLabel">Location (City/State)</Label>
                      <Input
                        id="reviewLocationLabel"
                        ref={locationInputRef}
                        placeholder="City, State (Google Places)…"
                        value={formData.reviewLocationLabel}
                        onChange={(e) => handleChange("reviewLocationLabel", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Rating *</Label>
                      <Select
                        value={formData.reviewRating}
                        onValueChange={(v) => handleChange("reviewRating", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select rating" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">⭐⭐⭐⭐⭐ — 5/5</SelectItem>
                          <SelectItem value="4">⭐⭐⭐⭐ — 4/5</SelectItem>
                          <SelectItem value="3">⭐⭐⭐ — 3/5</SelectItem>
                          <SelectItem value="2">⭐⭐ — 2/5</SelectItem>
                          <SelectItem value="1">⭐ — 1/5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Price Level</Label>
                      <div className="flex gap-2 pt-1">
                        {[
                          { value: "1", label: "$" },
                          { value: "2", label: "$$" },
                          { value: "3", label: "$$$" },
                          { value: "4", label: "$$$$" },
                        ].map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={formData.reviewPriceLevel === value}
                            onClick={() =>
                              handleChange(
                                "reviewPriceLevel",
                                formData.reviewPriceLevel === value ? "" : value
                              )
                            }
                            className={`px-3 py-1.5 rounded border text-sm font-semibold transition-colors ${
                              formData.reviewPriceLevel === value
                                ? "bg-primary text-white border-primary"
                                : "border-input text-muted-foreground hover:border-primary"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Optional</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reviewVerdict">Verdict</Label>
                    <Input
                      id="reviewVerdict"
                      placeholder="e.g., Def recommend"
                      value={formData.reviewVerdict}
                      onChange={(e) => handleChange("reviewVerdict", e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reviewPros">Pros</Label>
                      <Input
                        id="reviewPros"
                        placeholder="e.g., Great flavor; friendly staff"
                        value={formData.reviewPros}
                        onChange={(e) => handleChange("reviewPros", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Separate multiple with a semicolon (;)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reviewCons">Cons</Label>
                      <Input
                        id="reviewCons"
                        placeholder="e.g., Parking; long wait"
                        value={formData.reviewCons}
                        onChange={(e) => handleChange("reviewCons", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Separate multiple with a semicolon (;)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reviewNotes">Notes</Label>
                    <Input
                      id="reviewNotes"
                      placeholder="e.g., Try the stewed chicken"
                      value={formData.reviewNotes}
                      onChange={(e) => handleChange("reviewNotes", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="caption">
                      Hashtags / extra lines (optional)
                    </Label>
                    <Textarea
                      id="caption"
                      placeholder={"#jamaican\n#hartford\n..."}
                      value={formData.caption}
                      onChange={(e) => handleChange("caption", e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {reviewCaptionPreview && (
                    <div className="rounded-md border p-3 bg-muted/20">
                      <div className="text-xs font-medium mb-2 text-muted-foreground">
                        Preview
                      </div>
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                        {reviewCaptionPreview}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Caption (Post/Recipe only) */}
            {formData.postType !== "review" && (
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
            )}

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
                              value={row.amount || EMPTY_SELECT}
                              onValueChange={(v) =>
                                updateIngredient(index, {
                                  amount: v === EMPTY_SELECT ? "" : v,
                                })
                              }
                            >
                              <SelectTrigger
                                className="h-9"
                                data-testid={`select-ingredient-amount-${index}`}
                              >
                                <SelectValue placeholder="Amt" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={EMPTY_SELECT}>—</SelectItem>
                                {AMOUNT_OPTIONS.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="col-span-4 sm:col-span-3">
                            <Select
                              value={row.unit || EMPTY_SELECT}
                              onValueChange={(v) =>
                                updateIngredient(index, {
                                  unit: v === EMPTY_SELECT ? "" : v,
                                })
                              }
                            >
                              <SelectTrigger
                                className="h-9"
                                data-testid={`select-ingredient-unit-${index}`}
                              >
                                <SelectValue placeholder="Unit" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={EMPTY_SELECT}>—</SelectItem>
                                {UNIT_OPTIONS.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
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
