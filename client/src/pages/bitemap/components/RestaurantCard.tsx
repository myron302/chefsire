import * as React from "react";
import { Star, Landmark, Globe2, ImageOff } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PlaceSource = "fsq" | "google";

type CategoryLike =
  | string
  | { id?: string; title?: string; name?: string }
  | null
  | undefined;

function catLabel(c: CategoryLike): string {
  if (typeof c === "string") return c;
  if (!c) return "";
  return (c.title || c.name || "").toString();
}

function PriceBadge({ price, source }: { price?: number | null; source: PlaceSource }) {
  if (price == null) return null;
  const count = source === "google" ? Math.max(1, price) : price;
  const safe = Math.max(1, Math.min(4, Number(count) || 1));
  return <Badge variant="secondary">{"$".repeat(safe)}</Badge>;
}

export default function RestaurantCard(props: {
  name: string;
  address?: string | null;
  rating?: number;
  price?: number | null;
  categories?: CategoryLike[];
  source: PlaceSource;
  onSelect?: () => void;
  raw?: any;
}) {
  const { name, address, rating, price, categories = [], source, onSelect, raw } = props;

  const catStrings = categories.map(catLabel).filter(Boolean).slice(0, 3);

  // Extract photo reference - check both locations
  const photoRef = raw?.__photoRef || raw?.photos?.[0]?.photo_reference || null;

  // If Google result includes a photo reference, use our server proxy to load the image
  const initialSrc =
    source === "google" && photoRef
      ? `/api/google/photo?ref=${encodeURIComponent(photoRef)}&maxWidth=600`
      : null;

  const [imgSrc, setImgSrc] = React.useState<string | null>(initialSrc);
  const [imgOk, setImgOk] = React.useState<boolean>(Boolean(initialSrc));

  React.useEffect(() => {
    setImgSrc(initialSrc);
    setImgOk(Boolean(initialSrc));
  }, [initialSrc]);

  // Make the entire card clickable (and keyboard accessible)
  const handleOpen = (e?: React.SyntheticEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onSelect?.();
  };

  return (
    <Card
      className="h-full overflow-hidden cursor-pointer transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleOpen(e);
        }
      }}
    >
      {/* Image header (also clickable) */}
      <div className="w-full h-40 bg-muted relative" onClick={handleOpen}>
        {imgSrc && imgOk ? (
          <img
            src={imgSrc}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgOk(false)} // fallback to placeholder on error
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageOff className="w-6 h-6" />
          </div>
        )}
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold leading-tight line-clamp-2">
          {name}
        </CardTitle>
        <div className="mt-1 text-xs text-muted-foreground line-clamp-1">
          {address || "—"}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          {typeof rating === "number" && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 stroke-yellow-400" />
              <span>{rating.toFixed(1)}</span>
            </div>
          )}

          <PriceBadge price={price ?? null} source={source} />

          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            {source === "fsq" ? (
              <>
                <Landmark className="w-3.5 h-3.5" />
                <span>Foursquare</span>
              </>
            ) : (
              <>
                <Globe2 className="w-3.5 h-3.5" />
                <span>Google</span>
              </>
            )}
          </div>
        </div>

        {catStrings.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {catStrings.map((c, i) => (
              <Badge key={`${c}-${i}`} variant="outline" className="text-[11px]">
                {c}
              </Badge>
            ))}
          </div>
        )}

        <div className="pt-1">
          <Button onClick={handleOpen} variant="secondary" size="sm" className="w-full">
            View details & reviews
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
