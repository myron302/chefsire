import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type BuyerOrderStatus = "completed" | "pending" | "refunded_pending" | "refunded" | "revoked";

type BuyerOrder = {
  orderId: string;
  purchaseId: string | null;
  collectionId: string;
  collectionName: string;
  collectionRoute: string;
  creatorUserId: string | null;
  creatorUsername: string | null;
  grossAmountCents: number;
  currency: string;
  status: BuyerOrderStatus;
  statusReason: string | null;
  purchasedAt: string;
  refundedAt: string | null;
  owned: boolean;
};

type BuyerOrdersResponse = {
  ok: boolean;
  userId: string;
  count: number;
  orders: BuyerOrder[];
  reportingNotes: string[];
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatCurrency(cents?: number | null, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
  }).format(Number(cents ?? 0) / 100);
}

function orderStatusMeta(status: BuyerOrderStatus) {
  switch (status) {
    case "refunded":
      return { label: "Refunded", variant: "outline" as const };
    case "refunded_pending":
      return { label: "Pending refund", variant: "outline" as const };
    case "revoked":
      return { label: "Revoked access", variant: "outline" as const };
    case "pending":
      return { label: "Pending", variant: "secondary" as const };
    case "completed":
    default:
      return { label: "Completed", variant: "default" as const };
  }
}

export default function DrinkOrdersPage() {
  const { user, loading: userLoading } = useUser();

  const ordersQuery = useQuery<BuyerOrdersResponse>({
    queryKey: ["/api/drinks/orders", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/orders", { credentials: "include" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load your premium collection orders (${response.status})`;
        throw new Error(String(message));
      }

      return payload as BuyerOrdersResponse;
    },
    enabled: Boolean(user?.id),
  });

  if (userLoading) {
    return <div className="container mx-auto max-w-6xl px-4 py-8">Loading your orders…</div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-6xl space-y-4 px-4 py-8">
        <DrinksPlatformNav current="orders" />
        <Card>
          <CardHeader>
            <CardTitle>Premium Collection Orders</CardTitle>
            <CardDescription>Sign in to view your premium drink collection order history.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/auth/login">
              <Button>Sign in</Button>
            </Link>
            <Link href="/drinks/collections/explore">
              <Button variant="outline">Browse premium collections</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const orders = ordersQuery.data?.orders ?? [];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <DrinksPlatformNav current="orders" />

      <section className="space-y-2">
        <h1 className="text-3xl font-bold">Premium Collection Orders</h1>
        <p className="text-sm text-muted-foreground">
          Review every premium drink collection order with ownership-aware status labels pulled from the current Square-backed lifecycle.
        </p>
        <div className="flex flex-wrap gap-2 pt-1 text-sm">
          <Link href="/drinks/collections/purchased" className="underline underline-offset-2">My purchased collections</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/drinks/collections/explore" className="underline underline-offset-2">Browse premium collections</Link>
        </div>
      </section>

      {ordersQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading premium collection orders…</p> : null}
      {ordersQuery.isError ? <p className="text-sm text-destructive">{ordersQuery.error instanceof Error ? ordersQuery.error.message : "Unable to load premium collection orders right now."}</p> : null}

      {ordersQuery.data?.reportingNotes?.length ? (
        <Card>
          <CardContent className="pt-6">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {ordersQuery.data.reportingNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {ordersQuery.isSuccess && orders.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No premium collection orders yet</CardTitle>
            <CardDescription>
              Once you start a Square checkout for a premium collection, it will show up here with its latest status.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/drinks/collections/explore">
              <Button>Browse premium collections</Button>
            </Link>
            <Link href="/drinks/collections/purchased">
              <Button variant="outline">View ownership page</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {orders.length > 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
              <CardDescription>{orders.length} premium collection orders in your history.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p>
                <p className="text-xl font-semibold">{orders.filter((order) => order.status === "completed").length}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
                <p className="text-xl font-semibold">{orders.filter((order) => order.status === "pending" || order.status === "refunded_pending").length}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">No longer owned</p>
                <p className="text-xl font-semibold">{orders.filter((order) => !order.owned).length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order history</CardTitle>
              <CardDescription>Completed, refunded, revoked, and pending order states stay visible here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Collection</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Creator</TableHead>
                      <TableHead className="text-right">Price paid</TableHead>
                      <TableHead className="text-right">Purchased</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.orderId}>
                        <TableCell>
                          <div className="space-y-1">
                            <Link href={order.collectionRoute} className="font-medium underline underline-offset-2">
                              {order.collectionName}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              Order {order.orderId}
                              {order.purchaseId ? ` · Purchase ${order.purchaseId}` : ""}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant={orderStatusMeta(order.status).variant}>{orderStatusMeta(order.status).label}</Badge>
                            <Badge variant={order.owned ? "secondary" : "outline"}>{order.owned ? "Owned" : "Not owned"}</Badge>
                            {order.statusReason ? <p className="max-w-xs text-xs text-muted-foreground">{order.statusReason}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell>{order.creatorUsername ? `@${order.creatorUsername}` : "Creator"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(order.grossAmountCents, order.currency)}</TableCell>
                        <TableCell className="text-right">{formatDateTime(order.purchasedAt)}</TableCell>
                        <TableCell className="text-right">{formatDateTime(order.refundedAt ?? order.purchasedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-4 md:hidden">
                {orders.map((order) => (
                  <Card key={order.orderId}>
                    <CardHeader>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={orderStatusMeta(order.status).variant}>{orderStatusMeta(order.status).label}</Badge>
                        <Badge variant={order.owned ? "secondary" : "outline"}>{order.owned ? "Owned" : "Not owned"}</Badge>
                      </div>
                      <CardTitle className="text-lg">
                        <Link href={order.collectionRoute} className="underline underline-offset-2">
                          {order.collectionName}
                        </Link>
                      </CardTitle>
                      <CardDescription>{order.creatorUsername ? `Created by @${order.creatorUsername}` : "Creator attribution unavailable."}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <div>Order ID: {order.orderId}</div>
                      {order.purchaseId ? <div>Purchase ID: {order.purchaseId}</div> : null}
                      <div>Price paid: {formatCurrency(order.grossAmountCents, order.currency)}</div>
                      <div>Purchased: {formatDateTime(order.purchasedAt)}</div>
                      {order.refundedAt ? <div>Status updated: {formatDateTime(order.refundedAt)}</div> : null}
                      {order.statusReason ? <div>{order.statusReason}</div> : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
