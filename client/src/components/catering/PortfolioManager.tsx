import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ImagePlus, Save, Trash2 } from "lucide-react";
import { CATERING_PORTFOLIO_CATEGORIES, CATERING_PORTFOLIO_ITEM_LIMIT, type CateringPortfolioItem } from "@shared/catering-portfolio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const queryKey = (id: string) => ["catering", "portfolio", id] as const;
async function api(url: string, options?: RequestInit) { const response = await fetch(url, { credentials: "include", ...options, headers: { "Content-Type": "application/json", ...options?.headers } }); const body = response.status === 204 ? null : await response.json().catch(() => ({})); if (!response.ok) throw new Error(body?.message || "Portfolio request failed"); return body; }

export function PortfolioManager({ providerId, enabled }: { providerId: string; enabled: boolean }) {
  const client = useQueryClient(); const { toast } = useToast();
  const [progress, setProgress] = useState<number | null>(null); const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<string>();
  const [draft, setDraft] = useState({ title: "", description: "", category: "Other" });
  const portfolio = useQuery({ queryKey: queryKey(providerId), queryFn: async (): Promise<CateringPortfolioItem[]> => (await api(`/api/catering/providers/${providerId}/portfolio`)).items, enabled, staleTime: 300000 });
  const refresh = () => client.invalidateQueries({ queryKey: queryKey(providerId) });
  const mutate = useMutation({ mutationFn: ({ url, method, body }: { url: string; method: string; body?: unknown }) => api(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }), onSuccess: refresh, onError: (error: Error) => toast({ title: "Portfolio update failed", description: error.message, variant: "destructive" }) });
  const reorder = useMutation({
    mutationFn: (itemIds: string[]) => api(`/api/catering/users/${providerId}/portfolio/reorder`, { method: "PUT", body: JSON.stringify({ itemIds }) }),
    onMutate: async (itemIds) => {
      await client.cancelQueries({ queryKey: queryKey(providerId) });
      const previous = client.getQueryData<CateringPortfolioItem[]>(queryKey(providerId));
      const byId = new Map(previous?.map((item) => [item.id, item]));
      const optimistic = itemIds.flatMap((id, sortOrder) => {
        const item = byId.get(id);
        return item ? [{ ...item, sortOrder }] : [];
      });
      client.setQueryData(queryKey(providerId), optimistic);
      return { previous };
    },
    onError: (error: Error, _itemIds, context) => {
      if (context?.previous) client.setQueryData(queryKey(providerId), context.previous);
      toast({ title: "Portfolio reorder failed", description: error.message, variant: "destructive" });
    },
    onSettled: refresh,
  });
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const upload = (event: FormEvent) => { event.preventDefault(); if (!file || (portfolio.data?.length ?? 0) >= CATERING_PORTFOLIO_ITEM_LIMIT) return; const data = new FormData(); data.append("image", file); data.append("title", draft.title); data.append("description", draft.description); data.append("category", draft.category); data.append("sortOrder", String(portfolio.data?.length ?? 0)); const xhr = new XMLHttpRequest(); xhr.open("POST", `/api/catering/users/${providerId}/portfolio`); xhr.withCredentials = true; xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round(e.loaded / e.total * 100)); xhr.onload = async () => { setProgress(null); if (xhr.status < 200 || xhr.status >= 300) { let message = "Upload failed"; try { message = JSON.parse(xhr.responseText).message || message; } catch { /* non-JSON server response */ } return toast({ title: "Photo not uploaded", description: message, variant: "destructive" }); } if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(undefined); setDraft({ title: "", description: "", category: "Other" }); await refresh(); toast({ title: "Portfolio photo added" }); }; xhr.onerror = () => { setProgress(null); toast({ title: "Photo not uploaded", variant: "destructive" }); }; setProgress(0); xhr.send(data); };
  const move = (index: number, delta: number) => { const ids = (portfolio.data ?? []).map(({ id }) => id); [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]; reorder.mutate(ids); };
  if (!enabled) return <Card><CardHeader><CardTitle>Portfolio</CardTitle><CardDescription>Enable and save your marketplace listing before uploading photos.</CardDescription></CardHeader></Card>;
  return <Card><CardHeader><CardTitle>Portfolio</CardTitle><CardDescription>Showcase only work you upload. Use the arrows to set public gallery order. {portfolio.data?.length ?? 0} of {CATERING_PORTFOLIO_ITEM_LIMIT} photos used.</CardDescription></CardHeader><CardContent className="space-y-5"><form onSubmit={upload} className="space-y-4 rounded-xl border p-4"><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="portfolio-photo">Photo *</Label><Input id="portfolio-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required onChange={(e) => { const next = e.target.files?.[0] ?? null; setFile(next); setPreview(next ? URL.createObjectURL(next) : undefined); }} />{preview && <img src={preview} alt="New portfolio preview" className="mt-2 h-40 w-full rounded-lg object-cover" />}</div><div className="space-y-3"><div><Label htmlFor="portfolio-title">Title *</Label><Input id="portfolio-title" required maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div><CategorySelect value={draft.category} onChange={(category) => setDraft({ ...draft, category })} /></div></div><div><Label htmlFor="portfolio-description">Description</Label><Textarea id="portfolio-description" maxLength={1000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>{(portfolio.data?.length ?? 0) >= CATERING_PORTFOLIO_ITEM_LIMIT && <p className="text-sm font-medium text-amber-700" role="status">Portfolio limit reached. Delete a photo before uploading another.</p>}{progress != null && <div role="status" aria-label={`Uploading ${progress}%`}><Progress value={progress} /><p className="mt-1 text-xs">Uploading {progress}%</p></div>}<Button type="submit" className="min-h-11" disabled={!file || progress != null || (portfolio.data?.length ?? 0) >= CATERING_PORTFOLIO_ITEM_LIMIT}><ImagePlus className="mr-2 h-4 w-4" />Upload photo</Button></form>{portfolio.isLoading ? <p role="status">Loading portfolio…</p> : !portfolio.data?.length ? <p className="rounded-lg border border-dashed p-5 text-center text-muted-foreground">You have not uploaded any portfolio photos.</p> : <div className="space-y-4">{portfolio.data.map((item, index) => <Editor key={item.id} item={item} disabled={mutate.isPending || reorder.isPending} first={index === 0} last={index === portfolio.data!.length - 1} move={(delta) => move(index, delta)} save={(value) => mutate.mutate({ url: `/api/catering/users/${providerId}/portfolio/${item.id}`, method: "PATCH", body: value })} remove={() => window.confirm(`Delete ${item.title}?`) && mutate.mutate({ url: `/api/catering/users/${providerId}/portfolio/${item.id}`, method: "DELETE" })} />)}</div>}</CardContent></Card>;
}

