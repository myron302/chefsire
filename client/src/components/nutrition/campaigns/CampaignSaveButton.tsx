import { useState } from "react";
import { Bookmark, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function CampaignSaveButton({ initialSaved = false, className }: { initialSaved?: boolean; className?: string }) {
  const [saved, setSaved] = useState(initialSaved);

  return (
    <Button
      type="button"
      size="sm"
      variant={saved ? "default" : "secondary"}
      className={cn("gap-2 rounded-full shadow-sm", saved ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-white/90 hover:bg-white", className)}
      onClick={() => setSaved((current) => !current)}
    >
      {saved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
