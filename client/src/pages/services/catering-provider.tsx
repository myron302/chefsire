import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChefHat, Loader2, MapPin } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PortfolioManager } from "@/components/catering/PortfolioManager";
import { PackageManager } from "@/components/catering/PackageManager";
import { AvailabilityManager } from "@/components/catering/AvailabilityManager";
import { CateringReviews } from "@/components/catering/CateringReviews";
import { ProviderDashboardOverview, cateringDashboardKey } from "@/components/catering/ProviderDashboardOverview";
import { cateringDashboardSectionState, type CateringDashboardSection } from "@shared/catering-dashboard";
import { formatCateringCalendarDate } from "@shared/catering-availability";

type ProviderForm = { displayName: string; avatar: string; specialty: string; location: string; radius: string; bio: string; enabled: boolean };

export default function CateringProviderPage() {
  const { user, loading, refreshUser } = useUser();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProviderForm | null>(null);
  const [formUserId, setFormUserId] = useState<string | null>(null);
  const [section, setSection] = useState<"overview" | CateringDashboardSection>("overview");

  useEffect(() => {
    if (!loading && !user) navigate("/login?next=%2Fservices%2Fcatering%2Fprovider", { replace: true });
  }, [loading, navigate, user]);
  useEffect(() => {
    if (!user || formUserId === user.id) return;
    setForm({ displayName: user.displayName || user.username || "", avatar: user.avatar || "", specialty: user.specialty ?? "", location: user.cateringLocation ?? "", radius: user.cateringRadius == null ? "" : String(user.cateringRadius), bio: user.cateringBio ?? "", enabled: user.cateringEnabled ?? false });
    setFormUserId(user.id);
    setSection("overview");
  }, [formUserId, user]);
  const update = <K extends keyof ProviderForm>(key: K, value: ProviderForm[K]) => setForm((current) => current ? { ...current, [key]: value } : current);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !form) return;
    setError("");
    const radius = Number(form.radius);
    if (!Number.isInteger(radius) || radius < 5 || radius > 100) return setError("Service radius must be a whole number between 5 and 100 miles.");
    setSaving(true);
    try {
      const response = await fetch(`/api/catering/users/${user.id}/profile`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, radius }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to save your catering profile.");
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ["/api/catering/chefs/search"] });
      toast({ title: "Catering profile saved", description: form.enabled ? "Your catering profile was saved. Manage inquiry acceptance in the Availability section." : "Your catering profile was saved and is currently hidden from the marketplace." });
      await queryClient.invalidateQueries({ queryKey: cateringDashboardKey(user.id) });
      setSection("overview");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save your catering profile."); }
    finally { setSaving(false); }
  };

  if (loading || !user || !form) return <div className="min-h-[50vh] flex items-center justify-center" role="status"><Loader2 className="h-7 w-7 animate-spin mr-2" /> Loading catering profile…</div>;
  const sections = ["overview", "profile", "inquiries", "packages", "portfolio", "availability", "reviews"] as const;
  return <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-10">
    <Link href="/services/catering" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-5"><ArrowLeft className="w-4 h-4 mr-1" /> Catering marketplace</Link>
    <div className="mb-6"><h1 className="text-2xl font-bold sm:text-3xl">Catering business command center</h1><p className="mt-1 text-muted-foreground">Manage your marketplace presence, requests, and customer-facing content.</p></div>
    <nav aria-label="Catering dashboard sections" className="mb-6 flex flex-wrap gap-2">{sections.map((item) => <Button key={item} className="min-h-11 capitalize" variant={section === item ? "default" : "outline"} aria-current={section === item ? "page" : undefined} onClick={() => setSection(item)}>{item}</Button>)}</nav>
    {section === "overview" && <ProviderDashboardOverview providerId={user.id} openSection={setSection} />}
    {section === "profile" && <Card><CardHeader><div className="flex items-center gap-3"><div className="rounded-full bg-orange-100 p-3"><ChefHat className="h-6 w-6 text-orange-700" /></div><div><CardTitle>{user.cateringEnabled ? "Edit your catering service" : "List your catering service"}</CardTitle><CardDescription>These details power your real marketplace listing and service-area search.</CardDescription></div></div></CardHeader>
      <CardContent><form onSubmit={submit} className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="businessName">Business or display name *</Label><Input id="businessName" value={form.displayName} onChange={(e) => update("displayName", e.target.value)} minLength={2} maxLength={100} required /></div><div className="space-y-2"><Label htmlFor="specialty">Catering specialty *</Label><Input id="specialty" value={form.specialty} onChange={(e) => update("specialty", e.target.value)} placeholder="Italian, weddings, plant-based…" minLength={2} maxLength={100} required /></div></div>
        <div className="space-y-2"><Label htmlFor="avatar">Profile image URL</Label><Input id="avatar" type="url" value={form.avatar} onChange={(e) => update("avatar", e.target.value)} placeholder="https://…" /></div>
        <div className="grid gap-5 sm:grid-cols-[1fr_180px]"><div className="space-y-2"><Label htmlFor="location">Service location *</Label><div className="relative"><MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="location" className="pl-9" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="City, state or ZIP code" minLength={2} maxLength={200} required /></div></div><div className="space-y-2"><Label htmlFor="radius">Travel radius (miles) *</Label><Input id="radius" type="number" min={5} max={100} step={1} value={form.radius} onChange={(e) => update("radius", e.target.value)} required /></div></div>
        <div className="space-y-2"><Label htmlFor="bio">Catering description *</Label><Textarea id="bio" rows={5} value={form.bio} onChange={(e) => update("bio", e.target.value)} minLength={20} maxLength={1000} required /><p className="text-xs text-muted-foreground">{form.bio.length}/1000 characters (minimum 20)</p></div>
        <div className="rounded-lg border p-4"><div className="flex items-center justify-between gap-4"><div><Label htmlFor="enabled">Marketplace listing enabled</Label><p className="text-sm text-muted-foreground">Turn this off to hide your catering profile. Manage inquiry acceptance in Availability below.</p></div><Switch id="enabled" checked={form.enabled} onCheckedChange={(value) => update("enabled", value)} /></div></div>
        {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3"><Button type="button" variant="outline" asChild><Link href="/services/catering">Cancel</Link></Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? "Saving…" : "Save catering profile"}</Button></div>
      </form></CardContent></Card>}
    {section === "inquiries" && <InquiryManager providerId={user.id} />}
    {section === "portfolio" && <PortfolioManager providerId={user.id} enabled={Boolean(user.cateringEnabled)} />}
    {section === "availability" && (cateringDashboardSectionState("availability", Boolean(user.cateringEnabled)) === "manager" ? <AvailabilityManager providerId={user.id} enabled /> : <ListingRequiredState title="Availability" description="Enable your marketplace listing before configuring inquiry availability." openProfile={() => setSection("profile")} />)}
    {section === "packages" && <PackageManager providerId={user.id} enabled={Boolean(user.cateringEnabled)} />}
    {section === "reviews" && (user.cateringEnabled ? <Card><CardContent className="p-4 sm:p-6"><CateringReviews providerId={user.id} providerMode /></CardContent></Card> : <Card><CardContent className="p-6 text-muted-foreground">Enable and save your marketplace listing to manage public reviews.</CardContent></Card>)}
  </main>;
}

