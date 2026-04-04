import { Link } from "wouter";
import { Crown, Eye, EyeOff, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type StoreDashboardHeaderProps = {
  storeName: string;
  storeHandle: string;
  published: boolean;
  currentTier: string;
  trialDaysLeft: number;
  publishing: boolean;
  onTogglePublish: () => void;
};

export default function StoreDashboardHeader({
  storeName,
  storeHandle,
  published,
  currentTier,
  trialDaysLeft,
  publishing,
  onTogglePublish,
}: StoreDashboardHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Store Dashboard</h1>
          <p className="text-gray-500 mt-1">{storeName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/store/${storeHandle}`}>
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-1.5" />
              View Store
            </Button>
          </Link>
          <Button
            onClick={onTogglePublish}
            disabled={publishing}
            size="sm"
            variant={published ? "outline" : "default"}
            className={!published ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {published ? (
              <>
                <EyeOff className="w-4 h-4 mr-1.5" />
                Unpublish
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 mr-1.5" />
                Publish Store
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Badge variant={published ? "default" : "secondary"} className={published ? "bg-green-600" : ""}>
          {published ? "Published" : "Draft"}
        </Badge>
        <Badge variant="outline" className="capitalize">
          <Crown className="w-3 h-3 mr-1" />
          {currentTier} plan
        </Badge>
        {trialDaysLeft > 0 && (
          <Badge variant="outline" className="text-orange-600 border-orange-300">
            Trial: {trialDaysLeft} days left
          </Badge>
        )}
        <span className="text-sm text-gray-400">chefsire.com/store/{storeHandle}</span>
      </div>
    </div>
  );
}
