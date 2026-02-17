// client/src/pages/social/reviews.tsx
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  // Turns one-line reviews into multi-line by inserting \n before each section marker.
  // This makes both parsing + display cleaner.
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

  // Prefer the longest $ group (so "$$ - $$$" => 3)
  const groups = s.match(/\$+/g);
  if (groups && groups.length) {
    const maxLen = Math.max(...groups.map((g) => g.length));
    return Math.max(1, Math.min(4, maxLen));
  }

  // Fallback numeric forms: "2", "2/4"
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
  // Split gently on separators people commonly use
  const parts = s
    .split(/•|;|\||,(?!\s*\d)/g) // avoid weird splits on numeric commas
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts : [s];
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

      // $ filter
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-2xl font-bold text-slate-900 italic tracking-tighter">
              REVIEWS
            </CardTitle>

            <div className="flex gap-2">
              <Button
                variant={sortByRating ? "default" : "outline"}
                size="sm"
                onClick={() => setSortByRating(!sortByRating)}
              >
                <ArrowUpNarrowWide className="mr-2 h-4 w-4" />
                {sortByRating ? "Top Rated" : "Latest"}
              </Button>

              <Button
                variant={showSavedOnly ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowSavedOnly(!showSavedOnly)}
              >
                <Bookmark className="mr-2 h-4 w-4" />
                {showSavedOnly ? "Saved" : "All"}
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
                placeholder="Min ★ (1–5)"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQ("");
                  setMinRating("");
                  setSortByRating(false);
                  setActivePrice(null);
                  setShowSavedOnly(false);
                }}
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-md w-fit border">
            {[1, 2, 3, 4].map((p) => (
              <button
                key={p}
                onClick={() => setActivePrice(activePrice === p ? null : p)}
                className={`px-3 py-1 text-[10px] font-bold rounded ${
                  activePrice === p ? "bg-primary text-white" : "text-muted-foreground"
                }`}
                type="button"
              >
                {"$".repeat(p)}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="text-sm text-muted-foreground">
          This page shows posts marked as <span className="font-medium">Review</span>.
          <div className="text-xs mt-2">
            Tip: reviews saved as one line will still display clean now.
          </div>
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
        <div className="space-y-10">
          {reviewPosts.map(({ post, parsed }) => {
            const isSaved = savedIds.includes(post.id);
            const mapsUrl = parsed ? buildMapsUrl(parsed) : null;

            const tags = (post.tags || []).filter((t) => t !== "review");
            const pros = splitToBullets(parsed?.pros);
            const cons = splitToBullets(parsed?.cons);

            return (
              <Card key={post.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-4">
                  {parsed ? (
                    <div className="space-y-3">
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-2xl font-black text-slate-900 leading-tight">
                            {parsed.businessName}
                          </div>

                          {/* Clickable address */}
                          {(parsed.fullAddress || parsed.locationLabel) && (
                            mapsUrl ? (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-slate-900 hover:underline"
                              >
                                <MapPin size={14} />
                                <span className="truncate">
                                  {parsed.fullAddress || parsed.locationLabel}
                                </span>
                              </a>
                            ) : (
                              <div className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin size={14} />
                                <span className="truncate">
                                  {parsed.fullAddress || parsed.locationLabel}
                                </span>
                              </div>
                            )
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {typeof parsed.rating === "number" && (
                            <div className="flex items-center gap-1 font-bold text-yellow-600">
                              <span>{parsed.rating}</span>
                              <Star size={16} fill="currentColor" />
                            </div>
                          )}
                          {typeof parsed.priceLevel === "number" && (
                            <Badge variant="secondary" className="text-xs">
                              {"$".repeat(parsed.priceLevel)}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Verdict */}
                      {parsed.verdict && (
                        <div className="bg-primary/5 border-l-4 border-primary p-3 rounded-r-lg">
                          <div className="flex gap-2">
                            <Lightbulb size={18} className="text-primary shrink-0" />
                            <p className="text-sm italic font-medium">"{parsed.verdict}"</p>
                          </div>
                        </div>
                      )}

                      {/* Pros / Cons */}
                      {(pros.length > 0 || cons.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {pros.length > 0 && (
                            <div className="rounded-lg border bg-emerald-50/40 p-3">
                              <div className="flex items-center gap-2 font-semibold text-emerald-700 text-sm">
                                <ThumbsUp size={14} />
                                Pros
                              </div>
                              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                                {pros.map((x, idx) => (
                                  <li key={idx} className="leading-snug">
                                    • {x}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {cons.length > 0 && (
                            <div className="rounded-lg border bg-rose-50/40 p-3">
                              <div className="flex items-center gap-2 font-semibold text-rose-700 text-sm">
                                <ThumbsDown size={14} />
                                Cons
                              </div>
                              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                                {cons.map((x, idx) => (
                                  <li key={idx} className="leading-snug">
                                    • {x}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {parsed.notes && (
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <div className="text-xs font-semibold text-muted-foreground">
                            Notes
                          </div>
                          <div className="mt-1 text-sm text-slate-800">
                            {parsed.notes}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {tags.slice(0, 6).map((t) => (
                            <Badge key={t} variant="outline">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Save / Share */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newIds = isSaved
                              ? savedIds.filter((i) => i !== post.id)
                              : [...savedIds, post.id];
                            setSavedIds(newIds);
                            localStorage.setItem("saved_reviews", JSON.stringify(newIds));
                            toast({ title: isSaved ? "Removed" : "Saved" });
                          }}
                        >
                          {isSaved ? (
                            <>
                              <BookmarkCheck className="mr-2 h-4 w-4 text-primary" />
                              Saved
                            </>
                          ) : (
                            <>
                              <Bookmark className="mr-2 h-4 w-4" />
                              Save
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
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
                            <>
                              <Check className="mr-2 h-4 w-4 text-emerald-500" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Share2 className="mr-2 h-4 w-4" />
                              Share
                            </>
                          )}
                        </Button>

                        {mapsUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={mapsUrl} target="_blank" rel="noreferrer">
                              <MapPin className="mr-2 h-4 w-4" />
                              Open Map
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      This review doesn’t match the template format, so it’s shown as a normal post.
                    </div>
                  )}
                </CardContent>

                {/* Keep PostCard for image + likes/comments, but remove the garbled caption */}
                <div className="border-t">
                  <PostCard
                    post={{ ...post, caption: "" }}
                    currentUserId={currentUserId}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
