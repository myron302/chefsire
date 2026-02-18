// client/src/pages/social/reviews.tsx
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Star,
  MapPin,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Share2,
  Bookmark,
  BookmarkCheck,
  Check,
  ArrowUpNarrowWide,
  Clock,
  SlidersHorizontal,
} from "lucide-react";
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
  priceLevel?: number;
};

function normalizeReviewText(raw: string) {
  return String(raw ?? "")
    .replace(/\s+(📍\s*Location:)/g, "\n$1")
    .replace(/\s+(⭐️?\s*Rating:)/g, "\n$1")
    .replace(/\s+(✅\s*Pros:)/g, "\n$1")
    .replace(/\s+(⚠️\s*Cons:)/g, "\n$1")
    .replace(/\s+(💰\s*Price:)/g, "\n$1")
    .replace(/\s+(💡\s*Verdict:)/g, "\n$1")
    .replace(/\s+(Notes:)/gi, "\n$1")
    .trim();
}

function parsePriceLevelFromLine(text?: string): number | undefined {
  const s = String(text ?? "").trim();
  if (!s) return undefined;

  const groups = s.match(/\$+/g);
  if (groups && groups.length) {
    const maxLen = Math.max(...groups.map((g) => g.length));
    return Math.max(1, Math.min(4, maxLen));
  }

  const n = Number((s.match(/\d+/)?.[0] ?? "").trim());
  if (Number.isFinite(n) && n > 0) return Math.max(1, Math.min(4, Math.floor(n)));

  return undefined;
}

