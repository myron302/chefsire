import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, MapPin, ThumbsUp, ThumbsDown, Lightbulb, Share2, Bookmark, BookmarkCheck, Check } from "lucide-react";
import PostCard from "@/components/post-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { PostWithUser } from "@shared/schema";
import { useUser } from "@/contexts/UserContext";

type ParsedReview = {
  businessName: string;
  fullAddress?: string;
  locationLabel?: string;
  rating?: number;
  pros?: string;
  cons?: string;
  verdict?: string;
  notes?: string;
};

function parseReviewCaption(caption: string): ParsedReview | null {
  const raw = (caption || "").trim();
  if (!raw.startsWith("📝 Review:")) return null;

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  const first = lines[0] || "";
  const firstValue = first.replace(/^📝\s*Review:\s*/i, "").trim();

  const [namePart, ...rest] = firstValue
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const businessName = namePart || firstValue;
  const fullAddress = rest.length ? rest.join(", ") : undefined;

  const takeAfter = (prefix: string) => {
    const line = lines.find((l) => l.startsWith(prefix));
    if (!line) return undefined;
    return line.slice(prefix.length).trim();
  };

  const ratingRaw = takeAfter("⭐ Rating:") || takeAfter("⭐️ Rating:");
  let rating: number | undefined;
  if (ratingRaw) {
    const m = ratingRaw.match(/(\d+(?:\.\d+)?)/);
    if (m) rating = Math.max(0, Math.min(5, Number(m[1])));
  }

  const notesLine = lines.find((l) => /^Notes:/i.test(l));
  const notes = notesLine ? notesLine.replace(/^Notes:\s*/i, "").trim() : undefined;

  return {
    businessName,
    fullAddress,
    locationLabel: takeAfter("📍 Location:"),
    rating,
    pros: takeAfter("✅ Pros:"),
    cons: takeAfter("⚠️ Cons:"),
    verdict: takeAfter("💡 Verdict:"),
    notes,
  };
}

