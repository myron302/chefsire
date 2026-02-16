import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import {
  Users,
  MessageSquare,
  ArrowLeft,
  Send,
  Calendar,
  Crown,
  Pencil,
  Save,
  X,
  Camera,
  Upload,
  Plus,
  Minus,
} from "lucide-react";

// Server /api/clubs/:id returns: { club: { club: ClubRow, creator: Creator }, stats: Stats }
type ClubRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  coverImage: string | null;
  isPublic: boolean;
  rules: string | null;
  createdAt: string;
};

type Creator = {
  id: string;
  username: string;
  displayName: string | null;
};

type Stats = {
  memberCount: number;
  postCount: number;
};

type ClubDetailResponse = {
  club: {
    club: ClubRow;
    creator: Creator;
  };
  stats: Stats;
};

type Post = {
  post: {
    id: string;
    clubId: string;
    userId: string;
    content: string;
    imageUrl: string | null;
    likesCount: number;
    commentsCount: number;
    createdAt: string;
    recipeId?: string | null;
  };
  author: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

type PostType = "post" | "recipe" | "review";

type IngredientRow = {
  qty: string; // NEW: qty separate
  unit: string;
  item: string;
};

export default function ClubDetailPage() {
  const { id } = useParams();
  const clubId = String(id || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const [newPostContent, setNewPostContent] = useState("");
  const [newPostType, setNewPostType] = useState<PostType>("post");

  const [newPostImageFile, setNewPostImageFile] = useState<File | null>(null);
  const [newPostImagePreview, setNewPostImagePreview] = useState<string>("");

  // ✅ NEW: quantity (number/fraction) dropdown options
  const QTY_OPTIONS = [
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

  const [recipeTitle, setRecipeTitle] = useState("");
  const [recipeCookTime, setRecipeCookTime] = useState("");
  const [recipeServings, setRecipeServings] = useState("");
  const [recipeDifficulty, setRecipeDifficulty] = useState("Easy");

  // ✅ ingredient rows now qty + unit + item
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([
    { qty: "1", unit: "cup", item: "" },
  ]);

  const [instructionRows, setInstructionRows] = useState<string[]>([""]);

  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewPros, setReviewPros] = useState("");
  const [reviewCons, setReviewCons] = useState("");
  const [reviewVerdict, setReviewVerdict] = useState("");

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState("");

  // Fetch club details
  const { data: clubData, isLoading: clubLoading } = useQuery<ClubDetailResponse>({
    queryKey: [`/api/clubs/${clubId}`],
    enabled: !!clubId,
  });

  // Fetch club posts
  const { data: postsData, isLoading: postsLoading } = useQuery<{ posts: Post[] }>({
    queryKey: [`/api/clubs/${clubId}/posts`],
    enabled: !!clubId,
  });

  // Check membership status
  const { data: myClubsData } = useQuery<{ clubs: any[] }>({
    queryKey: ["/api/clubs/my-clubs"],
    enabled: !!user,
  });

  const isMember = useMemo(() => {
    const list = myClubsData?.clubs;
    if (!Array.isArray(list) || !clubId) return false;
    return list.some((c: any) => c?.club?.id === clubId || c?.clubId === clubId || c?.id === clubId);
  }, [myClubsData?.clubs, clubId]);

  // Join club mutation
  const joinClubMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clubs/${clubId}/join`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to join club");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs/my-clubs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ title: "✓ Joined club", description: "Welcome to the club!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to join club", description: error.message, variant: "destructive" });
    },
  });

  // Leave club mutation
  const leaveClubMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clubs/${clubId}/leave`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to leave club");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs/my-clubs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ title: "✓ Left club" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to leave club", description: error.message, variant: "destructive" });
    },
  });

  // Image handling
  const handleNewPostImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewPostImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setNewPostImagePreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const clearNewPostImage = () => {
    setNewPostImageFile(null);
    setNewPostImagePreview("");
  };

  // Ingredient helpers
  const addIngredientRow = () =>
    setIngredientRows((prev) => [...prev, { qty: "1", unit: "", item: "" }]);

  const removeIngredientRow = (index: number) =>
    setIngredientRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const updateIngredientRow = (index: number, patch: Partial<IngredientRow>) =>
    setIngredientRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  // Instruction helpers
  const addInstructionRow = () => setInstructionRows((prev) => [...prev, ""]);
  const removeInstructionRow = (index: number) =>
    setInstructionRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  const updateInstructionRow = (index: number, value: string) =>
    setInstructionRows((prev) => prev.map((row, i) => (i === index ? value : row)));

  const resetComposer = () => {
    setNewPostType("post");
    setNewPostContent("");
    clearNewPostImage();

    setRecipeTitle("");
    setRecipeCookTime("");
    setRecipeServings("");
    setRecipeDifficulty("Easy");
    setIngredientRows([{ qty: "1", unit: "cup", item: "" }]);
    setInstructionRows([""]);

    setReviewTitle("");
    setReviewRating("5");
    setReviewPros("");
    setReviewCons("");
    setReviewVerdict("");
  };

  const createPostMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/clubs/${clubId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create post");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/posts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ title: "✓ Post created" });
      resetComposer();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create post", description: error.message, variant: "destructive" });
    },
  });

  const handleCreatePost = () => {
    if (!user) {
      toast({ title: "Login required", description: "Please login to post", variant: "destructive" });
      return;
    }

    const type = newPostType;

    // Recipe
    if (type === "recipe") {
      if (!recipeTitle.trim()) {
        toast({ title: "Recipe title required", description: "Please add a recipe title", variant: "destructive" });
        return;
      }

      const ingredientLines = ingredientRows
        .map((row) => {
          const qty = String(row.qty || "").trim();
          const unit = String(row.unit || "").trim();
          const item = String(row.item || "").trim();
          const left = [qty, unit].filter(Boolean).join(" ");
          return [left, item].filter(Boolean).join(" ").trim();
        })
        .filter(Boolean);

      const instructionLines = instructionRows.map((s) => String(s || "").trim()).filter(Boolean);

      if (ingredientLines.length === 0) {
        toast({ title: "Ingredients required", description: "Add at least one ingredient", variant: "destructive" });
        return;
      }
      if (instructionLines.length === 0) {
        toast({ title: "Instructions required", description: "Add at least one step", variant: "destructive" });
        return;
      }

      const notes = newPostContent.trim();
      const content = `🍽️ Recipe: ${recipeTitle.trim()}` + (notes ? `\n\n${notes}` : "");

      createPostMutation.mutate({
        postType: "recipe",
        content,
        imageUrl: newPostImagePreview || null,
        recipe: {
          title: recipeTitle.trim(),
          imageUrl: newPostImagePreview || null,
          ingredients: ingredientLines,
          instructions: instructionLines,
          cookTime: recipeCookTime ? parseInt(recipeCookTime) : null,
          servings: recipeServings ? parseInt(recipeServings) : null,
          difficulty: recipeDifficulty,
        },
      });
      return;
    }

    // Review
    if (type === "review") {
      if (!reviewTitle.trim()) {
        toast({ title: "Review title required", description: "Please add what you're reviewing", variant: "destructive" });
        return;
      }

      const notes = newPostContent.trim();
      const content =
        `📝 Review: ${reviewTitle.trim()}\n` +
        `⭐ Rating: ${reviewRating}/5\n\n` +
        (reviewPros.trim() ? `✅ Pros: ${reviewPros.trim()}\n\n` : "") +
        (reviewCons.trim() ? `⚠️ Cons: ${reviewCons.trim()}\n\n` : "") +
        (reviewVerdict.trim() ? `💡 Verdict: ${reviewVerdict.trim()}\n\n` : "") +
        (notes ? `Notes: ${notes}` : "");

      createPostMutation.mutate({
        postType: "review",
        content,
        imageUrl: newPostImagePreview || null,
      });
      return;
    }

    // Standard post
    if (!newPostContent.trim()) {
      toast({ title: "Content required", description: "Please enter post content", variant: "destructive" });
      return;
    }

    createPostMutation.mutate({
      postType: "post",
      content: newPostContent.trim(),
      imageUrl: newPostImagePreview || null,
    });
  };

  const updatePostMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const res = await fetch(`/api/clubs/${clubId}/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update post");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/posts`] });
      toast({ title: "✓ Post saved" });
      setEditingPostId(null);
      setEditPostContent("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save post", description: error.message, variant: "destructive" });
    },
  });

  const startEditingPost = (post: Post) => {
    setEditingPostId(post.post.id);
    setEditPostContent(post.post.content);
  };

  const cancelEditingPost = () => {
    setEditingPostId(null);
    setEditPostContent("");
  };

  const saveEditedPost = () => {
    if (!editingPostId) return;

    if (!editPostContent.trim()) {
      toast({ title: "Content required", description: "Please enter post content", variant: "destructive" });
      return;
    }

    updatePostMutation.mutate({ postId: editingPostId, content: editPostContent.trim() });
  };

  if (clubLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        </div>
      </div>
    );
  }

  // Normalize data shape (defensive)
  const club = clubData?.club?.club;
  const creator = clubData?.club?.creator;
  const stats = clubData?.stats;

  if (!club || !creator || !stats) {
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

  const posts = postsData?.posts || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Link href="/clubs">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clubs
          </Button>
        </Link>

        {/* Club Header */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-2xl font-bold">{club.name}</CardTitle>
                </div>

                {club.description ? (
                  <CardDescription className="text-base">{club.description}</CardDescription>
                ) : (
                  <CardDescription className="text-base text-slate-500">No description</CardDescription>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="secondary" className="capitalize">
                    {club.category}
                  </Badge>
                  {club.isPublic ? <Badge variant="outline">Public</Badge> : <Badge variant="outline">Private</Badge>}
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center justify-end gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {stats.memberCount}
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    {stats.postCount}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 text-xs text-slate-500 mt-2">
                  <Calendar className="h-3 w-3" />
                  {new Date(club.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Creator & Join/Leave */}
            <div className="flex items-center justify-between gap-4 pt-2 border-t">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>
                    {(creator.displayName || creator.username || "U").slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <div className="text-sm font-medium">{creator.displayName || creator.username}</div>
                  <div className="text-xs text-slate-500">@{creator.username}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!user ? (
                  <Link href="/login">
                    <Button>Log in to Join</Button>
                  </Link>
                ) : isMember ? (
                  <Button variant="outline" onClick={() => leaveClubMutation.mutate()} disabled={leaveClubMutation.isPending}>
                    {leaveClubMutation.isPending ? "Leaving..." : "Leave Club"}
                  </Button>
                ) : (
                  <Button onClick={() => joinClubMutation.mutate()} disabled={joinClubMutation.isPending}>
                    {joinClubMutation.isPending ? "Joining..." : "Join Club"}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Rules */}
        {club.rules ? (
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Club Rules</CardTitle>
              <CardDescription className="whitespace-pre-wrap">{club.rules}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {/* New Post */}
        {user && isMember ? (
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Create a Post</CardTitle>
              <CardDescription>Choose a template (post, recipe, review) and share with the club</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-12 items-end">
                <div className="md:col-span-4">
                  <Label>Post Type</Label>
                  <Select value={newPostType} onValueChange={(v) => setNewPostType(v as any)}>
                    <SelectTrigger data-testid="club-select-post-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="post">Post</SelectItem>
                      <SelectItem value="recipe">Recipe</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-8 flex justify-end gap-2">
                  <input
                    id="club-post-image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleNewPostImageChange}
                  />
                  <Button type="button" variant="outline" onClick={() => document.getElementById("club-post-image")?.click()}>
                    <Camera className="h-4 w-4 mr-2" />
                    Add Photo
                  </Button>
                  {newPostImagePreview ? (
                    <Button type="button" variant="outline" onClick={clearNewPostImage}>
                      <X className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>

              {newPostImagePreview ? (
                <div className="relative border rounded-lg overflow-hidden bg-slate-50">
                  <img src={newPostImagePreview} alt="Post preview" className="w-full max-h-80 object-cover" />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>{newPostType === "post" ? "Post" : "Caption / Notes (optional)"}</Label>
                <Textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder={newPostType === "post" ? "Write your post..." : "Add a short intro, story, or extra details..."}
                  rows={newPostType === "post" ? 4 : 3}
                />
              </div>

              {newPostType === "recipe" ? (
                <div className="space-y-4">
                  <Separator />
                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-12">
                      <Label>Recipe Title</Label>
                      <Input
                        value={recipeTitle}
                        onChange={(e) => setRecipeTitle(e.target.value)}
                        placeholder="e.g., Honey Garlic Chicken"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <Label>Cook Time (minutes)</Label>
                      <Input
                        value={recipeCookTime}
                        onChange={(e) => setRecipeCookTime(e.target.value)}
                        placeholder="e.g., 35"
                        inputMode="numeric"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <Label>Servings</Label>
                      <Input
                        value={recipeServings}
                        onChange={(e) => setRecipeServings(e.target.value)}
                        placeholder="e.g., 4"
                        inputMode="numeric"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <Label>Difficulty</Label>
                      <Select value={recipeDifficulty} onValueChange={setRecipeDifficulty}>
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
                  </div>

                  {/* ✅ UPDATED INGREDIENTS UI: qty dropdown + unit dropdown + ingredient */}
                  <div className="space-y-2">
                    <Label>Ingredients</Label>

                    <div className="space-y-2">
                      {ingredientRows.map((row, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4 sm:col-span-2">
                            <Select value={row.qty} onValueChange={(v) => updateIngredientRow(index, { qty: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Qty" />
                              </SelectTrigger>
                              <SelectContent>
                                {QTY_OPTIONS.map((opt) => (
                                  <SelectItem key={opt || "__blank"} value={opt}>
                                    {opt || "—"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="col-span-4 sm:col-span-2">
                            <Select value={row.unit} onValueChange={(v) => updateIngredientRow(index, { unit: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Unit" />
                              </SelectTrigger>
                              <SelectContent>
                                {UNIT_OPTIONS.map((opt) => (
                                  <SelectItem key={opt || "none"} value={opt}>
                                    {opt || "—"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="col-span-12 sm:col-span-7">
                            <Input
                              value={row.item}
                              onChange={(e) => updateIngredientRow(index, { item: e.target.value })}
                              placeholder="Ingredient (e.g., flour)"
                            />
                          </div>

                          <div className="col-span-12 sm:col-span-1 flex justify-end">
                            {ingredientRows.length > 1 ? (
                              <Button type="button" variant="outline" size="sm" onClick={() => removeIngredientRow(index)}>
                                <Minus className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button type="button" variant="outline" size="sm" onClick={addIngredientRow} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Ingredient
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Instructions</Label>
                    <div className="space-y-2">
                      {instructionRows.map((step, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input value={step} onChange={(e) => updateInstructionRow(index, e.target.value)} placeholder={`Step ${index + 1}`} />
                          {instructionRows.length > 1 ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => removeInstructionRow(index)}>
                              <Minus className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    <Button type="button" variant="outline" size="sm" onClick={addInstructionRow} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Step
                    </Button>
                  </div>
                </div>
              ) : null}

              {newPostType === "review" ? (
                <div className="space-y-4">
                  <Separator />
                  <div className="space-y-2">
                    <Label>What are you reviewing?</Label>
                    <Input value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} placeholder="e.g., 'Stainless Steel Pan'" />
                  </div>

                  <div className="space-y-2">
                    <Label>Rating</Label>
                    <Select value={reviewRating} onValueChange={setReviewRating}>
                      <SelectTrigger>
                        <SelectValue placeholder="Rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 - Amazing</SelectItem>
                        <SelectItem value="4">4 - Great</SelectItem>
                        <SelectItem value="3">3 - Good</SelectItem>
                        <SelectItem value="2">2 - Meh</SelectItem>
                        <SelectItem value="1">1 - Bad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Pros</Label>
                    <Textarea value={reviewPros} onChange={(e) => setReviewPros(e.target.value)} rows={2} placeholder="What did you like?" />
                  </div>

                  <div className="space-y-2">
                    <Label>Cons</Label>
                    <Textarea value={reviewCons} onChange={(e) => setReviewCons(e.target.value)} rows={2} placeholder="What didn’t you like?" />
                  </div>

                  <div className="space-y-2">
                    <Label>Verdict</Label>
                    <Textarea value={reviewVerdict} onChange={(e) => setReviewVerdict(e.target.value)} rows={2} placeholder="Would you recommend it?" />
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button onClick={handleCreatePost} disabled={createPostMutation.isPending}>
                  <Send className="h-4 w-4 mr-2" />
                  {createPostMutation.isPending ? "Posting..." : "Post"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Posts */}
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Club Posts</CardTitle>
            <CardDescription>
              {postsLoading ? "Loading posts..." : `${posts.length} post${posts.length === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {!postsLoading && posts.length === 0 ? (
              <div className="text-center text-slate-500 py-10">No posts yet.</div>
            ) : (
              posts.map((p) => (
                <Card key={p.post.id} className="border border-slate-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {(p.author.displayName || p.author.username || "U").slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="leading-tight">
                        <div className="text-sm font-medium">{p.author.displayName || p.author.username}</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {clubData?.club?.creator?.id && p.post.userId === clubData.club.creator.id ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                              <Crown className="h-3 w-3 mr-1" />
                              Creator
                            </Badge>
                          ) : null}
                          {p.post.recipeId ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                              🍽️ Recipe
                            </Badge>
                          ) : null}
                          {typeof p.post.content === "string" && p.post.content.startsWith("📝 Review:") ? (
                            <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">
                              ⭐ Review
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-500">{new Date(p.post.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {editingPostId === p.post.id ? (
                      <>
                        <Textarea value={editPostContent} onChange={(e) => setEditPostContent(e.target.value)} rows={3} />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={cancelEditingPost}>
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                          <Button size="sm" onClick={saveEditedPost} disabled={updatePostMutation.isPending}>
                            <Save className="h-4 w-4 mr-1" />
                            {updatePostMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap text-slate-800">{p.post.content}</p>
                        {p.post.imageUrl ? (
                          <div className="overflow-hidden rounded-lg border bg-slate-50">
                            <img src={p.post.imageUrl} alt="Club post" className="w-full max-h-96 object-cover" />
                          </div>
                        ) : null}
                        {user?.id === p.post.userId && (
                          <div className="flex justify-end">
                            <Button variant="outline" size="sm" onClick={() => startEditingPost(p)}>
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
