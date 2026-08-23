import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CalendarDays, Loader2, RotateCcw, Trash2 } from "lucide-react";
import type { AvailabilityException, AvailabilitySettings, WeeklyRule } from "@shared/catering-availability";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { replaceWeeklyRule } from "./availability-actions";

type Data = { settings: AvailabilitySettings; rules: WeeklyRule[]; exceptions: AvailabilityException[] };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const queryKey = (providerId: string) => ["catering", "availability", providerId] as const;

async function availabilityRequest(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, credentials: "include", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Availability was not saved");
  return data;
}

export function AvailabilityManager({ providerId, enabled }: { providerId: string; enabled: boolean }) {
  const client = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({
    queryKey: queryKey(providerId),
    queryFn: async (): Promise<Data> => {
      const response = await fetch(`/api/catering/users/${providerId}/availability`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load availability");
      return response.json();
    },
    enabled,
  });
  const [settingsDraft, setSettingsDraft] = useState<AvailabilitySettings>();
  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyRule[]>([]);
  const [range, setRange] = useState({ startDate: "", endDate: "", type: "blocked" as "blocked" | "available", reason: "" });
  const [deletingId, setDeletingId] = useState<string>();
  const invalidateAvailabilitySurfaces = () => Promise.all([
    client.invalidateQueries({ queryKey: queryKey(providerId) }),
    client.invalidateQueries({ queryKey: ["/api/catering/chefs/search"] }),
    client.invalidateQueries({ queryKey: ["catering", "provider", providerId] }),
    client.invalidateQueries({ queryKey: ["catering", "date-availability", providerId] }),
  ]);

  const settingsMutation = useMutation({
    mutationFn: (settings: AvailabilitySettings) => availabilityRequest(`/api/catering/users/${providerId}/availability/settings`, "PUT", settings),
    onSuccess: invalidateAvailabilitySurfaces,
    onError: (error: Error) => { setSettingsDraft(query.data?.settings); toast({ title: "Settings not saved", description: error.message, variant: "destructive" }); },
  });
  const weeklyMutation = useMutation({
    mutationFn: (rules: WeeklyRule[]) => availabilityRequest(`/api/catering/users/${providerId}/availability/weekly`, "PUT", { rules }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKey(providerId) }),
    onError: (error: Error) => { setWeeklyDraft(query.data?.rules ?? []); toast({ title: "Weekly availability not saved", description: error.message, variant: "destructive" }); },
  });
  const addMutation = useMutation({
    mutationFn: () => availabilityRequest(`/api/catering/users/${providerId}/availability/exceptions`, "POST", { ...range, endDate: range.endDate || range.startDate, reason: range.reason || null }),
    onSuccess: () => { setRange({ startDate: "", endDate: "", type: "blocked", reason: "" }); client.invalidateQueries({ queryKey: queryKey(providerId) }); },
    onError: (error: Error) => toast({ title: "Dates not added", description: error.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => availabilityRequest(`/api/catering/users/${providerId}/availability/exceptions/${id}`, "DELETE"),
    onMutate: setDeletingId,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKey(providerId) }),
    onError: (error: Error) => toast({ title: "Dates not removed", description: error.message, variant: "destructive" }),
    onSettled: () => setDeletingId(undefined),
  });

  useEffect(() => { if (query.data && !settingsMutation.isPending) setSettingsDraft(query.data.settings); }, [query.data, settingsMutation.isPending]);
  useEffect(() => { if (query.data && !weeklyMutation.isPending) setWeeklyDraft(query.data.rules); }, [query.data, weeklyMutation.isPending]);

  if (!enabled) return null;
  if (query.isLoading) return <Card><CardContent className="p-6" role="status"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading availability…</CardContent></Card>;
  if (query.isError || !query.data || !settingsDraft) return <Card><CardContent className="space-y-4 p-6" role="alert"><div className="flex gap-2"><AlertCircle className="h-5 w-5 text-destructive" /><div><p className="font-medium">Availability could not be loaded</p><p className="text-sm text-muted-foreground">Please try again. Your saved calendar has not been changed.</p></div></div><Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RotateCcw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Retry</Button></CardContent></Card>;

  const saveSettings = (next: AvailabilitySettings) => { setSettingsDraft(next); settingsMutation.mutate(next); };
  const submitRange = (event: FormEvent) => { event.preventDefault(); if (!addMutation.isPending) addMutation.mutate(); };
  const ruleMap = new Map(weeklyDraft.map((rule) => [rule.dayOfWeek, rule.available]));
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />Availability</CardTitle><CardDescription>Inquiry dates are requests only and are not confirmed bookings.</CardDescription></CardHeader><CardContent className="space-y-6">
    <div className="flex items-center justify-between gap-4"><div><Label>Accepting inquiries</Label><p className="text-sm text-muted-foreground">Immediately pause all new quote requests.</p></div><Switch checked={settingsDraft.acceptingBookings} disabled={settingsMutation.isPending} onCheckedChange={(acceptingBookings) => saveSettings({ ...settingsDraft, acceptingBookings })} /></div>
    <div className="grid gap-4 sm:grid-cols-3"><div><Label htmlFor="lead-days">Minimum lead days</Label><Input id="lead-days" type="number" min={0} max={1095} value={settingsDraft.minimumLeadDays} disabled={settingsMutation.isPending} onChange={(e) => setSettingsDraft({ ...settingsDraft, minimumLeadDays: Number(e.target.value) })} onBlur={() => settingsMutation.mutate(settingsDraft)} /></div><div><Label htmlFor="advance-days">Maximum advance days</Label><Input id="advance-days" type="number" min={0} max={1095} value={settingsDraft.maximumAdvanceDays} disabled={settingsMutation.isPending} onChange={(e) => setSettingsDraft({ ...settingsDraft, maximumAdvanceDays: Number(e.target.value) })} onBlur={() => settingsMutation.mutate(settingsDraft)} /></div><div><Label htmlFor="timezone">Business timezone</Label><Input id="timezone" value={settingsDraft.timezone} disabled={settingsMutation.isPending} onChange={(e) => setSettingsDraft({ ...settingsDraft, timezone: e.target.value })} onBlur={() => settingsMutation.mutate(settingsDraft)} /></div></div>
    <div><Label>Weekly availability</Label><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{DAYS.map((day, dayOfWeek) => <label key={day} className="flex items-center justify-between rounded border p-2 text-sm">{day}<Switch checked={ruleMap.get(dayOfWeek) !== false} disabled={weeklyMutation.isPending} onCheckedChange={(available) => { const next = replaceWeeklyRule(weeklyDraft, dayOfWeek, available); setWeeklyDraft(next); weeklyMutation.mutate(next); }} /></label>)}</div></div>
    <form className="space-y-3 rounded border p-4" onSubmit={submitRange}><Label>Block dates or add an override</Label><div className="grid gap-3 sm:grid-cols-4"><Input aria-label="Start date" type="date" required value={range.startDate} onChange={(e) => setRange({ ...range, startDate: e.target.value })} /><Input aria-label="End date" type="date" min={range.startDate} value={range.endDate} onChange={(e) => setRange({ ...range, endDate: e.target.value })} /><select className="rounded-md border bg-background px-3" value={range.type} onChange={(e) => setRange({ ...range, type: e.target.value as "blocked" | "available" })}><option value="blocked">Blocked</option><option value="available">Available override</option></select><Button disabled={addMutation.isPending}>{addMutation.isPending ? "Adding…" : "Add dates"}</Button></div><Input placeholder="Private reason (optional)" maxLength={300} value={range.reason} onChange={(e) => setRange({ ...range, reason: e.target.value })} /></form>
    <div><Label>Upcoming exceptions</Label><div className="mt-2 space-y-2">{query.data.exceptions.length === 0 ? <p className="text-sm text-muted-foreground">No date exceptions.</p> : query.data.exceptions.map((item) => <div key={item.id} className="flex items-center justify-between rounded border p-3 text-sm"><span><strong className={item.type === "blocked" ? "text-red-700" : "text-emerald-700"}>{item.type === "blocked" ? "Blocked" : "Available"}</strong> · {item.startDate}{item.endDate !== item.startDate && ` – ${item.endDate}`}</span><Button variant="ghost" size="icon" aria-label="Remove exception" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(item.id)}>{deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></div>)}</div></div>
  </CardContent></Card>;
}
