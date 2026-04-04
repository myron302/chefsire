import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import StoreRecentSalesList from "./StoreRecentSalesList";

type StoreDashboardOrdersTabProps = {
  recentSales: any[];
};

export default function StoreDashboardOrdersTab({ recentSales }: StoreDashboardOrdersTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
        <CardDescription>Orders placed by your customers</CardDescription>
      </CardHeader>
      <CardContent>
        <StoreRecentSalesList recentSales={recentSales} />
      </CardContent>
    </Card>
  );
}
