import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CollectionItem = {
  id: string;
  drinkSlug: string;
  drinkName: string;
  image?: string | null;
  route: string;
  remixedFromSlug?: string | null;
  addedAt: string;
  drink?: {
    slug: string;
    name: string;
    route: string;
    image?: string | null;
  } | null;
};

type CollectionCheckoutSnapshot = {
  checkoutSessionId: string;
  status: CheckoutStatus;
  failureReason?: string | null;
  updatedAt: string;
  verifiedAt?: string | null;
  expiresAt?: string | null;
};

type Collection = {
  id: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  isPremium: boolean;
  priceCents: number;
  isLocked?: boolean;
  requiresUnlock?: boolean;
  ownedByViewer?: boolean;
  previewLimit?: number;
  checkout?: CollectionCheckoutSnapshot | null;
  userId: string;
  creatorUsername?: string | null;
  creatorAvatar?: string | null;
  itemsCount: number;
  items: CollectionItem[];
};

type CheckoutStatus = "pending" | "completed" | "failed" | "canceled";

type CheckoutStatusResponse = {
  ok: boolean;
  status: CheckoutStatus;
  owned: boolean;
  failureReason?: string | null;
  collectionId: string;
  checkoutSessionId: string;
};

function initials(value: string | null | undefined): string {
  if (!value) return "DR";
  return value.slice(0, 2).toUpperCase();
}

function messageForCheckoutState(status: CheckoutStatus, failureReason?: string | null) {
  if (status === "completed") return "Payment verified. Your premium collection is now unlocked.";
  if (status === "failed") return failureReason || "Square reported that the payment failed.";
  if (status === "canceled") return failureReason || "Checkout was canceled before payment completed.";
  return "Payment submitted. We’re waiting for Square to confirm it. This page will unlock automatically once verification finishes.";
}

