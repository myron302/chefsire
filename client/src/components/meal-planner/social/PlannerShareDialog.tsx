import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type PlannerShareDialogProps = { open: boolean; onClose: () => void; summary: string; onCopyLink: () => void; onShareSnapshot: () => void; onExportWeek: () => void; };

const PlannerShareDialog = ({ open, onClose, summary, onCopyLink, onShareSnapshot, onExportWeek }: PlannerShareDialogProps) => (
  <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>Share Plan</DialogTitle></DialogHeader>
      <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded-md">{summary}</pre>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onCopyLink}>Copy Link</Button>
        <Button variant="outline" onClick={onShareSnapshot}>Share Snapshot</Button>
        <Button variant="secondary" onClick={onExportWeek}>Export Week</Button>
      </div>
    </DialogContent>
  </Dialog>
);

export default PlannerShareDialog;
