import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PantryItem } from "../lib/types";

interface ExpiryCalendarDialogProps {
  open: boolean;
  expiringItems: PantryItem[];
  onOpenChange: (open: boolean) => void;
}

export function ExpiryCalendarDialog({ open, expiringItems, onOpenChange }: ExpiryCalendarDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Expiry Calendar (Next 7 Days)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {expiringItems.length === 0 ? (
            <p className="text-muted-foreground">Nothing expiring in the next week.</p>
          ) : (
            Object.entries(
              expiringItems.reduce<Record<string, PantryItem[]>>((acc, item) => {
                const key = item.expirationDate
                  ? new Date(item.expirationDate).toISOString().split("T")[0]
                  : "No date";
                (acc[key] ||= []).push(item);
                return acc;
              }, {}),
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([day, items]) => (
                <div key={day} className="border rounded-lg">
                  <div className="px-4 py-2 font-semibold bg-muted/50">
                    {day === "No date" ? "No expiration date" : format(new Date(day), "EEEE, MMM d, yyyy")}
                  </div>
                  <div className="p-4 space-y-2">
                    {items.map((i) => (
                      <div key={i.id} className="flex items-center justify-between">
                        <span>{i.name}</span>
                        <Badge variant="secondary">
                          {i.quantity && i.unit ? `${i.quantity} ${i.unit}` : "—"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
