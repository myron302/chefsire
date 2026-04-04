import { Badge } from "@/components/ui/badge";
import { Package, ShoppingCart } from "lucide-react";

type RecentSale = {
  order: {
    id: string;
    quantity: number;
    createdAt: string;
    sellerAmount: string;
    status: string;
  };
  product: {
    name: string;
  };
  buyer: {
    displayName?: string;
    username?: string;
  };
};

interface StoreRecentSalesListProps {
  recentSales: RecentSale[];
}

export default function StoreRecentSalesList({ recentSales }: StoreRecentSalesListProps) {
  if (recentSales.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-200" />
        <p className="font-medium">No orders yet</p>
        <p className="text-sm mt-1">Orders will appear here when customers make purchases</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recentSales.map((sale) => (
        <div key={sale.order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-sm">{sale.product.name}</p>
              <p className="text-xs text-gray-500">
                {sale.buyer.displayName || sale.buyer.username} · {sale.order.quantity}x ·{" "}
                {new Date(sale.order.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-green-600 text-sm">
              +${parseFloat(sale.order.sellerAmount).toFixed(2)}
            </p>
            <Badge variant={sale.order.status === "delivered" ? "default" : "secondary"} className="text-xs mt-0.5">
              {sale.order.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
