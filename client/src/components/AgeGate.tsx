// client/src/components/AgeGate.tsx
import * as React from "react";
import { setAgeVerified, clearAgeVerified } from "@/lib/ageGate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type AgeGateProps = {
  open: boolean;
  onClose: () => void;
};

export default function AgeGate({ open, onClose }: AgeGateProps) {
  const onYes = () => {
    setAgeVerified();
    onClose();
  };
  const onNo = () => {
    clearAgeVerified();
    // keep the dialog open; optionally you could route away here
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Are you 21 or older?</DialogTitle>
          <DialogDescription>
            You must be of legal drinking age to view Potent Potables content.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex gap-3 justify-end">
          <Button variant="secondary" onClick={onNo}>
            No
          </Button>
          <Button onClick={onYes}>Yes</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          We remember your choice for 30 days on this device.
        </p>
      </DialogContent>
    </Dialog>
  );
}
