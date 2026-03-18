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
type PurchaseType = "self" | "gift";

type GiftSummary = {
  id: string;
  giftCode: string;
  status: "pending" | "completed" | "revoked";
  targetType: "collection" | "bundle";
  targetId: string;
  checkoutSessionId: string;
  claimUrl: string;
  recipientUserId: string | null;
  claimedAt: string | null;
  completedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

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
    purchaseType?: PurchaseType;
    failureReason?: string | null;
    updatedAt: string;
    verifiedAt?: string | null;
    expiresAt?: string | null;
    gift?: GiftSummary | null;
  } | null;
};

function initials(value?: string | null): string {
  if (!value) return "BD";
  return value.slice(0, 2).toUpperCase();
}

function formatCurrency(cents: number | null | undefined, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(cents ?? 0) / 100);
}

function messageForCheckoutState(status: CheckoutStatus, failureReason?: string | null, purchaseType: PurchaseType = "self", gift?: GiftSummary | null) {
  if (status === "completed") {
    return purchaseType === "gift"
      ? gift?.claimUrl
        ? "Payment verified. Your bundle gift is ready to share."
        : "Payment verified. Your bundle gift purchase is complete."
      : "Payment verified. Your bundle is unlocked.";
  }
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
  const [checkoutPurchaseType, setCheckoutPurchaseType] = useState<PurchaseType>("self");
  const [giftSummary, setGiftSummary] = useState<GiftSummary | null>(null);
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
        setCheckoutPurchaseType(nextBundle?.checkout?.purchaseType ?? "self");
        setGiftSummary(nextBundle?.checkout?.gift ?? null);
        if (nextBundle?.ownedByViewer) {
          setCheckoutStatus("completed");
          setCheckoutSessionId(null);
          setCheckoutMessage("This bundle is unlocked and the included collections are ready to open.");
        } else if (nextBundle?.checkout?.status) {
          setCheckoutStatus(nextBundle.checkout.status);
          setCheckoutSessionId(nextBundle.checkout.status === "pending" ? nextBundle.checkout.checkoutSessionId : null);
          setCheckoutMessage(messageForCheckoutState(
            nextBundle.checkout.status,
            nextBundle.checkout.failureReason,
            nextBundle.checkout.purchaseType ?? "self",
            nextBundle.checkout.gift ?? null,
          ));
        } else {
          setCheckoutStatus(null);
          setCheckoutSessionId(null);
          setCheckoutPurchaseType("self");
          setGiftSummary(null);
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
        setCheckoutPurchaseType((payload?.purchaseType as PurchaseType | undefined) ?? "self");
        setGiftSummary((payload?.gift as GiftSummary | null | undefined) ?? null);
        setCheckoutStatus(nextStatus);
        setCheckoutMessage(messageForCheckoutState(
          nextStatus,
          payload?.failureReason || null,
          (payload?.purchaseType as PurchaseType | undefined) ?? "self",
          (payload?.gift as GiftSummary | null | undefined) ?? null,
        ));

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

  const startCheckout = async (purchaseType: PurchaseType) => {
    if (!bundle) return;
    setIsUnlocking(true);
    setCheckoutPurchaseType(purchaseType);
    setGiftSummary(null);
    try {
      const response = await fetch(`/api/drinks/bundles/${encodeURIComponent(bundle.id)}/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ purchaseType }),
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
      setCheckoutMessage(
        purchaseType === "gift"
          ? "Square checkout opened in a new tab. Complete payment there and we’ll generate a bundle gift link here."
          : "Square checkout opened in a new tab. Complete payment there and this page will unlock automatically.",
      );
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
                  <CardTitle className="text-xl">Unlock or Gift Bundle</CardTitle>
                  <CardDescription>One Square checkout can unlock this bundle for you or create a shareable gift claim link.</CardDescription>
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
                  <div className="grid gap-2">
                    <Button className="w-full" disabled={!user || isUnlocking || Boolean(bundle.ownedByViewer)} onClick={() => void startCheckout("self")}>
                      {bundle.ownedByViewer
                        ? "Bundle unlocked"
                        : isUnlocking && checkoutPurchaseType === "self"
                          ? "Opening Square…"
                          : "Unlock Bundle"}
                    </Button>
                    <Button className="w-full" variant="outline" disabled={!user || isUnlocking} onClick={() => void startCheckout("gift")}>
                      {isUnlocking && checkoutPurchaseType === "gift" ? "Opening gift checkout…" : "Gift this"}
                    </Button>
                  </div>
                  {!user ? (
                    <Link href="/login">
                      <Button variant="outline" className="w-full">Sign in to buy</Button>
                    </Link>
                  ) : null}
                  {giftSummary?.claimUrl ? (
                    <div className="rounded-md border bg-muted/40 p-3 text-sm">
                      <p className="font-medium">Gift link ready</p>
                      <p className="text-xs text-muted-foreground">Share this claim link after payment. The recipient gets access only after claiming it while signed in.</p>
                      <div className="mt-2 flex flex-col gap-2">
                        <input readOnly value={giftSummary.claimUrl} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            await navigator.clipboard.writeText(giftSummary.claimUrl);
                            setCheckoutMessage("Gift claim link copied to your clipboard.");
                          }}
                        >
                          Copy gift link
                        </Button>
                      </div>
                    </div>
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
