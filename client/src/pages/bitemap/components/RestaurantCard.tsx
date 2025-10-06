import * as React from "react";
import { Star, Landmark, Globe2 } from "lucide-react";
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
  // FSQ price: 1–4; Google price_level: 0–4 (0 can mean free)
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
}) {
  const { name, address, rating, price, categories = [], source, onSelect } = props;

  // Normalize categories to strings (avoid React error #31)
  const catStrings = categories
    .map(catLabel)
    .filter(Boolean)
    .slice(0, 3); // show up to 3

  return (
    <Card className="h-full">
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
          <Button onClick={onSelect} variant="secondary" size="sm" className="w-full">
            View details & reviews
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
