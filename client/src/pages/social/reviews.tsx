import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  const currentUserId = user?.id || "";

  const [q, setQ] = useState("");
  const [minRating, setMinRating] = useState<number | "">("");

  // Pull a bigger slice so search feels responsive.
  // (If you want true server-side search later, we’ll add endpoints.)
  const { data: posts = [], isLoading } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/explore", currentUserId, 0, 100],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("offset", "0");
      params.set("limit", "100");
      if (currentUserId) params.set("userId", currentUserId);

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
      .sort((a, b) => {
        // newest first
        const ad = new Date(a.post.createdAt).getTime();
        const bd = new Date(b.post.createdAt).getTime();
        return bd - ad;
      });

    return withParsed.filter(({ post, parsed }) => {
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
  }, [posts, q, minRating]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-2xl font-bold">Reviews</CardTitle>
            <Badge variant="secondary">{reviewPosts.length}</Badge>
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
                inputMode="numeric"
                type="number"
                min={1}
                max={5}
                placeholder="Min rating (1-5)"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQ("");
                  setMinRating("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="text-sm text-muted-foreground">
          This page shows posts marked as <span className="font-medium">Review</span> (tagged “review” or starting with{" "}
          <span className="font-medium">📝 Review:</span>). Tap a card to interact like a normal post.
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
        <div className="space-y-4">
          {reviewPosts.map(({ post, parsed }) => {
            const mapsUrl = parsed ? buildMapsUrl(parsed) : null;

            return (
              <div key={post.id} className="space-y-2">
                {/* Optional quick link row */}
                {mapsUrl ? (
                  <div className="flex justify-end">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Open in Google Maps
                    </a>
                  </div>
                ) : null}

                <PostCard post={post} currentUserId={currentUserId} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
