import React, { useState } from "react";
import { Megaphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  price: string | number;
  images?: string[];
}

interface NotifyFollowersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  product: Product;
  followerCount?: number;
}

const MAX_CHARS = 140;

export default function NotifyFollowersDialog({
  open,
  onOpenChange,
  storeId,
  product,
  followerCount = 0,
}: NotifyFollowersDialogProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const charsLeft = MAX_CHARS - message.length;

  const handleSubmit = async () => {
    if (message.trim().length > MAX_CHARS) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/drops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productId: product.id,
          message: message.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          const hours = Math.ceil((data.retryAfterSeconds ?? 3600) / 3600);
          toast({
            title: "Rate limit reached",
            description: `You can send another drop in ${hours} hour${hours !== 1 ? "s" : ""}.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Failed to send drop",
            description: data.error || "An error occurred",
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "Drop sent!",
        description: `Notified ${data.drop.recipientCount} follower${data.drop.recipientCount !== 1 ? "s" : ""}.`,
      });
      setMessage("");
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to send drop", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const primaryImage = product.images?.[0];
  const price =
    typeof product.price === "number"
      ? `$${product.price.toFixed(2)}`
      : `$${parseFloat(product.price).toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-orange-500" />
            Notify Your Followers
          </DialogTitle>
          <DialogDescription>
            Send a drop notification to all {followerCount} of your followers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product preview */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            {primaryImage ? (
              <img
                src={primaryImage}
                alt={product.name}
                className="w-14 h-14 rounded-md object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-md bg-gray-200 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">📦</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{product.name}</p>
              <p className="text-sm text-muted-foreground">{price}</p>
            </div>
          </div>

          {/* Optional message */}
          <div className="space-y-1">
            <Label htmlFor="drop-message">
              Message{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="drop-message"
              placeholder="Tell your followers something special about this drop…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX_CHARS}
              rows={3}
              className="resize-none"
            />
            <p
              className={`text-xs text-right ${
                charsLeft < 20 ? "text-orange-500" : "text-muted-foreground"
              }`}
            >
              {charsLeft} characters remaining
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              onClick={handleSubmit}
              disabled={loading || charsLeft < 0}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                `Notify ${followerCount} follower${followerCount !== 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
