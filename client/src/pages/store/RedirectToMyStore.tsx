import * as React from "react";
import { useLocation } from "wouter";
import { useUser } from "@/contexts/UserContext";

/**
 * Redirects the signed-in user to their public store URL: /store/:handle
 * If they don't have a store yet, sends them to /store (Marketplace) to create one.
 * If not logged in, sends to /login.
 */
export default function RedirectToMyStore() {
  const { user } = useUser();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        // Not logged in → go login
        if (!user?.id) {
          setLocation("/login");
          return;
        }

        // Ask backend for this user's store
        const res = await fetch(`/api/stores/by-user/${user.id}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          // API trouble → fall back to marketplace
          setLocation("/store");
          return;
        }

        const data = await res.json();
        const handle: string | undefined = data?.store?.handle;

        if (handle) {
          setLocation(`/store/${handle}`);
        } else {
          // No store yet → go to marketplace/store to create one
          setLocation("/store");
        }
      } catch (_e) {
        // Network/abort → safe fallback
        setLocation("/store");
      }
    })();

    return () => controller.abort();
  }, [user?.id, setLocation]);

  // Tiny placeholder while redirecting
  return <div className="p-6 text-gray-600">Loading your store…</div>;
}
