import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Star, MapPin, ArrowUpNarrowWide, Calendar, ThumbsUp, ThumbsDown, 
  Lightbulb, Share2, Check, Bookmark, BookmarkCheck, DollarSign,
  Search, Info
} from "lucide-react";
import PostCard from "@/components/post-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { PostWithUser } from "@shared/schema";
import { useUser } from "@/contexts/UserContext";

// --- Logic Helpers ---

function parseReviewCaption(caption: string = ""): ParsedReview | null {
  const raw = caption.trim();
  const lines = raw.split("\n").map(l => l.trim());
  
  // If it doesn't start with the emoji, we still return a partial object 
  // so it doesn't get filtered out of the list.
  const isStructured = raw.toLowerCase().startsWith("📝 review:");
  
  const takeAfter = (keys: string[]) => {
    const line = lines.find(l => keys.some(k => l.toLowerCase().startsWith(k.toLowerCase())));
    return line ? line.split(":").slice(1).join(":").trim() : undefined;
  };

  const nameHeader = isStructured 
    ? lines[0].replace(/^📝\s*Review:\s*/i, "").split(",")[0] 
    : "Review Post";

  const ratingStr = takeAfter(["⭐ Rating", "⭐️ Rating"]);
  const priceStr = takeAfter(["💰 Price", "Price Range", "Price"]);

  return {
    businessName: nameHeader.trim(),
    locationLabel: takeAfter(["📍 Location", "Location"]),
    rating: parseFloat(ratingStr?.match(/(\d+(\.\d+)?)/)?.[0] || "0"),
    priceRange: priceStr ? (priceStr.match(/\$/g) || []).length || parseInt(priceStr) : undefined,
    pros: takeAfter(["✅ Pros", "Pros"]),
    cons: takeAfter(["⚠️ Cons", "Cons"]),
    verdict: takeAfter(["💡 Verdict", "Verdict"]),
  };
}

function PriceIndicator({ level }: { level?: number }) {
  if (!level || isNaN(level)) return null;
  return (
    <div className="flex text-emerald-600 font-bold text-xs">
      {[1, 2, 3, 4].map((i) => (
        <DollarSign key={i} size={14} className={i <= level ? "opacity-100" : "opacity-20"} />
      ))}
    </div>
  );
}

// --- Main Page ---

export default function ReviewsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const currentUserId = user?.id || "";

  const [q, setQ] = useState("");
  const [activePrice, setActivePrice] = useState<number | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<number[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("saved_reviews");
    if (saved) setSavedIds(JSON.parse(saved));
  }, []);

  const { data: posts = [], isLoading } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/explore", currentUserId],
    queryFn: async () => {
      const res = await fetch(`/api/posts/explore?limit=100`, { credentials: "include" });
      return res.ok ? res.json() : [];
    }
  });

  const reviewPosts = useMemo(() => {
    const normalizedQ = q.toLowerCase();

    return posts
      .filter(p => {
        const hasTag = (p.tags || []).some(t => t.toLowerCase() === "review");
        const hasPrefix = (p.caption || "").toLowerCase().startsWith("📝 review:");
        return hasTag || hasPrefix; // BROADER FILTER: captures everything tagged "review"
      })
      .map(p => ({
        post: p,
        parsed: parseReviewCaption(p.caption || "")
      }))
      .filter(({ post, parsed }) => {
        // Apply "Saved" filter
        if (showSavedOnly && !savedIds.includes(post.id)) return false;
        
        // Apply Price filter (only if post actually has a price listed)
        if (activePrice && parsed?.priceRange !== activePrice) return false;

        // Apply Search filter
        const searchPool = [
          post.caption,
          (post.tags || []).join(" "),
          parsed?.businessName,
          parsed?.verdict
        ].join(" ").toLowerCase();
        
        return searchPool.includes(normalizedQ);
      })
      .sort((a, b) => new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime());
  }, [posts, q, showSavedOnly, savedIds, activePrice]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 min-h-screen">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Reviews</h1>
            <p className="text-slate-500 font-medium">Everything tagged "Review" in the community.</p>
          </div>
          <Button 
            variant={showSavedOnly ? "default" : "outline"}
            onClick={() => setShowSavedOnly(!showSavedOnly)}
            className="rounded-full"
          >
            <Bookmark className="mr-2 h-4 w-4" /> {showSavedOnly ? "Showing Saved" : "My Bookmarks"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input 
              placeholder="Search reviews..." 
              className="pl-10 h-11 rounded-xl shadow-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 bg-white p-1 border rounded-xl shadow-sm">
            {[1, 2, 3, 4].map(p => (
              <button
                key={p}
                onClick={() => setActivePrice(activePrice === p ? null : p)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activePrice === p ? "bg-primary text-white" : "hover:bg-slate-100 text-slate-500"
                }`}
              >
                {"$".repeat(p)}
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => {setQ(""); setActivePrice(null); setShowSavedOnly(false);}}>
            Reset
          </Button>
        </div>
      </div>

      <Separator />

      {isLoading ? (
        <div className="text-center py-20 animate-pulse text-slate-400 font-medium">Loading reviews...</div>
      ) : reviewPosts.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center border-2 border-dashed rounded-3xl">
           <Info size={32} className="text-slate-300 mb-2" />
           <p className="text-slate-500">No reviews found matching these criteria.</p>
        </div>
      ) : (
        <div className="space-y-16">
          {reviewPosts.map(({ post, parsed }) => (
            <div key={post.id} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              <div className="lg:col-span-4 space-y-4">
                <div className="lg:sticky lg:top-24 space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{parsed?.businessName}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      {parsed?.rating ? (
                        <div className="flex items-center gap-1 bg-yellow-400 text-white px-2 py-0.5 rounded font-bold text-sm">
                          {parsed.rating.toFixed(1)} <Star size={12} fill="currentColor" />
                        </div>
                      ) : <Badge variant="outline">No Rating</Badge>}
                      <PriceIndicator level={parsed?.priceRange} />
                    </div>
                  </div>

                  {parsed?.locationLabel && (
                    <div className="text-sm text-slate-500 flex items-start gap-2">
                      <MapPin size={16} className="mt-0.5 shrink-0" />
                      <span>{parsed.locationLabel}</span>
                    </div>
                  )}

                  {parsed?.verdict && (
                    <div className="bg-primary/5 border-l-4 border-primary p-4 rounded-r-xl">
                      <p className="text-sm font-medium italic text-slate-700">"{parsed.verdict}"</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 rounded-full"
                      onClick={() => {
                        const ids = savedIds.includes(post.id) ? savedIds.filter(i => i !== post.id) : [...savedIds, post.id];
                        setSavedIds(ids);
                        localStorage.setItem("saved_reviews", JSON.stringify(ids));
                      }}
                      variant={savedIds.includes(post.id) ? "default" : "outline"}
                    >
                      {savedIds.includes(post.id) ? <BookmarkCheck className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}
                      {savedIds.includes(post.id) ? "Saved" : "Save"}
                    </Button>
                    <Button variant="outline" size="icon" className="rounded-full" onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`);
                      toast({ title: "Link copied!" });
                    }}>
                      <Share2 size={16} />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8">
                <div className="bg-white rounded-3xl overflow-hidden shadow-lg border border-slate-100">
                   <PostCard post={post} currentUserId={currentUserId} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type ParsedReview = {
  businessName: string;
  locationLabel?: string;
  rating: number;
  priceRange?: number;
  pros?: string;
  cons?: string;
  verdict?: string;
};