export default function DrinkCollectionDetailPage() {
  const [matched, params] = useRoute<{ id: string }>("/drinks/collections/:id");
  const [location] = useLocation();
  const collectionId = matched ? String(params.id ?? "") : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [isPollingCheckout, setIsPollingCheckout] = useState(false);
  const checkoutWindowRef = useRef<Window | null>(null);
  const pollStartedAtRef = useRef<number | null>(null);
  const popupClosedNoticeShownRef = useRef(false);

  const queryParams = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, [location]);

  async function loadCollection(currentCollectionId: string, preserveCheckoutMessage = false) {
    if (!currentCollectionId) return;

    setLoading(true);
    setError("");
    setStatusCode(null);

    try {
      const res = await fetch(`/api/drinks/collections/${encodeURIComponent(currentCollectionId)}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setStatusCode(res.status);
        throw new Error(payload?.error || `Failed to load collection (${res.status})`);
      }

      const payload = await res.json();
      const nextCollection = (payload?.collection ?? null) as Collection | null;
      setCollection(nextCollection);
      if (!preserveCheckoutMessage) {
        const latestCheckout = nextCollection?.checkout ?? null;
        if (nextCollection?.ownedByViewer) {
          setCheckoutSessionId(null);
          if (latestCheckout?.status === "completed") {
            setCheckoutStatus("completed");
            setCheckoutMessage("This premium collection is unlocked and ready to use.");
          } else {
            setCheckoutStatus(null);
            setCheckoutMessage("");
          }
        } else if (latestCheckout?.status) {
          setCheckoutStatus(latestCheckout.status);
          setCheckoutMessage(messageForCheckoutState(latestCheckout.status, latestCheckout.failureReason));
          if (latestCheckout.status === "pending") {
            setCheckoutSessionId(latestCheckout.checkoutSessionId);
          } else {
            setCheckoutSessionId(null);
          }
        } else {
          setCheckoutStatus(null);
          setCheckoutMessage("");
          setCheckoutSessionId(null);
        }
      }
    } catch (err) {
      setCollection(null);
      setError(err instanceof Error ? err.message : "Failed to load collection");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCollection(collectionId);
  }, [collectionId]);

  useEffect(() => {
    const returnedSessionId = queryParams.get("checkoutSessionId")?.trim();
    if (!returnedSessionId) return;

    setCheckoutSessionId(returnedSessionId);
    setCheckoutStatus("pending");
    setCheckoutMessage("Finishing your Square checkout…");
    setError("");
    setStatusCode(null);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkoutSessionId");
      url.searchParams.delete("squareCheckout");
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    }
  }, [queryParams]);

  useEffect(() => {
    if (!checkoutSessionId) {
      setIsPollingCheckout(false);
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;
    pollStartedAtRef.current = Date.now();
    popupClosedNoticeShownRef.current = false;
    setIsPollingCheckout(true);

    async function pollCheckoutStatus() {
      try {
        const res = await fetch(`/api/drinks/collections/checkout-sessions/${encodeURIComponent(checkoutSessionId)}/status`, {
          credentials: "include",
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          setStatusCode(res.status);
          throw new Error(payload?.error || `Failed to verify checkout (${res.status})`);
        }

        const payload = (await res.json()) as CheckoutStatusResponse;
        if (cancelled) return;

        setCheckoutStatus(payload.status);

        if (payload.status === "completed" && payload.owned) {
          setCheckoutMessage(messageForCheckoutState("completed"));
          setCheckoutSessionId(null);
          setIsPollingCheckout(false);
          checkoutWindowRef.current?.close();
          checkoutWindowRef.current = null;
          await loadCollection(collectionId, true);
          return;
        }

        if (payload.status === "failed") {
          setCheckoutMessage(messageForCheckoutState("failed", payload.failureReason));
          setCheckoutSessionId(null);
          setIsPollingCheckout(false);
          return;
        }

        if (payload.status === "canceled") {
          setCheckoutMessage(messageForCheckoutState("canceled", payload.failureReason));
          setCheckoutSessionId(null);
          setIsPollingCheckout(false);
          return;
        }

        const popupClosed = Boolean(checkoutWindowRef.current && checkoutWindowRef.current.closed);
        const pollAgeMs = pollStartedAtRef.current ? Date.now() - pollStartedAtRef.current : 0;
        if (popupClosed && !popupClosedNoticeShownRef.current && pollAgeMs > 1500) {
          popupClosedNoticeShownRef.current = true;
          setCheckoutMessage("Square checkout was closed before payment was verified. If you completed payment, keep this page open while we confirm it.");
        }

        if (pollAgeMs > 60_000) {
          setCheckoutMessage("Square checkout is still pending. We’ll keep this collection locked until Square confirms a completed payment.");
          setCheckoutSessionId(null);
          setIsPollingCheckout(false);
        }
      } catch (err) {
        if (cancelled) return;
        setCheckoutMessage(err instanceof Error ? err.message : "Failed to verify checkout");
        setCheckoutSessionId(null);
        setIsPollingCheckout(false);
      }
    }

    void pollCheckoutStatus();
    intervalId = window.setInterval(() => {
      void pollCheckoutStatus();
    }, 2500);

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [checkoutSessionId, collectionId]);

  async function unlockCollection() {
    if (!collection) return;

    setIsUnlocking(true);
    setError("");
    setStatusCode(null);
    setCheckoutStatus("pending");
    setCheckoutMessage("Creating your Square checkout…");

    try {
      const checkoutRes = await fetch(`/api/drinks/collections/${encodeURIComponent(collection.id)}/create-checkout`, {
        method: "POST",
        credentials: "include",
      });

      const payload = await checkoutRes.json().catch(() => null);
      if (!checkoutRes.ok) {
        setStatusCode(checkoutRes.status);
        throw new Error(payload?.error || `Failed to start checkout (${checkoutRes.status})`);
      }

      if (payload?.owned) {
        setCheckoutStatus("completed");
        setCheckoutMessage("You already own this premium collection.");
        await loadCollection(collection.id, true);
        return;
      }

      if (!payload?.checkoutSessionId || !payload?.checkoutUrl) {
        throw new Error("Square checkout link was not returned by the server.");
      }

      setCheckoutSessionId(String(payload.checkoutSessionId));
      setCheckoutMessage("Square checkout opened in a new tab. Complete payment there and we’ll unlock the collection here.");

      const popup = window.open(String(payload.checkoutUrl), "chefsire-square-checkout", "popup,width=520,height=760");
      checkoutWindowRef.current = popup;

      if (!popup) {
        setCheckoutMessage("Redirecting to Square checkout…");
        window.location.assign(String(payload.checkoutUrl));
      }
    } catch (err) {
      setCheckoutStatus("failed");
      setCheckoutMessage("");
      setError(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setIsUnlocking(false);
    }
  }

  const isLockedPremium = Boolean(collection?.isPremium && collection?.requiresUnlock);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <DrinksPlatformNav current="collections" />

      {loading ? <p className="text-muted-foreground">Loading collection…</p> : null}
      {!loading && error ? (
        <p className="text-destructive">
          {statusCode === 404 ? "Collection not found." : statusCode === 401 ? "Please sign in to unlock this collection." : statusCode === 403 ? "This collection is private." : error}
        </p>
      ) : null}
      {!loading && error && import.meta.env.DEV ? <p className="text-xs text-muted-foreground break-all">{error}</p> : null}

      {!loading && !error && collection ? (
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-2xl flex flex-wrap items-center gap-2">
              {collection.name}
              <Badge variant="outline">{collection.isPublic ? "Public" : "Private"}</Badge>
              <Badge variant="secondary">{collection.itemsCount} drinks</Badge>
              {collection.isPremium ? <Badge>Premium Collection · ${(collection.priceCents / 100).toFixed(2)}</Badge> : null}
              {collection.ownedByViewer ? <Badge variant="secondary">Owned</Badge> : null}
              {!collection.ownedByViewer && isLockedPremium ? <Badge variant="outline">Locked</Badge> : null}
            </CardTitle>
            {collection.description ? <p className="text-sm text-muted-foreground">{collection.description}</p> : null}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar className="h-6 w-6">
                <AvatarImage src={collection.creatorAvatar ?? undefined} alt={collection.creatorUsername ?? "creator"} />
                <AvatarFallback>{initials(collection.creatorUsername)}</AvatarFallback>
              </Avatar>
              <span>Created by {collection.creatorUsername ? `@${collection.creatorUsername}` : "a creator"}</span>
              {collection.isPublic ? (
                <Link href={`/drinks/creator/${encodeURIComponent(collection.userId)}`} className="underline underline-offset-2">
                  View creator
                </Link>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isLockedPremium && checkoutMessage && checkoutStatus === "completed" ? (
              <p className="text-sm text-emerald-600">{checkoutMessage}</p>
            ) : null}
            {isLockedPremium ? (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">This premium collection is locked. Preview available below.</p>
                  {collection.checkout?.status === "pending" && !checkoutSessionId ? (
                    <p className="text-xs text-muted-foreground">A previous Square checkout is still pending verification. Use the status button below if you just completed payment.</p>
                  ) : null}
                  {checkoutMessage ? (
                    <p className={`text-sm ${checkoutStatus === "completed" ? "text-emerald-600" : checkoutStatus === "failed" || checkoutStatus === "canceled" ? "text-destructive" : "text-muted-foreground"}`}>
                      {checkoutMessage}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={unlockCollection} disabled={isUnlocking || isPollingCheckout}>
                      {isUnlocking ? "Opening Square Checkout…" : isPollingCheckout ? "Waiting for Square payment…" : `Unlock Collection · $${(collection.priceCents / 100).toFixed(2)}`}
                    </Button>
                    {checkoutSessionId ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setCheckoutStatus("pending");
                          setCheckoutMessage("Checking your Square payment status…");
                        }}
                      >
                        Check Payment Status
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {collection.items.length === 0 ? <p className="text-sm text-muted-foreground">This public collection is empty right now. Check back soon for added drinks.</p> : null}
            {collection.items.map((item) => (
              <div key={item.id || `${collection.id}-${item.drinkSlug}`} className="border rounded-md p-3 space-y-1">
                <Link href={item.route ?? item.drink?.route ?? `/drinks/recipe/${encodeURIComponent(item.drinkSlug)}`} className="font-medium underline underline-offset-2">
                  {item.drinkName ?? item.drink?.name ?? item.drinkSlug}
                </Link>
                {item.remixedFromSlug ? (
                  <p className="text-xs text-muted-foreground">
                    Remix lineage: <Link href={`/drinks/recipe/${encodeURIComponent(item.remixedFromSlug)}`} className="underline underline-offset-2">{item.remixedFromSlug}</Link>
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">Added {new Date(item.addedAt).toLocaleDateString()}</p>
              </div>
            ))}
            {isLockedPremium ? (
              <p className="text-xs text-muted-foreground">
                Showing preview ({collection.items.length} of {collection.itemsCount} drinks). Unlock to access the full collection.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
