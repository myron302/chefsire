import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Star, MapPin, ArrowUpNarrowWide, Calendar, ThumbsUp, ThumbsDown, 
  Lightbulb, Share2, Check, Bookmark, BookmarkCheck, DollarSign,
  Search, SlidersHorizontal, Info, ExternalLink
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

// --- Advanced Parsing ---
type ParsedReview = {
  businessName: string;
  locationLabel?: string;
  rating: number;
  priceRange?: number; // 1-4 scale
  pros?: string;
  cons?: string;
  verdict?: string;
};

function parseReviewCaption(caption: string = ""): ParsedReview | null {
  const raw = caption.trim();
  if (!raw.toLowerCase().startsWith("📝 review:")) return null;

  const lines = raw.split("\n").map(l => l.trim());
  const headerLine = lines[0].replace(/^📝\s*Review:\s*/i, "");
  const [name, ...locParts] = headerLine.split(",");

  const takeAfter = (keys: string[]) => {
    const line = lines.find(l => keys.some(k => l.toLowerCase().startsWith(k.toLowerCase())));
    return line ? line.split(":").slice(1).join(":").trim() : undefined;
  };

  const ratingStr = takeAfter(["⭐ Rating", "⭐️ Rating"]);
  const priceStr = takeAfter(["💰 Price", "Price Range"]);

  return {
    businessName: name.trim(),
    locationLabel: locParts.join(",").trim() || takeAfter(["📍 Location"]),
    rating: parseFloat(ratingStr?.match(/(\d+(\.\d+)?)/)?.[0] || "0"),
    priceRange: priceStr ? (priceStr.match(/\$/g) || []).length || parseInt(priceStr) : undefined,
    pros: takeAfter(["✅ Pros"]),
    cons: takeAfter(["⚠️ Cons"]),
    verdict: takeAfter(["💡 Verdict", "Verdict"]),
  };
}

// --- Sub-components ---

function PriceIndicator({ level }: { level?: number }) {
  if (!level) return null;
  return (
    <div className="flex text-emerald-600 font-bold text-xs">
      {[1, 2, 3, 4].map((i) => (
        <DollarSign key={i} size={14} className={i <= level ? "opacity-100" : "opacity-20"} />
      ))}
    </div>
  );
}

export default function ProfessionalReviewsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [activePrice, setActivePrice] = useState<number | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<number[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("saved_reviews");
    if (saved) setSavedIds(JSON.parse(saved));
  }, []);

  const { data: posts = [], isLoading } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/explore", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/posts/explore?limit=100`, { credentials: "include" });
      return res.ok ? res.json() : [];
    }
  });

  const filteredReviews = useMemo(() => {
    return posts
      .map(p => ({ post: p, parsed: parseReviewCaption(p.caption) }))
      .filter(({ post, parsed }) => {
        if (!parsed) return false;
        if (showSavedOnly && !savedIds.includes(post.id)) return false;
        if (activePrice && parsed.priceRange !== activePrice) return false;
        
        const searchStr = `${parsed.businessName} ${parsed.verdict} ${post.tags?.join(" ")}`.toLowerCase();
        return searchStr.includes(q.toLowerCase());
      });
  }, [posts, q, showSavedOnly, savedIds, activePrice]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 bg-slate-50/50 min-h-screen">
      {/* Header & Advanced Search */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Explore Reviews</h1>
            <p className="text-slate-500 font-medium">Verified local insights and recommendations.</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant={showSavedOnly ? "default" : "outline"}
              onClick={() => setShowSavedOnly(!showSavedOnly)}
              className="rounded-full shadow-sm"
            >
              <Bookmark className="mr-2 h-4 w-4" /> My Bookmarks
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input 
              placeholder="Search by name, vibe, or keyword..." 
              className="pl-10 bg-white border-slate-200 h-11 rounded-xl shadow-sm focus:ring-2 ring-primary/20"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 bg-white p-1 border rounded-xl shadow-sm overflow-hidden">
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
            Reset Filters
          </Button>
        </div>
      </div>

      <Separator />

      {/* Results Feed */}
      <div className="space-y-16">
        {filteredReviews.length > 0 ? (
          filteredReviews.map(({ post, parsed }) => (
            <div key={post.id} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Review Metadata Sidebar */}
              <div className="lg:col-span-4 space-y-4">
                <div className="sticky top-24 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-2xl font-bold tracking-tight text-slate-900">{parsed!.businessName}</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-yellow-400 text-white px-2 py-0.5 rounded font-bold text-sm">
                        {parsed!.rating.toFixed(1)} <Star size={12} fill="currentColor" />
                      </div>
                      <PriceIndicator level={parsed!.priceRange} />
                    </div>
                  </div>

                  <div className="text-sm text-slate-500 flex items-start gap-2">
                    <MapPin size={16} className="mt-0.5 shrink-0" />
                    <span>{parsed!.locationLabel || "Address not listed"}</span>
                  </div>

                  {parsed!.verdict && (
                    <Card className="bg-primary/5 border-none shadow-none">
                      <CardContent className="p-4">
                        <div className="flex gap-3">
                          <Lightbulb className="text-primary shrink-0" size={20} />
                          <p className="text-sm font-medium leading-relaxed italic text-slate-700">"{parsed!.verdict}"</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-2">
                    {parsed!.pros && (
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                        <ThumbsUp size={14} /> {parsed!.pros}
                      </div>
                    )}
                    {parsed!.cons && (
                      <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
                        <ThumbsDown size={14} /> {parsed!.cons}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex gap-2">
                    <Button 
                      className="flex-1 rounded-full gap-2"
                      onClick={() => {
                        const ids = savedIds.includes(post.id) ? savedIds.filter(i => i !== post.id) : [...savedIds, post.id];
                        setSavedIds(ids);
                        localStorage.setItem("saved_reviews", JSON.stringify(ids));
                        toast({ title: savedIds.includes(post.id) ? "Removed" : "Saved to My Spots" });
                      }}
                      variant={savedIds.includes(post.id) ? "default" : "outline"}
                    >
                      {savedIds.includes(post.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                      {savedIds.includes(post.id) ? "Saved" : "Save Spot"}
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="rounded-full"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`);
                              toast({ title: "Link copied!" });
                            }}
                          >
                            <Share2 size={16} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy review link</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>

              {/* Main Post Content */}
              <div className="lg:col-span-8">
                <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100 hover:border-primary/20 transition-all group">
                   <PostCard post={post} currentUserId={user?.id || 0} />
                </div>
              </div>
              
            </div>
          ))
        ) : (
          <div className="h-96 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-3xl">
             <div className="p-4 bg-slate-100 rounded-full text-slate-400">
               <Info size={32} />
             </div>
             <div>
               <h3 className="text-xl font-bold">No results found</h3>
               <p className="text-slate-500 max-w-xs mx-auto">Try adjusting your filters or search keywords to find what you're looking for.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
