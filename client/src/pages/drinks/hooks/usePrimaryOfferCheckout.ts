import { useMemo, useState } from "react";

export type PrimaryOfferCheckoutOffer = {
  type: "collection_checkout";
  ctaLabel?: string | null;
  helperText?: string | null;
  collectionId: string;
  promoCode?: string | null;
} | {
  type: "membership_checkout";
  ctaLabel?: string | null;
  helperText?: string | null;
  creatorUserId: string;
};

type UsePrimaryOfferCheckoutOptions = {
  offer: PrimaryOfferCheckoutOffer | null;
  isAuthenticated: boolean;
  popupNamePrefix: string;
};

const STANDARD_CTA_LABEL = {
  collection_checkout: "Buy now",
  membership_checkout: "Join membership",
} as const;

const STANDARD_HELPER_TEXT = {
  collection_checkout: "Secure checkout opens in Square in a new window.",
  membership_checkout: "Membership checkout opens in Square in a new window.",
} as const;

const STANDARD_LAUNCH_MESSAGE = "Checkout opened in a new window. Complete payment in Square to unlock access.";
const STANDARD_ALREADY_ACTIVE_MESSAGE = "You already have access to this offer.";

export function usePrimaryOfferCheckout({ offer, isAuthenticated, popupNamePrefix }: UsePrimaryOfferCheckoutOptions) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);

  const ctaLabel = useMemo(() => {
    if (!offer) return "";
    return STANDARD_CTA_LABEL[offer.type] ?? offer.ctaLabel ?? "Checkout";
  }, [offer]);

  const helperText = useMemo(() => {
    if (!offer) return "";
    return offer.helperText ?? STANDARD_HELPER_TEXT[offer.type];
  }, [offer]);

  const loadingLabel = "Opening checkout…";

  const startCheckout = async () => {
    if (!offer || isStartingCheckout) return;

    if (!isAuthenticated) {
      const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.href = `/auth/login?next=${encodeURIComponent(next)}`;
      return;
    }

    setError("");
    setMessage("");
    setIsStartingCheckout(true);

    try {
      if (offer.type === "collection_checkout") {
        const response = await fetch(`/api/drinks/collections/${encodeURIComponent(offer.collectionId)}/create-checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            promoCode: offer.promoCode ?? undefined,
            purchaseType: "self",
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to start checkout (${response.status})`);
        }
        if (payload?.alreadyOwned || payload?.owned) {
          setMessage(STANDARD_ALREADY_ACTIVE_MESSAGE);
          return;
        }
        if (!payload?.checkoutUrl) {
          throw new Error("Square checkout link was not returned.");
        }
        window.open(String(payload.checkoutUrl), `${popupNamePrefix}-collection`, "popup,width=520,height=760");
        setMessage(offer.promoCode
          ? `${STANDARD_LAUNCH_MESSAGE} Promo code ${offer.promoCode} was applied.`
          : STANDARD_LAUNCH_MESSAGE);
        return;
      }

      const response = await fetch(`/api/drinks/creators/${encodeURIComponent(offer.creatorUserId)}/membership/create-checkout`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to start membership checkout (${response.status})`);
      }
      if (payload?.alreadyActive) {
        setMessage(STANDARD_ALREADY_ACTIVE_MESSAGE);
        return;
      }
      if (!payload?.checkoutUrl) {
        throw new Error("Square membership checkout link was not returned.");
      }
      window.open(String(payload.checkoutUrl), `${popupNamePrefix}-membership`, "popup,width=520,height=760");
      setMessage(STANDARD_LAUNCH_MESSAGE);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to start checkout right now. Please try again.");
    } finally {
      setIsStartingCheckout(false);
    }
  };

  return {
    ctaLabel,
    error,
    helperText,
    isStartingCheckout,
    loadingLabel,
    message,
    startCheckout,
  };
}
