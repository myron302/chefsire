import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StoreRecentSalesList, { type RecentSale } from "./StoreRecentSalesList";

type StoreDashboardOrdersTabProps = {
  sellerId: string;
  onOrderUpdated: (id: string, status: string, trackingNumber: string | null) => void;
};

const PAGE_SIZE = 20;

export default function StoreDashboardOrdersTab({ sellerId, onOrderUpdated }: StoreDashboardOrdersTabProps) {
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace-seller-orders", sellerId];
  const orders = useQuery<{ sales: RecentSale[]; hasMore: boolean }>({
    queryKey: [...queryKey, page],
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryFn: async () => (await apiRequest("GET", `/api/orders/my-sales?paidOnly=true&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)).json(),
  });
  function updateOrder(id: string, status: string, trackingNumber: string | null) {
    onOrderUpdated(id, status, trackingNumber);
    void queryClient.invalidateQueries({ queryKey });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Paid Orders</CardTitle>
        <CardDescription>Orders with verified payment, ready to fulfill or review</CardDescription>
      </CardHeader>
      <CardContent>
        {orders.isPending ? <p role="status">Loading orders…</p> : orders.isError ? (
          <p role="alert">Could not load orders. <button onClick={() => orders.refetch()}>Try again</button></p>
        ) : (
          <StoreRecentSalesList
            recentSales={orders.data.sales}
            renderFulfillment={(sale) => <Fulfillment sale={sale} onOrderUpdated={updateOrder} />}
          />
        )}
        {(page > 0 || orders.data?.hasMore) && (
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" disabled={page === 0 || orders.isFetching} onClick={() => setPage(page - 1)}>Previous</Button>
            <span>Page {page + 1}</span>
            <Button variant="outline" disabled={!orders.data?.hasMore || orders.isFetching} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Fulfillment({ sale, onOrderUpdated }: { sale: RecentSale; onOrderUpdated: StoreDashboardOrdersTabProps["onOrderUpdated"] }) {
  const [tracking, setTracking] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { order, verifiedPaid } = sale;
  if (!verifiedPaid || order.deliveryMethod === "digital") return null;
  const shipped = order.deliveryMethod === "shipped";
  const next = order.status === "pending" ? "processing"
    : order.status === "processing" ? (shipped ? "shipped" : "delivered")
    : order.status === "shipped" ? "delivered" : null;
  const address = shipped ? order.shippingAddress : null;

  async function update() {
    if (!next || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, trackingNumber: next === "shipped" ? tracking.trim() || undefined : undefined }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Order update failed");
      onOrderUpdated(order.id, data.order.status, data.order.trackingNumber);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Order update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 space-y-1">
      {address && <p className="text-xs">{address.street}, {address.city}, {address.state} {address.zipCode}, {address.country}</p>}
      {!shipped && <p className="text-xs">Local pickup</p>}
      {next === "shipped" && <Input aria-label="Tracking number (optional)" value={tracking} onChange={(event) => setTracking(event.target.value)} maxLength={100} />}
      {order.trackingNumber && <p className="text-xs">Tracking: {order.trackingNumber}</p>}
      {next && <Button size="sm" onClick={update} disabled={saving}>
        {saving ? "Saving…" : next === "processing" ? "Start fulfillment" : next === "shipped" ? "Mark shipped" : shipped ? "Mark delivered" : "Mark picked up"}
      </Button>}
      {error && <p role="alert" className="text-xs">{error}</p>}
    </div>
  );
}
