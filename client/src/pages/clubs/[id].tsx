import { useMemo, useRef, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Image as ImageIcon,
  Trash2,
  Plus,
  Minus,
  Lock,
  CheckCircle2,
  AlertCircle,
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

type ClubPostRow = {
  id: string;
  clubId: string;
  userId: string;
  content: string;
  imageUrl: string | null;
  recipeId: string | null;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
};

type ClubAuthor = {
  id: string;
  username: string;
  displayName: string | null;
};

type ClubRecipe = {
  id: string;
  title: string;
  imageUrl: string | null;
  ingredients: string[];
  instructions: string[];
  cookTime: number | null;
  servings: number | null;
  difficulty: string | null;
};

type ClubPost = {
  post: ClubPostRow;
  author: ClubAuthor;
  // Optional enrichment (only if your server includes it)
  recipe?: ClubRecipe | null;
};

type MembershipResponse =
  | {
      isMember: boolean;
      role?: "owner" | "member" | "pending";
    }
  | undefined;

type ParsedContent =
  | {
      type: "post";
      caption: string;
    }
  | {
      type: "review";
      caption: string;
      review: {
        subject: string;
        rating: number;
        pros: string;
        cons: string;
        verdict: string;
      };
    };

function safeParseContent(raw: string): ParsedContent {
  const s = String(raw ?? "");
  if (!s.trim()) return { type: "post", caption: "" };
  if (s.trim().startsWith("{")) {
    try {
      const obj = JSON.parse(s);
      if (obj && obj.type === "review") {
        const rating = Number(obj?.review?.rating ?? 0);
        return {
          type: "review",
          caption: String(obj?.caption ?? ""),
          review: {
            subject: String(obj?.review?.subject ?? ""),
            rating: Number.isFinite(rating) ? rating : 0,
            pros: String(obj?.review?.pros ?? ""),
            cons: String(obj?.review?.cons ?? ""),
            verdict: String(obj?.review?.verdict ?? ""),
          },
        };
      }
    } catch {
      // fallthrough
    }
  }
  return { type: "post", caption: s };
}

type IngredientRow = { amount: string; unit: string; name: string };

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

function parseIngredientString(raw: string): IngredientRow {
  const s = (raw ?? "").trim();
  if (!s) return { amount: "", unit: "", name: "" };

  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { amount: "", unit: "", name: s };

  const looksLikeFraction = (t: string) => /^\d+\/\d+$/.test(t);
  const looksLikeNumber = (t: string) => /^\d+(\.\d+)?$/.test(t);

  let amount = "";
  let unit = "";
  let nameStart = 0;

  const first = parts[0];
  const second = parts[1] ?? "";

  if (looksLikeNumber(first) || looksLikeFraction(first)) {
    if (looksLikeFraction(second)) {
      amount = `${first} ${second}`;
      nameStart = 2;
    } else {
      amount = first;
      nameStart = 1;
    }
  }

  const maybeUnit = parts[nameStart] ?? "";
  if (UNIT_OPTIONS.includes(maybeUnit)) {
    unit = maybeUnit;
    nameStart += 1;
  }

  const name = parts.slice(nameStart).join(" ").trim();
  return { amount, unit, name: name || s };
}

function normalizeSteps(steps: string[]): string[] {
  return steps.map((s) => (s ?? "").trim()).filter(Boolean);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function ClubDetailPage() {
  const { id } = useParams();
  const clubId = String(id || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  // Composer state
  const [postType, setPostType] = useState<"post" | "recipe" | "review">("post");
  const [caption, setCaption] = useState("");
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Recipe draft
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeTitle, setRecipeTitle] = useState("");
  const [recipeDifficulty, setRecipeDifficulty] = useState("Easy");
  const [recipeCookTime, setRecipeCookTime] = useState<string>("");
  const [recipeServings, setRecipeServings] = useState<string>("");
  const [recipeIngredients, setRecipeIngredients] = useState<IngredientRow[]>([
    { amount: "", unit: "", name: "" },
  ]);
  const [recipeSteps, setRecipeSteps] = useState<string[]>([""]);

  // Review draft
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSubject, setReviewSubject] = useState("");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewPros, setReviewPros] = useState("");
  const [reviewCons, setReviewCons] = useState("");
  const [reviewVerdict, setReviewVerdict] = useState("");

  // Edit state
  const [editing, setEditing] = useState<null | {
    postId: string;
    type: "post" | "recipe" | "review";
    caption: string;
    imageUrl: string;
    recipeId?: string | null;
  }>(null);

  const [editCaption, setEditCaption] = useState("");
  const [editImagePreview, setEditImagePreview] = useState("");
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  // Edit recipe state
  const [editRecipeOpen, setEditRecipeOpen] = useState(false);
  const [editRecipeId, setEditRecipeId] = useState<string | null>(null);
  const [editRecipeTitle, setEditRecipeTitle] = useState("");
  const [editRecipeDifficulty, setEditRecipeDifficulty] = useState("Easy");
  const [editRecipeCookTime, setEditRecipeCookTime] = useState<string>("");
  const [editRecipeServings, setEditRecipeServings] = useState<string>("");
  const [editRecipeIngredients, setEditRecipeIngredients] = useState<IngredientRow[]>([
    { amount: "", unit: "", name: "" },
  ]);
  const [editRecipeSteps, setEditRecipeSteps] = useState<string[]>([""]);

  // Edit review state
  const [editReviewOpen, setEditReviewOpen] = useState(false);
  const [editReviewSubject, setEditReviewSubject] = useState("");
  const [editReviewRating, setEditReviewRating] = useState("5");
  const [editReviewPros, setEditReviewPros] = useState("");
  const [editReviewCons, setEditReviewCons] = useState("");
  const [editReviewVerdict, setEditReviewVerdict] = useState("");

  // Fetch club details
  const { data: clubData, isLoading: clubLoading } = useQuery<ClubDetailResponse>({
    queryKey: [`/api/clubs/${clubId}`],
    enabled: !!clubId,
  });

  // Fetch club posts
  const { data: postsData, isLoading: postsLoading } = useQuery<{ posts: ClubPost[] }>({
    queryKey: [`/api/clubs/${clubId}/posts`],
    enabled: !!clubId,
  });

  // Membership (prefer dedicated endpoint if present, else fallback to my-clubs)
  const { data: membershipData } = useQuery<MembershipResponse>({
    queryKey: [`/api/clubs/${clubId}/membership`],
    enabled: !!clubId && !!user,
    queryFn: async () => {
      const res = await fetch(`/api/clubs/${clubId}/membership`, { credentials: "include" });
      if (res.status === 404) return undefined;
      if (!res.ok) return undefined;
      return res.json();
    },
  });

  const { data: myClubsData } = useQuery<{ clubs: any[] }>({
    queryKey: ["/api/clubs/my-clubs"],
    enabled: !!user && !membershipData,
  });

  // Normalize data shape (defensive)
  const club = clubData?.club?.club;
  const creator = clubData?.club?.creator;
  const stats = clubData?.stats;

  const isOwner = !!user?.id && !!creator?.id && user.id === creator.id;

  const isMember = useMemo(() => {
    if (!user?.id) return false;
    if (membershipData?.isMember) return true;
    if (membershipData?.role === "owner" || membershipData?.role === "member") return true;
    if (isOwner) return true;

    const list = myClubsData?.clubs;
    if (!Array.isArray(list) || !clubId) return false;
    return list.some((c: any) => c?.club?.id === clubId || c?.clubId === clubId || c?.id === clubId);
  }, [user?.id, membershipData, myClubsData?.clubs, clubId, isOwner]);

  const membershipRole = membershipData?.role ?? (isOwner ? "owner" : isMember ? "member" : undefined);

  // Join club mutation
  const joinClubMutation = useMutation({
    mutationFn: async () => {
      const endpoint = club?.isPublic ? `/api/clubs/${clubId}/join` : `/api/clubs/${clubId}/join`;
      const res = await fetch(endpoint, {
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
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/membership`] });
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
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/membership`] });
      toast({ title: "✓ Left club" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to leave club", description: error.message, variant: "destructive" });
    },
  });

  const resetComposer = () => {
    setPostType("post");
    setCaption("");
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";

    setRecipeTitle("");
    setRecipeDifficulty("Easy");
    setRecipeCookTime("");
    setRecipeServings("");
    setRecipeIngredients([{ amount: "", unit: "", name: "" }]);
    setRecipeSteps([""]);

    setReviewSubject("");
    setReviewRating("5");
    setReviewPros("");
    setReviewCons("");
    setReviewVerdict("");
  };

  const serializeContentForSubmit = (): { content: string; kind: "post" | "recipe" | "review" } => {
    if (postType === "review") {
      const payload = {
        type: "review",
        caption: caption.trim(),
        review: {
          subject: reviewSubject.trim(),
          rating: Number(reviewRating || "0"),
          pros: reviewPros.trim(),
          cons: reviewCons.trim(),
          verdict: reviewVerdict.trim(),
        },
      };
      return { content: JSON.stringify(payload), kind: "review" };
    }

    // For recipe posts, caption is optional—fallback to the recipe title so the server's "content required" rule is satisfied.
    if (postType === "recipe") {
      const fallback = recipeTitle.trim() ? `Shared a recipe: ${recipeTitle.trim()}` : "Shared a recipe";
      return { content: caption.trim() || fallback, kind: "recipe" };
    }

    return { content: caption.trim(), kind: "post" };
  };

  // Create club post mutation
  const createPostMutation = useMutation({
    mutationFn: async () => {
      const { content, kind } = serializeContentForSubmit();

      if (!content || !content.trim()) {
        throw new Error("Please write something before posting");
      }

      const body: any = { content };

      if (imagePreview) body.imageUrl = imagePreview;

      if (kind === "recipe") {
        const ingredients = ingredientRowsToStrings(recipeIngredients);
        const instructions = normalizeSteps(recipeSteps);

        if (!recipeTitle.trim()) throw new Error("Recipe title is required");
        if (ingredients.length === 0) throw new Error("Add at least one ingredient");
        if (instructions.length === 0) throw new Error("Add at least one instruction step");

        body.recipe = {
          title: recipeTitle.trim(),
          ingredients,
          instructions,
          cookTime: recipeCookTime ? Number(recipeCookTime) : null,
          servings: recipeServings ? Number(recipeServings) : null,
          difficulty: recipeDifficulty || "Easy",
        };
      }

      const res = await fetch(`/api/clubs/${clubId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
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
      toast({ title: "✓ Posted" });
      resetComposer();
    },
    onError: (error: Error) => {
      toast({ title: "Post failed", description: error.message, variant: "destructive" });
    },
  });

  // Update club post mutation (caption + image + (optional) recipe/review payload)
  const updatePostMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/clubs/${clubId}/posts/${payload.postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload.body),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update post");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/posts`] });
      toast({ title: "✓ Saved" });
      setEditing(null);
      setEditCaption("");
      setEditImagePreview("");
      setEditRecipeId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  // Delete post mutation (owner can delete any; author can delete theirs)
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/clubs/${clubId}/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete post");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/posts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ title: "Deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  // Delete club (owner only)
  const deleteClubMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clubs/${clubId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete club");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Club deleted" });
      window.location.href = "/clubs";
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const openEdit = async (p: ClubPost) => {
    const parsed = safeParseContent(p.post.content);
    const kind: "post" | "recipe" | "review" =
      p.post.recipeId ? "recipe" : parsed.type === "review" ? "review" : "post";

    setEditing({
      postId: p.post.id,
      type: kind,
      caption: parsed.caption,
      imageUrl: p.post.imageUrl || "",
      recipeId: p.post.recipeId,
    });

    setEditCaption(parsed.caption);
    setEditImagePreview(p.post.imageUrl || "");

    // Review prefill
    if (parsed.type === "review") {
      setEditReviewSubject(parsed.review.subject);
      setEditReviewRating(String(parsed.review.rating || 0));
      setEditReviewPros(parsed.review.pros);
      setEditReviewCons(parsed.review.cons);
      setEditReviewVerdict(parsed.review.verdict);
    }

    // Recipe prefill (from server enrichment if present; else fetch)
    if (p.post.recipeId) {
      setEditRecipeId(p.post.recipeId);

      const base = p.recipe ?? null;
      if (base) {
        setEditRecipeTitle(base.title || "");
        setEditRecipeDifficulty(base.difficulty || "Easy");
        setEditRecipeCookTime(base.cookTime ? String(base.cookTime) : "");
        setEditRecipeServings(base.servings ? String(base.servings) : "");
        const ing = (base.ingredients || []).map(parseIngredientString);
        setEditRecipeIngredients(ing.length ? ing : [{ amount: "", unit: "", name: "" }]);
        const steps = (base.instructions || []).filter(Boolean);
        setEditRecipeSteps(steps.length ? steps : [""]);
        return;
      }

      // Fallback fetch if your server supports it:
      try {
        const res = await fetch(`/api/clubs/${clubId}/recipes/${p.post.recipeId}`, {
          credentials: "include",
        });
        if (res.ok) {
          const r: ClubRecipe = await res.json();
          setEditRecipeTitle(r.title || "");
          setEditRecipeDifficulty(r.difficulty || "Easy");
          setEditRecipeCookTime(r.cookTime ? String(r.cookTime) : "");
          setEditRecipeServings(r.servings ? String(r.servings) : "");
          const ing = (r.ingredients || []).map(parseIngredientString);
          setEditRecipeIngredients(ing.length ? ing : [{ amount: "", unit: "", name: "" }]);
          const steps = (r.instructions || []).filter(Boolean);
          setEditRecipeSteps(steps.length ? steps : [""]);
        }
      } catch {
        // ignore
      }
    }
  };

  const saveEdit = async () => {
    if (!editing) return;

    const body: any = {};
    const trimmedCaption = editCaption.trim();

    if (editing.type === "review") {
      const payload = {
        type: "review",
        caption: trimmedCaption,
        review: {
          subject: editReviewSubject.trim(),
          rating: Number(editReviewRating || "0"),
          pros: editReviewPros.trim(),
          cons: editReviewCons.trim(),
          verdict: editReviewVerdict.trim(),
        },
      };
      body.content = JSON.stringify(payload);
    } else if (editing.type === "recipe") {
      const fallback = editRecipeTitle.trim() ? `Shared a recipe: ${editRecipeTitle.trim()}` : "Shared a recipe";
      body.content = trimmedCaption || fallback;
    } else {
      body.content = trimmedCaption;
    }

    body.imageUrl = editImagePreview || null;

    if (!body.content || !String(body.content).trim()) {
      toast({ title: "Content required", description: "Please enter post content", variant: "destructive" });
      return;
    }

    // Attach recipe updates (server must support: it should update the recipe row linked to recipeId)
    if (editing.type === "recipe" && editRecipeId) {
      const ingredients = ingredientRowsToStrings(editRecipeIngredients);
      const instructions = normalizeSteps(editRecipeSteps);

      if (!editRecipeTitle.trim()) {
        toast({ title: "Recipe title required", variant: "destructive" });
        return;
      }
      if (ingredients.length === 0) {
        toast({ title: "Add at least one ingredient", variant: "destructive" });
        return;
      }
      if (instructions.length === 0) {
        toast({ title: "Add at least one instruction step", variant: "destructive" });
        return;
      }

      body.recipe = {
        id: editRecipeId,
        title: editRecipeTitle.trim(),
        ingredients,
        instructions,
        cookTime: editRecipeCookTime ? Number(editRecipeCookTime) : null,
        servings: editRecipeServings ? Number(editRecipeServings) : null,
        difficulty: editRecipeDifficulty || "Easy",
      };
    }

    updatePostMutation.mutate({ postId: editing.postId, body });
  };

  const posts = postsData?.posts || [];

  if (clubLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        </div>
      </div>
    );
  }

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

  const showCreateComposer = !!user && isMember && membershipRole !== "pending";

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
                  {club.isPublic ? (
                    <Badge variant="outline">Public</Badge>
                  ) : (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Private
                    </Badge>
                  )}
                  {isOwner ? (
                    <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
                      Owner
                    </Badge>
                  ) : null}
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
                  <Button
                    variant="outline"
                    onClick={() => leaveClubMutation.mutate()}
                    disabled={leaveClubMutation.isPending}
                  >
                    {leaveClubMutation.isPending ? "Leaving..." : "Leave Club"}
                  </Button>
                ) : (
                  <Button onClick={() => joinClubMutation.mutate()} disabled={joinClubMutation.isPending}>
                    {joinClubMutation.isPending ? "Joining..." : club.isPublic ? "Join Club" : "Request to Join"}
                  </Button>
                )}

                {isOwner ? (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (!confirm("Delete this club? This cannot be undone.")) return;
                      deleteClubMutation.mutate();
                    }}
                    disabled={deleteClubMutation.isPending}
                    title="Delete club"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleteClubMutation.isPending ? "Deleting..." : "Delete Club"}
                  </Button>
                ) : null}
              </div>
            </div>

            {membershipRole === "pending" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                Your join request is pending approval.
              </div>
            ) : null}
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

        {/* Create Post Composer */}
        {showCreateComposer ? (
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Create a Post</CardTitle>
              <CardDescription>Choose a post type, add an image, or attach a recipe/review.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="w-full sm:w-56">
                  <Select value={postType} onValueChange={(v) => setPostType(v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="post">Post</SelectItem>
                      <SelectItem value="recipe">Recipe</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const dataUrl = await fileToDataUrl(file);
                        setImagePreview(dataUrl);
                        toast({ title: "Image added" });
                      } catch {
                        toast({ title: "Failed to load image", variant: "destructive" });
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Add Photo
                  </Button>

                  {postType === "recipe" ? (
                    <Button type="button" variant="outline" onClick={() => setRecipeOpen(true)}>
                      <Crown className="h-4 w-4 mr-2 text-purple-600" />
                      Recipe Builder
                    </Button>
                  ) : null}

                  {postType === "review" ? (
                    <Button type="button" variant="outline" onClick={() => setReviewOpen(true)}>
                      <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
                      Review Details
                    </Button>
                  ) : null}
                </div>
              </div>

              {imagePreview ? (
                <div className="rounded-xl border bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-medium">Attached photo</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setImagePreview("");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="mt-3 w-full max-h-[360px] object-cover rounded-lg"
                  />
                </div>
              ) : null}

              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={
                  postType === "review"
                    ? "Write your review summary..."
                    : postType === "recipe"
                    ? "Add a short intro/caption for your recipe..."
                    : "Write your post..."
                }
                rows={4}
              />

              <div className="flex items-center justify-between">
                <Button type="button" variant="ghost" onClick={resetComposer}>
                  Reset
                </Button>

                <Button onClick={() => createPostMutation.mutate()} disabled={createPostMutation.isPending}>
                  <Send className="h-4 w-4 mr-2" />
                  {createPostMutation.isPending ? "Posting..." : "Post"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Recipe Builder Dialog (new post) */}
        <Dialog open={recipeOpen} onOpenChange={setRecipeOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Recipe Builder</DialogTitle>
              <DialogDescription>
                Add ingredients with amount + unit dropdowns, then add instruction steps.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Recipe title</label>
                  <Input
                    value={recipeTitle}
                    onChange={(e) => setRecipeTitle(e.target.value)}
                    placeholder="e.g., Lemon Garlic Pasta"
                    className="mt-2"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Difficulty</label>
                  <div className="mt-2">
                    <Select value={recipeDifficulty} onValueChange={setRecipeDifficulty}>
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

                <div>
                  <label className="text-sm font-medium">Cook time (minutes)</label>
                  <Input
                    value={recipeCookTime}
                    onChange={(e) => setRecipeCookTime(e.target.value)}
                    type="number"
                    inputMode="numeric"
                    placeholder="30"
                    className="mt-2"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Servings</label>
                  <Input
                    value={recipeServings}
                    onChange={(e) => setRecipeServings(e.target.value)}
                    type="number"
                    inputMode="numeric"
                    placeholder="4"
                    className="mt-2"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Ingredients</h4>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRecipeIngredients((prev) => [...prev, { amount: "", unit: "", name: "" }])}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add ingredient
                  </Button>
                </div>

                <div className="space-y-2">
                  {recipeIngredients.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4 sm:col-span-3">
                        <Select
                          value={row.amount}
                          onValueChange={(v) =>
                            setRecipeIngredients((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, amount: v } : r))
                            )
                          }
                        >
                          <SelectTrigger className="h-9">
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
                            setRecipeIngredients((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, unit: v } : r))
                            )
                          }
                        >
                          <SelectTrigger className="h-9">
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
                          value={row.name}
                          onChange={(e) =>
                            setRecipeIngredients((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r))
                            )
                          }
                          placeholder="Ingredient"
                          className="h-9"
                        />
                      </div>

                      <div className="col-span-12 sm:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setRecipeIngredients((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={recipeIngredients.length === 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Instructions</h4>
                  <Button type="button" size="sm" variant="outline" onClick={() => setRecipeSteps((prev) => [...prev, ""])}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add step
                  </Button>
                </div>

                <div className="space-y-2">
                  {recipeSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={step}
                        onChange={(e) =>
                          setRecipeSteps((prev) => prev.map((s, i) => (i === idx ? e.target.value : s)))
                        }
                        placeholder={`Step ${idx + 1}`}
                        className="h-9"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setRecipeSteps((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={recipeSteps.length === 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setRecipeOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Review Details Dialog (new post) */}
        <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Details</DialogTitle>
              <DialogDescription>Add a subject, rating, and optional pros/cons.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">What are you reviewing?</label>
                <Input
                  value={reviewSubject}
                  onChange={(e) => setReviewSubject(e.target.value)}
                  placeholder="e.g., The Royal Club Brunch"
                  className="mt-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Rating</label>
                  <div className="mt-2">
                    <Select value={reviewRating} onValueChange={setReviewRating}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 ⭐</SelectItem>
                        <SelectItem value="4">4 ⭐</SelectItem>
                        <SelectItem value="3">3 ⭐</SelectItem>
                        <SelectItem value="2">2 ⭐</SelectItem>
                        <SelectItem value="1">1 ⭐</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Pros</label>
                  <Textarea
                    value={reviewPros}
                    onChange={(e) => setReviewPros(e.target.value)}
                    rows={4}
                    className="mt-2"
                    placeholder="What was great?"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Cons</label>
                  <Textarea
                    value={reviewCons}
                    onChange={(e) => setReviewCons(e.target.value)}
                    rows={4}
                    className="mt-2"
                    placeholder="What could be better?"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Verdict</label>
                <Textarea
                  value={reviewVerdict}
                  onChange={(e) => setReviewVerdict(e.target.value)}
                  rows={3}
                  className="mt-2"
                  placeholder="Your final take..."
                />
              </div>

              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
              posts.map((p) => {
                const parsed = safeParseContent(p.post.content);
                const isCreatorPost = p.post.userId === creator.id;

                return (
                  <Card key={p.post.id} className="border border-slate-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {(p.author.displayName || p.author.username || "U").slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="leading-tight">
                            <div className="text-sm font-medium flex items-center gap-2">
                              {p.author.displayName || p.author.username}
                              {isCreatorPost ? (
                                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                                  Creator
                                </Badge>
                              ) : null}
                              {p.post.recipeId ? <Badge variant="secondary">Recipe</Badge> : null}
                              {parsed.type === "review" ? <Badge variant="secondary">Review</Badge> : null}
                            </div>
                            <div className="text-xs text-slate-500">{new Date(p.post.createdAt).toLocaleString()}</div>
                          </div>
                        </div>

                        {/* Actions */}
                        {user?.id ? (
                          <div className="flex items-center gap-2">
                            {user.id === p.post.userId || isOwner ? (
                              <>
                                <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                                  <Pencil className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    if (!confirm("Delete this post?")) return;
                                    deletePostMutation.mutate(p.post.id);
                                  }}
                                  disabled={deletePostMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0 space-y-3">
                      {parsed.type === "review" ? (
                        <div className="rounded-xl border bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold">{parsed.review.subject || "Review"}</div>
                            <Badge variant="outline">{`${parsed.review.rating || 0}/5`}</Badge>
                          </div>
                          {parsed.caption ? (
                            <p className="mt-2 whitespace-pre-wrap text-slate-800">{parsed.caption}</p>
                          ) : null}
                          {parsed.review.pros || parsed.review.cons || parsed.review.verdict ? (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                              {parsed.review.pros ? (
                                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2">
                                  <div className="font-medium text-emerald-900">Pros</div>
                                  <div className="text-emerald-800 whitespace-pre-wrap">{parsed.review.pros}</div>
                                </div>
                              ) : null}
                              {parsed.review.cons ? (
                                <div className="rounded-lg bg-rose-50 border border-rose-100 p-2">
                                  <div className="font-medium text-rose-900">Cons</div>
                                  <div className="text-rose-800 whitespace-pre-wrap">{parsed.review.cons}</div>
                                </div>
                              ) : null}
                              {parsed.review.verdict ? (
                                <div className="sm:col-span-2 rounded-lg bg-slate-50 border border-slate-200 p-2">
                                  <div className="font-medium text-slate-900">Verdict</div>
                                  <div className="text-slate-700 whitespace-pre-wrap">{parsed.review.verdict}</div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-slate-800">{parsed.caption}</p>
                      )}

                      {p.post.imageUrl ? (
                        <img
                          src={p.post.imageUrl}
                          alt="Post"
                          className="w-full max-h-[520px] object-cover rounded-lg border"
                        />
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit Post</DialogTitle>
              <DialogDescription>
                Update your content{editing?.type === "recipe" ? " and recipe details" : ""}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Image */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const dataUrl = await fileToDataUrl(file);
                      setEditImagePreview(dataUrl);
                      toast({ title: "Image updated" });
                    } catch {
                      toast({ title: "Failed to load image", variant: "destructive" });
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => editFileInputRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  {editImagePreview ? "Replace Photo" : "Add Photo"}
                </Button>
                {editImagePreview ? (
                  <Button type="button" variant="ghost" onClick={() => setEditImagePreview("")}>
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                ) : null}

                {editing?.type === "recipe" ? (
                  <Button type="button" variant="outline" onClick={() => setEditRecipeOpen(true)}>
                    <Crown className="h-4 w-4 mr-2 text-purple-600" />
                    Edit Recipe
                  </Button>
                ) : null}

                {editing?.type === "review" ? (
                  <Button type="button" variant="outline" onClick={() => setEditReviewOpen(true)}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
                    Edit Review
                  </Button>
                ) : null}
              </div>

              {editImagePreview ? (
                <img
                  src={editImagePreview}
                  alt="Preview"
                  className="w-full max-h-[360px] object-cover rounded-lg border"
                />
              ) : null}

              <div>
                <label className="text-sm font-medium">
                  {editing?.type === "review" ? "Review Summary" : editing?.type === "recipe" ? "Recipe Caption" : "Post"}
                </label>
                <Textarea value={editCaption} onChange={(e) => setEditCaption(e.target.value)} rows={4} className="mt-2" />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={saveEdit} disabled={updatePostMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updatePostMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Recipe Dialog */}
        <Dialog open={editRecipeOpen} onOpenChange={setEditRecipeOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit Recipe</DialogTitle>
              <DialogDescription>Update ingredients and steps. This saves with the post.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Recipe title</label>
                  <Input value={editRecipeTitle} onChange={(e) => setEditRecipeTitle(e.target.value)} className="mt-2" />
                </div>
                <div>
                  <label className="text-sm font-medium">Difficulty</label>
                  <div className="mt-2">
                    <Select value={editRecipeDifficulty} onValueChange={setEditRecipeDifficulty}>
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
                <div>
                  <label className="text-sm font-medium">Cook time (minutes)</label>
                  <Input
                    value={editRecipeCookTime}
                    onChange={(e) => setEditRecipeCookTime(e.target.value)}
                    type="number"
                    inputMode="numeric"
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Servings</label>
                  <Input
                    value={editRecipeServings}
                    onChange={(e) => setEditRecipeServings(e.target.value)}
                    type="number"
                    inputMode="numeric"
                    className="mt-2"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Ingredients</h4>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditRecipeIngredients((prev) => [...prev, { amount: "", unit: "", name: "" }])}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>

                <div className="space-y-2">
                  {editRecipeIngredients.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4 sm:col-span-3">
                        <Select
                          value={row.amount}
                          onValueChange={(v) =>
                            setEditRecipeIngredients((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, amount: v } : r))
                            )
                          }
                        >
                          <SelectTrigger className="h-9">
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
                            setEditRecipeIngredients((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, unit: v } : r))
                            )
                          }
                        >
                          <SelectTrigger className="h-9">
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
                          value={row.name}
                          onChange={(e) =>
                            setEditRecipeIngredients((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r))
                            )
                          }
                          placeholder="Ingredient"
                          className="h-9"
                        />
                      </div>

                      <div className="col-span-12 sm:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditRecipeIngredients((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={editRecipeIngredients.length === 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Instructions</h4>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditRecipeSteps((prev) => [...prev, ""])}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add step
                  </Button>
                </div>

                <div className="space-y-2">
                  {editRecipeSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={step}
                        onChange={(e) =>
                          setEditRecipeSteps((prev) => prev.map((s, i) => (i === idx ? e.target.value : s)))
                        }
                        placeholder={`Step ${idx + 1}`}
                        className="h-9"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditRecipeSteps((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={editRecipeSteps.length === 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditRecipeOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Review Dialog */}
        <Dialog open={editReviewOpen} onOpenChange={setEditReviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Review</DialogTitle>
              <DialogDescription>Update subject, rating, pros/cons, and verdict.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Input value={editReviewSubject} onChange={(e) => setEditReviewSubject(e.target.value)} className="mt-2" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Rating</label>
                  <div className="mt-2">
                    <Select value={editReviewRating} onValueChange={setEditReviewRating}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 ⭐</SelectItem>
                        <SelectItem value="4">4 ⭐</SelectItem>
                        <SelectItem value="3">3 ⭐</SelectItem>
                        <SelectItem value="2">2 ⭐</SelectItem>
                        <SelectItem value="1">1 ⭐</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Pros</label>
                  <Textarea value={editReviewPros} onChange={(e) => setEditReviewPros(e.target.value)} rows={4} className="mt-2" />
                </div>
                <div>
                  <label className="text-sm font-medium">Cons</label>
                  <Textarea value={editReviewCons} onChange={(e) => setEditReviewCons(e.target.value)} rows={4} className="mt-2" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Verdict</label>
                <Textarea value={editReviewVerdict} onChange={(e) => setEditReviewVerdict(e.target.value)} rows={3} className="mt-2" />
              </div>

              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => setEditReviewOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
