import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  MessageCircle,
  Share,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Video,
  Upload,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";
import CameraModal from "@/components/CameraModal";
import { uploadMediaUrl } from "@/lib/uploadMedia";
import chefLogo from "../asset/logo.jpg"; // Add import to match layout

interface Bite {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  content: {
    type: "image" | "video";
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
  mediaType: "image" | "video";
  caption?: string | null;
  createdAt?: string | null;
  user?: {
    username?: string | null;
    displayName?: string | null;
    avatar?: string | null;
  } | null;
};

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

const isMovVideoUrl = (url?: string) =>
  Boolean(url && /\.mov(?:[?#].*)?$/i.test(url));

const isQuickTimeVideo = (url?: string | null, mimeType?: string | null) =>
  isMovVideoUrl(url ?? undefined) || mimeType === "video/quicktime";

const logVideoLoadedMetadata = (label: string, video: HTMLVideoElement) => {
  console.info(`[BitesRow video] ${label} loadedmetadata`, {
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    duration: video.duration,
    readyState: video.readyState,
  });
};

const logVideoCanPlay = (label: string, video: HTMLVideoElement) => {
  console.info(`[BitesRow video] ${label} canplay`, {
    readyState: video.readyState,
  });
};

const logVideoError = (label: string, video: HTMLVideoElement) => {
  console.error(`[BitesRow video] ${label} error`, {
    code: video.error?.code,
    message: video.error?.message,
  });
};

interface BitesRowProps {
  className?: string;
}

export function BitesRow({ className = "" }: BitesRowProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [viewedUserIds, setViewedUserIds] = useState<Set<string>>(new Set());
  const [likedBiteIds, setLikedBiteIds] = useState<Set<string>>(new Set());
  const [isViewing, setIsViewing] = useState(false);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [currentBiteIndex, setCurrentBiteIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Create bite state
  const [isCreating, setIsCreating] = useState(false);
  const [createCaption, setCreateCaption] = useState("");
  const [createMediaUrl, setCreateMediaUrl] = useState<string | null>(null);
  const [createMediaType, setCreateMediaType] = useState<"image" | "video">(
    "video",
  );
  const [createMediaMimeType, setCreateMediaMimeType] = useState<string | null>(
    null,
  );
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCameraCapture = (dataUrl: string, type: "image" | "video") => {
    setCreateMediaType(type);
    setCreateMediaMimeType(null);
    setCreateMediaUrl(dataUrl);
  };

  const activeBitesQueryKey = user?.id
    ? ["/api/bites/active", user.id]
    : ["/api/bites/active"];

  const activeBitesQuery = useQuery<ActiveBiteApiItem[]>({
    queryKey: activeBitesQueryKey,
    queryFn: async ({ queryKey }) => {
      const endpoint = queryKey.join("/");
      const response = await fetch(endpoint, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(payload?.message || "Failed to load bites");
      return Array.isArray(payload) ? payload : [];
    },
  });

  const userBites = useMemo(() => {
    const grouped = new Map<string, UserBites>();
    for (const item of activeBitesQuery.data ?? []) {
      if (!item?.id || !item?.userId || !item?.imageUrl) continue;
      const username = item.user?.username || item.user?.displayName || "Chef";
      const avatar = item.user?.avatar || "";
      const isLiked = likedBiteIds.has(item.id);
      const bite: Bite = {
        id: item.id,
        userId: item.userId,
        username,
        avatar,
        content: { type: item.mediaType, url: item.imageUrl },
        caption: item.caption || "",
        timestamp: item.createdAt ? new Date(item.createdAt) : new Date(),
        duration: item.mediaType === "video" ? 15 : 5,
        views: 0,
        likes: isLiked ? 1 : 0,
        isLiked,
        tags: [],
      };

      const existing = grouped.get(item.userId);
      if (existing) {
        existing.bites.push(bite);
      } else {
        const isViewed = viewedUserIds.has(item.userId);
        grouped.set(item.userId, {
          userId: item.userId,
          username,
          avatar,
          bites: [bite],
          hasNewBites: !isViewed,
          isViewed,
        });
      }
    }
    return Array.from(grouped.values());
  }, [activeBitesQuery.data, likedBiteIds, viewedUserIds]);

  const currentUser = userBites[currentUserIndex];
  const currentBite = currentUser?.bites[currentBiteIndex];

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
    const userIndex = userBites.findIndex(
      (ub) => ub.userId === userBite.userId,
    );
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
      setCurrentBiteIndex((prev) => prev + 1);
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
      setCurrentBiteIndex((prev) => prev - 1);
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
    setViewedUserIds((prev) => new Set(prev).add(userId));
  };

  const handleLike = (biteId: string) => {
    setLikedBiteIds((prev) => {
      const next = new Set(prev);
      if (next.has(biteId)) next.delete(biteId);
      else next.add(biteId);
      return next;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    setCreateMediaType(isVideo ? "video" : "image");
    setCreateMediaMimeType(file.type || null);
    const reader = new FileReader();
    reader.onload = () => setCreateMediaUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const resetCreate = () => {
    setIsCreating(false);
    setCreateCaption("");
    setCreateMediaUrl(null);
    setCreateMediaType("video");
    setCreateMediaMimeType(null);
    setCreateError("");
  };

  const handleCreateBite = async () => {
    if (!user?.id || !createMediaUrl) return;
    setCreateSubmitting(true);
    setCreateError("");
    try {
      const storedUrl = await uploadMediaUrl(createMediaUrl);
      const res = await fetch("/api/bites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          imageUrl: storedUrl,
          caption: createCaption.trim() || undefined,
          mediaType: createMediaType,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message || "Failed to create bite");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/bites/active"] });
      resetCreate();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Something went wrong",
      );
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
      <div
        className={`bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 ${className}`}
      >
        <div className="container mx-auto px-4 py-4">
          <h2 className="text-orange-500 text-lg font-bold mb-4 flex items-center">
            <CustomLogo />
            <span className="ml-3">Chef's Corner - Quick Bites</span>
          </h2>
          {activeBitesQuery.isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading bites…
            </p>
          ) : activeBitesQuery.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {activeBitesQuery.error instanceof Error
                ? activeBitesQuery.error.message
                : "Unable to load bites right now."}
            </p>
          ) : (
            <>
              <div className="flex items-center space-x-4 overflow-x-auto pb-2 scrollbar-hide">
                {/* Your Bite (Create) */}
                <div
                  className="flex-shrink-0 cursor-pointer group"
                  onClick={() => (user ? setIsCreating(true) : null)}
                >
                  <div className="relative">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center group-hover:border-primary transition-colors">
                      <Plus className="w-6 h-6 text-gray-400 group-hover:text-primary" />
                    </div>
                  </div>
                  <p className="text-xs text-center mt-2 max-w-[70px] truncate text-gray-600 dark:text-gray-400">
                    Your bite
                  </p>
                </div>

                {userBites.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No bites available yet.
                  </p>
                ) : null}

                {/* Other User Bites */}
                {userBites.map((userBite) => (
                  <div
                    key={userBite.userId}
                    className="flex-shrink-0 cursor-pointer group"
                    onClick={() => openUserBites(userBite)}
                  >
                    <div
                      className={`relative p-0.5 rounded-full ${
                        userBite.hasNewBites
                          ? "bg-gradient-to-tr from-orange-400 via-red-500 to-pink-600"
                          : userBite.isViewed
                            ? "bg-gray-300 dark:bg-gray-600"
                            : "bg-gradient-to-tr from-orange-400 via-red-500 to-pink-600"
                      }`}
                    >
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
                          <span className="text-white text-xs font-bold">
                            {userBite.bites.length}
                          </span>
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
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="w-full aspect-[9/16] max-h-64 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600">
              {createMediaUrl && createMediaType === "video" ? (
                <video
                  src={createMediaUrl}
                  className="w-full h-full object-contain rounded-xl bg-black"
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(event) =>
                    logVideoLoadedMetadata("create-preview", event.currentTarget)
                  }
                  onCanPlay={(event) =>
                    logVideoCanPlay("create-preview", event.currentTarget)
                  }
                  onError={(event) =>
                    logVideoError("create-preview", event.currentTarget)
                  }
                />
              ) : createMediaUrl ? (
                <img
                  src={createMediaUrl}
                  alt="Preview"
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-400">
                  <Video className="w-8 h-8" />
                  <span className="text-sm font-medium">
                    Add video or photo
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCamera(true)}
                    >
                      <Camera className="w-4 h-4 mr-1" />
                      Camera
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Upload
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {isQuickTimeVideo(createMediaUrl, createMediaMimeType) && (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                MOV files from iPhone can render as black in Chrome when they
                use HEVC. This is a browser compatibility issue, not a BiteRow
                API issue. For reliable playback, upload browser-safe MP4
                (H.264) or WebM; server-side transcoding can be added later.
              </p>
            )}

            {/* Caption */}
            <textarea
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm resize-none bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              rows={2}
              placeholder="Add a caption…"
              value={createCaption}
              onChange={(e) => setCreateCaption(e.target.value)}
              maxLength={500}
            />

            {createError && (
              <p className="text-red-500 text-sm">{createError}</p>
            )}

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

      <CameraModal
        open={showCamera}
        onOpenChange={setShowCamera}
        onCapture={handleCameraCapture}
      />

      {/* Bite Viewer Modal */}
      {isViewing && currentBite && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          {/* Progress bars - only for CURRENT user's bites */}
          <div className="absolute top-4 left-4 right-4 flex space-x-1 z-10">
            {currentUser.bites.map((_, index) => (
              <div
                key={index}
                className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white rounded-full transition-all duration-100"
                  style={{
                    width:
                      index === currentBiteIndex
                        ? `${progress}%`
                        : index < currentBiteIndex
                          ? "100%"
                          : "0%",
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
          <div className="flex w-full max-w-md flex-col items-center gap-2 mx-auto">
            <div className="relative w-full min-h-[300px] aspect-[9/16]">
              {currentBite.content.type === "video" ? (
                <video
                  key={currentBite.id}
                  src={currentBite.content.url}
                  className="w-full h-full min-h-[300px] object-contain rounded-lg bg-black"
                  controls
                  autoPlay
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(event) => {
                    logVideoLoadedMetadata("modal-viewer", event.currentTarget);
                    event.currentTarget.play().catch(() => undefined);
                  }}
                  onCanPlay={(event) => {
                    logVideoCanPlay("modal-viewer", event.currentTarget);
                    event.currentTarget.play().catch(() => undefined);
                  }}
                  onError={(event) =>
                    logVideoError("modal-viewer", event.currentTarget)
                  }
                  onPlay={() => setIsPaused(false)}
                  onPause={() => setIsPaused(true)}
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
                            ? "fill-red-500 text-red-500"
                            : "text-white"
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
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs bg-white/20 text-white border-none"
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {isMovVideoUrl(currentBite.content.url) && (
              <p className="rounded-lg bg-amber-500/90 p-3 text-xs text-black shadow-lg">
                MOV/iPhone HEVC videos may render as black in Chrome. This is a
                browser compatibility issue, not a BiteRow API issue. Use
                browser-safe MP4 (H.264) or WebM until transcoding is added.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default BitesRow;
