// client/src/pages/clubs/[id].tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import {
  Users,
  ArrowLeft,
  Plus,
  Lock,
  Globe,
  Settings,
  Crown,
  MessageSquare,
  Camera,
  Upload,
  X,
  Video,
  Minus,
} from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Club = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  coverImage: string | null;
  isPublic: boolean;
  createdAt: string;
  createdById: string;
};

type ClubStats = {
  memberCount: number;
  postCount: number;
  isMember: boolean;
  isAdmin: boolean;
};

type ClubDetailsResponse = {
  club: Club;
  stats: ClubStats;
};

type ClubPost = {
  id: string;
  clubId: string;
  userId: string;
  caption: string;
  imageUrl: string | null;
  tags: string[] | null;
  postType: "post" | "recipe" | "review";
  createdAt: string;
  recipeId?: string | null;
  reviewId?: string | null;
  user?: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
};

type ClubPostsResponse = {
  posts: ClubPost[];
};

type IngredientRow = { amount: string; unit: string; name: string };
type MediaKind = "image" | "video" | "";

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

export default function ClubPage() {
  const { id: clubId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useUser();

  const isGoogleMapsLoaded = useGoogleMaps();

  // Review autocomplete refs
  const businessInputRef = useRef<HTMLInputElement | null>(null);
  const locationInputRef = useRef<HTMLInputElement | null>(null);

  // Composer state (inline in Posts tab)
  const [newPostType, setNewPostType] = useState<"post" | "recipe" | "review">("post");
  const [newPostCaption, setNewPostCaption] = useState("");
  const [newPostTags, setNewPostTags] = useState<string[]>([""]);
  const [newPostImageFile, setNewPostImageFile] = useState<File | null>(null);
  const [newPostImagePreview, setNewPostImagePreview] = useState<string>("");
  const [newPostMediaKind, setNewPostMediaKind] = useState<MediaKind>("");

  // Recipe fields
  const [recipeTitle, setRecipeTitle] = useState("");
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ amount: "", unit: "", name: "" }]);
  const [instructions, setInstructions] = useState<string[]>([""]);
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");

  // Review fields
  const [reviewBusinessName, setReviewBusinessName] = useState("");
  const [reviewFullAddress, setReviewFullAddress] = useState("");
  const [reviewLocationLabel, setReviewLocationLabel] = useState("");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewPriceLevel, setReviewPriceLevel] = useState<"" | "1" | "2" | "3" | "4">("");
  const [reviewPros, setReviewPros] = useState("");
  const [reviewCons, setReviewCons] = useState("");
  const [reviewVerdict, setReviewVerdict] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const reviewCaptionPreview = useMemo(() => {
    if (newPostType !== "review") return "";
    if (!reviewBusinessName.trim()) return "";
    return buildReviewCaption({
      businessName: reviewBusinessName,
      fullAddress: reviewFullAddress,
      locationLabel: reviewLocationLabel,
      rating: reviewRating,
      priceLevel: reviewPriceLevel,
      pros: reviewPros,
      cons: reviewCons,
      verdict: reviewVerdict,
      notes: reviewNotes,
      extra: newPostCaption,
    });
  }, [
    newPostType,
    reviewBusinessName,
    reviewFullAddress,
    reviewLocationLabel,
    reviewRating,
    reviewPriceLevel,
    reviewPros,
    reviewCons,
    reviewVerdict,
    reviewNotes,
    newPostCaption,
  ]);

  const resetComposer = () => {
    setNewPostType("post");
    setNewPostCaption("");
    setNewPostTags([""]);
    setNewPostImageFile(null);
    setNewPostImagePreview("");
    setNewPostMediaKind("");

    setRecipeTitle("");
    setIngredients([{ amount: "", unit: "", name: "" }]);
    setInstructions([""]);
    setCookTime("");
    setServings("");
    setDifficulty("Easy");

    setReviewBusinessName("");
    setReviewFullAddress("");
    setReviewLocationLabel("");
    setReviewRating("5");
    setReviewPriceLevel("");
    setReviewPros("");
    setReviewCons("");
    setReviewVerdict("");
    setReviewNotes("");
  };

  // Club details
  const {
    data: clubData,
    isLoading: clubLoading,
    isError: clubIsError,
    error: clubError,
  } = useQuery({
    queryKey: [`/api/clubs/${clubId}`],
  });

  // Club posts
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: [`/api/clubs/${clubId}/posts`],
    enabled: !!clubId,
  });

  const club = (clubData as ClubDetailsResponse | undefined)?.club;
  const stats = (clubData as ClubDetailsResponse | undefined)?.stats;
  const posts = ((postsData as ClubPostsResponse | undefined)?.posts || []) as ClubPost[];

  const isMember = !!stats?.isMember;
  const isAdmin = !!stats?.isAdmin;

  const handleNewPostMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const kind: MediaKind = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
      ? "image"
      : "";

    if (!kind) {
      toast({
        title: "Invalid file",
        description: "Please select an image or video file",
        variant: "destructive",
      });
      return;
    }

    setNewPostMediaKind(kind);
    setNewPostImageFile(file);

    const reader = new FileReader();
    reader.onload = () => setNewPostImagePreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  // Join / Leave
  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/clubs/${clubId}/join`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to join club");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ description: "Joined club" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", description: err.message });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/clubs/${clubId}/leave`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to leave club");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ description: "Left club" });
      resetComposer();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", description: err.message });
    },
  });

  // Create club post
  const createClubPostMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("You must be logged in");
      if (!isMember) throw new Error("Join the club to post");
      if (!newPostImagePreview.trim()) throw new Error("Please add a photo/video (upload or URL)");

      const tags = newPostTags.map((t) => t.trim()).filter(Boolean);

      const captionToSend =
        newPostType === "review"
          ? buildReviewCaption({
              businessName: reviewBusinessName,
              fullAddress: reviewFullAddress,
              locationLabel: reviewLocationLabel,
              rating: reviewRating,
              priceLevel: reviewPriceLevel,
              pros: reviewPros,
              cons: reviewCons,
              verdict: reviewVerdict,
              notes: reviewNotes,
              extra: newPostCaption,
            })
          : newPostCaption;

      const payload: any = {
        clubId,
        caption: captionToSend,
        imageUrl: newPostImagePreview,
        tags,
        postType: newPostType,
      };

      if (newPostType === "recipe") {
        if (!recipeTitle.trim()) throw new Error("Please add a recipe title");

        const ing = ingredientRowsToStrings(ingredients);
        const steps = normalizeSteps(instructions);

        if (ing.length === 0) throw new Error("Please add at least one ingredient");
        if (steps.length === 0) throw new Error("Please add at least one instruction step");

        payload.recipe = {
          title: recipeTitle,
          ingredients: ing,
          instructions: steps,
          cookTime: cookTime ? parseInt(cookTime) : null,
          servings: servings ? parseInt(servings) : null,
          difficulty,
          imageUrl: newPostImagePreview || null,
        };
      }

      if (newPostType === "review") {
        if (!reviewBusinessName.trim()) throw new Error("Please choose a business");
        if (!reviewRating.trim()) throw new Error("Please select a rating");
        payload.review = {
          businessName: reviewBusinessName,
          fullAddress: reviewFullAddress || null,
          locationLabel: reviewLocationLabel || null,
          rating: parseInt(reviewRating),
          priceLevel: reviewPriceLevel ? parseInt(reviewPriceLevel) : null,
          pros: reviewPros || null,
          cons: reviewCons || null,
          verdict: reviewVerdict || null,
          notes: reviewNotes || null,
        };
      }

      const res = await apiRequest("POST", `/api/clubs/${clubId}/posts`, payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to create club post");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/posts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ description: "Posted to club!" });
      resetComposer();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", description: err.message });
    },
  });

  // Google Places Autocomplete for review
  useEffect(() => {
    if (!isGoogleMapsLoaded) return;
    if (!window.google?.maps?.places) return;

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

        setReviewBusinessName((prev) => name || prev);
        setReviewFullAddress((prev) => addr || prev);
        setReviewLocationLabel((prev) => locLabel || prev);
      });
    }

    if (locationInputRef.current) {
      const lac = new google.maps.places.Autocomplete(locationInputRef.current, {
        types: ["(cities)"],
        fields: ["name", "formatted_address", "address_components", "geometry"],
      });

      lac.addListener("place_changed", () => {
        const place = lac.getPlace();
        const locLabel = place ? getCityStateLabelFromPlace(place) : "";
        const name = place?.name || place?.formatted_address || "";
        setReviewLocationLabel((prev) => locLabel || name || prev);
      });
    }
  }, [isGoogleMapsLoaded]);

  // Ingredients helpers
  const addIngredientRow = () =>
    setIngredients((prev) => [...prev, { amount: "", unit: "", name: "" }]);

  const removeIngredientRow = (index: number) =>
    setIngredients((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const updateIngredientRow = (index: number, patch: Partial<IngredientRow>) =>
    setIngredients((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  // Instructions helpers
  const addInstruction = () => setInstructions((prev) => [...prev, ""]);
  const removeInstruction = (index: number) =>
    setInstructions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  const updateInstruction = (index: number, value: string) =>
    setInstructions((prev) => prev.map((s, i) => (i === index ? value : s)));

  // Error UI
  if (clubIsError) {
    const msg =
      (clubError as any)?.message ||
      "Unable to load this club right now. Please try again.";
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-10">
              <Alert variant="destructive">
                <AlertTitle>Could not load club</AlertTitle>
                <AlertDescription>{msg}</AlertDescription>
              </Alert>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                  Retry
                </Button>
                <Link href="/clubs">
                  <Button>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Clubs
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (clubLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-10 text-center text-slate-600">
              Loading club…
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-600">Club not found</p>
              <Link href="/clubs">
                <Button className="mt-4">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Clubs
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <Card className="overflow-hidden">
          {club.coverImage ? (
            <div className="h-44 w-full">
              <img src={club.coverImage} alt={club.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="h-44 w-full bg-slate-200" />
          )}

          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{club.name}</h1>
                  <Badge variant="secondary" className="gap-1">
                    {club.isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {club.isPublic ? "Public" : "Private"}
                  </Badge>
                  {isAdmin && (
                    <Badge className="gap-1">
                      <Crown className="h-3.5 w-3.5" />
                      Admin
                    </Badge>
                  )}
                </div>

                {club.description ? (
                  <p className="text-slate-700">{club.description}</p>
                ) : (
                  <p className="text-slate-500 italic">No description yet.</p>
                )}

                <div className="flex items-center gap-3 text-sm text-slate-600 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-4 w-4" /> {stats?.memberCount ?? 0} members
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" /> {stats?.postCount ?? 0} posts
                  </span>
                  <Badge variant="outline">{club.category}</Badge>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link href="/clubs">
                  <Button variant="outline">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </Link>

                {isMember ? (
                  <Button
                    variant="outline"
                    onClick={() => leaveMutation.mutate()}
                    disabled={leaveMutation.isPending}
                  >
                    Leave
                  </Button>
                ) : (
                  <Button
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                  >
                    Join
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="posts">
          <TabsList>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            {isAdmin && <TabsTrigger value="settings">Settings</TabsTrigger>}
          </TabsList>

          <TabsContent value="posts" className="space-y-4 mt-4">
            {/* INLINE COMPOSER */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Post in this club</CardTitle>
                <CardDescription>
                  {isMember ? "Share a post, recipe, or review." : "Join the club to post."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!user?.id ? (
                  <Alert variant="destructive">
                    <AlertTitle>Login required</AlertTitle>
                    <AlertDescription>You must be logged in to post.</AlertDescription>
                  </Alert>
                ) : !isMember ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => joinMutation.mutate()}
                      disabled={joinMutation.isPending}
                      className="sm:w-auto w-full"
                    >
                      {joinMutation.isPending ? "Joining..." : "Join to post"}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Post type</Label>
                      <Select value={newPostType} onValueChange={(v) => setNewPostType(v as any)}>
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

                    <div className="space-y-2">
                      <Label>Photo/Video *</Label>
                      <div className="border-2 border-dashed rounded-lg p-4">
                        {newPostImagePreview ? (
                          <div className="space-y-3">
                            <div className="rounded-lg overflow-hidden">
                              {newPostMediaKind === "video" ? (
                                <video src={newPostImagePreview} controls className="w-full max-h-80 object-cover" />
                              ) : (
                                <img src={newPostImagePreview} alt="Post preview" className="w-full max-h-80 object-cover" />
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setNewPostImageFile(null);
                                  setNewPostImagePreview("");
                                  setNewPostMediaKind("");
                                }}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-center gap-3">
                              <Camera className="h-9 w-9 text-slate-500" />
                              <Video className="h-9 w-9 text-slate-500" />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => document.getElementById("club-camera-input")?.click()}
                              >
                                <Camera className="h-4 w-4 mr-2" />
                                Camera
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => document.getElementById("club-file-input")?.click()}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Media
                              </Button>
                            </div>

                            <input
                              id="club-camera-input"
                              type="file"
                              accept="image/*,video/*"
                              capture="environment"
                              onChange={handleNewPostMediaChange}
                              className="hidden"
                            />
                            <input
                              id="club-file-input"
                              type="file"
                              accept="image/*,video/*"
                              onChange={handleNewPostMediaChange}
                              className="hidden"
                            />

                            <p className="text-xs text-slate-500">Or paste a media URL</p>
                            <Input
                              placeholder="https://example.com/image.jpg or .mp4"
                              value={newPostImagePreview}
                              onChange={(e) => {
                                const url = e.target.value;
                                setNewPostImagePreview(url);
                                if (!url) {
                                  setNewPostMediaKind("");
                                  return;
                                }
                                setNewPostMediaKind(isVideoUrl(url) ? "video" : "image");
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* REVIEW FIELDS */}
                    {newPostType === "review" && (
                      <>
                        <Separator />
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Review Details</h3>

                          <div className="space-y-2">
                            <Label>Business *</Label>
                            <Input
                              ref={businessInputRef}
                              placeholder="Search a business (Google Places)…"
                              value={reviewBusinessName}
                              onChange={(e) => setReviewBusinessName(e.target.value)}
                            />
                            <p className="text-xs text-slate-500">
                              Start typing to use Google Places suggestions.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Full address</Label>
                              <Input
                                placeholder="Auto-filled from selection"
                                value={reviewFullAddress}
                                onChange={(e) => setReviewFullAddress(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Location (City/State)</Label>
                              <Input
                                ref={locationInputRef}
                                placeholder="City, State (Google Places)…"
                                value={reviewLocationLabel}
                                onChange={(e) => setReviewLocationLabel(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Rating *</Label>
                              <Select value={reviewRating} onValueChange={setReviewRating}>
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
                                    aria-pressed={reviewPriceLevel === value}
                                    onClick={() =>
                                      setReviewPriceLevel(
                                        reviewPriceLevel === value ? "" : (value as any)
                                      )
                                    }
                                    className={`px-3 py-1.5 rounded border text-sm font-semibold transition-colors ${
                                      reviewPriceLevel === value
                                        ? "bg-primary text-white border-primary"
                                        : "border-input text-muted-foreground hover:border-primary"
                                    }`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                              <p className="text-xs text-slate-500">Optional</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Verdict</Label>
                            <Input
                              placeholder="e.g., Def recommend"
                              value={reviewVerdict}
                              onChange={(e) => setReviewVerdict(e.target.value)}
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Pros</Label>
                              <Input
                                placeholder="e.g., Great flavor; friendly staff"
                                value={reviewPros}
                                onChange={(e) => setReviewPros(e.target.value)}
                              />
                              <p className="text-xs text-slate-500">
                                Separate multiple with a semicolon (;)
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>Cons</Label>
                              <Input
                                placeholder="e.g., Parking; long wait"
                                value={reviewCons}
                                onChange={(e) => setReviewCons(e.target.value)}
                              />
                              <p className="text-xs text-slate-500">
                                Separate multiple with a semicolon (;)
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Notes</Label>
                            <Input
                              placeholder="e.g., Try the stewed chicken"
                              value={reviewNotes}
                              onChange={(e) => setReviewNotes(e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Hashtags / extra lines (optional)</Label>
                            <Textarea
                              placeholder={"#jamaican\n#hartford\n..."}
                              value={newPostCaption}
                              onChange={(e) => setNewPostCaption(e.target.value)}
                              rows={3}
                              className="resize-none"
                            />
                          </div>

                          {reviewCaptionPreview && (
                            <div className="rounded-md border p-3 bg-slate-50">
                              <div className="text-xs font-medium mb-2 text-slate-500">Preview</div>
                              <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                                {reviewCaptionPreview}
                              </pre>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* CAPTION (POST/RECIPE) */}
                    {newPostType !== "review" && (
                      <div className="space-y-2">
                        <Label>Caption</Label>
                        <Textarea
                          placeholder="Write something..."
                          value={newPostCaption}
                          onChange={(e) => setNewPostCaption(e.target.value)}
                          rows={4}
                          className="resize-none"
                        />
                      </div>
                    )}

                    {/* TAGS */}
                    <div className="space-y-2">
                      <Label>Tags</Label>
                      <div className="space-y-2">
                        {newPostTags.map((tag, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              placeholder="Enter a tag (e.g., italian, pasta)"
                              value={tag}
                              onChange={(e) =>
                                setNewPostTags((prev) =>
                                  prev.map((t, i) => (i === index ? e.target.value : t))
                                )
                              }
                            />
                            {newPostTags.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  setNewPostTags((prev) => prev.filter((_, i) => i !== index))
                                }
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setNewPostTags((prev) => [...prev, ""])}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Tag
                        </Button>
                      </div>
                    </div>

                    {/* RECIPE FIELDS */}
                    {newPostType === "recipe" && (
                      <>
                        <Separator />
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Recipe Details</h3>

                          <div className="space-y-2">
                            <Label>Recipe Title *</Label>
                            <Input
                              placeholder="Enter the recipe name"
                              value={recipeTitle}
                              onChange={(e) => setRecipeTitle(e.target.value)}
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Cook Time (minutes)</Label>
                              <Input
                                type="number"
                                inputMode="numeric"
                                placeholder="30"
                                value={cookTime}
                                onChange={(e) => setCookTime(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Servings</Label>
                              <Input
                                type="number"
                                inputMode="numeric"
                                placeholder="4"
                                value={servings}
                                onChange={(e) => setServings(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Difficulty</Label>
                              <Select value={difficulty} onValueChange={setDifficulty}>
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

                          {/* Ingredients */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Ingredients *</Label>
                              <Button type="button" variant="outline" size="sm" onClick={addIngredientRow}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add
                              </Button>
                            </div>

                            <div className="space-y-2">
                              {ingredients.map((row, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-4 sm:col-span-3">
                                    <Select
                                      value={row.amount || SELECT_NONE}
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
                                      placeholder="Ingredient"
                                      value={row.name}
                                      onChange={(e) => updateIngredientRow(index, { name: e.target.value })}
                                      className="h-9"
                                    />
                                  </div>

                                  <div className="col-span-12 sm:col-span-1 flex justify-end">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeIngredientRow(index)}
                                      disabled={ingredients.length <= 1}
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
                              <Button type="button" variant="outline" size="sm" onClick={addInstruction}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add step
                              </Button>
                            </div>

                            <div className="space-y-2">
                              {instructions.map((instruction, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <Input
                                    placeholder={`Step ${index + 1}`}
                                    value={instruction}
                                    onChange={(e) => updateInstruction(index, e.target.value)}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeInstruction(index)}
                                    disabled={instructions.length <= 1}
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

                    <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        type="button"
                        onClick={resetComposer}
                      >
                        Clear
                      </Button>
                      <Button
                        type="button"
                        onClick={() => createClubPostMutation.mutate()}
                        disabled={createClubPostMutation.isPending}
                      >
                        {createClubPostMutation.isPending ? "Posting..." : "Post"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* POSTS LIST */}
            {postsLoading ? (
              <Card>
                <CardContent className="py-10 text-center text-slate-600">
                  Loading posts…
                </CardContent>
              </Card>
            ) : posts.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-slate-600">
                  No posts yet.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {posts.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="py-5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm text-slate-600">
                          {p.user?.username ? (
                            <span className="font-medium text-slate-900">{p.user.username}</span>
                          ) : (
                            <span className="font-medium text-slate-900">Member</span>
                          )}
                          <span className="mx-2">•</span>
                          <span>{new Date(p.createdAt).toLocaleString()}</span>
                        </div>
                        <Badge variant="outline">{p.postType}</Badge>
                      </div>

                      {p.imageUrl ? (
                        isVideoUrl(p.imageUrl) ? (
                          <video src={p.imageUrl} controls className="w-full rounded-lg max-h-[520px] object-cover" />
                        ) : (
                          <img src={p.imageUrl} alt="Post media" className="w-full rounded-lg max-h-[520px] object-cover" />
                        )
                      ) : null}

                      {p.caption ? (
                        <pre className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">
                          {p.caption}
                        </pre>
                      ) : null}

                      {Array.isArray(p.tags) && p.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {p.tags.map((t) => (
                            <Badge key={t} variant="secondary">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="about" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
                <CardDescription>Club details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-slate-700">
                <div>
                  <div className="text-sm font-medium text-slate-900">Category</div>
                  <div className="text-sm">{club.category}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-slate-900">Visibility</div>
                  <div className="text-sm">{club.isPublic ? "Public" : "Private"}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-slate-900">Description</div>
                  <div className="text-sm">{club.description || "—"}</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Club Settings
                </CardTitle>
                <CardDescription>Admin-only tools</CardDescription>
              </CardHeader>
              <CardContent className="text-slate-700 text-sm">
                Admin tools can be added here.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
