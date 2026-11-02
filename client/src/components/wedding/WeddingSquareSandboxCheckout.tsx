import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useUser } from "@/contexts/UserContext";

export type WeddingSquareQuote = {
  ok: true;
  billingAvailable: boolean;
  tier: "premium" | "elite";
  amountCents: number;
  currency: "USD";
  cadence: "MONTHLY";
  consentVersion: string;
  automaticRenewal: true;
  trialExpiresAt: string | null;
  firstChargeStartDate: string | null;
  requiresExplicitConsent: true;
};
type SquareCard = {
  attach(selector: string): Promise<void>;
  tokenize(): Promise<{ status: string; token?: string }>;
  destroy?(): Promise<void>;
};
type SquarePayments = {
  card(): Promise<SquareCard>;
  verifyBuyer(token: string, details: {
    intent: "STORE";
    billingContact?: { email: string };
  }): Promise<{ token?: string }>;
};
type SquareGlobal = { payments(applicationId: string, locationId: string): Promise<SquarePayments> | SquarePayments };
const sdkUrl = "https://sandbox.web.squarecdn.com/v1/square.js";

function loadSquareSandboxSdk(): Promise<SquareGlobal> {
  const current = (window as unknown as { Square?: SquareGlobal }).Square;
  if (current) return Promise.resolve(current);
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>('script[data-chefsire-square-sandbox="true"]');
    if (!script) {
      script = document.createElement("script");
      script.src = sdkUrl;
      script.async = true;
      script.dataset.chefsireSquareSandbox = "true";
      document.head.appendChild(script);
    }
    const ready = () => {
      const Square = (window as unknown as { Square?: SquareGlobal }).Square;
      if (Square) resolve(Square);
      else reject(new Error("Square sandbox card form could not initialize."));
    };
    script.addEventListener("load", ready, { once:true });
    script.addEventListener("error", () => reject(new Error("Square sandbox card form unavailable.")), { once:true });
    if ((window as unknown as { Square?: SquareGlobal }).Square) ready();
  });
}

