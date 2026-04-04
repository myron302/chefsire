import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAnalyticsCards, type DashboardStats } from "../lib/storeDashboard";

type StoreDashboardAnalyticsTabProps = {
  stats: DashboardStats;
};

export default function StoreDashboardAnalyticsTab({ stats }: StoreDashboardAnalyticsTabProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {buildAnalyticsCards(stats).map(({ label, value, sub, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
              <Icon className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="py-16 text-center text-gray-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-medium">Detailed analytics coming soon</p>
          <p className="text-sm mt-1">Track your store performance and customer insights over time</p>
        </CardContent>
      </Card>
    </>
  );
}
