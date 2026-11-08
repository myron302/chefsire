import { useQuery } from "@tanstack/react-query";

import { toVendor, type PublishedVendorListing, type Vendor } from "@/pages/services/lib/wedding-planning-core";

/** Published wedding vendors from the public directory endpoint. Empty (never fabricated) on failure. */
export function usePublishedVendors() {
  return useQuery<Vendor[]>({
    queryKey: ["/api/wedding/vendor-listings/public"],
    queryFn: async () => {
      const res = await fetch("/api/wedding/vendor-listings/public", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json().catch(() => ({}));
      const listings: PublishedVendorListing[] = Array.isArray(data?.listings) ? data.listings : [];
      return listings.filter((l) => l && l.businessName && Number.isFinite(Number(l.id))).map(toVendor);
    },
    staleTime: 60_000,
    retry: false,
  });
}