function parseReviewCaption(caption: string): ParsedReview | null {
  const raw = (caption || "").trim();
  if (!raw.startsWith("📝 Review:")) return null;

  const normalized = normalizeReviewText(raw);
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

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

  const priceRaw = takeAfter("💰 Price:") || takeAfter("Price:");
  const priceLevel = parsePriceLevelFromLine(priceRaw);

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

function splitToBullets(text?: string) {
  const s = String(text ?? "").trim();
  if (!s) return [];
  // Split only on semicolons and bullet characters — avoids splitting on commas in natural prose
  const parts = s
    .split(/•|;/g)
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts : [s];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          className={i <= rating ? "text-yellow-500 fill-yellow-500" : "text-gray-200 fill-gray-200"}
        />
      ))}
      <span className="ml-1 text-sm font-bold text-yellow-600">{rating}</span>
    </div>
  );
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
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("saved_reviews");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) setSavedIds(parsed);
    } catch {
      // ignore malformed localStorage
    }
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

    const withParsed = onlyReviews.map((p) => ({
      post: p,
      parsed: parseReviewCaption(p.caption || ""),
    }));

    withParsed.sort((a, b) => {
      if (sortByRating) return (b.parsed?.rating || 0) - (a.parsed?.rating || 0);
      return new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime();
    });

    return withParsed.filter(({ post, parsed }) => {
      if (showSavedOnly && !savedIds.includes(post.id)) return false;

      if (activePrice !== null) {
        if ((parsed?.priceLevel ?? null) !== activePrice) return false;
      }

      if (!normalizedQ && minRating === "") return true;

      const cap = (post.caption || "").toLowerCase();
      const tags = (post.tags || []).join(" ").toLowerCase();

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

  const hasActiveFilters = q || minRating !== "" || activePrice !== null || showSavedOnly || sortByRating;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900">Reviews</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? "Loading…" : `${reviewPosts.length} review${reviewPosts.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={sortByRating ? "default" : "outline"}
            size="sm"
            onClick={() => setSortByRating(!sortByRating)}
            title={sortByRating ? "Sorted by top rated" : "Sorted by latest"}
          >
            <ArrowUpNarrowWide className="h-4 w-4 mr-1.5" />
            {sortByRating ? "Top Rated" : "Latest"}
          </Button>
          <Button
            variant={filtersOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <SlidersHorizontal className="h-4 w-4 mr-1.5" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1.5 w-2 h-2 rounded-full bg-primary inline-block" />
            )}
          </Button>
        </div>
      </div>

      {/* ── Search + Filters ── */}
      <div className="space-y-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by business, city, notes, tags…"
          className="w-full"
        />

        {filtersOpen && (
          <div className="rounded-xl border bg-muted/30 p-4 space-y-4">

            {/* Price filter */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Price Level
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={activePrice === p}
                    onClick={() => setActivePrice(activePrice === p ? null : p)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-colors ${
                      activePrice === p
                        ? "bg-primary text-white border-primary"
                        : "border-input text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {"$".repeat(p)}
                  </button>
                ))}
              </div>
            </div>

            {/* Min rating filter */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Minimum Rating
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={minRating === r}
                    onClick={() => setMinRating(minRating === r ? "" : r)}
                    className={`w-9 h-9 rounded-lg border text-sm font-bold transition-colors flex items-center justify-center gap-0.5 ${
                      minRating === r
                        ? "bg-primary text-white border-primary"
                        : "border-input text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {r}★
                  </button>
                ))}
              </div>
            </div>

            {/* Saved filter + clear */}
            <div className="flex items-center justify-between">
              <Button
                variant={showSavedOnly ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowSavedOnly(!showSavedOnly)}
              >
                <Bookmark className="h-4 w-4 mr-1.5" />
                {showSavedOnly ? "Showing Saved Only" : "Show Saved Only"}
              </Button>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQ("");
                    setMinRating("");
                    setSortByRating(false);
                    setActivePrice(null);
                    setShowSavedOnly(false);
                  }}
                >
                  Clear all filters
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-5 animate-pulse space-y-3">
              <div className="h-5 w-1/2 bg-muted rounded" />
              <div className="h-3 w-1/3 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : reviewPosts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-semibold text-slate-700">
            {showSavedOnly ? "No saved reviews yet" : "No reviews found"}
          </p>
          <p className="text-sm mt-1">
            {showSavedOnly
              ? "Save a review by tapping the bookmark icon."
              : "Try adjusting your search or filters."}
          </p>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setQ("");
                setMinRating("");
                setSortByRating(false);
                setActivePrice(null);
                setShowSavedOnly(false);
              }}
            >
              Clear all filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {reviewPosts.map(({ post, parsed }) => {
            const isSaved = savedIds.includes(post.id);
            const mapsUrl = parsed ? buildMapsUrl(parsed) : null;
            const tags = (post.tags || []).filter((t) => t !== "review");
            const pros = splitToBullets(parsed?.pros);
            const cons = splitToBullets(parsed?.cons);

            // Author info from PostWithUser
            const author = (post as any).user;
            const authorName = author?.displayName || author?.username || "Unknown";
            const authorAvatar = author?.avatar || null;
            const authorInitial = authorName.charAt(0).toUpperCase();

            return (
              <Card key={post.id} className="overflow-hidden border rounded-xl shadow-sm">
                {parsed ? (
                  <CardContent className="p-0">

                    {/* ── Post image (if any) ── */}
                    {post.imageUrl && (
                      <div className="w-full aspect-video bg-muted overflow-hidden">
                        <img
                          src={post.imageUrl}
                          alt={parsed.businessName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="p-5 space-y-4">

                      {/* ── Business name + rating + price ── */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="text-xl font-black text-slate-900 leading-tight">
                            {parsed.businessName}
                          </h2>

                          {(parsed.fullAddress || parsed.locationLabel) && (
                            mapsUrl ? (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900 hover:underline"
                              >
                                <MapPin size={13} />
                                <span className="truncate">
                                  {parsed.fullAddress || parsed.locationLabel}
                                </span>
                              </a>
                            ) : (
                              <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                                <MapPin size={13} />
                                <span className="truncate">
                                  {parsed.fullAddress || parsed.locationLabel}
                                </span>
                              </div>
                            )
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {typeof parsed.rating === "number" && (
                            <StarDisplay rating={parsed.rating} />
                          )}
                          {typeof parsed.priceLevel === "number" && (
                            <Badge variant="secondary" className="text-xs font-bold">
                              {"$".repeat(parsed.priceLevel)}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* ── Verdict ── */}
                      {parsed.verdict && (
                        <div className="bg-primary/5 border-l-4 border-primary px-4 py-3 rounded-r-lg">
                          <div className="flex gap-2 items-start">
                            <Lightbulb size={16} className="text-primary mt-0.5 shrink-0" />
                            <p className="text-sm italic font-medium text-slate-800">
                              "{parsed.verdict}"
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ── Pros / Cons ── */}
                      {(pros.length > 0 || cons.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {pros.length > 0 && (
                            <div className="rounded-lg border bg-emerald-50/50 p-3">
                              <div className="flex items-center gap-1.5 font-semibold text-emerald-700 text-xs uppercase tracking-wide mb-2">
                                <ThumbsUp size={12} />
                                Pros
                              </div>
                              <ul className="space-y-1 text-sm text-slate-700">
                                {pros.map((x, idx) => (
                                  <li key={idx} className="flex gap-1.5 leading-snug">
                                    <span className="text-emerald-500 mt-0.5">✓</span>
                                    {x}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {cons.length > 0 && (
                            <div className="rounded-lg border bg-rose-50/50 p-3">
                              <div className="flex items-center gap-1.5 font-semibold text-rose-700 text-xs uppercase tracking-wide mb-2">
                                <ThumbsDown size={12} />
                                Cons
                              </div>
                              <ul className="space-y-1 text-sm text-slate-700">
                                {cons.map((x, idx) => (
                                  <li key={idx} className="flex gap-1.5 leading-snug">
                                    <span className="text-rose-400 mt-0.5">✗</span>
                                    {x}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Notes ── */}
                      {parsed.notes && (
                        <div className="rounded-lg border bg-muted/30 px-4 py-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                            Notes
                          </p>
                          <p className="text-sm text-slate-800">{parsed.notes}</p>
                        </div>
                      )}

                      {/* ── Tags ── */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {tags.slice(0, 6).map((t) => (
                            <Badge key={t} variant="outline" className="text-xs">
                              #{t}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* ── Author + timestamp ── */}
                      <div className="flex items-center justify-between pt-1 border-t">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={authorAvatar || undefined} />
                            <AvatarFallback className="text-xs">{authorInitial}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-slate-700">{authorName}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock size={11} />
                            {timeAgo(post.createdAt)}
                          </span>
                        </div>

                        {/* ── Actions ── */}
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            title={isSaved ? "Remove from saved" : "Save review"}
                            onClick={() => {
                              const newIds = isSaved
                                ? savedIds.filter((i) => i !== post.id)
                                : [...savedIds, post.id];
                              setSavedIds(newIds);
                              localStorage.setItem("saved_reviews", JSON.stringify(newIds));
                              toast({ title: isSaved ? "Removed from saved" : "Review saved" });
                            }}
                          >
                            {isSaved ? (
                              <BookmarkCheck className="h-4 w-4 text-primary" />
                            ) : (
                              <Bookmark className="h-4 w-4" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            title="Copy link"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `${window.location.origin}/posts/${post.id}`
                              );
                              setCopiedId(post.id);
                              toast({ title: "Link copied" });
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                          >
                            {copiedId === post.id ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Share2 className="h-4 w-4" />
                            )}
                          </Button>

                          {mapsUrl && (
                            <Button variant="ghost" size="sm" className="h-8 px-2" title="Open in Google Maps" asChild>
                              <a href={mapsUrl} target="_blank" rel="noreferrer">
                                <MapPin className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                ) : (
                  /* Fallback for non-template reviews */
                  <PostCard
                    post={post}
                    currentUserId={currentUserId}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
