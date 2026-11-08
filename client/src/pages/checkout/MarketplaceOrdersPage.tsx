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

export default function MarketplaceOrdersPage() {
  const { user, loading } = useUser();
  const [, params] = useRoute("/orders/:id");
  const orderId = params?.id === "my-purchases" ? null : params?.id;
  const endpoint = orderId ? `/api/orders/${encodeURIComponent(orderId)}` : "/api/orders/my-purchases";
  const purchases = useQuery<Purchase[]>({
    queryKey: ["marketplace-orders", endpoint, user?.id],
    staleTime: 0,
    refetchOnMount: "always",
    enabled: Boolean(user),
    queryFn: async () => {
      const data = await (await apiRequest("GET", endpoint)).json();
      return orderId ? [{ ...data.order, verifiedPaid: data.verifiedPaid }] : data.orders;
    },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">{orderId ? "Marketplace order" : "Marketplace orders"}</h1>
      {loading ? <p role="status">Checking your session…</p> : !user ? (
        <Link href={`/login?next=${encodeURIComponent(window.location.pathname)}`}>Sign in to view your orders</Link>
      ) : purchases.isPending ? <p role="status">Loading orders…</p> : purchases.isError ? (
        <p role="alert">Could not load your orders. <button onClick={() => purchases.refetch()}>Try again</button></p>
      ) : purchases.data.length === 0 ? (
        <p>No Marketplace orders yet. <Link href="/marketplace">Browse Marketplace</Link></p>
      ) : purchases.data.map(({ order, product, verifiedPaid }) => (
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
    </main>
  );
}
