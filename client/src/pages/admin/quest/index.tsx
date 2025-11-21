import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUser } from "@/contexts/UserContext";

type Quest = {
  id: string;
  slug: string;
  title: string;
  description: string;
  questType: string;
  category: string | null;
  targetValue: number;
  xpReward: number;
  difficulty: "easy" | "medium" | "hard";
  isActive: boolean;
  recurringPattern: "daily" | "weekly" | "weekend_only" | "weekday_only" | null;
  metadata: any;
  createdAt?: string;
};

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export default function AdminQuestsPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("");
  const [active, setActive] = useState<string>("");

  // Basic guard
  if (!user || (!(user as any).isAdmin && (user as any).role !== "admin")) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader><CardTitle>Admin Only</CardTitle></CardHeader>
        <CardContent>You need admin access to view this page.</CardContent>
        </Card>
      </div>
    );
  }

  const { data, isLoading, error } = useQuery<{ quests: Quest[] }>({
    queryKey: ["admin-quests", q, type, active],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (type) params.set("type", type);
      if (active) params.set("active", active);
      return fetchJSON(`/api/quests/admin/list?${params.toString()}`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetchJSON(`/api/quests/admin/toggle/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-quests"] }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Quest>) =>
      fetchJSON(`/api/quests/admin/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-quests"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Quest> }) =>
      fetchJSON(`/api/quests/admin/update/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-quests"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJSON(`/api/quests/admin/delete/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-quests"] }),
  });

  // quick-create state
  const [newQuest, setNewQuest] = useState<Partial<Quest>>({
    slug: "",
    title: "",
    description: "",
    questType: "make_drink",
    category: "",
    targetValue: 1,
    xpReward: 50,
    difficulty: "easy",
    isActive: true,
    recurringPattern: "daily",
    metadata: {},
  });

  const quests = data?.quests ?? [];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader><CardTitle>Quests Admin</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid md:grid-cols-3 gap-3">
            <Input placeholder="Search title/slug/description…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All types</SelectItem>
                <SelectItem value="make_drink">Make Drink</SelectItem>
                <SelectItem value="try_category">Try Category</SelectItem>
                <SelectItem value="use_ingredient">Use Ingredient</SelectItem>
                <SelectItem value="social_action">Social Action</SelectItem>
                <SelectItem value="streak_milestone">Streak Milestone</SelectItem>
              </SelectContent>
            </Select>
            <Select value={active} onValueChange={setActive}>
              <SelectTrigger><SelectValue placeholder="Active status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Create new */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="font-semibold">Create Quest</div>
            <div className="grid md:grid-cols-3 gap-3">
              <Input placeholder="Slug" value={newQuest.slug ?? ""} onChange={(e) => setNewQuest(s => ({ ...s, slug: e.target.value }))} />
              <Input placeholder="Title" value={newQuest.title ?? ""} onChange={(e) => setNewQuest(s => ({ ...s, title: e.target.value }))} />
              <Input placeholder="Description" value={newQuest.description ?? ""} onChange={(e) => setNewQuest(s => ({ ...s, description: e.target.value }))} />
              <Select value={newQuest.questType ?? ""} onValueChange={(v) => setNewQuest(s => ({ ...s, questType: v as any }))}>
                <SelectTrigger><SelectValue placeholder="Quest Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="make_drink">Make Drink</SelectItem>
                  <SelectItem value="try_category">Try Category</SelectItem>
                  <SelectItem value="use_ingredient">Use Ingredient</SelectItem>
                  <SelectItem value="social_action">Social Action</SelectItem>
                  <SelectItem value="streak_milestone">Streak Milestone</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Category (optional)" value={newQuest.category ?? ""} onChange={(e) => setNewQuest(s => ({ ...s, category: e.target.value }))} />
              <Input type="number" placeholder="Target" value={newQuest.targetValue ?? 1} onChange={(e) => setNewQuest(s => ({ ...s, targetValue: Number(e.target.value || 1) }))} />
              <Input type="number" placeholder="XP" value={newQuest.xpReward ?? 50} onChange={(e) => setNewQuest(s => ({ ...s, xpReward: Number(e.target.value || 0) }))} />
              <Select value={newQuest.difficulty ?? "easy"} onValueChange={(v) => setNewQuest(s => ({ ...s, difficulty: v as any }))}>
                <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newQuest.recurringPattern ?? "daily"} onValueChange={(v) => setNewQuest(s => ({ ...s, recurringPattern: v as any }))}>
                <SelectTrigger><SelectValue placeholder="Pattern" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="weekday_only">Weekdays only</SelectItem>
                  <SelectItem value="weekend_only">Weekends only</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch checked={newQuest.isActive ?? true} onCheckedChange={(v) => setNewQuest(s => ({ ...s, isActive: v }))} />
                <span>Active</span>
              </div>
            </div>
            <Button onClick={() => createMutation.mutate(newQuest)}>Create</Button>
          </div>

          {/* List */}
          <div className="space-y-3">
            {isLoading && <div>Loading…</div>}
            {error && <div className="text-destructive">Error loading quests.</div>}
            {quests.map(q => (
              <div key={q.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{q.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{q.description}</div>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <Badge variant="outline">{q.questType}</Badge>
                    {q.category ? <Badge variant="secondary">{q.category}</Badge> : null}
                    <Badge variant="outline">{q.difficulty}</Badge>
                    {q.recurringPattern ? <Badge variant="outline">{q.recurringPattern}</Badge> : null}
                    <Badge variant="default">XP {q.xpReward}</Badge>
                    <Badge variant="outline">Target {q.targetValue}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={q.isActive} onCheckedChange={(v) => toggleMutation.mutate({ id: q.id, isActive: v })} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: q.id, payload: { title: q.title } })}
                  >
                    Save
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(q.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {quests.length === 0 && !isLoading && <div className="text-sm text-muted-foreground">No quests found.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