/** Browser displays Square-hosted card fields; ChefSire never receives PAN/CVV. */
export function WeddingSquareSandboxCheckout({
  quote, onRefresh,
}: { quote: WeddingSquareQuote; onRefresh: () => void }) {
  const { user } = useUser();
  const cardRef = useRef<SquareCard | null>(null);
  const paymentsRef = useRef<SquarePayments | null>(null);
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let instance: SquareCard | null = null;
    const initialize = async () => {
      if (!quote.billingAvailable) return;
      try {
        const res = await fetch("/api/wedding/subscription/sandbox/card-config", {
          credentials: "include", cache: "no-store",
        });
        const config = await res.json().catch(() => ({}));
        if (!res.ok || config?.ok !== true || config?.squareEnvironment !== "sandbox" ||
            config?.billingLive !== false || config?.cardSetupAvailable !== true ||
            typeof config.applicationId !== "string" ||
            typeof config.locationId !== "string") {
          throw new Error("Square sandbox card entry is not configured.");
        }
        const Square = await loadSquareSandboxSdk();
        if (cancelled) return;
        const payments = await Square.payments(config.applicationId, config.locationId);
        const card = await payments.card();
        instance = card;
        if (cancelled) { await card.destroy?.(); return; }
        await card.attach("#wedding-square-card-container");
        if (cancelled) { await card.destroy?.(); return; }
        paymentsRef.current = payments;
        cardRef.current = card;
        setReady(true);
      } catch {
        if (!cancelled) setMessage("Square sandbox card fields are temporarily unavailable. No payment was started.");
      }
    };
    void initialize();
    return () => {
      cancelled = true;
      cardRef.current = null;
      paymentsRef.current = null;
      setReady(false);
      void instance?.destroy?.().catch(() => undefined);
    };
  }, [quote.tier, quote.billingAvailable]);

  const enroll = async () => {
    if (submitting || uncertain || !accepted || !ready ||
        !paymentsRef.current || !cardRef.current ||
        !quote.billingAvailable || !user?.email) return;
    setSubmitting(true);
    setMessage(null);
    let providerPostStarted = false;
    try {
      const tokenResult = await cardRef.current.tokenize();
      if (tokenResult.status !== "OK" || !tokenResult.token?.startsWith("cnon:")) {
        throw new Error("Please check your Square card details.");
      }
      const verification = await paymentsRef.current.verifyBuyer(tokenResult.token, {
        intent: "STORE", billingContact: { email: user.email },
      });
      if (!verification?.token) throw new Error("Buyer verification is required to store a card.");

      // From this point a network timeout may have committed Square writes.
      // Never re-submit this source or repeat POSTs automatically.
      providerPostStarted = true;
      setUncertain(true);
      const res = await fetch("/api/wedding/subscription/sandbox/card-setup", {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: tokenResult.token,
          verificationToken: verification.token,
          consent: {
            tier: quote.tier,
            consentVersion: quote.consentVersion,
            acceptedAutomaticMonthlyRenewal: true,
            acceptedAmountCents: quote.amountCents,
            acceptedCurrency: quote.currency,
            acknowledgedFirstChargeStartDate: quote.firstChargeStartDate,
          },
        }),
      });
      const setup = await res.json().catch(() => ({}));
      if (res.status !== 202 || setup?.ok !== true ||
          setup?.status !== "subscription_reserved" ||
          typeof setup?.attemptId !== "string" ||
          setup?.paidEntitlementGranted !== false) {
        throw new Error("Square card setup requires reconciliation.");
      }
      const submit = await fetch("/api/wedding/subscription/sandbox/submit", {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: setup.attemptId }),
      });
      const receipt = await submit.json().catch(() => ({}));
      if (submit.status !== 202 || receipt?.ok !== true ||
          receipt?.status !== "pending_payment_verification" ||
          receipt?.paidEntitlementGranted !== false) {
        throw new Error("Square subscription confirmation requires reconciliation.");
      }
      setMessage("Square sandbox subscription saved. No paid access is granted until a Square invoice payment is independently verified.");
      onRefresh();
    } catch (err) {
      setMessage(providerPostStarted
        ? "Square setup outcome is uncertain. Do not retry or enter another card. Contact support for provider reconciliation."
        : err instanceof Error ? err.message : "Unable to verify card details. No provider request was started.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!quote.billingAvailable) return (
    <p className="text-sm text-amber-800" role="status">
      Square recurring checkout is not enabled. No payment method can be collected.
    </p>
  );
  return (
    <div className="space-y-3">
      <p className="text-xs text-amber-800" role="status">
        Square sandbox testing only. This does not initiate a live charge.
      </p>
      <div id="wedding-square-card-container" className="min-h-[90px]" aria-label="Square secure card entry" />
      {!ready && !message ? <p className="text-xs text-gray-600">Loading secure Square card fields…</p> : null}
      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={accepted} onCheckedChange={value => setAccepted(value === true)}
          disabled={!ready || submitting || uncertain} />
        <span>I authorize automatic monthly Square billing of
          {" "}${(quote.amountCents/100).toFixed(2)} USD for
          {" "}{quote.tier === "premium" ? "Premium" : "Elite"}.
          {quote.firstChargeStartDate
            ? " First requested charge date: " + quote.firstChargeStartDate + " UTC, no earlier than my trial expiration."
            : " The first charge may occur after I authorize enrollment."}
          {" "}I may request cancellation of future renewals.
        </span>
      </label>
      <Button type="button" disabled={!ready || !accepted || submitting || uncertain}
        onClick={() => void enroll()}>
        {submitting ? "Processing Square sandbox enrollment…" : "Authorize Square sandbox recurring billing"}
      </Button>
      {message ? <p role="status" className="text-sm text-amber-800">{message}</p> : null}
    </div>
  );
}
