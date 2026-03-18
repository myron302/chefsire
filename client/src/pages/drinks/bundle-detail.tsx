import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { useUser } from "@/contexts/UserContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


type BundleCollection = {
  id: string;
  name: string;
  description?: string | null;
  route: string;
  priceCents: number;
  isPremium: boolean;
  ownedByViewer?: boolean;
  coverImage?: string | null;
  addedAt?: string;
};

type CheckoutStatus = "pending" | "completed" | "failed" | "canceled" | "refunded_pending" | "refunded" | "revoked";

type Bundle = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  isPremium: boolean;
  priceCents: number;
  creatorUsername?: string | null;
  creatorAvatar?: string | null;
  ownedByViewer?: boolean;
  itemsCount: number;
  unlockedCollectionCount?: number;
  includedCollections: BundleCollection[];
  checkout?: {
    checkoutSessionId: string;
    status: CheckoutStatus;
    failureReason?: string | null;
    updatedAt: string;
    verifiedAt?: string | null;
    expiresAt?: string | null;
  } | null;
};

function initials(value?: string | null): string {
  if (!value) return "BD";
  return value.slice(0, 2).toUpperCase();
}

function formatCurrency(cents: number | null | undefined, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(cents ?? 0) / 100);
}

function messageForCheckoutState(status: CheckoutStatus, failureReason?: string | null) {
  if (status === "completed") return "Payment verified. Your bundle is unlocked.";
  if (status === "failed") return failureReason || "Square reported that the bundle payment failed.";
  if (status === "canceled") return failureReason || "Bundle checkout was canceled before payment completed.";
  if (status === "refunded_pending") return failureReason || "A refund is pending for this bundle purchase.";
  if (status === "refunded") return failureReason || "This bundle purchase was refunded, so access has been removed.";
  if (status === "revoked") return failureReason || "Access to this bundle has been revoked.";
  return "Payment submitted. We’re waiting for Square to confirm it.";
}

