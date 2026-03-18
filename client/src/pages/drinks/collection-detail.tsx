import { useEffect, useMemo, useRef, useState } from "react";
import { Star } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import CollectionRatingSummary from "@/components/drinks/CollectionRatingSummary";
import { useUser } from "@/contexts/UserContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  purchaseType?: PurchaseType;
  failureReason?: string | null;
  updatedAt: string;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  originalAmountCents?: number | null;
  discountAmountCents?: number | null;
  promotionCode?: string | null;
  gift?: GiftSummary | null;
};

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

type PromoPricing = {
  promotionId: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  originalAmountCents: number;
  discountAmountCents: number;
  finalAmountCents: number;
  currencyCode: string;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
};

type ApplyPromoResponse = {
  ok: boolean;
  collectionId: string;
  promo: {
    id: string;
    code: string;
    discountType: "percent" | "fixed";
    discountValue: number;
    startsAt: string | null;
    endsAt: string | null;
    maxRedemptions: number | null;
    redemptionCount: number;
  };
  pricing: PromoPricing;
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
  isWishlisted?: boolean;
  wishlistCount?: number;
  activePromoPricing?: PromoPricing | null;
  previewLimit?: number;
  averageRating?: number;
  reviewCount?: number;
  checkout?: CollectionCheckoutSnapshot | null;
  userId: string;
  creatorUsername?: string | null;
  creatorAvatar?: string | null;
  itemsCount: number;
  items: CollectionItem[];
};

type CheckoutStatus = "pending" | "completed" | "failed" | "canceled" | "refunded_pending" | "refunded" | "revoked";

type CheckoutStatusResponse = {
  ok: boolean;
  status: CheckoutStatus;
  owned: boolean;
  purchaseType?: PurchaseType;
  failureReason?: string | null;
  collectionId: string;
  checkoutSessionId: string;
  gift?: GiftSummary | null;
};

type WishlistStatusResponse = {
  ok: boolean;
  collectionId: string;
  isWishlisted: boolean;
  owned: boolean;
  wishlistCount: number;
};

type CollectionReview = {
  id: string;
  userId: string;
  collectionId: string;
  rating: number;
  title: string | null;
  body: string | null;
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
};

type CollectionReviewsResponse = {
  ok: boolean;
  collectionId: string;
  summary: {
    averageRating: number;
    reviewCount: number;
  };
  reviews: CollectionReview[];
  viewerOwnsCollection?: boolean;
  canReview?: boolean;
  viewerReview?: CollectionReview | null;
};

function initials(value: string | null | undefined): string {
  if (!value) return "DR";
  return value.slice(0, 2).toUpperCase();
}

function formatCurrency(cents: number | null | undefined, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
  }).format(Number(cents ?? 0) / 100);
}

function messageForCheckoutState(status: CheckoutStatus, failureReason?: string | null, purchaseType: PurchaseType = "self", gift?: GiftSummary | null) {
  if (status === "completed") {
    return purchaseType === "gift"
      ? gift?.claimUrl
        ? "Payment verified. Your gift is ready to share."
        : "Payment verified. Your gift purchase is complete."
      : "Payment verified. Your premium collection is now unlocked.";
  }
  if (status === "failed") return failureReason || "Square reported that the payment failed.";
  if (status === "canceled") return failureReason || "Checkout was canceled before payment completed.";
  if (status === "refunded_pending") return failureReason || "A refund is pending for this purchase. Access is temporarily unavailable while Square finishes the refund lifecycle.";
  if (status === "refunded") return failureReason || "This premium collection purchase was refunded, so access has been removed.";
  if (status === "revoked") return failureReason || "Access to this premium collection has been revoked.";
  return "Payment submitted. We’re waiting for Square to confirm it. This page will unlock automatically once verification finishes.";
}

function formatPromoDiscount(promo: PromoPricing) {
  if (promo.discountType === "percent") return `${promo.discountValue}% off`;
  return `${formatCurrency(promo.discountAmountCents, promo.currencyCode)} off`;
}

