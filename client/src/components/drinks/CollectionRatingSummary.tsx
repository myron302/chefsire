import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface CollectionRatingSummaryProps {
  averageRating?: number | null;
  reviewCount?: number | null;
  className?: string;
  showEmpty?: boolean;
}

export default function CollectionRatingSummary({
  averageRating,
  reviewCount,
  className,
  showEmpty = true,
}: CollectionRatingSummaryProps) {
  const count = Math.max(0, Number(reviewCount ?? 0));
  const rating = count > 0 ? Number(averageRating ?? 0) : 0;

  if (!showEmpty && count === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-sm text-muted-foreground", className)}>
      <div className="flex items-center gap-1 font-medium text-foreground">
        <Star className={cn("h-4 w-4", count > 0 ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground")} />
        <span>{count > 0 ? rating.toFixed(1) : "No ratings yet"}</span>
      </div>
      <span>{count > 0 ? `(${count} review${count === 1 ? "" : "s"})` : "Be the first verified buyer to review."}</span>
    </div>
  );
}
