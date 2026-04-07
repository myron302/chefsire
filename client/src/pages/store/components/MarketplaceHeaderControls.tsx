import React from "react";
import { Grid, List, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MarketplaceHeaderControlsProps {
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onStartSelling: () => void;
}

export function MarketplaceHeaderControls({
  viewMode,
  onViewModeChange,
  onStartSelling,
}: MarketplaceHeaderControlsProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-2">
        <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => onViewModeChange("grid")}>
          <Grid className="w-4 h-4" />
        </Button>
        <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => onViewModeChange("list")}>
          <List className="w-4 h-4" />
        </Button>
      </div>

      <Button onClick={onStartSelling}>
        <Store className="w-4 h-4 mr-2" />
        Start Selling
      </Button>
    </div>
  );
}
