import React from 'react';
import { Copy, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type ShareFamilyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMembers: any[];
  groceryCount: number;
  onCopyToClipboard: () => void;
};

const ShareFamilyDialog = ({
  open,
  onOpenChange,
  familyMembers,
  groceryCount,
  onCopyToClipboard,
}: ShareFamilyDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Share Grocery List with Family</DialogTitle>
        <DialogDescription>
          Copy your grocery list to share with family members
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Family Members:</h4>
          {familyMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No family members found. Add them in the Allergies section.
            </p>
          ) : (
            <div className="space-y-2">
              {familyMembers.map((member: any) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                >
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{member.name}</p>
                    {member.relationship && (
                      <p className="text-xs text-muted-foreground">{member.relationship}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium text-sm mb-2">Grocery List Summary:</h4>
          <p className="text-sm text-muted-foreground mb-4">
            {groceryCount} items in your list
          </p>

          <Button onClick={onCopyToClipboard} className="w-full">
            <Copy className="w-4 h-4 mr-2" />
            Copy List to Clipboard
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            You can paste this list in any messaging app to share with family
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export default ShareFamilyDialog;
