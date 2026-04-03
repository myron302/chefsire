import { Merge, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { DuplicateDecision, DuplicatePair } from "../types";

type DuplicateResolutionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicatePair[];
  decisions: Record<string, DuplicateDecision>;
  onDecisionChange: (incomingId: string, action: DuplicateDecision) => void;
  onApplyChoices: () => void;
  applyPending: boolean;
};

export function DuplicateResolutionDialog({
  open,
  onOpenChange,
  duplicates,
  decisions,
  onDecisionChange,
  onApplyChoices,
  applyPending,
}: DuplicateResolutionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Duplicate items found</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-auto">
          <p className="text-sm text-muted-foreground">
            Some items already existed in the household pantry. Choose what to do for each duplicate.
          </p>

          {duplicates.map((duplicate) => {
            const action = decisions[duplicate.incoming.id] || "merge";
            return (
              <div key={duplicate.incoming.id} className="border rounded p-3 space-y-2">
                <div className="text-sm">
                  <div className="font-medium">{duplicate.existing.name}</div>
                  <div className="text-muted-foreground">
                    Household: {duplicate.existing.quantity ?? "—"} {duplicate.existing.unit ?? ""}{" "}
                    {duplicate.existing.category ? `• ${duplicate.existing.category}` : ""}
                  </div>
                  <div className="text-muted-foreground">
                    Yours: {duplicate.incoming.quantity ?? "—"} {duplicate.incoming.unit ?? ""}{" "}
                    {duplicate.incoming.category ? `• ${duplicate.incoming.category}` : ""}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={action === "merge" ? "default" : "outline"}
                    size="sm"
                    onClick={() => onDecisionChange(duplicate.incoming.id, "merge")}
                  >
                    <Merge className="w-4 h-4 mr-2" />
                    Merge quantities
                  </Button>
                  <Button
                    variant={action === "keepBoth" ? "default" : "outline"}
                    size="sm"
                    onClick={() => onDecisionChange(duplicate.incoming.id, "keepBoth")}
                  >
                    Keep both
                  </Button>
                  <Button
                    variant={action === "discardIncoming" ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => onDecisionChange(duplicate.incoming.id, "discardIncoming")}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Discard mine
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onApplyChoices} disabled={applyPending}>
            Apply choices
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
