import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";

import {
  Users,
  MessageSquare,
  ArrowLeft,
  Send,
  Calendar,
  Crown,
  Pencil,
  Save,
  Camera,
  Plus,
  Minus,
  Star,
  Upload,
  X,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface ClubPost {
  id: number;
  clubId: number;
  userId: number;
  content: string;
  imageUrl?: string;
  createdAt: string;
  user?: {
    id: number;
    username: string;
    profilePicture?: string;
  };
  postType?: "post" | "recipe" | "review";
  recipeTitle?: string;
  recipeIngredients?: string[];
  recipeInstructions?: string[];
  recipeCookTime?: number;
  recipeServings?: number;
  recipeDifficulty?: string;
  reviewTitle?: string;
  reviewRating?: number;
  reviewPros?: string;
  reviewCons?: string;
  reviewVerdict?: string;
}

interface Club {
  id: number;
  name: string;
  description: string;
  coverImage?: string;
  memberCount: number;
  isPrivate: boolean;
  createdAt: string;
  ownerId: number;
  owner?: {
    id: number;
    username: string;
    profilePicture?: string;
  };
  isMember?: boolean;
  isOwner?: boolean;
}

interface ClubEvent {
  id: number;
  clubId: number;
  title: string;
  description: string;
  date: string;
  location: string;
  createdAt: string;
}

interface ClubPageProps {
  params: {
    id: string;
  };
}

function ingredientRowsToStrings(rows: { amount: string; unit: string; name: string }[]): string[] {
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

export default function ClubPage({ params }: ClubPageProps) {
  const clubId = parseInt(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  // Queries
  const { data: club, isLoading: clubLoading } = useQuery<Club>({
    queryKey: [`/api/clubs/${clubId}`],
    enabled: !!clubId,
  });

  const { data: posts, isLoading: postsLoading } = useQuery<ClubPost[]>({
    queryKey: [`/api/clubs/${clubId}/posts`],
    enabled: !!clubId,
  });

  const { data: events, isLoading: eventsLoading } = useQuery<ClubEvent[]>({
    queryKey: [`/api/clubs/${clubId}/events`],
    enabled: !!clubId,
  });

  // State
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostType, setNewPostType] = useState<"post" | "recipe" | "review">("post");
  const [newPostImageFile, setNewPostImageFile] = useState<File | null>(null);
  const [newPostImagePreview, setNewPostImagePreview] = useState<string>("");

  // Media helpers
  type MediaKind = "image" | "video" | "";

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
    extra?: string; // hashtags / extra lines
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

  const [newPostMediaKind, setNewPostMediaKind] = useState<MediaKind>("");

  // Review fields (used by club composer)
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewAddress, setReviewAddress] = useState("");
  const [reviewLocation, setReviewLocation] = useState("");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewPros, setReviewPros] = useState("");
  const [reviewCons, setReviewCons] = useState("");
  const [reviewVerdict, setReviewVerdict] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const isGoogleMapsLoaded = useGoogleMaps();
  const reviewBusinessInputRef = useRef<HTMLInputElement | null>(null);
  const reviewLocationInputRef = useRef<HTMLInputElement | null>(null);

  // Wire up Google Places Autocomplete for review business + location (club composer)
  useEffect(() => {
    if (!isGoogleMapsLoaded) return;
    if (!window.google?.maps?.places) return;
    if (newPostType !== "review") return;

    // Business autocomplete (establishments)
    if (reviewBusinessInputRef.current) {
      const ac = new google.maps.places.Autocomplete(reviewBusinessInputRef.current, {
        types: ["establishment"],
        fields: ["name", "formatted_address", "address_components", "geometry"],
      });

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const name = place?.name || "";
        const addr = place?.formatted_address || "";
        const locLabel = place ? getCityStateLabelFromPlace(place) : "";

        if (name) setReviewTitle(name);
        if (addr) setReviewAddress(addr);
        if (locLabel) setReviewLocation(locLabel);
      });
    }

    // Location autocomplete (cities / regions)
    if (reviewLocationInputRef.current) {
      const lac = new google.maps.places.Autocomplete(reviewLocationInputRef.current, {
        types: ["(cities)"],
        fields: ["name", "formatted_address", "address_components", "geometry"],
      });

      lac.addListener("place_changed", () => {
        const place = lac.getPlace();
        const locLabel = place ? getCityStateLabelFromPlace(place) : "";
        const name = place?.name || place?.formatted_address || "";
        if (locLabel || name) setReviewLocation(locLabel || name);
      });
    }
  }, [isGoogleMapsLoaded, newPostType]);

  // Recipe fields (club composer)
  const [recipeTitle, setRecipeTitle] = useState("");
  const [recipeCookTime, setRecipeCookTime] = useState("");
  const [recipeServings, setRecipeServings] = useState("");
  const [recipeDifficulty, setRecipeDifficulty] = useState("Easy");
  const [recipeIngredients, setRecipeIngredients] = useState<
    { amount: string; unit: string; name: string }[]
  >([{ amount: "", unit: "", name: "" }]);
  const [recipeInstructions, setRecipeInstructions] = useState<string[]>([""]);

  // UI states
  const [isEditingClub, setIsEditingClub] = useState(false);
  const [editedClubName, setEditedClubName] = useState("");
  const [editedClubDescription, setEditedClubDescription] = useState("");
  const [editedClubPrivate, setEditedClubPrivate] = useState(false);

  // For edit club cover image
  const [clubCoverPreview, setClubCoverPreview] = useState<string>("");
  const [clubCoverFile, setClubCoverFile] = useState<File | null>(null);

  // Event creation state
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");

  // Select options
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

  // For optional "none" selection in unit select (Radix Select items can't have empty value)
  const SELECT_NONE = "__none__";

  const isOwner = useMemo(() => {
    return !!club?.isOwner || (club?.ownerId && user?.id === club.ownerId);
  }, [club, user]);

  // Initialize edit form when toggling editing
  useEffect(() => {
    if (club && isEditingClub) {
      setEditedClubName(club.name || "");
      setEditedClubDescription(club.description || "");
      setEditedClubPrivate(!!club.isPrivate);
      setClubCoverPreview(club.coverImage || "");
      setClubCoverFile(null);
    }
  }, [club, isEditingClub]);

  // Mutations
  const joinClubMutation = useQuery({
    queryKey: ["joinClubMutation"],
    enabled: false,
    queryFn: async () => null,
  });

  const leaveClubMutation = useQuery({
    queryKey: ["leaveClubMutation"],
    enabled: false,
    queryFn: async () => null,
  });

  // Create club post (uses content/imageUrl/postType)
  const createPostMutation = useQuery({
    queryKey: ["createPostMutation"],
    enabled: false,
    queryFn: async () => null,
  });

  // We'll use manual fetch for create post to keep behavior consistent with this page
  const handleJoinClub = async () => {
    try {
      const response = await apiRequest("POST", `/api/clubs/${clubId}/join`, {});
      if (!response.ok) throw new Error("Failed to join club");

      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ title: "Joined", description: "You are now a member of this club." });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join club",
        variant: "destructive",
      });
    }
  };

  const handleLeaveClub = async () => {
    try {
      const response = await apiRequest("POST", `/api/clubs/${clubId}/leave`, {});
      if (!response.ok) throw new Error("Failed to leave club");

      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ title: "Left club", description: "You left the club." });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to leave club",
        variant: "destructive",
      });
    }
  };

  const clearNewPostImage = () => {
    setNewPostImageFile(null);
    setNewPostImagePreview("");
    setNewPostMediaKind("");
  };

  const handleNewPostImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const kind: MediaKind = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
      ? "image"
      : "";

    if (!kind) {
      toast({ variant: "destructive", description: "Please select an image or video file" });
      return;
    }

    setNewPostImageFile(file);
    setNewPostMediaKind(kind);

    const reader = new FileReader();
    reader.onload = () => setNewPostImagePreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const resetComposer = () => {
    setNewPostContent("");
    setNewPostType("post");
    clearNewPostImage();

    setRecipeTitle("");
    setRecipeCookTime("");
    setRecipeServings("");
    setRecipeDifficulty("Easy");
    setRecipeIngredients([{ amount: "", unit: "", name: "" }]);
    setRecipeInstructions([""]);

    setReviewTitle("");
    setReviewAddress("");
    setReviewLocation("");
    setReviewRating("5");
    setReviewPros("");
    setReviewCons("");
    setReviewVerdict("");
    setReviewNotes("");
  };

  const handleCreatePost = async () => {
    if (!clubId) return;

    const type = newPostType;

    // Recipe
    if (type === "recipe") {
      if (!recipeTitle.trim()) {
        toast({
          title: "Recipe title required",
          description: "Please add a recipe title.",
          variant: "destructive",
        });
        return;
      }

      const ingredients = ingredientRowsToStrings(recipeIngredients);
      const instructions = normalizeSteps(recipeInstructions);

      if (ingredients.length === 0) {
        toast({
          title: "Ingredients required",
          description: "Please add at least one ingredient.",
          variant: "destructive",
        });
        return;
      }

      if (instructions.length === 0) {
        toast({
          title: "Instructions required",
          description: "Please add at least one instruction step.",
          variant: "destructive",
        });
        return;
      }

      const content = newPostContent.trim() || `🍽️ ${recipeTitle.trim()}`;

      try {
        const res = await fetch(`/api/clubs/${clubId}/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postType: "recipe",
            content,
            imageUrl: newPostImagePreview || null,
            recipeTitle: recipeTitle.trim(),
            recipeIngredients: ingredients,
            recipeInstructions: instructions,
            recipeCookTime: recipeCookTime ? parseInt(recipeCookTime) : null,
            recipeServings: recipeServings ? parseInt(recipeServings) : null,
            recipeDifficulty,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.message || "Failed to create recipe post");
        }

        queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/posts`] });
        toast({ title: "Posted", description: "Recipe posted to the club." });
        resetComposer();
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create post",
          variant: "destructive",
        });
      }
      return;
    }

    // Review
    if (type === "review") {
      if (!reviewTitle.trim()) {
        toast({
          title: "Business required",
          description: "Please choose a business (or type one).",
          variant: "destructive",
        });
        return;
      }

      if (!reviewRating.trim()) {
        toast({
          title: "Rating required",
          description: "Please select a rating.",
          variant: "destructive",
        });
        return;
      }

      const content = buildReviewCaption({
        businessName: reviewTitle,
        fullAddress: reviewAddress,
        locationLabel: reviewLocation,
        rating: reviewRating,
        pros: reviewPros,
        cons: reviewCons,
        verdict: reviewVerdict,
        notes: reviewNotes,
        extra: newPostContent,
      });

      try {
        const res = await fetch(`/api/clubs/${clubId}/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postType: "review",
            content,
            imageUrl: newPostImagePreview || null,
            reviewTitle: reviewTitle.trim(),
            reviewRating: parseInt(reviewRating),
            reviewPros: reviewPros.trim(),
            reviewCons: reviewCons.trim(),
            reviewVerdict: reviewVerdict.trim(),
            reviewNotes: reviewNotes.trim(),
            reviewAddress: reviewAddress.trim(),
            reviewLocation: reviewLocation.trim(),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.message || "Failed to create review post");
        }

        queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/posts`] });
        toast({ title: "Posted", description: "Review posted to the club." });
        resetComposer();
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create post",
          variant: "destructive",
        });
      }
      return;
    }

    // Standard Post
    if (!newPostContent.trim() && !newPostImagePreview) {
      toast({
        title: "Post required",
        description: "Add text or media before posting.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch(`/api/clubs/${clubId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postType: "post",
          content: newPostContent.trim(),
          imageUrl: newPostImagePreview || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to create post");
      }

      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/posts`] });
      toast({ title: "Posted", description: "Posted to the club." });
      resetComposer();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create post",
        variant: "destructive",
      });
    }
  };

  const handleSaveClubChanges = async () => {
    try {
      const payload: any = {
        name: editedClubName.trim(),
        description: editedClubDescription.trim(),
        isPrivate: editedClubPrivate,
        coverImage: clubCoverPreview || null,
      };

      const res = await apiRequest("PATCH", `/api/clubs/${clubId}`, payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to update club");
      }

      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ title: "Saved", description: "Club updated." });
      setIsEditingClub(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update club",
        variant: "destructive",
      });
    }
  };

  const handleClubCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setClubCoverFile(file);
    const reader = new FileReader();
    reader.onload = () => setClubCoverPreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const handleCreateEvent = async () => {
    if (!newEventTitle.trim() || !newEventDate.trim() || !newEventLocation.trim()) {
      toast({
        title: "Missing fields",
        description: "Title, date, and location are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await apiRequest("POST", `/api/clubs/${clubId}/events`, {
        title: newEventTitle.trim(),
        description: newEventDescription.trim(),
        date: newEventDate,
        location: newEventLocation.trim(),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to create event");
      }

      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/events`] });
      toast({ title: "Created", description: "Event created." });

      setNewEventTitle("");
      setNewEventDescription("");
      setNewEventDate("");
      setNewEventLocation("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create event",
        variant: "destructive",
      });
    }
  };

  // Loading states
  if (clubLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">Loading club…</div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">Club not found.</div>
        <div className="flex justify-center mt-6">
          <Button variant="outline" onClick={() => setLocation("/clubs")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clubs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setLocation("/clubs")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{club.name}</h1>
              {club.isPrivate ? (
                <Badge variant="secondary">Private</Badge>
              ) : (
                <Badge variant="outline">Public</Badge>
              )}
              {isOwner && (
                <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-200">
                  <Crown className="h-3 w-3 mr-1" />
                  Owner
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!club.isMember ? (
              <Button onClick={handleJoinClub} className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Join
              </Button>
            ) : (
              <Button variant="outline" onClick={handleLeaveClub} className="flex items-center gap-2">
                Leave
              </Button>
            )}

            {isOwner && (
              <Button
                variant={isEditingClub ? "secondary" : "outline"}
                onClick={() => setIsEditingClub((v) => !v)}
                className="flex items-center gap-2"
              >
                <Pencil className="h-4 w-4" />
                {isEditingClub ? "Cancel edit" : "Edit club"}
              </Button>
            )}
          </div>
        </div>

        {/* Cover Image */}
        {(club.coverImage || clubCoverPreview) && (
          <div className="rounded-lg overflow-hidden border">
            <img
              src={clubCoverPreview || club.coverImage}
              alt={`${club.name} cover`}
              className="w-full h-48 object-cover"
            />
          </div>
        )}

        {/* Edit Club */}
        {isOwner && isEditingClub && (
          <Card className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Club name</Label>
                <Input value={editedClubName} onChange={(e) => setEditedClubName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Privacy</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={editedClubPrivate}
                    onCheckedChange={(v) => setEditedClubPrivate(Boolean(v))}
                    id="club-private"
                  />
                  <Label htmlFor="club-private" className="text-sm">
                    Private club (invite only)
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editedClubDescription}
                onChange={(e) => setEditedClubDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Cover image</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("clubCoverInput")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload cover
                </Button>
                <input
                  id="clubCoverInput"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleClubCoverChange}
                />

                {clubCoverPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setClubCoverPreview("");
                      setClubCoverFile(null);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveClubChanges} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Save changes
              </Button>
            </div>
          </Card>
        )}

        {/* Club Description */}
        {!isEditingClub && club.description && (
          <p className="text-muted-foreground">{club.description}</p>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {club.memberCount} members
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Created {new Date(club.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="posts" className="w-full">
        <TabsList>
          <TabsTrigger value="posts" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Posts
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Events
          </TabsTrigger>
        </TabsList>

        {/* POSTS TAB */}
        <TabsContent value="posts" className="space-y-6">
          {/* Composer */}
          {club.isMember && (
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-semibold">New Post</h2>

                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Type</Label>
                  <Select value={newPostType} onValueChange={(v) => setNewPostType(v as any)}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="post">Post</SelectItem>
                      <SelectItem value="recipe">Recipe</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Review fields */}
              {newPostType === "review" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Business</Label>
                      <Input
                        id="reviewTitle"
                        ref={reviewBusinessInputRef}
                        value={reviewTitle}
                        onChange={(e) => setReviewTitle(e.target.value)}
                        placeholder="Search a business (Google Places)…"
                      />
                      <div className="text-xs text-muted-foreground">
                        Start typing and pick a suggestion.
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Rating</Label>
                      <Select value={reviewRating} onValueChange={(v) => setReviewRating(v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rating" />
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
                      <Label>Full address</Label>
                      <Input
                        value={reviewAddress}
                        onChange={(e) => setReviewAddress(e.target.value)}
                        placeholder="Auto-filled from selection"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Location (City/State)</Label>
                      <Input
                        id="reviewLocation"
                        ref={reviewLocationInputRef}
                        value={reviewLocation}
                        onChange={(e) => setReviewLocation(e.target.value)}
                        placeholder="City, State (Google Places)…"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Pros</Label>
                      <Input
                        value={reviewPros}
                        onChange={(e) => setReviewPros(e.target.value)}
                        placeholder="What was good?"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cons</Label>
                      <Input
                        value={reviewCons}
                        onChange={(e) => setReviewCons(e.target.value)}
                        placeholder="What could be better?"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Verdict</Label>
                    <Textarea
                      value={reviewVerdict}
                      onChange={(e) => setReviewVerdict(e.target.value)}
                      rows={2}
                      placeholder="Would you recommend it?"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Anything else you want to remember?"
                    />
                  </div>
                </div>
              )}

              {/* Recipe fields */}
              {newPostType === "recipe" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Recipe title</Label>
                      <Input value={recipeTitle} onChange={(e) => setRecipeTitle(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label>Difficulty</Label>
                      <Select value={recipeDifficulty} onValueChange={(v) => setRecipeDifficulty(v)}>
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

                    <div className="space-y-2">
                      <Label>Cook time (minutes)</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={recipeCookTime}
                        onChange={(e) => setRecipeCookTime(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Servings</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={recipeServings}
                        onChange={(e) => setRecipeServings(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Ingredients</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setRecipeIngredients((prev) => [
                            ...prev,
                            { amount: "", unit: "", name: "" },
                          ])
                        }
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {recipeIngredients.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4 md:col-span-2">
                            <Select
                              value={row.amount || SELECT_NONE}
                              onValueChange={(v) =>
                                setRecipeIngredients((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, amount: v === SELECT_NONE ? "" : v } : r
                                  )
                                )
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

                          <div className="col-span-4 md:col-span-2">
                            <Select
                              value={row.unit || SELECT_NONE}
                              onValueChange={(v) =>
                                setRecipeIngredients((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, unit: v === SELECT_NONE ? "" : v } : r
                                  )
                                )
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

                          <div className="col-span-4 md:col-span-7">
                            <Input
                              value={row.name}
                              onChange={(e) =>
                                setRecipeIngredients((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, name: e.target.value } : r
                                  )
                                )
                              }
                              placeholder="Ingredient"
                              className="h-9"
                            />
                          </div>

                          <div className="col-span-12 md:col-span-1 flex justify-end">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                setRecipeIngredients((prev) =>
                                  prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)
                                )
                              }
                              disabled={recipeIngredients.length <= 1}
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
                      <Label>Instructions</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setRecipeInstructions((prev) => [...prev, ""])}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add step
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {recipeInstructions.map((step, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Input
                            value={step}
                            onChange={(e) =>
                              setRecipeInstructions((prev) =>
                                prev.map((s, i) => (i === idx ? e.target.value : s))
                              )
                            }
                            placeholder={`Step ${idx + 1}`}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setRecipeInstructions((prev) =>
                                prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)
                              )
                            }
                            disabled={recipeInstructions.length <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Media + Content */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-4">
                    <Label>{newPostType === "post" ? "Post" : newPostType === "recipe" ? "Caption" : "Extra (hashtags / extra lines)"}</Label>
                  </div>

                  <div className="md:col-span-8 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("newPostMediaCamera")?.click()}
                      className="flex items-center gap-1"
                    >
                      <Camera className="h-4 w-4" />
                      Camera
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("newPostMediaFile")?.click()}
                      className="flex items-center gap-1"
                    >
                      <Upload className="h-4 w-4" />
                      Upload
                    </Button>

                    <input
                      id="newPostMediaCamera"
                      type="file"
                      accept="image/*,video/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleNewPostImageChange}
                    />
                    <input
                      id="newPostMediaFile"
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleNewPostImageChange}
                    />
                  </div>

                  <div className="md:col-span-12">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <Label htmlFor="newPostMediaUrl" className="text-xs text-muted-foreground">
                          Media URL (optional)
                        </Label>
                        <Input
                          id="newPostMediaUrl"
                          type="url"
                          placeholder="https://example.com/image.jpg or .mp4"
                          value={newPostImageFile ? "" : newPostImagePreview}
                          onChange={(e) => {
                            const url = e.target.value;
                            setNewPostImageFile(null);
                            setNewPostImagePreview(url);
                            setNewPostMediaKind(url ? (isVideoUrl(url) ? "video" : "image") : "");
                          }}
                        />
                      </div>

                      <div className="md:col-span-1 flex items-end justify-end">
                        {(newPostImagePreview || newPostImageFile) && (
                          <Button type="button" variant="outline" size="sm" onClick={clearNewPostImage}>
                            <X className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>

                    {newPostImagePreview ? (
                      <div className="mt-3 rounded-md border p-3 bg-muted/10">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs text-muted-foreground">Preview</div>
                          {newPostMediaKind === "video" && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Video className="h-3.5 w-3.5" />
                              Video
                            </div>
                          )}
                        </div>

                        {newPostMediaKind === "video" ? (
                          <video
                            src={newPostImagePreview}
                            controls
                            className="w-full max-w-xl mx-auto h-64 object-cover rounded-md"
                          />
                        ) : (
                          <img
                            src={newPostImagePreview}
                            alt="Preview"
                            className="w-full max-w-xl mx-auto h-64 object-cover rounded-md"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                            }}
                          />
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="md:col-span-12">
                    <Textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      rows={newPostType === "review" ? 3 : 4}
                      placeholder={
                        newPostType === "review"
                          ? "#tags or extra lines (optional)"
                          : "Write something to the club…"
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetComposer}>
                  Reset
                </Button>
                <Button type="button" onClick={handleCreatePost} className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Post
                </Button>
              </div>
            </Card>
          )}

          {/* Posts list */}
          <div className="space-y-4">
            {postsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading posts…</div>
            ) : posts && posts.length > 0 ? (
              posts.map((post) => (
                <Card key={post.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex items-center justify-center text-sm font-medium">
                        {post.user?.profilePicture ? (
                          <img
                            src={post.user.profilePicture}
                            alt={post.user.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (post.user?.username || "U").charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{post.user?.username || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(post.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {post.postType && (
                      <Badge variant="outline" className="capitalize">
                        {post.postType}
                      </Badge>
                    )}
                  </div>

                  {/* Media */}
                  {post.imageUrl ? (
                    <div className="rounded-md overflow-hidden border bg-muted/10">
                      {isVideoUrl(post.imageUrl) ? (
                        <video src={post.imageUrl} controls className="w-full max-h-[420px] object-cover" />
                      ) : (
                        <img src={post.imageUrl} alt="Post media" className="w-full max-h-[420px] object-cover" />
                      )}
                    </div>
                  ) : null}

                  {/* Content */}
                  {post.content && (
                    <div className="whitespace-pre-wrap leading-relaxed">{post.content}</div>
                  )}
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">No posts yet.</div>
            )}
          </div>
        </TabsContent>

        {/* EVENTS TAB */}
        <TabsContent value="events" className="space-y-6">
          {club.isMember && isOwner && (
            <Card className="p-4 space-y-4">
              <h2 className="font-semibold">Create Event</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="datetime-local" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Location</Label>
                  <Input value={newEventLocation} onChange={(e) => setNewEventLocation(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Description</Label>
                  <Textarea value={newEventDescription} onChange={(e) => setNewEventDescription(e.target.value)} rows={3} />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleCreateEvent} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create event
                </Button>
              </div>
            </Card>
          )}

          <div className="space-y-4">
            {eventsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading events…</div>
            ) : events && events.length > 0 ? (
              events.map((evt) => (
                <Card key={evt.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{evt.title}</div>
                    <Badge variant="outline">{new Date(evt.date).toLocaleString()}</Badge>
                  </div>
                  {evt.location && <div className="text-sm text-muted-foreground">{evt.location}</div>}
                  {evt.description && <div className="text-sm">{evt.description}</div>}
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">No events yet.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