export default function DrinkCollectionDetailPage() {
  const { user } = useUser();
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
  const [checkoutPurchaseType, setCheckoutPurchaseType] = useState<PurchaseType>("self");
  const [giftSummary, setGiftSummary] = useState<GiftSummary | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [isPollingCheckout, setIsPollingCheckout] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoPricing, setPromoPricing] = useState<PromoPricing | null>(null);
  const [promoMessage, setPromoMessage] = useState("");
  const [promoError, setPromoError] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isUpdatingWishlist, setIsUpdatingWishlist] = useState(false);
  const [wishlistMessage, setWishlistMessage] = useState("");
  const [wishlistError, setWishlistError] = useState("");
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState("");
  const [reviews, setReviews] = useState<CollectionReview[]>([]);
  const [currentUserReview, setCurrentUserReview] = useState<CollectionReview | null>(null);
  const [canReviewCollection, setCanReviewCollection] = useState(false);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewMutationError, setReviewMutationError] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isDeletingReview, setIsDeletingReview] = useState(false);
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
      setPromoCode(nextCollection?.activePromoPricing?.code ?? "");
      setPromoPricing(null);
      setPromoMessage("");
      setPromoError("");
      setWishlistMessage("");
      setWishlistError("");
      if (!preserveCheckoutMessage) {
        const latestCheckout = nextCollection?.checkout ?? null;
        setCheckoutPurchaseType(latestCheckout?.purchaseType ?? "self");
        setGiftSummary(latestCheckout?.gift ?? null);
        if (nextCollection?.ownedByViewer) {
          setCheckoutSessionId(null);
          if (latestCheckout?.status === "completed") {
            setCheckoutStatus("completed");
            setCheckoutMessage(messageForCheckoutState("completed", null, "self", null));
          } else {
            setCheckoutStatus(null);
            setCheckoutMessage("");
          }
        } else if (latestCheckout?.status) {
          setCheckoutStatus(latestCheckout.status);
          setCheckoutMessage(messageForCheckoutState(
            latestCheckout.status,
            latestCheckout.failureReason,
            latestCheckout.purchaseType ?? "self",
            latestCheckout.gift ?? null,
          ));
          if (latestCheckout.status === "pending") {
            setCheckoutSessionId(latestCheckout.checkoutSessionId);
          } else {
            setCheckoutSessionId(null);
          }
        } else {
          setCheckoutStatus(null);
          setCheckoutPurchaseType("self");
          setGiftSummary(null);
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

  function openReviewForm(review?: CollectionReview | null) {
    setReviewMutationError("");
    setReviewMessage("");
    setCurrentUserReview(review ?? currentUserReview ?? null);
    setReviewRating(review?.rating ?? currentUserReview?.rating ?? 5);
    setReviewTitle(review?.title ?? currentUserReview?.title ?? "");
    setReviewBody(review?.body ?? currentUserReview?.body ?? "");
    setReviewFormOpen(true);
  }

  function closeReviewForm() {
    setReviewFormOpen(false);
    setReviewMutationError("");
    setReviewMessage("");
  }

  async function loadReviews(currentCollectionId: string) {
    if (!currentCollectionId) return;

    setReviewsLoading(true);
    setReviewsError("");

    try {
      const response = await fetch(`/api/drinks/collections/${encodeURIComponent(currentCollectionId)}/reviews`, {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as CollectionReviewsResponse | null;
      if (!response.ok) {
        throw new Error(payload && "error" in payload ? String((payload as any).error) : `Failed to load reviews (${response.status})`);
      }

      setReviews(Array.isArray(payload?.reviews) ? payload.reviews : []);
      setCurrentUserReview(payload?.viewerReview ?? null);
      setCanReviewCollection(Boolean(payload?.canReview));
      setCollection((current) => current
        ? {
            ...current,
            averageRating: payload?.summary?.averageRating ?? current.averageRating ?? 0,
            reviewCount: payload?.summary?.reviewCount ?? current.reviewCount ?? 0,
          }
        : current);
    } catch (err) {
      setReviewsError(err instanceof Error ? err.message : "Failed to load reviews");
    } finally {
      setReviewsLoading(false);
    }
  }

  async function refreshCollectionAndReviews(preserveCheckoutMessage = true) {
    if (!collectionId) return;
    await Promise.all([
      loadCollection(collectionId, preserveCheckoutMessage),
      loadReviews(collectionId),
    ]);
  }

  async function submitReview() {
    if (!collection?.id) return;

    setIsSubmittingReview(true);
    setReviewMutationError("");
    setReviewMessage("");

    try {
      const response = await fetch(
        currentUserReview
          ? `/api/drinks/collections/${encodeURIComponent(collection.id)}/reviews/${encodeURIComponent(currentUserReview.id)}`
          : `/api/drinks/collections/${encodeURIComponent(collection.id)}/reviews`,
        {
          method: currentUserReview ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            rating: reviewRating,
            title: reviewTitle,
            body: reviewBody,
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to save review (${response.status})`);
      }

      await refreshCollectionAndReviews();
      setReviewMessage(currentUserReview ? "Your review was updated." : "Thanks for sharing your review.");
      setReviewFormOpen(false);
    } catch (err) {
      setReviewMutationError(err instanceof Error ? err.message : "Failed to save review");
    } finally {
      setIsSubmittingReview(false);
    }
  }

  async function deleteReview() {
    if (!collection?.id || !currentUserReview?.id) return;

    setIsDeletingReview(true);
    setReviewMutationError("");
    setReviewMessage("");

    try {
      const response = await fetch(`/api/drinks/collections/${encodeURIComponent(collection.id)}/reviews/${encodeURIComponent(currentUserReview.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to delete review (${response.status})`);
      }

      setCurrentUserReview(null);
      setReviewTitle("");
      setReviewBody("");
      setReviewRating(5);
      await refreshCollectionAndReviews();
      setReviewMessage("Your review was removed.");
      setReviewFormOpen(false);
    } catch (err) {
      setReviewMutationError(err instanceof Error ? err.message : "Failed to delete review");
    } finally {
      setIsDeletingReview(false);
    }
  }

  useEffect(() => {
    void loadCollection(collectionId);
    void loadReviews(collectionId);
  }, [collectionId]);

  useEffect(() => {
    if (!collection?.id) return;
    if (typeof window === "undefined") return;

    const storageKey = `drink-collection-view:${collection.id}`;
    const lastTrackedAtRaw = window.sessionStorage.getItem(storageKey);
    const lastTrackedAt = lastTrackedAtRaw ? Number(lastTrackedAtRaw) : 0;

    if (Number.isFinite(lastTrackedAt) && lastTrackedAt > 0 && Date.now() - lastTrackedAt < 1000 * 60 * 30) {
      return;
    }

    window.sessionStorage.setItem(storageKey, String(Date.now()));

    void fetch(`/api/drinks/collections/${encodeURIComponent(collection.id)}/track-view`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
    }).catch(() => {
      window.sessionStorage.removeItem(storageKey);
    });
  }, [collection?.id]);

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
        setCheckoutPurchaseType(payload.purchaseType ?? "self");
        setGiftSummary(payload.gift ?? null);

        if (payload.status === "completed" && payload.owned) {
          setCheckoutMessage(messageForCheckoutState("completed", null, payload.purchaseType ?? "self", payload.gift ?? null));
          setCheckoutSessionId(null);
          setIsPollingCheckout(false);
          checkoutWindowRef.current?.close();
          checkoutWindowRef.current = null;
          await loadCollection(collectionId, true);
          return;
        }

        if (payload.status === "completed" && (payload.purchaseType ?? "self") === "gift") {
          setCheckoutMessage(messageForCheckoutState("completed", null, "gift", payload.gift ?? null));
          setCheckoutSessionId(null);
          setIsPollingCheckout(false);
          checkoutWindowRef.current?.close();
          checkoutWindowRef.current = null;
          await loadCollection(collectionId, true);
          return;
        }

        if (payload.status === "failed") {
          setCheckoutMessage(messageForCheckoutState("failed", payload.failureReason, payload.purchaseType ?? "self", payload.gift ?? null));
          setCheckoutSessionId(null);
          setIsPollingCheckout(false);
          return;
        }

        if (payload.status === "canceled") {
          setCheckoutMessage(messageForCheckoutState("canceled", payload.failureReason, payload.purchaseType ?? "self", payload.gift ?? null));
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

  async function refreshWishlistStatus(currentCollectionId: string) {
    if (!user?.id || !currentCollectionId) return;

    const response = await fetch(`/api/drinks/collections/${encodeURIComponent(currentCollectionId)}/wishlist-status`, {
      credentials: "include",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || `Failed to refresh wishlist status (${response.status})`);
    }

    const result = payload as WishlistStatusResponse;
    setCollection((current) => current
      ? {
          ...current,
          isWishlisted: result.isWishlisted,
          ownedByViewer: result.owned,
          wishlistCount: result.wishlistCount,
        }
      : current);
  }

  async function toggleWishlist(nextWishlisted: boolean) {
    if (!collection?.id) return;

    setIsUpdatingWishlist(true);
    setWishlistError("");
    setWishlistMessage("");

    try {
      const response = await fetch(`/api/drinks/collections/${encodeURIComponent(collection.id)}/wishlist`, {
        method: nextWishlisted ? "POST" : "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to update wishlist (${response.status})`);
      }

      await refreshWishlistStatus(collection.id);
      setWishlistMessage(nextWishlisted ? "Saved to your wishlist." : "Removed from your wishlist.");
    } catch (err) {
      setWishlistError(err instanceof Error ? err.message : "Unable to update wishlist right now.");
    } finally {
      setIsUpdatingWishlist(false);
    }
  }

  async function applyPromoCode() {
    if (!collection?.id) return;

    const normalizedCode = promoCode.trim().toUpperCase();
    if (!normalizedCode) {
      setPromoPricing(null);
      setPromoMessage("");
      setPromoError("Enter a promo code to validate it.");
      return;
    }

    setIsApplyingPromo(true);
    setPromoError("");
    setPromoMessage("");

    try {
      const response = await fetch(`/api/drinks/collections/${encodeURIComponent(collection.id)}/apply-promo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: normalizedCode }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to validate promo (${response.status})`);
      }

      const result = payload as ApplyPromoResponse;
      setPromoPricing(result.pricing);
      setPromoCode(result.pricing.code);
      setPromoMessage(`Promo ${result.pricing.code} applied. ${formatCurrency(result.pricing.finalAmountCents, result.pricing.currencyCode)} will be sent to Square.`);
    } catch (err) {
      setPromoPricing(null);
      setPromoError(err instanceof Error ? err.message : "Unable to validate promo code right now.");
    } finally {
      setIsApplyingPromo(false);
    }
  }

  async function startCollectionCheckout(purchaseType: PurchaseType) {
    if (!collection) return;

    setIsUnlocking(true);
    setError("");
    setStatusCode(null);
    setCheckoutStatus("pending");
    setCheckoutPurchaseType(purchaseType);
    setGiftSummary(null);
    setCheckoutMessage(purchaseType === "gift" ? "Creating your Square gift checkout…" : "Creating your Square checkout…");
    setPromoError("");

    try {
      const checkoutRes = await fetch(`/api/drinks/collections/${encodeURIComponent(collection.id)}/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          promoCode: promoPricing?.code ?? (promoCode.trim() ? promoCode.trim().toUpperCase() : undefined),
          purchaseType,
        }),
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

      if (payload?.promotionCode) {
        setPromoMessage(`Promo ${payload.promotionCode} carried into Square checkout.`);
      }

      setCheckoutSessionId(String(payload.checkoutSessionId));
      setCheckoutMessage(
        purchaseType === "gift"
          ? "Square checkout opened in a new tab. Complete payment there and we’ll generate a shareable gift link here."
          : "Square checkout opened in a new tab. Complete payment there and we’ll unlock the collection here.",
      );

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
  const displayedOriginalAmountCents = promoPricing?.originalAmountCents ?? collection?.priceCents ?? 0;
  const displayedFinalAmountCents = promoPricing?.finalAmountCents ?? collection?.priceCents ?? 0;
  const displayedDiscountAmountCents = promoPricing?.discountAmountCents ?? 0;
  const activePromo = collection?.activePromoPricing ?? null;
  const canWishlist = Boolean(user?.id && collection?.isPremium && !collection?.ownedByViewer && collection?.userId !== user.id);
  const reviewAverageRating = collection?.averageRating ?? 0;
  const reviewCount = collection?.reviewCount ?? 0;
  const canManageReview = Boolean(canReviewCollection && user?.id && collection?.userId !== user.id);

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <DrinksPlatformNav current="collections" />

      {loading ? <p className="text-muted-foreground">Loading collection…</p> : null}
      {!loading && error ? (
        <p className="text-destructive">
          {statusCode === 404 ? "Collection not found." : statusCode === 401 ? "Please sign in to unlock this collection." : statusCode === 403 ? "This collection is private." : error}
        </p>
      ) : null}
      {!loading && error && import.meta.env.DEV ? <p className="break-all text-xs text-muted-foreground">{error}</p> : null}

      {!loading && !error && collection ? (
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-2xl">
              {collection.name}
              <Badge variant="outline">{collection.isPublic ? "Public" : "Private"}</Badge>
              <Badge variant="secondary">{collection.itemsCount} drinks</Badge>
              {collection.isPremium ? <Badge>Premium Collection · {(collection.priceCents / 100).toFixed(2)}</Badge> : null}
              {promoPricing ? <Badge variant="secondary">Promo {promoPricing.code} · {formatCurrency(displayedFinalAmountCents, promoPricing.currencyCode)}</Badge> : null}
              {!promoPricing && activePromo ? <Badge variant="secondary">Active promo {activePromo.code}</Badge> : null}
              {collection.ownedByViewer ? <Badge variant="secondary">Owned</Badge> : null}
              {collection.isWishlisted ? <Badge variant="outline">Wishlisted</Badge> : null}
              {!collection.ownedByViewer && isLockedPremium ? <Badge variant="outline">Locked</Badge> : null}
            </CardTitle>
            {collection.description ? <p className="text-sm text-muted-foreground">{collection.description}</p> : null}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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
            {collection.isPremium ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatCurrency(collection.priceCents)} list price</span>
                  <span>·</span>
                  <span>{collection.wishlistCount ?? 0} interested wishlists</span>
                  {activePromo ? (
                    <>
                      <span>·</span>
                      <span className="font-medium text-emerald-700">
                        Active promo {activePromo.code}: {formatPromoDiscount(activePromo)}
                      </span>
                    </>
                  ) : null}
                </div>
                <CollectionRatingSummary averageRating={reviewAverageRating} reviewCount={reviewCount} />
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {!isLockedPremium && checkoutMessage && checkoutStatus === "completed" ? (
              <p className="text-sm text-emerald-600">{checkoutMessage}</p>
            ) : null}

            {collection.isPremium && !collection.ownedByViewer ? (
              <div className="rounded-md border border-dashed p-3 text-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">Save this premium collection for later</p>
                    <p className="text-xs text-muted-foreground">
                      Wishlist keeps demand separate from purchases and helps you revisit this collection when promos go live.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canWishlist ? (
                      <Button
                        type="button"
                        variant={collection.isWishlisted ? "outline" : "secondary"}
                        onClick={() => void toggleWishlist(!collection.isWishlisted)}
                        disabled={isUpdatingWishlist}
                      >
                        {isUpdatingWishlist
                          ? "Updating…"
                          : collection.isWishlisted
                            ? "Remove from Wishlist"
                            : "Add to Wishlist"}
                      </Button>
                    ) : !user ? (
                      <Link href="/auth/login">
                        <Button type="button" variant="outline">Sign in to wishlist</Button>
                      </Link>
                    ) : null}
                    <Link href="/drinks/collections/wishlist">
                      <Button type="button" variant="ghost">Open Wishlist</Button>
                    </Link>
                  </div>
                </div>
                {wishlistMessage ? <p className="text-sm text-emerald-600">{wishlistMessage}</p> : null}
                {wishlistError ? <p className="text-sm text-destructive">{wishlistError}</p> : null}
              </div>
            ) : null}

            {isLockedPremium ? (
              <Card>
                <CardContent className="space-y-3 p-4">
                  <p className="text-sm text-muted-foreground">This premium collection is locked. Preview available below.</p>
                  {activePromo ? (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
                      <p className="font-medium text-emerald-800">Active creator promo: {activePromo.code}</p>
                      <p className="text-emerald-700">
                        {formatPromoDiscount(activePromo)} · checkout price {formatCurrency(activePromo.finalAmountCents, activePromo.currencyCode)}
                      </p>
                      <p className="text-xs text-emerald-700/90">Enter this code below before Square checkout if you want the discounted amount carried into payment.</p>
                    </div>
                  ) : null}
                  <div className="space-y-3 rounded-md border border-dashed p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Optional promo code</p>
                      <p className="text-xs text-muted-foreground">Enter a creator promo for this collection before Square checkout.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="collection-promo-code" className="text-xs uppercase tracking-wide text-muted-foreground">Promo code</Label>
                        <Input
                          id="collection-promo-code"
                          value={promoCode}
                          onChange={(event) => {
                            setPromoCode(event.target.value.toUpperCase());
                            setPromoPricing(null);
                            setPromoMessage("");
                            setPromoError("");
                          }}
                          placeholder={activePromo?.code ?? "SUMMER20"}
                          autoCapitalize="characters"
                        />
                      </div>
                      <div className="sm:self-end">
                        <Button type="button" variant="outline" onClick={applyPromoCode} disabled={isApplyingPromo}>
                          {isApplyingPromo ? "Validating…" : "Apply Promo"}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className={promoPricing ? "text-muted-foreground line-through" : "font-medium"}>
                        Original {formatCurrency(displayedOriginalAmountCents)}
                      </span>
                      {promoPricing ? (
                        <>
                          <span className="font-medium text-emerald-600">Discounted {formatCurrency(displayedFinalAmountCents, promoPricing.currencyCode)}</span>
                          <span className="text-xs text-muted-foreground">You save {formatCurrency(displayedDiscountAmountCents, promoPricing.currencyCode)}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">No promo applied yet.</span>
                      )}
                    </div>
                    {promoMessage ? <p className="text-sm text-emerald-600">{promoMessage}</p> : null}
                    {promoError ? <p className="text-sm text-destructive">{promoError}</p> : null}
                  </div>
                  {collection.checkout?.status === "pending" && !checkoutSessionId ? (
                    <p className="text-xs text-muted-foreground">A previous Square checkout is still pending verification. Use the status button below if you just completed payment.</p>
                  ) : null}
                  {checkoutMessage ? (
                    <p className={`text-sm ${checkoutStatus === "completed" ? "text-emerald-600" : checkoutStatus === "failed" || checkoutStatus === "canceled" ? "text-destructive" : "text-muted-foreground"}`}>
                      {checkoutMessage}
                    </p>
                  ) : null}
                  {giftSummary?.claimUrl ? (
                    <div className="rounded-md border bg-muted/40 p-3 text-sm">
                      <p className="font-medium">Gift link ready</p>
                      <p className="text-xs text-muted-foreground">Share this claim link with the recipient. Ownership is only granted after they claim it while signed in.</p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <Input readOnly value={giftSummary.claimUrl} />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            await navigator.clipboard.writeText(giftSummary.claimUrl);
                            setCheckoutMessage("Gift claim link copied to your clipboard.");
                          }}
                        >
                          Copy link
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void startCollectionCheckout("self")} disabled={isUnlocking || isPollingCheckout}>
                      {isUnlocking && checkoutPurchaseType === "self"
                        ? "Opening Square Checkout…"
                        : isPollingCheckout && checkoutPurchaseType === "self"
                          ? "Waiting for Square payment…"
                          : `Unlock Collection · ${formatCurrency(displayedFinalAmountCents, promoPricing?.currencyCode ?? "USD")}`}
                    </Button>
                    <Button onClick={() => void startCollectionCheckout("gift")} disabled={isUnlocking || isPollingCheckout} variant="outline">
                      {isUnlocking && checkoutPurchaseType === "gift"
                        ? "Opening Gift Checkout…"
                        : isPollingCheckout && checkoutPurchaseType === "gift"
                          ? "Waiting for gift payment…"
                          : `Gift this · ${formatCurrency(displayedFinalAmountCents, promoPricing?.currencyCode ?? "USD")}`}
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
              <div key={item.id || `${collection.id}-${item.drinkSlug}`} className="space-y-1 rounded-md border p-3">
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

            {collection.isPremium ? (
              <div className="space-y-4 rounded-md border-t pt-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">Reviews & ratings</h2>
                    <CollectionRatingSummary averageRating={reviewAverageRating} reviewCount={reviewCount} />
                    <p className="text-xs text-muted-foreground">
                      Verified buyer reviews stay visible as social proof even if access changes later, but new reviews require active ownership.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canManageReview ? (
                      <Button type="button" variant={currentUserReview ? "outline" : "default"} onClick={() => openReviewForm(currentUserReview)}>
                        {currentUserReview ? "Edit Your Review" : "Leave a Review"}
                      </Button>
                    ) : !user ? (
                      <Link href="/auth/login">
                        <Button type="button" variant="outline">Sign in to review</Button>
                      </Link>
                    ) : collection.userId === user.id ? (
                      <p className="text-sm text-muted-foreground">Creators can view feedback here but cannot review their own collection.</p>
                    ) : collection.isLocked ? (
                      <p className="text-sm text-muted-foreground">Unlock this premium collection to leave a verified review.</p>
                    ) : null}
                  </div>
                </div>

                {reviewMessage ? <p className="text-sm text-emerald-600">{reviewMessage}</p> : null}
                {reviewMutationError ? <p className="text-sm text-destructive">{reviewMutationError}</p> : null}
                {reviewsError ? <p className="text-sm text-destructive">{reviewsError}</p> : null}

                {reviewFormOpen ? (
                  <div className="space-y-3 rounded-md border bg-muted/20 p-4">
                    <div className="space-y-1">
                      <p className="font-medium">{currentUserReview ? "Edit your review" : "Leave a review"}</p>
                      <p className="text-xs text-muted-foreground">One verified buyer review per collection for version one.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Your rating</Label>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Button
                            key={value}
                            type="button"
                            variant={reviewRating === value ? "default" : "outline"}
                            onClick={() => setReviewRating(value)}
                            className="gap-1"
                          >
                            <Star className={`h-4 w-4 ${reviewRating >= value ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"}`} />
                            {value}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="collection-review-title">Title (optional)</Label>
                      <Input
                        id="collection-review-title"
                        value={reviewTitle}
                        onChange={(event) => setReviewTitle(event.target.value.slice(0, 160))}
                        placeholder="Worth the unlock"
                        maxLength={160}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="collection-review-body">Review (optional)</Label>
                      <Textarea
                        id="collection-review-body"
                        value={reviewBody}
                        onChange={(event) => setReviewBody(event.target.value.slice(0, 4000))}
                        placeholder="What made this premium collection useful?"
                        rows={4}
                        maxLength={4000}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => void submitReview()} disabled={isSubmittingReview}>
                        {isSubmittingReview ? "Saving…" : currentUserReview ? "Update Review" : "Publish Review"}
                      </Button>
                      <Button type="button" variant="outline" onClick={closeReviewForm} disabled={isSubmittingReview || isDeletingReview}>
                        Cancel
                      </Button>
                      {currentUserReview ? (
                        <Button type="button" variant="destructive" onClick={() => void deleteReview()} disabled={isSubmittingReview || isDeletingReview}>
                          {isDeletingReview ? "Deleting…" : "Delete Review"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {reviewsLoading ? <p className="text-sm text-muted-foreground">Loading reviews…</p> : null}
                {!reviewsLoading && reviews.length === 0 ? (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    No reviews yet. Verified buyers can add the first rating once they unlock this collection.
                  </div>
                ) : null}

                <div className="space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="rounded-md border p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">{review.user.displayName || review.user.username || "Verified buyer"}</p>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{review.rating.toFixed(1)}★</span>
                            <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                            {review.isVerifiedPurchase ? <Badge variant="secondary">Verified purchase</Badge> : null}
                            {review.userId === user?.id ? <Badge variant="outline">Your review</Badge> : null}
                          </div>
                        </div>
                      </div>
                      {review.title ? <p className="mt-3 font-medium">{review.title}</p> : null}
                      {review.body ? <p className="mt-2 text-sm text-muted-foreground">{review.body}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