function CategorySelect({ value, onChange }: { value: string; onChange: (value: CateringPortfolioItem["category"]) => void }) { return <div><Label>Category *</Label><Select value={value} onValueChange={onChange}><SelectTrigger aria-label="Portfolio category"><SelectValue /></SelectTrigger><SelectContent>{CATERING_PORTFOLIO_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>; }
function Editor({ item, disabled, first, last, move, save, remove }: { item: CateringPortfolioItem; disabled: boolean; first: boolean; last: boolean; move: (delta: number) => void; save: (item: CateringPortfolioItem) => void; remove: () => void }) { const [value, setValue] = useState(item); return <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-[140px_1fr]"><img src={item.image} alt={item.description || item.title} loading="lazy" className="h-32 w-full rounded-lg object-cover" /><div className="space-y-3"><Input aria-label="Portfolio title" maxLength={120} value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} /><CategorySelect value={value.category} onChange={(category) => setValue({ ...value, category })} /><Textarea aria-label="Portfolio description" maxLength={1000} value={value.description ?? ""} onChange={(e) => setValue({ ...value, description: e.target.value || null })} /><div className="flex flex-wrap gap-2"><Button variant="outline" size="icon" className="h-11 w-11" disabled={first || disabled} onClick={() => move(-1)} aria-label={`Move ${item.title} earlier`}><ArrowUp /></Button><Button variant="outline" size="icon" className="h-11 w-11" disabled={last || disabled} onClick={() => move(1)} aria-label={`Move ${item.title} later`}><ArrowDown /></Button><Button variant="outline" disabled={disabled || !value.title.trim()} onClick={() => save(value)}><Save className="mr-2 h-4 w-4" />Save</Button><Button variant="destructive" disabled={disabled} onClick={remove}><Trash2 className="mr-2 h-4 w-4" />Delete</Button></div></div></div>; }