function buildMapsUrl(review: ParsedReview) {
  const q = [review.businessName, review.fullAddress || review.locationLabel || ""]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export default function ReviewsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const currentUserId = user?.id || "";

  const [q, setQ] = useState("");
  const [minRating, setMinRating] = useState<number | "">("");
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Persistence for "Save" feature
  useEffect(() => {
    const saved = localStorage.getItem("saved_reviews");
    if (saved) setSavedIds(JSON.parse(saved));
  }, []);

  const toggleSave = (id: number, name: string) => {
    const newIds = savedIds.includes(id) ? savedIds.filter(i => i !== id) : [...savedIds, id];
    setSavedIds(newIds);
    localStorage.setItem("saved_reviews", JSON.stringify(newIds));
    toast({ title: savedIds.includes(id) ? "Removed" : "Saved", description: name });
  };

  const handleShare = async (id: number) => {
    await navigator.clipboard.writeText(`${window.location.origin}/posts/${id}`);
    setCopiedId(id);
    toast({ title: "Link copied to clipboard" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const { data: posts = [], isLoading } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/explore", currentUserId, 0, 100],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("offset", "0");
      params.set("limit", "100");
      if (currentUserId) params.set("userId", String(currentUserId));

      const res = await fetch(`/api/posts/explore?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const reviewPosts = useMemo(() => {
    const normalizedQ = q.trim().toLowerCase();

    const onlyReviews = posts.filter((p) => {
      const cap = (p.caption || "").trim();
      const tagReview = (p.tags || []).includes("review");
      const starts = cap.startsWith("📝 Review:");
      return tagReview || starts;
    });

    const withParsed = onlyReviews
      .map((p) => ({
        post: p,
        parsed: parseReviewCaption(p.caption || ""),
      }))
      .sort((a, b) => new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime());

    return withParsed.filter(({ post, parsed }) => {
      // Logic from your file
      if (showSavedOnly && !savedIds.includes(post.id)) return false;
      if (!normalizedQ && minRating === "") return true;

      const cap = (post.caption || "").toLowerCase();
      const tags = (post.tags || []).join(" ").toLowerCase();
      const hay = [
        cap, tags,
        parsed?.businessName?.toLowerCase() || "",
        parsed?.fullAddress?.toLowerCase() || "",
        parsed?.locationLabel?.toLowerCase() || "",
        parsed?.pros?.toLowerCase() || "",
        parsed?.cons?.toLowerCase() || "",
        parsed?.verdict?.toLowerCase() || "",
        parsed?.notes?.toLowerCase() || "",
      ].join(" ");

      const matchesQ = normalizedQ ? hay.includes(normalizedQ) : true;
      const matchesRating = minRating === "" ? true : (parsed?.rating || 0) >= minRating;

      return matchesQ && matchesRating;
    });
  }, [posts, q, minRating, savedIds, showSavedOnly]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-2xl font-bold">Reviews</CardTitle>
            <div className="flex gap-2">
              <Button 
                variant={showSavedOnly ? "default" : "outline"} 
                size="sm" 
                onClick={() => setShowSavedOnly(!showSavedOnly)}
              >
                <Bookmark className="mr-2 h-4 w-4" /> {showSavedOnly ? "Saved" : "All"}
              </Button>
              <Badge variant="secondary" className="h-9 px-3">{reviewPosts.length}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search reviews..."
              />
            </div>
            <div className="sm:col-span-4 flex gap-2">
              <Input
                value={minRating === "" ? "" : String(minRating)}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (!v) return setMinRating("");
                  const n = Number(v);
                  if (Number.isFinite(n)) setMinRating(Math.max(1, Math.min(5, Math.floor(n))));
                }}
                type="number"
                placeholder="Min rating"
              />
              <Button variant="outline" onClick={() => { setQ(""); setMinRating(""); setShowSavedOnly(false); }}>
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Separator />

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading reviews...</div>
      ) : reviewPosts.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No reviews found.</CardContent></Card>
      ) : (
        <div className="space-y-8">
          {reviewPosts.map(({ post, parsed }) => {
            const mapsUrl = parsed ? buildMapsUrl(parsed) : null;
            const isSaved = savedIds.includes(post.id);

            return (
              <div key={post.id} className="space-y-3 group">
                {parsed && (
                  <div className="px-1 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold">{parsed.businessName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {parsed.rating && (
                            <div className="flex text-yellow-500 items-center text-sm font-bold">
                              {parsed.rating} <Star size={14} fill="currentColor" className="ml-0.5" />
                            </div>
                          )}
                          {parsed.locationLabel && (
                            <Badge variant="outline" className="text-[10px] uppercase">
                              <MapPin size={10} className="mr-1" /> {parsed.locationLabel}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => toggleSave(post.id, parsed.businessName)}>
                          {isSaved ? <BookmarkCheck size={18} className="text-primary" /> : <Bookmark size={18} />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleShare(post.id)}>
                          {copiedId === post.id ? <Check size={18} className="text-emerald-500" /> : <Share2 size={18} />}
                        </Button>
                        {mapsUrl && (
                          <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" asChild>
                            <a href={mapsUrl} target="_blank" rel="noreferrer">Directions</a>
                          </Button>
                        )}
                      </div>
                    </div>

                    {parsed.verdict && (
                      <div className="bg-primary/5 border-l-4 border-primary p-3 rounded-r-lg">
                        <div className="flex gap-2">
                          <Lightbulb size={16} className="text-primary shrink-0 mt-0.5" />
                          <p className="text-sm italic font-medium">"{parsed.verdict}"</p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {parsed.pros && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50"><ThumbsUp size={12} className="mr-1" /> {parsed.pros}</Badge>}
                      {parsed.cons && <Badge className="bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-50"><ThumbsDown size={12} className="mr-1" /> {parsed.cons}</Badge>}
                    </div>
                  </div>
                )}
                <div className="rounded-2xl overflow-hidden border shadow-sm group-hover:border-primary/30 transition-colors">
                  <PostCard post={post} currentUserId={currentUserId} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
