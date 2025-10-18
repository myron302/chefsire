import React from "react";
import { MobileSheet, KeyboardAvoidingView, TouchButton, SafeArea } from "@/mobile/MobileKit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MakeShakeSheetProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  // Optional initial values if you want to pre-fill from a recipe/card:
  defaults?: { servings?: number; sweetener?: string; note?: string };
  onMake?: (data: { servings: number; sweetener: string; note: string }) => void;
};

export default function MakeShakeSheet({
  open,
  onOpenChange,
  title = "Make Shake",
  defaults,
  onMake,
}: MakeShakeSheetProps) {
  const [servings, setServings] = React.useState(defaults?.servings ?? 1);
  const [sweetener, setSweetener] = React.useState(defaults?.sweetener ?? "");
  const [note, setNote] = React.useState(defaults?.note ?? "");

  React.useEffect(() => {
    if (open) {
      setServings(defaults?.servings ?? 1);
      setSweetener(defaults?.sweetener ?? "");
      setNote(defaults?.note ?? "");
    }
  }, [open, defaults?.servings, defaults?.sweetener, defaults?.note]);

  return (
    <MobileSheet open={open} onOpenChange={onOpenChange} title={title} height="lg">
      {/* Keyboard-safe form INSIDE the sheet */}
      <KeyboardAvoidingView className="space-y-4">
        <div className="grid gap-3">
          <label className="text-sm font-medium">Servings</label>
          <Input
            type="number"
            min={1}
            value={servings}
            onChange={(e) => setServings(Math.max(1, Number(e.target.value || 1)))}
          />
        </div>

        <div className="grid gap-3">
          <label className="text-sm font-medium">Sweetener (optional)</label>
          <Input
            placeholder="Honey, stevia, dates…"
            value={sweetener}
            onChange={(e) => setSweetener(e.target.value)}
          />
        </div>

        <div className="grid gap-3">
          <label className="text-sm font-medium">Note</label>
          <Input
            placeholder="Blend longer / extra ice / protein brand…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Sticky action row that respects the iPhone home indicator */}
        <SafeArea edge="bottom" className="pt-2">
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => {
                onMake?.({ servings, sweetener, note });
                onOpenChange(false);
              }}
            >
              Make Shake
            </Button>
          </div>
        </SafeArea>
      </KeyboardAvoidingView>
    </MobileSheet>
  );
}
