// client/src/pages/bitemap/components/RestaurantCard.tsx
import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Star } from "lucide-react";

export interface RestaurantCardProps {
  name: string;
  address?: string;
  rating?: number | null;
  price?: number | null;
  categories?: string[];
  source?: "fsq" | "google";
  onSelect?: () => void;
}

export default function RestaurantCard({
  name,
  address,
  rating,
  price,
  categories = [],
  source,
  onSelect,
}: RestaurantCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{name}</span>
          <div className="flex items-center gap-2">
            {typeof rating === "number" && (
              <span className="inline-flex items-center gap-1 text-sm">
                <Star className="w-4 h-4" /> {rating.toFixed(1)}
              </span>
            )}
            {price && <Badge variant="secondary">{"$".repeat(price)}</Badge>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {source && (
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {source}
          </div>
        )}
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          <MapPin className="w-4 h-4" />
          <span>{address}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.slice(0, 3).map((c) => (
            <Badge key={c}>{c}</Badge>
          ))}
        </div>
        {onSelect && (
          <Button variant="outline" onClick={onSelect}>
            View details & reviews
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
