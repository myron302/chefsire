import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeMediaUrl } from "@/lib/mediaUrl";
import { cn } from "@/lib/utils";
import { onMediaImageError } from "@/lib/image-fallback";

type MediaCarouselProps = {
  imageUrl?: string | null;
  additionalImages?: string[] | null;
  alt?: string;
  className?: string;
  mediaClassName?: string;
  videoClassName?: string;
  testId?: string;
  onClick?: () => void;
  preloadVideo?: "none" | "metadata" | "auto";
  mutedVideo?: boolean;
};

export function getPostMediaItems(imageUrl?: string | null, additionalImages?: string[] | null): string[] {
  return [imageUrl, ...(additionalImages ?? [])]
    .map((media) => normalizeMediaUrl(media))
    .filter((media, index, items): media is string => Boolean(media) && items.indexOf(media) === index);
}

export function isVideoMediaUrl(url?: string | null): boolean {
  const normalized = normalizeMediaUrl(url);
  if (!normalized) return false;
  if (normalized.startsWith("data:video/")) return true;
  const clean = normalized.toLowerCase().split("?")[0];
  return clean.includes("video") || /\.(mp4|webm|mov|avi|m4v|ogg|mkv)$/.test(clean);
}

export default function MediaCarousel({
  imageUrl,
  additionalImages,
  alt = "Post content",
  className,
  mediaClassName,
  videoClassName,
  testId,
  onClick,
  preloadVideo = "metadata",
  mutedVideo = false,
}: MediaCarouselProps) {
  const mediaItems = getPostMediaItems(imageUrl, additionalImages);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const activeMedia = mediaItems[currentIndex];
  const hasGallery = mediaItems.length > 1;

  useEffect(() => {
    setCurrentIndex(0);
  }, [imageUrl, JSON.stringify(additionalImages ?? [])]);

  // WHY A LOADED VIDEO CAN STILL BE UNWATCHABLE.
  //
  // A video the browser cannot decode does not raise an error. An HEVC clip in desktop Chrome reaches
  // readyState 4 (HAVE_ENOUGH_DATA) and fires `loadeddata` with videoWidth 0 and videoHeight 0: the container
  // parsed, the duration is known, the controls work, and there is no picture. Left alone that renders as a
  // black rectangle the viewer has no way to understand, so the absence of dimensions is read here as what it
  // actually means -- no decodable video track -- and said out loud. New uploads are converted on the server;
  // this is for anything stored before that, and for a codec no server-side conversion reached.
  const [undecodable, setUndecodable] = useState(false);
  useEffect(() => {
    setUndecodable(false);
  }, [activeMedia]);

  const showPrevious = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!mediaItems.length) return;
    setCurrentIndex((current) => (current === 0 ? mediaItems.length - 1 : current - 1));
  };

  const showNext = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!mediaItems.length) return;
    setCurrentIndex((current) => (current === mediaItems.length - 1 ? 0 : current + 1));
  };

  if (!activeMedia) return null;

  return (
    <div
      className={cn("relative", onClick && "cursor-pointer", className)}
      onClick={onClick}
      onTouchStart={(event) => {
        touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (!hasGallery || touchStartXRef.current === null) return;
        const endX = event.changedTouches[0]?.clientX ?? touchStartXRef.current;
        const deltaX = endX - touchStartXRef.current;
        touchStartXRef.current = null;

        if (Math.abs(deltaX) < 40) return;
        if (deltaX < 0) showNext();
        else showPrevious();
      }}
    >
      {isVideoMediaUrl(activeMedia) ? (
        undecodable ? (
          <div
            className={cn("flex flex-col items-center justify-center gap-2 bg-muted px-6 py-10 text-center", mediaClassName)}
            data-testid={testId ? `${testId}-unplayable` : undefined}
          >
            <VideoOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">This video can&apos;t be played in this browser</p>
            <p className="text-xs text-muted-foreground">
              It was recorded in a format this browser has no decoder for. It may play on a phone.
            </p>
          </div>
        ) : (
          <video
            src={activeMedia}
            controls
            muted={mutedVideo}
            playsInline
            preload={preloadVideo}
            className={cn(mediaClassName, videoClassName)}
            onLoadedData={(event) => {
              // Dimensions of zero on a video that reports it has data is the signature of a missing decoder.
              const video = event.currentTarget;
              if (video.videoWidth === 0 || video.videoHeight === 0) setUndecodable(true);
            }}
            onError={() => setUndecodable(true)}
          />
        )
      ) : (
        <img key={activeMedia} src={activeMedia} alt={alt} className={mediaClassName} data-testid={testId} loading="lazy" decoding="async" onError={onMediaImageError} />
      )}

      {hasGallery && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center gap-1 p-3">
            {mediaItems.map((media, index) => (
              <span key={`${media}-${index}`} className={cn("h-1.5 flex-1 rounded-full", index === currentIndex ? "bg-white" : "bg-white/40")} />
            ))}
          </div>
          <Button type="button" variant="secondary" size="icon" className="absolute left-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-black/45 text-white hover:bg-black/60" onClick={showPrevious}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button type="button" variant="secondary" size="icon" className="absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-black/45 text-white hover:bg-black/60" onClick={showNext}>
            <ChevronRight className="h-5 w-5" />
          </Button>
          <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white">
            {currentIndex + 1} / {mediaItems.length}
          </div>
        </>
      )}
    </div>
  );
}
