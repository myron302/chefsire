import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Star, MapPin, ThumbsUp, ThumbsDown, Lightbulb, Share2, Bookmark, BookmarkCheck, Check, ArrowUpNarrowWide } from "lucide-react";
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
  priceLevel?: number; // Added for professional filter
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

  // Support for professional price parsing
  const priceRaw = takeAfter("💰 Price:") || takeAfter("Price:");
  const priceLevel = priceRaw ? (priceRaw.match(/\$/g) || []).length : undefined;

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
    priceLevel,
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
  const [sortByRating, setSortByRating] = useState(false);
  const [activePrice, setActivePrice] = useState<number | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("saved_reviews");
    if (saved) setSavedIds(JSON.parse(saved));
  }, []);

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
      }));

    // Sorting Logic
    withParsed.sort((a, b) => {
      if (sortByRating) {
        return (b.parsed?.rating || 0) - (a.parsed?.rating || 0);
      }
      return new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime();
    });

    return withParsed.filter(({ post, parsed }) => {
      if (showSavedOnly && !savedIds.includes(post.id)) return false;
      if (activePrice && parsed?.priceLevel !== activePrice) return false;
      if (!normalizedQ && minRating === "") return true;

      const cap = (post.caption || "").toLowerCase();
      const tags = (post.tags || []).join(" ").toLowerCase();

      // YOUR EXACT SEARCH POOL LOGIC
      const hay = [
        cap,
        tags,
        parsed?.businessName?.toLowerCase() || "",
        parsed?.fullAddress?.toLowerCase() || "",
        parsed?.locationLabel?.toLowerCase() || "",
        parsed?.pros?.toLowerCase() || "",
        parsed?.cons?.toLowerCase() || "",
        parsed?.verdict?.toLowerCase() || "",
        parsed?.notes?.toLowerCase() || "",
      ].join(" ");

      const matchesQ = normalizedQ ? hay.includes(normalizedQ) : true;

      const matchesRating =
        minRating === ""
          ? true
          : typeof parsed?.rating === "number"
          ? parsed.rating >= minRating
          : false;

      return matchesQ && matchesRating;
    });
  }, [posts, q, minRating, sortByRating, activePrice, showSavedOnly, savedIds]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-2xl font-bold text-slate-900 italic tracking-tighter">REVIEWS</CardTitle>
            <div className="flex gap-2">
               <Button variant={sortByRating ? "default" : "outline"} size="sm" onClick={() => setSortByRating(!sortByRating)}>
                  <ArrowUpNarrowWide className="mr-2 h-4 w-4" /> {sortByRating ? "Top Rated" : "Latest"}
               </Button>
               <Button variant={showSavedOnly ? "secondary" : "outline"} size="sm" onClick={() => setShowSavedOnly(!showSavedOnly)}>
                  <Bookmark className="mr-2 h-4 w-4" /> {showSavedOnly ? "Saved" : "All"}
               </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search reviews (business, city, notes, tags)…"
              />
            </div>

            <div className="sm:col-span-4 flex gap-2">
              <Input
                value={minRating === "" ? "" : String(minRating)}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (!v) return setMinRating("");
                  const n = Number(v);
                  if (!Number.isFinite(n)) return;
                  setMinRating(Math.max(1, Math.min(5, Math.floor(n))));
                }}
                type="number"
                placeholder="Rating"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => { setQ(""); setMinRating(""); setSortByRating(false); setActivePrice(null); setShowSavedOnly(false); }}
              >
                Clear
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-md w-fit border">
            {[1, 2, 3, 4].map(p => (
              <button 
                key={p} 
                onClick={() => setActivePrice(activePrice === p ? null : p)}
                className={`px-3 py-1 text-[10px] font-bold rounded ${activePrice === p ? 'bg-primary text-white' : 'text-muted-foreground'}`}
              >
                {"$".repeat(p)}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="text-sm text-muted-foreground">
          This page shows posts marked as <span className="font-medium">Review</span>.
        </CardContent>
      </Card>

      <Separator />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : reviewPosts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No reviews found. Try a different search.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-12">
          {reviewPosts.map(({ post, parsed }) => {
            const mapsUrl = parsed ? buildMapsUrl(parsed) : null;
            const isSaved = savedIds.includes(post.id);

            return (
              <div key={post.id} className="space-y-4">
                {parsed && (
                  <div className="px-1 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900">{parsed.businessName}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          {parsed.rating && (
                            <div className="flex items-center text-yellow-500 font-bold">
                              {parsed.rating} <Star size={16} fill="currentColor" className="ml-1" />
                            </div>
                          )}
                          {parsed.locationLabel && (
                            <div className="text-muted-foreground text-xs flex items-center">
                              <MapPin size={12} className="mr-1" /> {parsed.locationLabel}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => {
                          const newIds = isSaved ? savedIds.filter(i => i !== post.id) : [...savedIds, post.id];
                          setSavedIds(newIds);
                          localStorage.setItem("saved_reviews", JSON.stringify(newIds));
                          toast({ title: isSaved ? "Removed" : "Saved" });
                        }}>
                          {isSaved ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`);
                          setCopiedId(post.id);
                          toast({ title: "Link copied" });
                          setTimeout(() => setCopiedId(null), 2000);
                        }}>
                          {copiedId === post.id ? <Check className="text-emerald-500" /> : <Share2 />}
                        </Button>
                        {mapsUrl && (
                          <Button variant="outline" size="sm" className="rounded-full text-xs" asChild>
                            <a href={mapsUrl} target="_blank" rel="noreferrer">Directions</a>
                          </Button>
                        )}
                      </div>
                    </div>

                    {parsed.verdict && (
                      <div className="bg-primary/5 border-l-4 border-primary p-3 rounded-r-lg">
                        <div className="flex gap-2">
                          <Lightbulb size={18} className="text-primary shrink-0" />
                          <p className="text-sm italic font-medium">"{parsed.verdict}"</p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {parsed.pros && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100"><ThumbsUp size={12} className="mr-1" /> {parsed.pros}</Badge>}
                      {parsed.cons && <Badge variant="secondary" className="bg-rose-50 text-rose-700 border-rose-100"><ThumbsDown size={12} className="mr-1" /> {parsed.cons}</Badge>}
                    </div>
                  </div>
                )}
                <div className="rounded-2xl overflow-hidden border shadow-sm">
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
