import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CalendarDays, ChefHat, Loader2, MapPin, MessageCircle, Navigation, Share2, Store, Users } from "lucide-react";
import type { PublicCateringProvider } from "@shared/catering";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cateringProviderActionState, localCalendarDate } from "./catering-provider-actions";

class ProviderRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

async function fetchProvider(providerId: string): Promise<PublicCateringProvider> {
  const response = await fetch(`/api/catering/providers/${encodeURIComponent(providerId)}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ProviderRequestError(body.message || "Unable to load provider", response.status, body.code);
  return body.provider;
}

function ProfileSkeleton() {
  return <div className="mx-auto max-w-5xl space-y-6 px-4 py-8" role="status" aria-label="Loading provider profile">
    <Skeleton className="h-5 w-44" />
    <Card><CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:p-8"><Skeleton className="h-28 w-28 rounded-full" /><div className="flex-1 space-y-3"><Skeleton className="h-9 w-64 max-w-full" /><Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-full" /></div></CardContent></Card>
    <div className="grid gap-6 md:grid-cols-3"><Skeleton className="h-64 md:col-span-2" /><Skeleton className="h-64" /></div>
  </div>;
}

export default function CateringPublicProvider({ params }: { params: { providerId: string } }) {
  const { user, loading: isAuthLoading } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quote, setQuote] = useState({ eventDate: "", guestCount: "", eventType: "", message: "" });
  const providerQuery = useQuery({
    queryKey: ["catering", "provider", params.providerId],
    queryFn: () => fetchProvider(params.providerId),
    retry: (count, error) => !(error instanceof ProviderRequestError && error.status < 500) && count < 2,
  });

  const messageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/dm/threads", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ participantIds: [params.providerId] }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Unable to start a conversation");
      return body as { threadId: string };
    },
    onSuccess: ({ threadId }) => navigate(`/messages/${threadId}`),
    onError: (error: Error) => toast({ title: "Could not start message", description: error.message, variant: "destructive" }),
  });

  const quoteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/catering/inquiries", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chefId: params.providerId, eventDate: quote.eventDate, timezoneOffsetMinutes: new Date().getTimezoneOffset(), guestCount: quote.guestCount ? Number(quote.guestCount) : undefined, eventType: quote.eventType || undefined, message: quote.message || undefined }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Unable to send quote request");
    },
    onSuccess: () => { setQuoteOpen(false); toast({ title: "Quote request sent", description: "The provider can now review your event request." }); queryClient.invalidateQueries({ queryKey: ["catering", "inquiries"] }); },
    onError: (error: Error) => toast({ title: "Quote request not sent", description: error.message, variant: "destructive" }),
  });

  if (providerQuery.isLoading) return <ProfileSkeleton />;
  if (providerQuery.isError) {
    const error = providerQuery.error;
    const unavailable = error instanceof ProviderRequestError && (error.status === 410 || error.code === "PROVIDER_UNAVAILABLE");
    const missing = error instanceof ProviderRequestError && error.status === 404;
    return <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-4 text-center"><div className="mb-5 rounded-full bg-orange-50 p-5"><ChefHat className="h-10 w-10 text-orange-600" /></div><h1 className="text-2xl font-bold">{unavailable ? "Provider currently unavailable" : missing ? "Provider not found" : "We couldn’t load this profile"}</h1><p className="mt-3 text-muted-foreground">{unavailable ? "This catering provider is no longer listed in the marketplace." : missing ? "The profile may have moved or the link may be incorrect." : "Please try again in a moment."}</p><div className="mt-6 flex gap-3">{!unavailable && !missing && <Button variant="outline" onClick={() => providerQuery.refetch()}>Try again</Button>}<Button asChild><Link href="/services/catering">Back to Marketplace</Link></Button></div></div>;
  }

  const provider = providerQuery.data!;
  const actionState = cateringProviderActionState(isAuthLoading, user?.id, provider.id);
  const requireSignIn = () => {
    if (!actionState.canResolveAuthentication) return false;
    if (user) return true;
    const next = encodeURIComponent(`/services/catering/provider/${provider.id}`);
    navigate(`/login?next=${next}`);
    return false;
  };
  const requestQuote = () => { if (requireSignIn()) setQuoteOpen(true); };
  const message = () => { if (requireSignIn()) messageMutation.mutate(); };
  const share = async () => {
    const shareData = { title: `${provider.displayName} on ChefSire`, text: `View ${provider.displayName}'s catering profile`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(window.location.href); toast({ title: "Profile link copied" }); }
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast({ title: "Unable to share", variant: "destructive" }); }
  };

  return <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:pb-10 sm:pt-8">
    <Link href="/services/catering" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="h-4 w-4" />Back to Marketplace</Link>
    <Card className="overflow-hidden border-orange-100 shadow-sm"><div className="h-24 bg-gradient-to-r from-orange-100 via-amber-50 to-rose-50" /><CardContent className="relative p-6 pt-0 sm:p-8 sm:pt-0"><div className="flex flex-col gap-5 sm:flex-row sm:items-end"><Avatar className="-mt-14 h-28 w-28 border-4 border-background bg-background shadow"><AvatarImage src={provider.avatar ?? undefined} alt={`${provider.displayName} logo`} /><AvatarFallback className="bg-orange-100 text-3xl text-orange-700">{provider.displayName.charAt(0).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0 flex-1 sm:pb-1"><div className="flex flex-wrap items-center gap-3"><h1 className="break-words text-3xl font-bold tracking-tight">{provider.displayName}</h1><Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><Store className="mr-1 h-3 w-3" />Marketplace enabled</Badge></div>{provider.specialty ? <p className="mt-2 text-lg text-muted-foreground">{provider.specialty}</p> : <p className="mt-2 italic text-muted-foreground">Specialty not provided</p>}</div><Button variant="outline" onClick={share} className="hidden sm:inline-flex"><Share2 className="mr-2 h-4 w-4" />Share</Button></div></CardContent></Card>

    <div className="mt-6 grid gap-6 md:grid-cols-3"><Card className="md:col-span-2"><CardHeader><CardTitle>About this catering service</CardTitle></CardHeader><CardContent>{provider.cateringBio ? <p className="whitespace-pre-wrap leading-7 text-muted-foreground">{provider.cateringBio}</p> : <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">This provider has not added a catering bio yet.</div>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Service details</CardTitle></CardHeader><CardContent className="space-y-5"><div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" /><div><p className="font-medium">Service location</p><p className="text-sm text-muted-foreground">{provider.cateringLocation || "Not provided"}</p></div></div><div className="flex gap-3"><Navigation className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" /><div><p className="font-medium">Travel radius</p><p className="text-sm text-muted-foreground">{provider.cateringRadius == null ? "Not provided" : `Up to ${provider.cateringRadius} miles`}</p></div></div><div className="flex gap-3"><Users className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" /><div><p className="font-medium">Availability</p><p className="text-sm text-muted-foreground">{provider.cateringAvailable ? "Accepting event inquiries" : "Not accepting inquiries right now"}</p></div></div></CardContent></Card>
    </div>
    <Card className="mt-6 hidden sm:block"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-6"><div><p className="font-semibold">Planning an event?</p><p className="text-sm text-muted-foreground">{actionState.isAuthLoading ? "Checking your account…" : "Send real event details or begin a private conversation."}</p></div><div className="flex gap-3"><Button variant="outline" onClick={message} disabled={actionState.isAuthLoading || messageMutation.isPending || actionState.isSelf}><MessageCircle className="mr-2 h-4 w-4" />{actionState.isAuthLoading ? "Checking…" : "Message"}</Button><Button onClick={requestQuote} disabled={actionState.isAuthLoading || !provider.cateringAvailable || actionState.isSelf}><CalendarDays className="mr-2 h-4 w-4" />{actionState.isAuthLoading ? "Checking…" : "Request Quote"}</Button></div></CardContent></Card>

    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,.08)] backdrop-blur sm:hidden"><div className="mx-auto grid max-w-lg grid-cols-3 gap-2"><Button variant="outline" size="sm" onClick={share}><Share2 className="mr-1 h-4 w-4" />Share</Button><Button variant="outline" size="sm" onClick={message} disabled={actionState.isAuthLoading || messageMutation.isPending || actionState.isSelf}><MessageCircle className="mr-1 h-4 w-4" />{actionState.isAuthLoading ? "Checking…" : "Message"}</Button><Button size="sm" onClick={requestQuote} disabled={actionState.isAuthLoading || !provider.cateringAvailable || actionState.isSelf}><CalendarDays className="mr-1 h-4 w-4" />{actionState.isAuthLoading ? "Checking…" : "Quote"}</Button></div></div>

    <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}><DialogContent><DialogHeader><DialogTitle>Request a quote from {provider.displayName}</DialogTitle><DialogDescription>Share your event details. This sends a real inquiry to the provider.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!isAuthLoading) quoteMutation.mutate(); }}><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="quote-date">Event date</Label><Input id="quote-date" type="date" min={localCalendarDate()} required value={quote.eventDate} onChange={(e) => setQuote({ ...quote, eventDate: e.target.value })} /></div><div><Label htmlFor="quote-guests">Guest count</Label><Input id="quote-guests" type="number" min="1" value={quote.guestCount} onChange={(e) => setQuote({ ...quote, guestCount: e.target.value })} /></div></div><div><Label htmlFor="quote-type">Event type</Label><Input id="quote-type" placeholder="Wedding, corporate event, private dinner…" value={quote.eventType} onChange={(e) => setQuote({ ...quote, eventType: e.target.value })} /></div><div><Label htmlFor="quote-message">Event details</Label><Textarea id="quote-message" rows={4} placeholder="Location, menu preferences, dietary needs, and other helpful details" value={quote.message} onChange={(e) => setQuote({ ...quote, message: e.target.value })} /></div><Button className="w-full" type="submit" disabled={isAuthLoading || quoteMutation.isPending}>{quoteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send quote request</Button></form></DialogContent></Dialog>
  </div>;
}
