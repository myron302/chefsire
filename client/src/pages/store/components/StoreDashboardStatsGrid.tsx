import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMainStatsCards, type DashboardStats } from "../lib/storeDashboard";

type StoreDashboardStatsGridProps = {
  stats: DashboardStats;
};

export default function StoreDashboardStatsGrid({ stats }: StoreDashboardStatsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {buildMainStatsCards(stats).map(({ label, value, sub, icon: Icon, iconClass }) => (
        <Card key={label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
            <div className={`p-1.5 rounded-lg ${iconClass}`}>
              <Icon className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
