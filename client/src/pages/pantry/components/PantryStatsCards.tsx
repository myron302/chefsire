import { AlertCircle, Clock, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PantryStats {
  total: number;
  expiring: number;
  expired: number;
  runningLow: number;
}

interface PantryStatsCardsProps {
  stats: PantryStats;
  onSelect: (stat: "total" | "expiring" | "expired" | "runningLow") => void;
}

export function PantryStatsCards({ stats, onSelect }: PantryStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => onSelect("total")}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Package className="w-8 h-8 text-gray-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-yellow-200 bg-yellow-50 cursor-pointer hover:bg-yellow-100 transition-colors" onClick={() => onSelect("expiring")}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700">Expiring Soon</p>
              <p className="text-2xl font-bold text-yellow-800">{stats.expiring}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors" onClick={() => onSelect("expired")}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700">Expired</p>
              <p className="text-2xl font-bold text-red-800">{stats.expired}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => onSelect("runningLow")}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">Running Low</p>
              <p className="text-2xl font-bold text-blue-800">{stats.runningLow}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
