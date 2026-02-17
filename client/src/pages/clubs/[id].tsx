// client/src/pages/clubs/[id].tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Clock, Users, ChefHat, Calendar, ImageIcon, Video } from "lucide-react";

const SELECT_NONE = "__none__";

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
  const pros = (input.pros || "").trim();
  const cons = (input.cons || "").trim();
  const verdict = (input.verdict || "").trim();
  const notes = (input.notes || "").trim();
  const extra = (input.extra || "").trim();

  const lines: string[] = [];
  lines.push(`📝 Review: ${business}${address ? `, ${address}` : ""}`);
  if (loc) lines.push(`📍 Location: ${loc}`);
  if (rating) lines.push(`⭐ Rating: ${rating}/5`);
  if (pros) lines.push(`✅ Pros: ${pros}`);
  if (cons) lines.push(`⚠️ Cons: ${cons}`);
  if (verdict) lines.push(`💡 Verdict: ${verdict}`);
  if (notes) lines.push(`Notes: ${notes}`);
  if (extra) lines.push(extra);
  return lines.join("\n").trim();
}

type IngredientRow = {
  amount: string;
  unit: string;
  name: string;
};

export default function ClubPage({ params }: { params: { id: string } }) {
  const clubId = params.id;
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const isGoogleMapsLoaded = useGoogleMaps();
  const reviewBusinessInputRef = useRef<HTMLInputElement | null>(null);
  const reviewLocationInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState("posts");

  // New post form state
  const [newPostType, setNewPostType] = useState<"post" | "recipe" | "review">(
    "post"
  );
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostImageFile, setNewPostImageFile] = useState<File | null>(null);
  const [newPostImagePreview, setNewPostImagePreview] = useState<string | null>(
    null
  );
  const [newPostMediaKind, setNewPostMediaKind] = useState<
    "image" | "video" | ""
  >("");
  const [newPostMediaUrl, setNewPostMediaUrl] = useState("");

  // Recipe fields
  const [recipeTitle, setRecipeTitle] = useState("");
  const [recipeCookTime, setRecipeCookTime] = useState("");
  const [recipeServings, setRecipeServings] = useState("");
  const [recipeDifficulty, setRecipeDifficulty] = useState("Easy");
  const [recipeIngredients, setRecipeIngredients] = useState<IngredientRow[]>([
    { amount: "", unit: "", name: "" },
  ]);
  const [recipeInstructions, setRecipeInstructions] = useState<string[]>([""]);

  // Review fields
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewFullAddress, setReviewFullAddress] = useState("");
  const [reviewLocationLabel, setReviewLocationLabel] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewPros, setReviewPros] = useState("");
  const [reviewCons, setReviewCons] = useState("");
  const [reviewVerdict, setReviewVerdict] = useState("");

  // Derived post preview for review
  const reviewCaptionPreview = useMemo(() => {
    if (newPostType !== "review") return "";
    if (!reviewTitle.trim()) return "";
    return buildReviewCaption({
      businessName: reviewTitle,
      fullAddress: reviewFullAddress,
      locationLabel: reviewLocationLabel,
      rating: reviewRating,
      pros: reviewPros,
      cons: reviewCons,
      verdict: reviewVerdict,
      notes: reviewNotes,
      extra: newPostContent.trim(),
    });
  }, [
    newPostType,
    reviewTitle,
    reviewFullAddress,
    reviewLocationLabel,
    reviewRating,
    reviewPros,
    reviewCons,
    reviewVerdict,
    reviewNotes,
    newPostContent,
  ]);

  // Google Places Autocomplete (review business + city)
  useEffect(() => {
    if (!isGoogleMapsLoaded) return;
    if (!window.google?.maps?.places) return;
    if (newPostType !== "review") return;

    if (reviewBusinessInputRef.current) {
      const ac = new google.maps.places.Autocomplete(
        reviewBusinessInputRef.current,
        {
          types: ["establishment"],
          fields: ["name", "formatted_address", "address_components", "geometry"],
        }
      );

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const name = place?.name || "";
        const addr = place?.formatted_address || "";
        const locLabel = place ? getCityStateLabelFromPlace(place) : "";

        if (name) setReviewTitle(name);
        if (addr) setReviewFullAddress(addr);
        if (locLabel) setReviewLocationLabel(locLabel);
      });
    }

    if (reviewLocationInputRef.current) {
      const lac = new google.maps.places.Autocomplete(
        reviewLocationInputRef.current,
        {
          types: ["(cities)"],
          fields: ["name", "formatted_address", "address_components", "geometry"],
        }
      );

      lac.addListener("place_changed", () => {
        const place = lac.getPlace();
        const locLabel = place ? getCityStateLabelFromPlace(place) : "";
        const name = place?.name || place?.formatted_address || "";
        if (locLabel || name) setReviewLocationLabel(locLabel || name);
      });
    }
  }, [isGoogleMapsLoaded, newPostType]);

  // Fetch club details
  const { data: club, isLoading: isClubLoading } = useQuery({
    queryKey: ["/api/clubs", clubId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/clubs/${clubId}`);
      if (!response.ok) throw new Error("Failed to fetch club");
      return response.json();
    },
    enabled: !!clubId,
  });

  // Fetch club members
  const { data: members, isLoading: isMembersLoading } = useQuery({
    queryKey: ["/api/clubs", clubId, "members"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/clubs/${clubId}/members`);
      if (!response.ok) throw new Error("Failed to fetch members");
      return response.json();
    },
    enabled: !!clubId,
  });

  // Fetch club posts
  const { data: posts, isLoading: isPostsLoading } = useQuery({
    queryKey: ["/api/clubs", clubId, "posts"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/clubs/${clubId}/posts`);
      if (!response.ok) throw new Error("Failed to fetch club posts");
      return response.json();
    },
    enabled: !!clubId,
  });

  // Check membership status
  const { data: membership, isLoading: isMembershipLoading } = useQuery({
    queryKey: ["/api/clubs", clubId, "membership"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/clubs/${clubId}/membership`);
      if (!response.ok) throw new Error("Failed to fetch membership");
      return response.json();
    },
    enabled: !!clubId && !!user,
  });

  const isMember = membership?.isMember;

  const joinClubMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/clubs/${clubId}/join`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to join club");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId, "membership"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId, "members"] });
      toast({ description: "Joined club!" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        description: `Failed to join club: ${error.message}`,
      });
    },
  });

  const leaveClubMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/clubs/${clubId}/leave`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to leave club");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId, "membership"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId, "members"] });
      toast({ description: "Left club." });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        description: `Failed to leave club: ${error.message}`,
      });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async (postData: {
      postType: "post" | "recipe" | "review";
      content: string;
      imageUrl: string | null;
      recipe?: any;
    }) => {
      const response = await apiRequest("POST", `/api/clubs/${clubId}/posts`, postData);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to create post");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId, "posts"] });
      toast({ description: "Posted!" });
      resetNewPostForm();
      setActiveTab("posts");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        description: `Failed to create post: ${error.message}`,
      });
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const kind = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
      ? "image"
      : "";

    if (!kind) {
      toast({
        variant: "destructive",
        description: "Please select an image or video file",
      });
      return;
    }

    setNewPostImageFile(file);
    setNewPostMediaKind(kind);
    setNewPostMediaUrl("");

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewPostImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const resetNewPostForm = () => {
    setNewPostType("post");
    setNewPostContent("");
    setNewPostImageFile(null);
    setNewPostImagePreview(null);
    setNewPostMediaKind("");
    setNewPostMediaUrl("");

    setRecipeTitle("");
    setRecipeCookTime("");
    setRecipeServings("");
    setRecipeDifficulty("Easy");
    setRecipeIngredients([{ amount: "", unit: "", name: "" }]);
    setRecipeInstructions([""]);

    setReviewTitle("");
    setReviewFullAddress("");
    setReviewLocationLabel("");
    setReviewRating("5");
    setReviewPros("");
    setReviewCons("");
    setReviewVerdict("");
    setReviewNotes("");
  };

  const updateIngredientRow = (index: number, patch: Partial<IngredientRow>) => {
    setRecipeIngredients((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const addIngredientRow = () => {
    setRecipeIngredients((prev) => [...prev, { amount: "", unit: "", name: "" }]);
  };

  const removeIngredientRow = (index: number) => {
    setRecipeIngredients((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  };

  const updateInstruction = (index: number, value: string) => {
    setRecipeInstructions((prev) => prev.map((s, i) => (i === index ? value : s)));
  };

  const addInstruction = () => {
    setRecipeInstructions((prev) => [...prev, ""]);
  };

  const removeInstruction = (index: number) => {
    setRecipeInstructions((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isMember) {
      toast({
        variant: "destructive",
        description: "You must be a club member to post.",
      });
      return;
    }

    if (!(newPostMediaUrl.trim() || newPostImagePreview)) {
      toast({
        variant: "destructive",
        description: "Please add a photo/video (upload or URL).",
      });
      return;
    }

    if (newPostType === "recipe") {
      if (!recipeTitle.trim()) {
        toast({ variant: "destructive", description: "Please add a recipe title." });
        return;
      }

      const ingredients = recipeIngredients
        .map((r) =>
          [r.amount, r.unit, r.name]
            .map((x) => (x || "").trim())
            .filter(Boolean)
            .join(" ")
            .trim()
        )
        .filter(Boolean);

      const instructions = recipeInstructions.map((x) => (x || "").trim()).filter(Boolean);

      if (ingredients.length === 0) {
        toast({ variant: "destructive", description: "Please add at least one ingredient." });
        return;
      }
      if (instructions.length === 0) {
        toast({ variant: "destructive", description: "Please add at least one instruction step." });
        return;
      }

      createPostMutation.mutate({
        postType: "recipe",
        content: newPostContent.trim(),
        imageUrl: (newPostMediaUrl.trim() || newPostImagePreview) || null,
        recipe: {
          title: recipeTitle,
          ingredients,
          instructions,
          cookTime: recipeCookTime ? parseInt(recipeCookTime) : null,
          servings: recipeServings ? parseInt(recipeServings) : null,
          difficulty: recipeDifficulty,
        },
      });
      return;
    }

    if (newPostType === "review") {
      if (!reviewTitle.trim()) {
        toast({ variant: "destructive", description: "Business name is required" });
        return;
      }

      const content = buildReviewCaption({
        businessName: reviewTitle,
        fullAddress: reviewFullAddress,
        locationLabel: reviewLocationLabel,
        rating: reviewRating,
        pros: reviewPros,
        cons: reviewCons,
        verdict: reviewVerdict,
        notes: reviewNotes,
        extra: newPostContent.trim(),
      });

      createPostMutation.mutate({
        postType: "review",
        content,
        imageUrl: (newPostMediaUrl.trim() || newPostImagePreview) || null,
      });
      return;
    }

    // Regular post
    if (!newPostContent.trim()) {
      toast({ variant: "destructive", description: "Please write something." });
      return;
    }

    createPostMutation.mutate({
      postType: "post",
      content: newPostContent.trim(),
      imageUrl: (newPostMediaUrl.trim() || newPostImagePreview) || null,
    });
  };

  if (isClubLoading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Skeleton className="h-12 w-1/2 mb-6" />
        <Skeleton className="h-64 w-full mb-6" />
        <Skeleton className="h-10 w-full mb-2" />
        <Skeleton className="h-10 w-full mb-2" />
        <Skeleton className="h-10 w-full mb-2" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Club Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The club you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => setLocation("/clubs")}>Back to Clubs</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* Club Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-3xl font-bold">{club.name}</CardTitle>
              <p className="text-muted-foreground mt-1">{club.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {isMembershipLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : isMember ? (
                <Button
                  variant="outline"
                  onClick={() => leaveClubMutation.mutate()}
                  disabled={leaveClubMutation.isPending}
                >
                  {leaveClubMutation.isPending ? "Leaving..." : "Leave Club"}
                </Button>
              ) : (
                <Button
                  onClick={() => joinClubMutation.mutate()}
                  disabled={joinClubMutation.isPending}
                >
                  {joinClubMutation.isPending ? "Joining..." : "Join Club"}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{members?.length || 0} members</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Created {new Date(club.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {club.tags && club.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {club.tags.map((tag: string) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Club Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-6">
          {/* Create Post Form */}
          {isMember && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Share with the club</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Post Type</Label>
                      <Select
                        value={newPostType}
                        onValueChange={(v) => {
                          setNewPostType(v as any);
                          setNewPostContent("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="post">Post</SelectItem>
                          <SelectItem value="recipe">Recipe</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label>Media</Label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-md border text-sm">
                          <ImageIcon className="h-4 w-4" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={handleImageChange}
                          />

                          <div className="ml-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <Video className="h-3 w-3" />
                            <span>image/video</span>
                          </div>
                        </label>

                        {newPostImagePreview && (
                          <div className="flex-1">
                            {newPostMediaKind === "video" || isVideoUrl(newPostMediaUrl) ? (
                              <video
                                src={newPostMediaUrl || newPostImagePreview || ""}
                                controls
                                className="w-full h-16 object-cover rounded-md"
                              />
                            ) : (
                              <img
                                src={newPostMediaUrl || newPostImagePreview || ""}
                                alt="Preview"
                                className="w-full h-16 object-cover rounded-md"
                              />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 space-y-2">
                        <Label htmlFor="club-media-url">Or paste a media URL</Label>
                        <Input
                          id="club-media-url"
                          type="url"
                          placeholder="https://example.com/image.jpg or .mp4"
                          value={newPostMediaUrl}
                          onChange={(e) => {
                            const url = e.target.value;
                            setNewPostMediaUrl(url);
                            if (!url) {
                              setNewPostMediaKind("");
                              return;
                            }
                            setNewPostMediaKind(isVideoUrl(url) ? "video" : "image");
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {newPostType === "recipe" && (
                    <div className="space-y-4 rounded-md border p-4">
                      <h4 className="font-semibold">Recipe Details</h4>

                      <div className="space-y-2">
                        <Label>Recipe Title</Label>
                        <Input
                          value={recipeTitle}
                          onChange={(e) => setRecipeTitle(e.target.value)}
                          placeholder="Enter recipe name"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label>Cook Time (minutes)</Label>
                          <Input
                            type="number"
                            value={recipeCookTime}
                            onChange={(e) => setRecipeCookTime(e.target.value)}
                            placeholder="30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Servings</Label>
                          <Input
                            type="number"
                            value={recipeServings}
                            onChange={(e) => setRecipeServings(e.target.value)}
                            placeholder="4"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Difficulty</Label>
                          <Select
                            value={recipeDifficulty}
                            onValueChange={setRecipeDifficulty}
                          >
                            <SelectTrigger>
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

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Ingredients</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addIngredientRow}
                          >
                            Add
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {recipeIngredients.map((row, index) => (
                            <div
                              key={index}
                              className="grid grid-cols-12 gap-2 items-center"
                            >
                              <div className="col-span-4 sm:col-span-3">
                                <Select
                                  value={row.amount ? row.amount : SELECT_NONE}
                                  onValueChange={(v) =>
                                    updateIngredientRow(index, {
                                      amount: v === SELECT_NONE ? "" : v,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Amt" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={SELECT_NONE}>—</SelectItem>
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
                                  value={row.unit || SELECT_NONE}
                                  onValueChange={(v) =>
                                    updateIngredientRow(index, {
                                      unit: v === SELECT_NONE ? "" : v,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={SELECT_NONE}>—</SelectItem>
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
                                  className="h-9"
                                  placeholder="Ingredient"
                                  value={row.name}
                                  onChange={(e) =>
                                    updateIngredientRow(index, {
                                      name: e.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="col-span-12 sm:col-span-1 flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeIngredientRow(index)}
                                  disabled={recipeIngredients.length <= 1}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Instructions</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addInstruction}
                          >
                            Add step
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {recipeInstructions.map((step, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                value={step}
                                onChange={(e) => updateInstruction(index, e.target.value)}
                                placeholder={`Step ${index + 1}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeInstruction(index)}
                                disabled={recipeInstructions.length <= 1}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {newPostType === "review" && (
                    <div className="space-y-4 rounded-md border p-4">
                      <h4 className="font-semibold">Review Details</h4>

                      <div className="space-y-2">
                        <Label>Business Name</Label>
                        <Input
                          ref={reviewBusinessInputRef}
                          value={reviewTitle}
                          onChange={(e) => setReviewTitle(e.target.value)}
                          placeholder="Search a business (Google Places)…"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Full Address</Label>
                          <Input
                            value={reviewFullAddress}
                            onChange={(e) => setReviewFullAddress(e.target.value)}
                            placeholder="Auto-filled from selection"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Location (City/State)</Label>
                          <Input
                            ref={reviewLocationInputRef}
                            value={reviewLocationLabel}
                            onChange={(e) => setReviewLocationLabel(e.target.value)}
                            placeholder="City, State (Google Places)…"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Rating</Label>
                          <Select value={reviewRating} onValueChange={setReviewRating}>
                            <SelectTrigger>
                              <SelectValue placeholder="Rating" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5/5</SelectItem>
                              <SelectItem value="4">4/5</SelectItem>
                              <SelectItem value="3">3/5</SelectItem>
                              <SelectItem value="2">2/5</SelectItem>
                              <SelectItem value="1">1/5</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Verdict</Label>
                          <Input
                            value={reviewVerdict}
                            onChange={(e) => setReviewVerdict(e.target.value)}
                            placeholder="e.g., Def recommend"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Pros</Label>
                          <Input
                            value={reviewPros}
                            onChange={(e) => setReviewPros(e.target.value)}
                            placeholder="e.g., Flavor"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cons</Label>
                          <Input
                            value={reviewCons}
                            onChange={(e) => setReviewCons(e.target.value)}
                            placeholder="e.g., Price"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Input
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          placeholder="e.g., Stewed Chicken"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Hashtags / extra lines (optional)</Label>
                        <Textarea
                          value={newPostContent}
                          onChange={(e) => setNewPostContent(e.target.value)}
                          placeholder={"#jamaican\n#hartford\n..."}
                          className="min-h-[100px]"
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
                  )}

                  {newPostType !== "recipe" && newPostType !== "review" && (
                    <div className="space-y-2">
                      <Label>Content</Label>
                      <Textarea
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder="Write something..."
                        className="min-h-[120px]"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetNewPostForm}
                      disabled={createPostMutation.isPending}
                    >
                      Reset
                    </Button>
                    <Button type="submit" disabled={createPostMutation.isPending}>
                      {createPostMutation.isPending ? "Posting..." : "Post"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Club Posts */}
          <div className="space-y-4">
            {isPostsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-20 w-full mb-3" />
                    <Skeleton className="h-48 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : posts && posts.length > 0 ? (
              posts.map((post: any) => (
                <Card key={post.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={post.user?.profileImage} />
                          <AvatarFallback>
                            {post.user?.username?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold">
                            {post.user?.username || "User"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(post.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {post.postType}
                      </Badge>
                    </div>

                    <div className="whitespace-pre-wrap text-sm mb-3">
                      {post.content}
                    </div>

                    {post.imageUrl && (
                      <div className="rounded-md overflow-hidden border">
                        {isVideoUrl(post.imageUrl) ? (
                          <video src={post.imageUrl} controls className="w-full" />
                        ) : (
                          <img src={post.imageUrl} alt="Post media" className="w-full" />
                        )}
                      </div>
                    )}

                    {post.postType === "recipe" && post.recipe && (
                      <div className="mt-4 rounded-md border p-4 bg-muted/10">
                        <div className="flex items-center gap-2 mb-2">
                          <ChefHat className="h-4 w-4" />
                          <span className="font-semibold">{post.recipe.title}</span>
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-3">
                          {post.recipe.cookTime != null && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {post.recipe.cookTime} min
                            </span>
                          )}
                          {post.recipe.servings != null && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Serves {post.recipe.servings}
                            </span>
                          )}
                          {post.recipe.difficulty && (
                            <span className="capitalize">{post.recipe.difficulty}</span>
                          )}
                        </div>

                        {post.recipe.ingredients?.length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs font-semibold mb-1">
                              Ingredients
                            </div>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                              {post.recipe.ingredients.map((ing: string, idx: number) => (
                                <li key={idx}>{ing}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {post.recipe.instructions?.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold mb-1">
                              Instructions
                            </div>
                            <ol className="list-decimal pl-5 space-y-1 text-sm">
                              {post.recipe.instructions.map((step: string, idx: number) => (
                                <li key={idx}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    No posts yet. Be the first to share something!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Members</CardTitle>
            </CardHeader>
            <CardContent>
              {isMembersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
              ) : members && members.length > 0 ? (
                <div className="space-y-3">
                  {members.map((member: any) => (
                    <div key={member.id} className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.profileImage} />
                        <AvatarFallback>
                          {member.username?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium">{member.username}</div>
                        {member.joinedAt && (
                          <div className="text-xs text-muted-foreground">
                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      {member.role && (
                        <Badge variant="outline" className="capitalize">
                          {member.role}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No members found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
