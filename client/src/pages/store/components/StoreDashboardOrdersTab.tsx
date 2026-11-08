import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StoreRecentSalesList, { type RecentSale } from "./StoreRecentSalesList";

type StoreDashboardOrdersTabProps = {
  recentSales: RecentSale[];
  onOrderUpdated: (id: string, status: string, trackingNumber: string | null) => void;
};

export default function StoreDashboardOrdersTab({ recentSales, onOrderUpdated }: StoreDashboardOrdersTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
        <CardDescription>Orders placed by your customers</CardDescription>
      </CardHeader>
      <CardContent>
        <StoreRecentSalesList
          recentSales={recentSales}
          renderFulfillment={(sale) => <Fulfillment sale={sale} onOrderUpdated={onOrderUpdated} />}
        />
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
