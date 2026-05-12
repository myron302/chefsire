import { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, MessageCircle, Share, ChevronLeft, ChevronRight, X, Plus, Camera, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/contexts/UserContext';
import chefLogo from '../asset/logo.jpg'; // Add import to match layout

interface Bite {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  content: {
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
  };
  caption: string;
  timestamp: Date;
  duration: number;
  views: number;
  likes: number;
  isLiked: boolean;
  tags: string[];
}

interface UserBites {
  userId: string;
  username: string;
  avatar: string;
  bites: Bite[];
  hasNewBites: boolean;
  isViewed: boolean;
}

type ActiveBiteApiItem = {
  id: string;
  userId: string;
  imageUrl: string;
  caption?: string | null;
  createdAt?: string | null;
  user?: {
    username?: string | null;
    displayName?: string | null;
    avatar?: string | null;
  } | null;
};

const SAMPLE_BITES: ActiveBiteApiItem[] = [
  {
    id: "sample-bite-1",
    userId: "sample-chef-1",
    imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
    caption: "Sample bite: quick plating idea for tonight's special.",
    createdAt: new Date().toISOString(),
    user: { username: "Chef Lina", avatar: "" },
  },
  {
    id: "sample-bite-2",
    userId: "sample-chef-2",
    imageUrl: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80",
    caption: "Sample bite: testing a citrus glaze.",
    createdAt: new Date().toISOString(),
    user: { username: "Chef Mateo", avatar: "" },
  },
];

// Custom Logo Component
const CustomLogo = () => (
  <div className="flex items-center">
    <img 
      src={chefLogo} 
      alt="Logo" 
      className="w-8 h-8 rounded-full object-cover"
    />
  </div>
);

interface BitesRowProps {
  className?: string;
}

const mapItemsToUserBites = (items: ActiveBiteApiItem[]): UserBites[] => {
  const grouped = new Map<string, UserBites>();
  for (const item of items) {
    if (!item?.id || !item?.userId || !item?.imageUrl) continue;
    const username = item.user?.username || item.user?.displayName || "Chef";
    const avatar = item.user?.avatar || "";
    const bite: Bite = {
      id: item.id,
      userId: item.userId,
      username,
      avatar,
      content: {
        type:
          item.imageUrl.startsWith("data:video/") ||
          item.imageUrl.match(/\.(mp4|webm|mov|avi)(\?|$)/i)
            ? "video"
            : "image",
        url: item.imageUrl,
      },
      caption: item.caption || "",
      timestamp: item.createdAt ? new Date(item.createdAt) : new Date(),
      duration: 5,
      views: 0,
      likes: 0,
      isLiked: false,
      tags: [],
    };

    const existing = grouped.get(item.userId);
    if (existing) {
      existing.bites.push(bite);
    } else {
      grouped.set(item.userId, {
        userId: item.userId,
        username,
        avatar,
        bites: [bite],
        hasNewBites: true,
        isViewed: false,
      });
    }
  }
  return Array.from(grouped.values());
};

export function BitesRow({ className = "" }: BitesRowProps) {
  const { user } = useUser();
  const [userBites, setUserBites] = useState<UserBites[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [usingSampleBites, setUsingSampleBites] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [currentBiteIndex, setCurrentBiteIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentUser = userBites[currentUserIndex];
  const currentBite = currentUser?.bites[currentBiteIndex];

  // Create bite state
  const [isCreating, setIsCreating] = useState(false);
  const [createCaption, setCreateCaption] = useState("");
  const [createMediaUrl, setCreateMediaUrl] = useState<string | null>(null);
  const [createMediaType, setCreateMediaType] = useState<"image" | "video">("video");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extracted so we can refetch after creating a bite (instead of only running once on mount)
  const loadBites = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadError("");
      try {
        const endpoint = user?.id
          ? `/api/bites/active/${encodeURIComponent(user.id)}`
          : "/api/bites/active";
        const response = await fetch(endpoint, {
          credentials: "include",
          signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message || "Failed to load bites");

        const items = Array.isArray(payload) ? (payload as ActiveBiteApiItem[]) : [];
        const mapped = mapItemsToUserBites(items);

        if (signal?.aborted) return;
        if (mapped.length > 0) {
          setUserBites(mapped);
          setUsingSampleBites(false);
          return;
        }

        setUserBites(mapItemsToUserBites(SAMPLE_BITES));
        setUsingSampleBites(true);
      } catch (error) {
        if (signal?.aborted) return;
        // AbortError isn't a real error from the user's perspective
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "Unable to load bites right now.");
        setUserBites(mapItemsToUserBites(SAMPLE_BITES));
        setUsingSampleBites(true);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [user?.id],
  );

  // Initial load + refetch when the signed-in user changes
  useEffect(() => {
    const controller = new AbortController();
    void loadBites(controller.signal);
    return () => controller.abort();
  }, [loadBites]);

  // Auto-advance bites
  useEffect(() => {
    if (!isViewing || isPaused || !currentBite) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const increment = 100 / (currentBite.duration * 10);
        const newProgress = prev + increment;
        
        if (newProgress >= 100) {
          handleNextBite();
          return 0;
        }
        return newProgress;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isViewing, currentUserIndex, currentBiteIndex, isPaused, currentBite]);

  const openUserBites = (userBite: UserBites) => {
    const userIndex = userBites.findIndex(ub => ub.userId === userBite.userId);
    setCurrentUserIndex(userIndex);
    setCurrentBiteIndex(0);
    setIsViewing(true);
    setProgress(0);
    
    markUserAsViewed(userBite.userId);
  };

  const closeBites = () => {
    setIsViewing(false);
    setCurrentUserIndex(0);
    setCurrentBiteIndex(0);
    setProgress(0);
  };

  const handleNextBite = () => {
    if (!currentUser) return;
    
    if (currentBiteIndex < currentUser.bites.length - 1) {
      setCurrentBiteIndex(prev => prev + 1);
      setProgress(0);
    } else if (currentUserIndex < userBites.length - 1) {
      const nextUserIndex = currentUserIndex + 1;
      setCurrentUserIndex(nextUserIndex);
      setCurrentBiteIndex(0);
      setProgress(0);
      
      markUserAsViewed(userBites[nextUserIndex].userId);
    } else {
      closeBites();
    }
  };

  const handlePrevBite = () => {
    if (currentBiteIndex > 0) {
      setCurrentBiteIndex(prev => prev - 1);
      setProgress(0);
    } else if (currentUserIndex > 0) {
      const prevUserIndex = currentUserIndex - 1;
      const prevUser = userBites[prevUserIndex];
      setCurrentUserIndex(prevUserIndex);
      setCurrentBiteIndex(prevUser.bites.length - 1);
      setProgress(0);
    }
  };

  const markUserAsViewed = (userId: string) => {
    setUserBites(prev => prev.map(ub => 
      ub.userId === userId ? { ...ub, isViewed: true, hasNewBites: false } : ub
    ));
  };

  const handleLike = (biteId: string) => {
    setUserBites(prev => prev.map(user => ({
      ...user,
      bites: user.bites.map(bite =>
        bite.id === biteId 
          ? { ...bite, isLiked: !bite.isLiked, likes: bite.isLiked ? bite.likes - 1 : bite.likes + 1 }
          : bite
      )
    })));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    setCreateMediaType(isVideo ? "video" : "image");
    const reader = new FileReader();
    reader.onload = () => setCreateMediaUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const resetCreate = () => {
    setIsCreating(false);
    setCreateCaption("");
    setCreateMediaUrl(null);
    setCreateMediaType("video");
    setCreateError("");
  };

  const handleCreateBite = async () => {
    if (!user?.id || !createMediaUrl) return;
    setCreateSubmitting(true);
    setCreateError("");
    try {
      const res = await fetch("/api/bites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          imageUrl: createMediaUrl,
          caption: createCaption.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message || "Failed to create bite");
      }
      resetCreate();
      // Pull the freshly-created bite (and anyone else's recent activity) back
      // into the row. Without this the new bite would only show after a page
      // refresh, and clicking its tile would do nothing because the bite
      // wouldn't be in local state.
      await loadBites();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  return (
    <>
      {/* Bites Row */}
      <div className={`bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 ${className}`}>
        <div className="container mx-auto px-4 py-4">
          <h2 className="text-orange-500 text-lg font-bold mb-4 flex items-center">
            <CustomLogo />
            <span className="ml-3">Chef's Corner - Quick Bites</span>
          </h2>
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading bites…</p>
          ) : userBites.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No bites available yet.</p>
          ) : (
          <>
          {(loadError || usingSampleBites) ? (
            <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
              Showing sample bites while live bites are unavailable.
            </p>
          ) : null}
          <div className="flex items-center space-x-4 overflow-x-auto pb-2 scrollbar-hide">
            {/* Your Bite (Create) */}
            <div className="flex-shrink-0 cursor-pointer group" onClick={() => user ? setIsCreating(true) : null}>
              <div className="relative">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center group-hover:border-primary transition-colors">
                  <Plus className="w-6 h-6 text-gray-400 group-hover:text-primary" />
                </div>
              </div>
              <p className="text-xs text-center mt-2 max-w-[70px] truncate text-gray-600 dark:text-gray-400">
                Your bite
              </p>
            </div>

            {/* Other User Bites */}
            {userBites.map((userBite) => (
              <div
                key={userBite.userId}
                className="flex-shrink-0 cursor-pointer group"
                onClick={() => openUserBites(userBite)}
              >
                <div className={`relative p-0.5 rounded-full ${
                  userBite.hasNewBites 
                    ? 'bg-gradient-to-tr from-orange-400 via-red-500 to-pink-600' 
                    : userBite.isViewed 
                      ? 'bg-gray-300 dark:bg-gray-600' 
                      : 'bg-gradient-to-tr from-orange-400 via-red-500 to-pink-600'
                }`}>
                  <Avatar className="w-16 h-16 border-2 border-white dark:border-gray-900">
                    <AvatarImage 
                      src={userBite.avatar} 
                      alt={userBite.username}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-gray-100 text-gray-600 font-medium">
                      {userBite.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {userBite.hasNewBites && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{userBite.bites.length}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-center mt-2 max-w-[70px] truncate text-gray-700 dark:text-gray-300">
                  {userBite.username}
                </p>
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      </div>

      {/* Create Bite Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">New Bite</h3>
              <Button variant="ghost" size="icon" onClick={resetCreate}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Media picker */}
            <input ref={fileInputRef} type="file" accept="video/*,image/*" className="hidden" onChange={handleFileChange} />
            <div
              className="w-full aspect-[9/16] max-h-64 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {createMediaUrl && createMediaType === "video" ? (
                <video src={createMediaUrl} className="w-full h-full object-cover rounded-xl" controls muted playsInline />
              ) : createMediaUrl ? (
                <img src={createMediaUrl} alt="Preview" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Video className="w-8 h-8" />
                  <span className="text-sm font-medium">Tap to pick video or photo</span>
                  <span className="text-xs">Video recommended</span>
                </div>
              )}
            </div>

            {/* Caption */}
            <textarea
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm resize-none bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              rows={2}
              placeholder="Add a caption…"
              value={createCaption}
              onChange={(e) => setCreateCaption(e.target.value)}
              maxLength={500}
            />

            {createError && <p className="text-red-500 text-sm">{createError}</p>}

            <Button
              className="w-full"
              disabled={!createMediaUrl || createSubmitting}
              onClick={handleCreateBite}
            >
              {createSubmitting ? "Posting…" : "Share Bite"}
            </Button>
          </div>
        </div>
      )}

      {/* Bite Viewer Modal */}
      {isViewing && currentBite && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          {/* Progress bars - only for CURRENT user's bites */}
          <div className="absolute top-4 left-4 right-4 flex space-x-1 z-10">
            {currentUser.bites.map((_, index) => (
              <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-100"
                  style={{
                    width: index === currentBiteIndex ? `${progress}%` : index < currentBiteIndex ? '100%' : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-6 left-4 right-4 flex items-center justify-between z-10 mt-6">
            <div className="flex items-center space-x-3">
              <Avatar className="w-10 h-10 border-2 border-white">
                <AvatarImage src={currentBite.avatar} />
                <AvatarFallback className="bg-gray-100 text-gray-600">
                  {currentBite.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white font-medium">{currentBite.username}</p>
                <p className="text-white/70 text-sm">
                  {formatTimeAgo(currentBite.timestamp)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={closeBites}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation areas */}
          <div className="absolute inset-0 flex">
            <div className="flex-1 cursor-pointer" onClick={handlePrevBite} />
            <div 
              className="flex-1 cursor-pointer" 
              onClick={handleNextBite}
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
              onMouseLeave={() => setIsPaused(false)}
            />
          </div>

          {/* Navigation arrows (desktop) */}
          {(currentUserIndex > 0 || currentBiteIndex > 0) && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hidden md:flex z-20"
              onClick={handlePrevBite}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hidden md:flex z-20"
            onClick={handleNextBite}
          >
            <ChevronRight className="w-6 h-6" />
          </Button>

          {/* Bite Content */}
          <div className="relative w-full max-w-md mx-auto aspect-[9/16]">
            {currentBite.content.type === "video" ? (
              <video
                key={currentBite.id}
                src={currentBite.content.url}
                className="w-full h-full object-cover rounded-lg"
                autoPlay
                loop
                muted={false}
                playsInline
              />
            ) : (
              <img
                src={currentBite.content.url}
                alt={currentBite.caption}
                className="w-full h-full object-cover rounded-lg"
              />
            )}
            
            {/* Caption and actions */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-start justify-between mb-2">
                <p className="text-white text-sm flex-1 mr-4">
                  {currentBite.caption}
                </p>
                <div className="flex flex-col items-center space-y-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => handleLike(currentBite.id)}
                  >
                    <Heart 
                      className={`w-6 h-6 ${
                        currentBite.isLiked 
                          ? 'fill-red-500 text-red-500' 
                          : 'text-white'
                      }`} 
                    />
                  </Button>
                  <span className="text-white text-xs">
                    {currentBite.likes}
                  </span>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                  >
                    <MessageCircle className="w-6 h-6" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                  >
                    <Share className="w-6 h-6" />
                  </Button>
                </div>
              </div>
              
              {/* Tags */}
              {currentBite.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {currentBite.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs bg-white/20 text-white border-none">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BitesRow;
