import React, { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Megaphone, Users, MousePointerClick, TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Drop {
  id: string;
  productId: string | null;
  message: string | null;
  recipientCount: number;
  clickCount: number;
  createdAt: string;
  productName: string | null;
  productImages: string[] | null;
  productPrice: string | null;
}

interface StoreDropsTabProps {
  storeId: string;
}

export default function StoreDropsTab({ storeId }: StoreDropsTabProps) {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const fetchDrops = async (before?: string) => {
    const url = `/api/stores/${storeId}/drops${before ? `?before=${encodeURIComponent(before)}` : ""}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch drops");
    const data = await res.json();
    return (data.drops ?? []) as Drop[];
  };

  useEffect(() => {
    setLoading(true);
    fetchDrops()
      .then((rows) => {
        setDrops(rows);
        setHasMore(rows.length === 50);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId]);

  const loadMore = async () => {
    if (drops.length === 0) return;
    setLoadingMore(true);
    try {
      const cursor = drops[drops.length - 1].createdAt;
      const more = await fetchDrops(cursor);
      setDrops((prev) => [...prev, ...more]);
      setHasMore(more.length === 50);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  // Cumulative stats
  const totalReached = drops.reduce((sum, d) => sum + d.recipientCount, 0);
  const totalClicks = drops.reduce((sum, d) => sum + d.clickCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ROI header */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Megaphone className="w-4 h-4" />
              <span className="text-sm">Total Drops</span>
            </div>
            <p className="text-2xl font-bold">{drops.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="w-4 h-4" />
              <span className="text-sm">Followers Reached</span>
            </div>
            <p className="text-2xl font-bold">{totalReached.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MousePointerClick className="w-4 h-4" />
              <span className="text-sm">Total Click-Throughs</span>
            </div>
            <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Drop list */}
      {drops.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No drops yet</p>
          <p className="text-sm mt-1">
            Open a product and click "Notify my followers" to send your first drop.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {drops.map((drop) => {
            const ctr =
              drop.recipientCount > 0
                ? ((drop.clickCount / drop.recipientCount) * 100).toFixed(1)
                : null;
            const image = drop.productImages?.[0];
            return (
              <Card key={drop.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    {image ? (
                      <img
                        src={image}
                        alt={drop.productName ?? ""}
                        className="w-14 h-14 rounded-md object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">📦</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {drop.productName ?? (
                          <span className="text-muted-foreground italic">Product unavailable</span>
                        )}
                      </p>
                      {drop.message && (
                        <p className="text-sm text-muted-foreground italic mt-0.5 line-clamp-2">
                          "{drop.message}"
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(drop.createdAt), { addSuffix: true })}
                      </p>
                    </div>

                    <div className="flex gap-4 text-right flex-shrink-0">
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground justify-end">
                          <Users className="w-3.5 h-3.5" />
                          <span className="text-xs">Sent</span>
                        </div>
                        <p className="font-semibold text-sm">{drop.recipientCount.toLocaleString()}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground justify-end">
                          <MousePointerClick className="w-3.5 h-3.5" />
                          <span className="text-xs">Clicks</span>
                        </div>
                        <p className="font-semibold text-sm">{drop.clickCount.toLocaleString()}</p>
                      </div>
                      {ctr !== null && (
                        <div>
                          <div className="flex items-center gap-1 text-muted-foreground justify-end">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span className="text-xs">CTR</span>
                          </div>
                          <p className="font-semibold text-sm text-orange-600">{ctr}%</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {hasMore && (
            <div className="text-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
