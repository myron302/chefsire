import { useState } from "react";

import { Flag, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import { formatPhone, phoneHref, type Vendor } from "@/pages/services/lib/wedding-planning-core";

const REPORT_REASONS = [
  { value: "closed", label: "Permanently closed" },
  { value: "wrong_info", label: "Wrong phone, website or location" },
  { value: "not_wedding", label: "Not a wedding vendor" },
  { value: "duplicate", label: "Duplicate listing" },
  { value: "other", label: "Something else" },
] as const;

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data: data as any };
}

/**
 * Footer for an UNCLAIMED listing (real business from open data that hasn't joined ChefSire): contact it directly,
 * claim it if you own it, or report it if it's wrong. No quote requests until the owner claims it.
 */
export function WeddingPlanningUnclaimedVendorActions({ vendor }: { vendor: Vendor }) {
  const { toast } = useToast();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  const phoneText = formatPhone(vendor.phone);
  const tel = phoneHref(vendor.phone);

  const claim = async () => {
    setClaiming(true);
    try {
      const { status, ok, data } = await postJson(`/api/wedding/vendor-listings/${vendor.id}/claim`);
      if (status === 401) {
        toast({ title: "Sign in first", description: "Sign in or create a free account, then tap Claim again." });
        return;
      }
      if (!ok) {
        toast({ title: "Couldn't start the claim", description: data?.error || "Please try again.", variant: "destructive" });
        return;
      }
      setClaimed(true);
      toast(
        data?.method === "email"
          ? { title: "Check your business email", description: `We sent a confirmation link to ${data.sentTo}. Open it while signed in to finish.` }
          : { title: "Claim received", description: "We'll verify you own this business and email you once it's approved." },
      );
    } finally {
      setClaiming(false);
    }
  };

  const submitReport = async () => {
    if (!reason) return;
    setReporting(true);
    try {
      const { status, ok, data } = await postJson(`/api/wedding/vendor-listings/${vendor.id}/report`, {
        reason,
        details: details.trim() || undefined,
      });
      if (status === 401) {
        toast({ title: "Sign in first", description: "Sign in to report a listing." });
        return;
      }
      if (!ok) {
        toast({ title: "Couldn't send the report", description: data?.error || "Please try again.", variant: "destructive" });
        return;
      }
      setReported(true);
      setReportOpen(false);
      toast({ title: "Thanks for the report", description: "We'll review this listing." });
    } finally {
      setReporting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
        {tel && phoneText && (
          <a href={tel} className="inline-flex items-center gap-1 text-xs md:text-sm text-pink-600 hover:underline">
            <Phone className="w-3 h-3" /> {phoneText}
          </a>
        )}
        <Button size="sm" variant="outline" className="text-xs" disabled={claiming || claimed} onClick={claim}>
          {claimed ? "Claim requested" : "Own this business? Claim it"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-muted-foreground px-2"
          disabled={reported}
          onClick={() => setReportOpen(true)}
          aria-label={`Report ${vendor.name}`}
        >
          <Flag className="w-3 h-3" />
        </Button>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {vendor.name}</DialogTitle>
            <DialogDescription>What's wrong with this listing?</DialogDescription>
          </DialogHeader>
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-1">
            {REPORT_REASONS.map((r) => (
              <div key={r.value} className="flex items-center gap-2">
                <RadioGroupItem value={r.value} id={`report-${vendor.id}-${r.value}`} />
                <Label htmlFor={`report-${vendor.id}-${r.value}`}>{r.label}</Label>
              </div>
            ))}
          </RadioGroup>
          <Textarea
            placeholder="Anything else we should know? (optional)"
            maxLength={500}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button disabled={!reason || reporting} onClick={submitReport}>Send report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
