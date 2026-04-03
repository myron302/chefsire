import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { Vendor } from "@/pages/services/lib/wedding-planning-core";

interface QuoteFormState {
  eventDate: string;
  guestCount: number;
  contactEmail: string;
  message: string;
}

interface WeddingPlanningVendorQuoteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  quoteVendor: Vendor | null;
  quoteForm: QuoteFormState;
  onQuoteFormChange: (updater: (prev: QuoteFormState) => QuoteFormState) => void;
  onSubmit: () => void;
}

export function WeddingPlanningVendorQuoteDialog({
  isOpen,
  onOpenChange,
  quoteVendor,
  quoteForm,
  onQuoteFormChange,
  onSubmit,
}: WeddingPlanningVendorQuoteDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a Quote</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm font-medium">{quoteVendor?.name || "Vendor"}</p>
            <p className="text-xs text-muted-foreground">Fill this out and we&apos;ll send the vendor your request.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Event Date</label>
              <Input type="date" value={quoteForm.eventDate} onChange={(e) => onQuoteFormChange((p) => ({ ...p, eventDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Guest Count</label>
              <Input
                type="number"
                min={1}
                value={quoteForm.guestCount || ""}
                onChange={(e) => onQuoteFormChange((p) => ({ ...p, guestCount: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block">Your Email</label>
            <Input
              type="email"
              value={quoteForm.contactEmail}
              onChange={(e) => onQuoteFormChange((p) => ({ ...p, contactEmail: e.target.value }))}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block">Message (optional)</label>
            <Textarea
              value={quoteForm.message}
              onChange={(e) => onQuoteFormChange((p) => ({ ...p, message: e.target.value }))}
              placeholder="Any details or questions for the vendor..."
              rows={4}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onSubmit}>Send Request</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
