import * as React from "react";
import { X, Star, Globe, Link as LinkIcon, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MapView from "./MapView";

type PlaceSource = "fsq" | "google";

type Review = {
  author_name?: string;
  rating?: number;
  text?: string;
  time?: number;                  // google
  created_at?: string;            // fsq
};

export default function DetailsSheet(props: {
  open: boolean;
  onClose: () => void;

  source: PlaceSource;

  // Basic info
  name?: string;
  address?: string;
  rating?: number;
  userCount?: number;
  website?: string;
  url?: string;

  // New: display helpers we inject from the list item
  photoRef?: string | null;
  center?: { lat: number; lng: number } | undefined;

  // Optional reviews/details (if your details hook returns them)
  reviews?: Review[] | null;

  loading?: boolean;
}) {
  const {
    open,
    onClose,
    source,
    name,
    address,
    rating,
    userCount,
    website,
    url,
    photoRef,
    center,
    reviews = null,
    loading = false,
  } = props;

  const [hideImg, setHideImg] = React.useState(false);

  const imgSrc =
    source === "google" && photoRef
      ? `/api/google/photo?ref=${encodeURIComponent(photoRef)}&maxWidth=800`
      : null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* scrim */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* panel */}
      <div className="absolute right-0 top-0 h-full w-full md:w-[480px] bg-background shadow-xl overflow-y-auto">
        {/* header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-base font-semibold truncate">{name || "Details"}</div>
            {address && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{address}</span>
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* image */}
        <div className="w-full h-56 bg-muted">
          {imgSrc && !hideImg ? (
            <img
              src={imgSrc}
              alt={name || "photo"}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setHideImg(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              No photo available
            </div>
          )}
        </div>

        {/* meta */}
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            {typeof rating === "number" && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 stroke-yellow-400" />
                <span>{rating.toFixed(1)}</span>
                {typeof userCount === "number" && <span className="text-muted-foreground">({userCount})</span>}
              </div>
            )}
            <Badge variant="outline" className="ml-auto">
              {source === "google" ? "Google" : "Foursquare"}
            </Badge>
          </div>

          {/* links */}
          <div className="flex flex-wrap gap-2">
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
              >
                <Globe className="w-4 h-4" /> Website
              </a>
            )}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
              >
                <LinkIcon className="w-4 h-4" /> View on source
              </a>
            )}
          </div>
        </div>

        {/* map */}
        <div className="px-4">
          {center ? (
            <MapView center={center} markers={[center]} zoom={15} />
          ) : (
            <div className="w-full h-40 rounded border flex items-center justify-center text-sm text-muted-foreground">
              Map unavailable
            </div>
          )}
        </div>

        {/* reviews */}
        <div className="px-4 py-4">
          <div className="font-semibold mb-2">Reviews</div>
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!loading && (!reviews || reviews.length === 0) && (
            <div className="text-sm text-muted-foreground">No reviews found.</div>
          )}
          {!loading && !!reviews && reviews.length > 0 && (
            <ul className="space-y-3">
              {reviews.slice(0, 8).map((r, i) => (
                <li key={i} className="border rounded p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{r.author_name || "Anonymous"}</div>
                    {typeof r.rating === "number" && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="w-3.5 h-3.5 fill-yellow-400 stroke-yellow-400" />
                        <span>{r.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  {r.text && <p className="text-sm mt-1 whitespace-pre-line">{r.text}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