export default function DrinkBundleDetailPage() {
  const { user } = useUser();
  const [matched, params] = useRoute<{ id: string }>("/drinks/bundles/:id");
  const [location] = useLocation();
  const bundleId = matched ? String(params.id ?? "") : "";
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollStartedAtRef = useRef<number | null>(null);
  const popupClosedNoticeShownRef = useRef(false);
  const checkoutWindowRef = useRef<Window | null>(null);

  const queryParams = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, [location]);

  async function loadBundle(currentBundleId: string, preserveCheckoutMessage = false) {
    if (!currentBundleId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/drinks/bundles/${encodeURIComponent(currentBundleId)}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Failed to load bundle (${response.status})`);
      const nextBundle = (payload?.bundle ?? null) as Bundle | null;
      setBundle(nextBundle);
      if (!preserveCheckoutMessage) {
        if (nextBundle?.ownedByViewer) {
          setCheckoutStatus("completed");
          setCheckoutSessionId(null);
          setCheckoutMessage("This bundle is unlocked and the included collections are ready to open.");
        } else if (nextBundle?.checkout?.status) {
          setCheckoutStatus(nextBundle.checkout.status);
          setCheckoutSessionId(nextBundle.checkout.status === "pending" ? nextBundle.checkout.checkoutSessionId : null);
          setCheckoutMessage(messageForCheckoutState(nextBundle.checkout.status, nextBundle.checkout.failureReason));
        } else {
          setCheckoutStatus(null);
          setCheckoutSessionId(null);
          setCheckoutMessage("");
        }
      }
    } catch (err) {
      setBundle(null);
      setError(err instanceof Error ? err.message : "Failed to load bundle");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!bundleId) return;
    void loadBundle(bundleId);
  }, [bundleId]);

  useEffect(() => {
    const queryCheckoutSessionId = queryParams.get("checkoutSessionId");
    if (!queryCheckoutSessionId) return;
    setCheckoutSessionId(queryCheckoutSessionId);
    setCheckoutStatus("pending");
    setCheckoutMessage("Checking your Square bundle payment status…");
  }, [queryParams]);

  useEffect(() => {
    if (!checkoutSessionId || !user) return;

    let cancelled = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      if (cancelled) return;
      setIsPolling(true);
      if (!pollStartedAtRef.current) pollStartedAtRef.current = Date.now();

      try {
        const response = await fetch(`/api/drinks/bundles/checkout-sessions/${encodeURIComponent(checkoutSessionId)}/status`, {
          credentials: "include",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || `Failed to verify checkout (${response.status})`);

        const nextStatus = payload?.status as CheckoutStatus;
        setCheckoutStatus(nextStatus);
        setCheckoutMessage(messageForCheckoutState(nextStatus, payload?.failureReason || null));

        if (payload?.owned || nextStatus === "completed") {
          setCheckoutSessionId(null);
          await loadBundle(bundleId, true);
          return;
        }

        if (nextStatus !== "pending") {
          setCheckoutSessionId(null);
          await loadBundle(bundleId, true);
          return;
        }
      } catch (err) {
        setCheckoutMessage(err instanceof Error ? err.message : "Failed to verify bundle checkout.");
      } finally {
        setIsPolling(false);
      }

      if (cancelled) return;
      const popupClosed = checkoutWindowRef.current && checkoutWindowRef.current.closed;
      if (popupClosed && !popupClosedNoticeShownRef.current) {
        popupClosedNoticeShownRef.current = true;
        setCheckoutMessage("Square checkout popup closed. We’ll keep checking for a moment in case payment already finished.");
      }

      if ((Date.now() - (pollStartedAtRef.current ?? 0)) < 120000) {
        timeoutId = window.setTimeout(poll, 2500);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [bundleId, checkoutSessionId, user]);

  const startCheckout = async () => {
    if (!bundle) return;
    setIsUnlocking(true);
    try {
      const response = await fetch(`/api/drinks/bundles/${encodeURIComponent(bundle.id)}/create-checkout`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Failed to start checkout (${response.status})`);
      if (payload?.alreadyOwned) {
        setCheckoutStatus("completed");
        setCheckoutMessage("You already own this bundle.");
        await loadBundle(bundle.id, true);
        return;
      }
      const nextCheckoutSessionId = String(payload?.checkoutSessionId || "");
      const checkoutUrl = String(payload?.checkoutUrl || "");
      if (!nextCheckoutSessionId || !checkoutUrl) throw new Error("Square did not return a usable checkout link.");
      setCheckoutSessionId(nextCheckoutSessionId);
      setCheckoutStatus("pending");
      setCheckoutMessage("Square checkout opened in a new tab. Complete payment there and this page will unlock automatically.");
      popupClosedNoticeShownRef.current = false;
      pollStartedAtRef.current = Date.now();
      checkoutWindowRef.current = window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      if (!checkoutWindowRef.current) window.location.assign(checkoutUrl);
    } catch (err) {
      setCheckoutMessage(err instanceof Error ? err.message : "Failed to start bundle checkout.");
    } finally {
      setIsUnlocking(false);
    }
  };

  if (!matched) return null;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <DrinksPlatformNav current="collections" />

      {loading ? <p className="text-sm text-muted-foreground">Loading bundle…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {bundle ? (
        <>
          <section className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge>Premium Bundle</Badge>
                  <Badge variant="secondary">{formatCurrency(bundle.priceCents)}</Badge>
                  <Badge variant="outline">{bundle.itemsCount} collections</Badge>
                  {bundle.ownedByViewer ? <Badge variant="secondary">Owned</Badge> : null}
                </div>
                <h1 className="text-3xl font-bold">{bundle.name}</h1>
                <p className="max-w-3xl text-sm text-muted-foreground">{bundle.description || "A premium creator bundle that unlocks multiple premium drink collections together."}</p>
              </div>
              <Card className="w-full max-w-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Unlock Bundle</CardTitle>
                  <CardDescription>One Square checkout unlocks every included premium collection in this bundle.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={bundle.creatorAvatar ?? undefined} alt={bundle.creatorUsername ?? "creator"} />
                      <AvatarFallback>{initials(bundle.creatorUsername)}</AvatarFallback>
                    </Avatar>
                    <span>by {bundle.creatorUsername ? `@${bundle.creatorUsername}` : "a creator"}</span>
                  </div>
                  <div className="text-3xl font-semibold">{formatCurrency(bundle.priceCents)}</div>
                  <Button className="w-full" disabled={!user || isUnlocking || Boolean(bundle.ownedByViewer)} onClick={() => void startCheckout()}>
                    {bundle.ownedByViewer ? "Bundle unlocked" : isUnlocking ? "Opening Square…" : "Unlock Bundle"}
                  </Button>
                  {!user ? (
                    <Link href="/login">
                      <Button variant="outline" className="w-full">Sign in to buy</Button>
                    </Link>
                  ) : null}
                  {checkoutMessage ? <p className="text-sm text-muted-foreground">{checkoutMessage}</p> : null}
                  {isPolling ? <p className="text-xs text-muted-foreground">Verifying Square payment…</p> : null}
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bundle.includedCollections.map((collection) => {
              const unlocked = bundle.ownedByViewer || collection.ownedByViewer;
              return (
                <Card key={collection.id} className="overflow-hidden">
                  {collection.coverImage ? (
                    <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                      <img src={collection.coverImage} alt={collection.name} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ) : null}
                  <CardHeader>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Included</Badge>
                      {unlocked ? <Badge variant="secondary">Unlocked</Badge> : <Badge variant="outline">Locked</Badge>}
                    </div>
                    <CardTitle className="text-lg">{collection.name}</CardTitle>
                    <CardDescription>{collection.description || "Premium collection included in this bundle."}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">Standalone price: {formatCurrency(collection.priceCents)}</p>
                    <Link href={collection.route}>
                      <Button className="w-full" variant={unlocked ? "default" : "outline"}>
                        {unlocked ? "Open collection" : "Preview collection"}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        </>
      ) : null}
    </div>
  );
}
