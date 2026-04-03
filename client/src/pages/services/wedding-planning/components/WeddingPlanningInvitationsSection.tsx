import type { ReactNode } from "react";
import { Clock, Eye, Heart, Info, Lock, Mail, Plus, Send, Share2, Shield, Sparkles, TrendingUp, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface InvitationGuest {
  id: number | string;
  name: string;
  email: string;
  rsvp: string;
  plusOne: boolean;
  partnerName?: string;
  plusOneName?: string | null;
  respondedAt?: string | null;
}

interface RsvpStats {
  total: number;
  ceremonyTotal: number;
  receptionTotal: number;
  pending: number;
  declined: number;
  acceptedBoth: number;
  ceremonyOnly: number;
  receptionOnly: number;
}

interface RsvpBreakdownRow {
  key: string;
  label: string;
  count: number;
  percent: number;
  tone: "green" | "blue" | "purple" | "red" | "slate";
}

interface WeddingPlanningInvitationsSectionProps {
  isPremium: boolean;
  rsvpStats: RsvpStats;
  respondedGuests: InvitationGuest[];
  rsvpBreakdownRows: RsvpBreakdownRow[];
  onExportRsvpCsv: () => void;
  selectedTemplate: string;
  setSelectedTemplate: (template: string) => void;
  newGuestName: string;
  setNewGuestName: (name: string) => void;
  newGuestEmail: string;
  setNewGuestEmail: (email: string) => void;
  newGuestPartner: string;
  setNewGuestPartner: (partner: string) => void;
  newGuestPlusOneAllowed: boolean;
  setNewGuestPlusOneAllowed: (allowed: boolean) => void;
  onAddGuest: () => void;
  guestList: InvitationGuest[];
  onRemoveGuest: (guestId: number | string) => void;
  onSendInvitations: () => void;
  isPreviewOpen: boolean;
  setIsPreviewOpen: (open: boolean) => void;
  invitationPreview: ReactNode;
  onGoPremium: () => void;
}

export function WeddingPlanningInvitationsSection({
  isPremium,
  rsvpStats,
  respondedGuests,
  rsvpBreakdownRows,
  onExportRsvpCsv,
  selectedTemplate,
  setSelectedTemplate,
  newGuestName,
  setNewGuestName,
  newGuestEmail,
  setNewGuestEmail,
  newGuestPartner,
  setNewGuestPartner,
  newGuestPlusOneAllowed,
  setNewGuestPlusOneAllowed,
  onAddGuest,
  guestList,
  onRemoveGuest,
  onSendInvitations,
  isPreviewOpen,
  setIsPreviewOpen,
  invitationPreview,
  onGoPremium,
}: WeddingPlanningInvitationsSectionProps) {
  const unsentGuestCount = guestList.filter((g) => typeof g.id === "number").length;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
        <div className="text-center p-3 bg-muted rounded-lg">
          <p className="text-xl md:text-2xl font-bold">{rsvpStats.total}</p>
          <p className="text-xs text-muted-foreground">Total Guests</p>
        </div>
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <p className="text-xl md:text-2xl font-bold text-blue-600">{rsvpStats.ceremonyTotal}</p>
          <p className="text-xs text-muted-foreground">Ceremony</p>
        </div>
        <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
          <p className="text-xl md:text-2xl font-bold text-purple-600">{rsvpStats.receptionTotal}</p>
          <p className="text-xs text-muted-foreground">Reception</p>
        </div>
        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
          <p className="text-xl md:text-2xl font-bold text-yellow-600">{rsvpStats.pending}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
          <p className="text-xl md:text-2xl font-bold text-red-600">{rsvpStats.declined}</p>
          <p className="text-xs text-muted-foreground">Declined</p>
        </div>
      </div>

      <Card className="mb-6 border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden relative">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-purple-200/20 blur-3xl" />

        <CardHeader className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-sm">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl md:text-2xl font-bold">RSVP Insights</CardTitle>
                <CardDescription className="text-sm md:text-base">Breakdown by response type + the latest replies.</CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {respondedGuests.length} responded
              </Badge>
              <Button size="sm" variant="outline" onClick={onExportRsvpCsv} disabled={guestList.length === 0} className="h-9">
                <Share2 className="h-4 w-4 mr-2 text-indigo-600" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border bg-white/70 backdrop-blur-sm p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <p className="font-semibold">Response Breakdown</p>
                </div>
                <Badge variant="outline">{rsvpStats.total} total</Badge>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border">
                <div className="grid grid-cols-12 bg-muted/60 px-3 py-2 text-xs font-medium">
                  <div className="col-span-6">Type</div>
                  <div className="col-span-2 text-right">Count</div>
                  <div className="col-span-2 text-right">Share</div>
                  <div className="col-span-2 text-right">Trend</div>
                </div>

                <div className="divide-y bg-white/60">
                  {rsvpBreakdownRows.map((r) => {
                    const bar =
                      r.tone === "green"
                        ? "bg-green-600"
                        : r.tone === "blue"
                        ? "bg-blue-600"
                        : r.tone === "purple"
                        ? "bg-purple-600"
                        : r.tone === "red"
                        ? "bg-red-600"
                        : "bg-slate-400";

                    return (
                      <div key={r.key} className="grid grid-cols-12 items-center px-3 py-2">
                        <div className="col-span-6 flex items-center gap-2 min-w-0">
                          <span className={`h-2.5 w-2.5 rounded-full ${bar}`} />
                          <p className="text-sm font-medium truncate">{r.label}</p>
                        </div>
                        <div className="col-span-2 text-right text-sm font-semibold">{r.count}</div>
                        <div className="col-span-2 text-right text-sm text-muted-foreground">{r.percent}%</div>
                        <div className="col-span-2">
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div className={`h-2 ${bar}`} style={{ width: `${Math.min(100, r.percent)}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="rounded-xl bg-muted/60 p-3">
                  <p className="text-xs text-muted-foreground">Accepted</p>
                  <p className="text-sm font-semibold">{(rsvpStats.acceptedBoth + rsvpStats.ceremonyOnly + rsvpStats.receptionOnly).toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-muted/60 p-3">
                  <p className="text-xs text-muted-foreground">Declined</p>
                  <p className="text-sm font-semibold">{rsvpStats.declined.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-muted/60 p-3">
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-sm font-semibold">{rsvpStats.pending.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-white/70 backdrop-blur-sm p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <p className="font-semibold">Recent Responses</p>
                </div>
                <Badge variant="secondary">Latest</Badge>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border">
                <div className="grid grid-cols-12 bg-muted/60 px-3 py-2 text-xs font-medium">
                  <div className="col-span-6">Guest</div>
                  <div className="col-span-3">RSVP</div>
                  <div className="col-span-3 text-right">When</div>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y bg-white/60">
                  {respondedGuests.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">No responses yet.</div>
                  ) : (
                    respondedGuests.slice(0, 12).map((guest) => (
                      <div key={String(guest.id)} className="grid grid-cols-12 items-center px-3 py-2">
                        <div className="col-span-6 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {guest.partnerName ? `${guest.name} & ${guest.partnerName}` : guest.plusOneName ? `${guest.name} & ${guest.plusOneName}` : guest.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">{guest.email}</p>
                        </div>

                        <div className="col-span-3">
                          <Badge
                            variant={guest.rsvp === "accepted" || guest.rsvp === "accept-both" ? "default" : guest.rsvp === "declined" ? "destructive" : "secondary"}
                            className="text-[10px] capitalize"
                          >
                            {guest.rsvp}
                          </Badge>
                        </div>

                        <div className="col-span-3 text-right text-[11px] text-muted-foreground">
                          {guest.respondedAt ? new Date(guest.respondedAt).toLocaleString() : "—"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-muted/60 p-3">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-sky-600" />
                  <p className="text-xs text-muted-foreground">Export Guest CSV (includes pending + unsent guests) to share with your partner or planner.</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-sm">
            <Mail className="h-4 w-4 text-white" />
          </div>
          <label className="text-sm font-medium block">Invitation Template</label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {["elegant", "rustic", "modern"].map((template) => (
            <button
              key={template}
              onClick={() => setSelectedTemplate(template)}
              className={`p-4 border-2 rounded-lg text-center capitalize transition-all ${
                selectedTemplate === template ? "border-pink-500 bg-pink-50 dark:bg-pink-950" : "border-gray-200 hover:border-gray-300"
              } ${!isPremium ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              disabled={!isPremium}
            >
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-purple-600" />
              <p className="text-sm font-medium">{template}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 p-4 bg-muted rounded-lg">
        <h4 className="font-medium mb-3 text-sm">Add Guest</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Guest Name (e.g., John Smith)" value={newGuestName} onChange={(e) => setNewGuestName(e.target.value)} className="text-sm" />
            <Input type="email" placeholder="Email Address" value={newGuestEmail} onChange={(e) => setNewGuestEmail(e.target.value)} className="text-sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              placeholder="Partner/Plus-One Name (optional)"
              value={newGuestPartner}
              onChange={(e) => setNewGuestPartner(e.target.value)}
              className="text-sm"
            />
            <label className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
              <input type="checkbox" className="rounded" checked={newGuestPlusOneAllowed} onChange={(e) => setNewGuestPlusOneAllowed(e.target.checked)} />
              Allow plus-one even if no name provided
            </label>
          </div>

          <Button onClick={onAddGuest} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Guest
          </Button>

          <p className="text-xs text-muted-foreground">💡 Tip: Add a partner/plus-one name to send one invitation to a couple (e.g., "John & Jane Smith")</p>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-medium mb-3 text-sm">Guest List ({guestList.length})</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {guestList.map((guest) => (
            <div key={String(guest.id)} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {guest.partnerName ? `${guest.name} & ${guest.partnerName}` : guest.plusOneName ? `${guest.name} & ${guest.plusOneName}` : guest.name}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground truncate">{guest.email}</p>
                  {guest.plusOne && !guest.partnerName && !guest.plusOneName && (
                    <Badge variant="secondary" className="text-[10px]">
                      Plus-one allowed
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={guest.rsvp === "accepted" || guest.rsvp === "accept-both" ? "default" : guest.rsvp === "declined" ? "destructive" : "secondary"}
                  className={`text-xs ${
                    guest.rsvp === "ceremony-only"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      : guest.rsvp === "reception-only"
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-blue-200"
                      : ""
                  }`}
                >
                  {guest.rsvp === "accept-both"
                    ? "Both Events"
                    : guest.rsvp === "ceremony-only"
                    ? "Ceremony Only"
                    : guest.rsvp === "reception-only"
                    ? "Reception Only"
                    : guest.rsvp === "accepted"
                    ? "Accepted"
                    : guest.rsvp === "declined"
                    ? "Declined"
                    : "Pending"}
                </Badge>

                <Button size="sm" variant="ghost" onClick={() => onRemoveGuest(guest.id)} className="p-1">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {isPremium ? (
          <>
            <Button className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 text-white" onClick={onSendInvitations} disabled={unsentGuestCount === 0}>
              <Send className="w-4 h-4 mr-2" />
              Send Invitations ({unsentGuestCount})
            </Button>

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1 border-pink-200 hover:bg-pink-50">
                  <Eye className="w-4 h-4 mr-2 text-pink-600" />
                  Preview Invitation
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg overflow-hidden">
                <DialogHeader>
                  <DialogTitle>Invitation Preview</DialogTitle>
                  <p className="text-xs text-muted-foreground">This is exactly what your guests will see in their email.</p>
                </DialogHeader>

                {invitationPreview}

                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="ghost" onClick={() => setIsPreviewOpen(false)}>
                    Close
                  </Button>
                  <Button
                    className="bg-pink-600"
                    onClick={() => {
                      setIsPreviewOpen(false);
                      onSendInvitations();
                    }}
                    disabled={guestList.length === 0}
                  >
                    Confirm & Send
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <Button variant="outline" className="flex-1 border-pink-300 bg-pink-50" onClick={onGoPremium}>
            <Heart className="w-4 h-4 mr-2 text-pink-200" />
            Upgrade to Premium
          </Button>
        )}
      </div>

      {!isPremium && (
        <Alert className="mt-4 border-pink-300 bg-pink-50/50">
          <Lock className="h-4 h-4 text-pink-600" />
          <AlertDescription className="text-sm">
            Upgrade to Premium to send unlimited email invitations with beautiful templates and automatic RSVP tracking.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
