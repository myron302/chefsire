import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { useUser } from "@/contexts/UserContext";
import { apiRequest } from "@/lib/queryClient";

type Purchase = {
  order: {
    id: string;
    buyerId: string;
    quantity: number;
    totalAmount: string;
    status: string | null;
    paymentStatus: string;
    deliveryMethod: string;
    trackingNumber: string | null;
  };
  product: { name: string; pickupLocation?: string; pickupInstructions?: string };
  verifiedPaid: boolean;
};

const PAGE_SIZE = 20;

export default function MarketplaceOrdersPage() {
  const { user, loading } = useUser();
  const [, params] = useRoute("/orders/:id");
  const orderId = params?.id === "my-purchases" ? null : params?.id;
  const [page, setPage] = useState(0);
  const endpoint = orderId
    ? `/api/orders/${encodeURIComponent(orderId)}`
    : `/api/orders/my-purchases?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
  const purchases = useQuery<{ orders: Purchase[]; hasMore: boolean }>({
    queryKey: ["marketplace-orders", endpoint, user?.id],
    staleTime: 0,
    refetchOnMount: "always",
    enabled: Boolean(user),
    queryFn: async () => {
      const data = await (await apiRequest("GET", endpoint)).json();
      return orderId ? { orders: [{ ...data.order, verifiedPaid: data.verifiedPaid }], hasMore: false } : data;
    },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">{orderId ? "Marketplace order" : "Marketplace orders"}</h1>
      {loading ? <p role="status">Checking your session…</p> : !user ? (
        <Link href={`/login?next=${encodeURIComponent(window.location.pathname)}`}>Sign in to view your orders</Link>
      ) : purchases.isPending ? <p role="status">Loading orders…</p> : purchases.isError ? (
        <p role="alert">Could not load your orders. <button onClick={() => purchases.refetch()}>Try again</button></p>
      ) : purchases.data.orders.length === 0 ? (
        <p>No Marketplace orders yet. <Link href="/marketplace">Browse Marketplace</Link></p>
      ) : purchases.data.orders.map(({ order, product, verifiedPaid }) => (
        <article key={order.id} className="space-y-1 rounded-lg border p-4">
          <h2 className="font-semibold">{product.name}</h2>
          <p>{order.quantity} × · ${Number(order.totalAmount).toFixed(2)} total</p>
          <p>Payment: {verifiedPaid ? "Paid" : order.paymentStatus.replaceAll("_", " ")}</p>
          <p>Order: {order.status ?? "pending"}</p>
          {verifiedPaid && order.buyerId === user.id && order.deliveryMethod === "digital" && (
            <a className="underline" href={`/api/orders/${encodeURIComponent(order.id)}/download`}>Download purchase</a>
          )}
          {order.trackingNumber && <p>Tracking: {order.trackingNumber}</p>}
          {verifiedPaid && order.deliveryMethod === "pickup" && (
            <p>Pickup: {[product.pickupLocation, product.pickupInstructions].filter(Boolean).join(" · ") || "Contact the seller for details."}</p>
          )}
        </article>
      ))}
      {user && !orderId && (page > 0 || purchases.data?.hasMore) && (
        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={page === 0 || purchases.isFetching} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page + 1}</span>
          <Button variant="outline" disabled={!purchases.data?.hasMore || purchases.isFetching} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </main>
  );
}