function ListingRequiredState({ title, description, openProfile }: { title: string; description: string; openProfile: () => void }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent><Button className="min-h-11" onClick={openProfile}>Enable marketplace listing</Button></CardContent></Card>;
}

type Inquiry = { id: string; status: string | null; eventDate: string; eventType: string | null; guestCount: number | null; message: string | null; booking: { id: string; status: string } | null };
function InquiryManager({ providerId }: { providerId: string }) {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const limit = 20;
  const key = ["catering", "inquiries", providerId, page, limit] as const;
  useEffect(() => setPage(1), [providerId]);
  const query = useQuery({ queryKey: key, queryFn: async (): Promise<{ inquiries: Inquiry[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => { const response = await fetch(`/api/catering/users/${providerId}/inquiries?page=${page}&limit=${limit}`, { credentials: "include" }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || "Inquiries could not be loaded"); return body; }, staleTime: 60_000, refetchOnWindowFocus: true });
  const mutation = useMutation({ mutationFn: async ({ id, status }: { id: string; status: "accepted" | "declined" }) => { const response = await fetch(`/api/catering/inquiries/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || "Inquiry could not be updated"); }, onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ["catering", "inquiries", providerId] }), client.invalidateQueries({ queryKey: cateringDashboardKey(providerId) })]); } });
  const inquiries = query.data?.inquiries;
  const pagination = query.data?.pagination;
  return <Card><CardHeader><CardTitle>Inquiries</CardTitle><CardDescription>Customer quote requests. Accepted requests are not described as paid or confirmed bookings.</CardDescription></CardHeader><CardContent>{query.isLoading ? <p role="status">Loading inquiries…</p> : query.isError ? <div role="alert" className="space-y-3"><p>Inquiries could not be loaded.</p><Button variant="outline" onClick={() => query.refetch()}>Retry</Button></div> : inquiries?.length ? <div className="space-y-3">{inquiries.map((item) => <article key={item.id} className="min-w-0 rounded-lg border p-4"><div className="flex flex-wrap justify-between gap-2"><h2 className="break-words font-semibold">{item.eventType || "Catering request"}</h2><span className="rounded-full border px-2 py-1 text-xs capitalize">{item.booking?.status.replaceAll("_", " ") || item.status || "pending"}</span></div><p className="mt-2 text-sm">Requested event date: {formatCateringCalendarDate(item.eventDate)}{item.guestCount ? ` · ${item.guestCount} guests` : ""}</p>{item.message && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.message}</p>}{item.status === "pending" && <div className="mt-3 flex flex-wrap gap-2"><Button disabled={mutation.isPending} onClick={() => mutation.mutate({ id: item.id, status: "accepted" })}>Accept request</Button><Button disabled={mutation.isPending} variant="outline" onClick={() => mutation.mutate({ id: item.id, status: "declined" })}>Decline request</Button></div>}{item.booking && <Link href={`/services/catering/provider/bookings/${item.booking.id}`}><Button className="mt-3 min-h-11" variant="outline">Manage event</Button></Link>}</article>)}</div> : <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">No inquiries have been received yet.</p>}{mutation.isError && <p className="mt-3 text-destructive" role="alert">{mutation.error.message}</p>}{pagination && pagination.totalPages > 0 && <nav aria-label="Inquiry pages" className="mt-5 flex flex-wrap items-center justify-between gap-3"><Button className="min-h-11" variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button><p className="text-sm" aria-live="polite">Page {pagination.page} of {pagination.totalPages}</p><Button className="min-h-11" variant="outline" disabled={page >= pagination.totalPages || query.isFetching} onClick={() => setPage((current) => current + 1)}>Next</Button></nav>}</CardContent></Card>;
}
