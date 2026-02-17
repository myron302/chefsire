import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Star, MapPin, ArrowUpNarrowWide, Calendar, ThumbsUp, ThumbsDown, 
  Lightbulb, Share2, Check, Bookmark, BookmarkCheck, DollarSign,
  Search, Info, X
} from "lucide-react";
import PostCard from "@/components/post-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { PostWithUser } from "@shared/schema";
import { useUser } from "@/contexts/UserContext";

// --- Types ---
type ParsedReview = {
  businessName: string;
  locationLabel?: string;
  rating: number;
  priceRange?: number;
  pros?: string;
  cons?: string;
  verdict?: string;
  isStructured: boolean;
};

// --- Logic ---
function parseReviewCaption(caption: string = ""): ParsedReview {
  const raw = caption.trim();
  const lines = raw.split("\n").map(l => l.trim());
  
  // Check if it's the specific "📝 Review:" format
  const isStructured = raw.toLowerCase().startsWith("📝 review:");
  
  const takeAfter = (keys: string[]) => {
    const line = lines.find(l => keys.some(k => l.toLowerCase().startsWith(k.toLowerCase())));
    if (!line) return undefined;
    const parts = line.split(":");
    return parts.length > 1 ? parts.slice(1).join(":").trim() : undefined;
  };

  const nameHeader = isStructured 
    ? lines[0].replace(/^📝\s*Review:\s*/i, "").split(",")[0] 
    : "Community Review";

  const ratingMatch = takeAfter(["⭐ Rating", "⭐️ Rating", "Rating"])?.match(/(\d+(\.\d+)?)/);
  const priceStr = takeAfter(["💰 Price", "Price Range", "Price"]);

  return {
    businessName: nameHeader.trim(),
    locationLabel: takeAfter(["📍 Location", "Location"]),
    rating: ratingMatch ? parseFloat(ratingMatch[0]) : 0,
    priceRange: priceStr ? (priceStr.match(/\$/g) || []).length || parseInt(priceStr) : undefined,
    pros: takeAfter(["✅ Pros", "Pros"]),
    cons: takeAfter(["⚠️ Cons", "Cons"]),
    verdict: takeAfter(["💡 Verdict", "Verdict"]),
    isStructured
  };
}

export default function ReviewsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const currentUserId = user?.id || "";

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [minRating, setMinRating] = useState<number>(0);
  const [activePrice, setActivePrice] = useState<number | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<number[]>([]);

  // Load saved reviews
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
    return posts
      .filter(p => {
        const hasTag = (p.tags || []).some(t => t.toLowerCase() === "review");
        const hasPrefix = (p.caption || "").toLowerCase().includes("review:");
        return hasTag || hasPrefix;
      })
      .map(p => ({ post: p, parsed: parseReviewCaption(p.caption || "") }))
      .filter(({ post, parsed }) => {
        if (showSavedOnly && !savedIds.includes(post.id)) return false;
        if (activePrice && parsed.priceRange !== activePrice) return false;
        if (minRating > 0 && parsed.rating < minRating) return false;

        const content = `${post.caption} ${post.tags?.join(" ")} ${parsed.businessName}`.toLowerCase();
        return content.includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime());
  }, [posts, searchQuery, minRating, activePrice, showSavedOnly, savedIds]);

  const handleToggleSave = (id: number, name: string) => {
    const newIds = savedIds.includes(id) ? savedIds.filter(i => i !== id) : [...savedIds, id];
    setSavedIds(newIds);
    localStorage.setItem("saved_reviews", JSON.stringify(newIds));
    toast({ title: savedIds.includes(id) ? "Removed from bookmarks" : "Saved to bookmarks", description: name });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter">REVIEWS</h1>
          <p className="text-muted-foreground text-sm">Discover and save the best local spots.</p>
        </div>
        <div className="flex gap-2">
           <Button variant={showSavedOnly ? "default" : "outline"} onClick={() => setShowSavedOnly(!showSavedOnly)} className="rounded-full">
             <Bookmark className="mr-2 h-4 w-4" /> {showSavedOnly ? "Saved Only" : "All Reviews"}
           </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="bg-slate-50/50 border-none shadow-none p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search anything..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-10 bg-white"
            />
          </div>
          <div className="md:col-span-3 flex items-center gap-1 bg-white border rounded-md p-1">
            {[1, 2, 3, 4].map(num => (
              <button 
                key={num}
                onClick={() => setActivePrice(activePrice === num ? null : num)}
                className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-all ${activePrice === num ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-slate-50'}`}
              >
                {"$".repeat(num)}
              </button>
            ))}
          </div>
          <div className="md:col-span-3 flex items-center gap-2">
            <Star className="text-yellow-500 h-4 w-4 shrink-0" />
            <select 
              className="text-sm bg-white border rounded-md p-2 w-full"
              value={minRating}
              onChange={e => setMinRating(Number(e.target.value))}
            >
              <option value="0">All Ratings</option>
              <option value="4">4+ Stars</option>
              <option value="3">3+ Stars</option>
            </select>
          </div>
          <div className="md:col-span-1">
            <Button variant="ghost" size="icon" onClick={() => {setSearchQuery(""); setActivePrice(null); setMinRating(0); setShowSavedOnly(false);}}>
              <X size={18} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Feed */}
      {isLoading ? (
        <div className="text-center py-20 animate-pulse">Loading community feed...</div>
      ) : reviewPosts.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-3xl">
          <Info className="mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No matching reviews. Try broadening your search.</p>
        </div>
      ) : (
        <div className="space-y-16">
          {reviewPosts.map(({ post, parsed }) => (
            <div key={post.id} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Info Column */}
              <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-8 h-fit">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{parsed.businessName}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    {parsed.rating > 0 && (
                      <div className="flex items-center gap-1 bg-yellow-400 text-white px-2 py-0.5 rounded text-xs font-bold">
                        {parsed.rating} <Star size={10} fill="currentColor" />
                      </div>
                    )}
                    <div className="flex text-emerald-600">
                      {[1, 2, 3, 4].map(i => <DollarSign key={i} size={14} className={i <= (parsed.priceRange || 0) ? "opacity-100" : "opacity-20"} />)}
                    </div>
                  </div>
                </div>

                {parsed.locationLabel && (
                  <div className="text-xs text-muted-foreground flex gap-1 items-center">
                    <MapPin size={14} /> {parsed.locationLabel}
                  </div>
                )}

                {parsed.verdict && (
                  <div className="bg-primary/5 border-l-2 border-primary p-3 rounded-r-lg">
                    <p className="text-xs font-medium italic text-slate-700">"{parsed.verdict}"</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {parsed.pros && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-100 text-[10px]"><ThumbsUp size={10} className="mr-1" /> {parsed.pros}</Badge>}
                  {parsed.cons && <Badge variant="secondary" className="bg-rose-50 text-rose-700 hover:bg-rose-50 border-rose-100 text-[10px]"><ThumbsDown size={10} className="mr-1" /> {parsed.cons}</Badge>}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant={savedIds.includes(post.id) ? "default" : "outline"} className="flex-1 rounded-full text-xs" onClick={() => handleToggleSave(post.id, parsed.businessName)}>
                    {savedIds.includes(post.id) ? <BookmarkCheck className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}
                    {savedIds.includes(post.id) ? "Saved" : "Save Spot"}
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-full" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`);
                    toast({ title: "Link copied!" });
                  }}>
                    <Share2 size={16} />
                  </Button>
                </div>
              </div>

              {/* Card Column */}
              <div className="lg:col-span-8">
                <div className="shadow-lg rounded-2xl overflow-hidden border">
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
