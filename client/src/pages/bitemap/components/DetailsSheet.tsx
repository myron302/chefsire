// client/src/pages/bitemap/components/DetailsSheet.tsx
import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Star } from "lucide-react";

interface DetailsSheetProps {
  source: "fsq" | "google";
  name?: string;
  website?: string | null;
  url?: string | null;
  address?: string;
  rating?: number | null;
  userCount?: number | null;
  reviews?: { id: string; author: string; text: string; rating?: number; created_at?: string }[];
  loading?: boolean;
  onOpen?: () => void;
}

export default function DetailsSheet({
  source,
  name,
  website,
  url,
  address,
  rating,
  userCount,
  reviews = [],
  loading,
  onOpen,
}: DetailsSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" onClick={onOpen}>
          View details & reviews
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{name || "Details"}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="p-4 text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {website && (
              <a href={website} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-1">
                Website <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {url && (
              <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-1">
                Google Listing <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {address && <div className="text-sm text-muted-foreground">{address}</div>}
            {typeof rating === "number" && (
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4" />
                <strong>{rating.toFixed(1)}</strong>
                {userCount && <span className="text-sm text-muted-foreground">({userCount})</span>}
              </div>
            )}

            <div className="space-y-2">
              <h3 className="font-medium">
                {source === "fsq" ? "Tips (Foursquare users)" : "Recent Google reviews"}
              </h3>
              {reviews.length === 0 ? (
                <div className="text-sm text-muted-foreground">No reviews available.</div>
              ) : (
                <ul className="space-y-2">
                  {reviews.map((r) => (
                    <li key={r.id} className="border rounded p-2">
                      <div className="flex items-center gap-2 text-sm">
                        <strong>{r.author}</strong>
                        {typeof r.rating === "number" && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="w-3 h-3" /> {r.rating.toFixed(1)}
                          </span>
                        )}
                        {r.created_at && (
                          <span className="text-muted-foreground">• {r.created_at}</span>
                        )}
                      </div>
                      <p className="text-sm mt-1">{r.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
