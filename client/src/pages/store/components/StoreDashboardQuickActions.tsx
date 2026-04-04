import { Eye, Package, Users } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";

type StoreDashboardQuickActionsProps = {
  storeHandle: string;
  onCustomerInsightsClick: () => void;
};

export default function StoreDashboardQuickActions({
  storeHandle,
  onCustomerInsightsClick,
}: StoreDashboardQuickActionsProps) {
  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
      <Link href="/store/products/new">
        <Card className="hover:shadow-md transition-shadow cursor-pointer group">
          <CardContent className="pt-5">
            <Package className="text-orange-500 mb-2 w-6 h-6 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold mb-1">Add a Product</h3>
            <p className="text-sm text-gray-500">List a new item in your store</p>
          </CardContent>
        </Card>
      </Link>
      <Link href={`/store/${storeHandle}`}>
        <Card className="hover:shadow-md transition-shadow cursor-pointer group">
          <CardContent className="pt-5">
            <Eye className="text-blue-500 mb-2 w-6 h-6 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold mb-1">View Your Store</h3>
            <p className="text-sm text-gray-500">See how customers see your storefront</p>
          </CardContent>
        </Card>
      </Link>
      <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={onCustomerInsightsClick}>
        <CardContent className="pt-5">
          <Users className="text-purple-500 mb-2 w-6 h-6 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold mb-1">Customer Insights</h3>
          <p className="text-sm text-gray-500">Analytics and customer behaviour — coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
