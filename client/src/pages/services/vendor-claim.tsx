import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type State =
  | { kind: "working" }
  | { kind: "done"; businessName: string }
  | { kind: "signin" }
  | { kind: "error"; message: string };

/** Landing page for the claim link emailed to an unclaimed vendor listing's business address. */
export default function VendorClaimPage() {
  const [state, setState] = useState<State>({ kind: "working" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setState({ kind: "error", message: "This link is missing its code. Open the link from the email again." });
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/wedding/vendor-listings/claims/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        const data: any = await res.json().catch(() => ({}));
        if (res.status === 401) return setState({ kind: "signin" });
        if (!res.ok) return setState({ kind: "error", message: data?.error || "We couldn't confirm this claim." });
        setState({ kind: "done", businessName: data?.listing?.businessName || "your business" });
      } catch {
        setState({ kind: "error", message: "Network error. Please try the link again." });
      }
    })();
  }, []);

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <Card>
        <CardContent className="p-6 md:p-8 text-center space-y-4">
          {state.kind === "working" && <p className="text-muted-foreground">Confirming your listing…</p>}
          {state.kind === "done" && (
            <>
              <h1 className="text-2xl font-semibold">You now manage {state.businessName}</h1>
              <p className="text-muted-foreground">
                Your listing is live in the ChefSire wedding vendor directory, and couples can now send you quote requests.
              </p>
              <Link href="/services/wedding-planning/vendors">
                <Button className="bg-gradient-to-r from-pink-600 to-purple-600">View the vendor directory</Button>
              </Link>
            </>
          )}
          {state.kind === "signin" && (
            <>
              <h1 className="text-2xl font-semibold">Sign in to finish</h1>
              <p className="text-muted-foreground">
                Sign in with the ChefSire account you used to claim this business, then open the link from the email again.
              </p>
              <Link href="/login">
                <Button>Sign in</Button>
              </Link>
            </>
          )}
          {state.kind === "error" && (
            <>
              <h1 className="text-2xl font-semibold">We couldn't confirm this claim</h1>
              <p className="text-muted-foreground">{state.message}</p>
              <Link href="/services/wedding-planning/vendors">
                <Button variant="outline">Back to the vendor directory</Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
