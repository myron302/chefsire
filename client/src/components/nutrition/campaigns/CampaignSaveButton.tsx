import { Bookmark } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchCampaignState, saveCampaign, unsaveCampaign } from "@/components/meal-planner/campaigns/api/campaignPersistenceApi";
import { cn } from "@/lib/utils";

export default function CampaignSaveButton({ campaignId, initialSaved = false, className }: { campaignId: string; initialSaved?: boolean; className?: string }) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchCampaignState()
      .then((state) => {
        if (mounted) setSaved(state.savedCampaigns.some((campaign) => campaign.campaignId === campaignId));
      })
      .catch((err) => { if (mounted) setError(err instanceof Error ? err.message : "Unable to load saved state"); });
    return () => { mounted = false; };
  }, [campaignId]);

  const toggleSaved = async () => {
    setPending(true);
    setError(null);
    try {
      if (saved) {
        await unsaveCampaign(campaignId);
        setSaved(false);
      } else {
        await saveCampaign(campaignId);
        setSaved(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update saved campaign");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className={cn("gap-2 rounded-full bg-white/90 shadow-sm hover:bg-white", className)}
      disabled={pending}
      title={error ?? (saved ? "Remove this campaign from saved campaigns." : "Save this campaign to your account.")}
      onClick={() => void toggleSaved()}
    >
      <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
      {pending ? "Saving…" : saved ? "Saved" : "Save"}
    </Button>
  );
}
