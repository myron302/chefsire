import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
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

type ProviderForm = { displayName: string; avatar: string; specialty: string; location: string; radius: string; bio: string; enabled: boolean };

export default function CateringProviderPage() {
  const { user, loading, refreshUser } = useUser();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProviderForm | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login?next=%2Fservices%2Fcatering%2Fprovider", { replace: true });
  }, [loading, navigate, user]);
  useEffect(() => {
    if (!user || form) return;
    setForm({ displayName: user.displayName || user.username || "", avatar: user.avatar || "", specialty: user.specialty ?? "", location: user.cateringLocation ?? "", radius: user.cateringRadius == null ? "" : String(user.cateringRadius), bio: user.cateringBio ?? "", enabled: user.cateringEnabled ?? false });
  }, [form, user]);
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
      navigate("/services/catering");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save your catering profile."); }
    finally { setSaving(false); }
  };

  if (loading || !user || !form) return <div className="min-h-[50vh] flex items-center justify-center" role="status"><Loader2 className="h-7 w-7 animate-spin mr-2" /> Loading catering profile…</div>;
  return <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
    <Link href="/services/catering" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-5"><ArrowLeft className="w-4 h-4 mr-1" /> Catering marketplace</Link>
    <Card><CardHeader><div className="flex items-center gap-3"><div className="rounded-full bg-orange-100 p-3"><ChefHat className="h-6 w-6 text-orange-700" /></div><div><CardTitle>{user.cateringEnabled ? "Edit your catering service" : "List your catering service"}</CardTitle><CardDescription>These details power your real marketplace listing and service-area search.</CardDescription></div></div></CardHeader>
      <CardContent><form onSubmit={submit} className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="businessName">Business or display name *</Label><Input id="businessName" value={form.displayName} onChange={(e) => update("displayName", e.target.value)} minLength={2} maxLength={100} required /></div><div className="space-y-2"><Label htmlFor="specialty">Catering specialty *</Label><Input id="specialty" value={form.specialty} onChange={(e) => update("specialty", e.target.value)} placeholder="Italian, weddings, plant-based…" minLength={2} maxLength={100} required /></div></div>
        <div className="space-y-2"><Label htmlFor="avatar">Profile image URL</Label><Input id="avatar" type="url" value={form.avatar} onChange={(e) => update("avatar", e.target.value)} placeholder="https://…" /></div>
        <div className="grid gap-5 sm:grid-cols-[1fr_180px]"><div className="space-y-2"><Label htmlFor="location">Service location *</Label><div className="relative"><MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="location" className="pl-9" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="City, state or ZIP code" minLength={2} maxLength={200} required /></div></div><div className="space-y-2"><Label htmlFor="radius">Travel radius (miles) *</Label><Input id="radius" type="number" min={5} max={100} step={1} value={form.radius} onChange={(e) => update("radius", e.target.value)} required /></div></div>
        <div className="space-y-2"><Label htmlFor="bio">Catering description *</Label><Textarea id="bio" rows={5} value={form.bio} onChange={(e) => update("bio", e.target.value)} minLength={20} maxLength={1000} required /><p className="text-xs text-muted-foreground">{form.bio.length}/1000 characters (minimum 20)</p></div>
        <div className="rounded-lg border p-4"><div className="flex items-center justify-between gap-4"><div><Label htmlFor="enabled">Marketplace listing enabled</Label><p className="text-sm text-muted-foreground">Turn this off to hide your catering profile. Manage inquiry acceptance in Availability below.</p></div><Switch id="enabled" checked={form.enabled} onCheckedChange={(value) => update("enabled", value)} /></div></div>
        {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3"><Button type="button" variant="outline" asChild><Link href="/services/catering">Cancel</Link></Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? "Saving…" : "Save catering profile"}</Button></div>
      </form></CardContent></Card>
    <div className="mt-6"><PortfolioManager providerId={user.id} enabled={Boolean(user.cateringEnabled)} /></div>
    <div className="mt-6"><AvailabilityManager providerId={user.id} enabled={Boolean(user.cateringEnabled)} /></div>
    <div className="mt-6"><PackageManager providerId={user.id} enabled={Boolean(user.cateringEnabled)} /></div>
  </main>;
}
