import { Bookmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function CampaignSaveButton({ className }: { initialSaved?: boolean; className?: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className={cn("gap-2 rounded-full bg-white/90 shadow-sm hover:bg-white", className)}
      disabled
      aria-disabled="true"
      title="Saving nutrition campaigns is coming soon."
    >
      <Bookmark className="h-4 w-4" />
      Save — Coming soon
    </Button>
  );
}
