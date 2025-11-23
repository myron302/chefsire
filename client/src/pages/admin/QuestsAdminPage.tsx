// client/src/pages/admin/QuestsAdminPage.tsx
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { useUser } from "@/contexts/UserContext";
import { Trophy, PlusCircle, ToggleLeft, ToggleRight } from "lucide-react";

type Quest = {
  id: string;
  slug: string;
  title: string;
  description: string;
  questType: string;
  category: string | null;
  targetValue: number;
  xpReward: number;
  difficulty: string;
  isActive: boolean;
  recurringPattern: string | null;
  createdAt: string;
};

type QuestsResponse = {
  quests: Quest[];
};

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }

  return res.json();
}

export default function QuestsAdminPage() {
  const { user, loading } = useUser();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    slug: "",
    title: "",
    description: "",
    questType: "make_drink",
    category: "",
    targetValue: 1,
    xpReward: 50,
    difficulty: "easy",
    recurringPattern: "daily",
  });

  // simple "is admin" check for UI; backend still enforces via requireAdmin
  const isAdmin = !!user && (user.role === "admin" || (user as any).isAdmin === true);

  const {
    data,
    isLoading,
    error,
  } = useQuery<QuestsResponse>({
    queryKey: ["/api/quests"],
    queryFn: () => fetchJSON<QuestsResponse>("/api/quests"),
    enabled: !loading && !!user,
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      fetchJSON<{ quest: Quest }>("/api/quests/create", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          category: payload.category || null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quests"] });
      setForm((prev) => ({
        ...prev,
        slug: "",
        title: "",
        description: "",
        category: "",
      }));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (quest: Quest) =>
      fetchJSON<{ quest: Quest }>(`/api/quests/${quest.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !quest.isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quests"] });
    },
  });

  // Guard: must be logged-in AND admin
  if (!loading && (!user || !isAdmin)) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Admin – Daily Quests</CardTitle>
          </CardHeader>
          <CardContent>
            {!user ? (
              <p className="text-sm text-muted-foreground">
                You must be logged in to manage quests.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                You must be an admin to access this page.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Daily Quests Admin
          </h1>
          <p className="text-sm text-muted-foreground">
            View, create, and toggle quests without touching the database.
          </p>
        </div>
        {data?.quests && (
          <Badge variant="outline" className="text-xs">
            {data.quests.length} quests
          </Badge>
        )}
      </div>

      {/* Create quest */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlusCircle className="h-4 w-4" />
            Create New Quest
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Slug & Title */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Slug</label>
              <Input
                value={form.slug}
                onChange={(e) =>
                  setForm((f) => ({ ...f, slug: e.target.value }))
                }
                placeholder="morning-boost"
              />
              <p className="text-[10px] text-muted-foreground">
                Must be unique. Used in analytics & debugging, not user-facing.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Title</label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Morning Energy Boost"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Description</label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Make a caffeinated drink to start your day right"
              rows={2}
            />
          </div>

          {/* Type / Difficulty / Recurrence */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Quest Type</label>
              <Select
                value={form.questType}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, questType: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="make_drink">Make drink</SelectItem>
                  <SelectItem value="try_category">Try category</SelectItem>
                  <SelectItem value="use_ingredient">Use ingredient</SelectItem>
                  <SelectItem value="social_action">Social action</SelectItem>
                  <SelectItem value="streak_milestone">Streak</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Difficulty</label>
              <Select
                value={form.difficulty}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, difficulty: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Recurring Pattern</label>
              <Select
                value={form.recurringPattern}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, recurringPattern: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pattern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="weekend_only">Weekends only</SelectItem>
                  <SelectItem value="weekday_only">Weekdays only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category / Target / XP */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Category (optional)</label>
              <Input
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                placeholder="smoothies, detoxes, caffeinated/matcha…"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Target Value</label>
              <Input
                type="number"
                min={1}
                value={form.targetValue}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    targetValue: Number(e.target.value) || 1,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">XP Reward</label>
              <Input
                type="number"
                min={1}
                value={form.xpReward}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    xpReward: Number(e.target.value) || 1,
                  }))
                }
              />
            </div>
          </div>

          <Button
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate(form)}
          >
            {createMutation.isPending ? "Creating…" : "Create Quest"}
          </Button>

          {createMutation.error instanceof Error && (
            <p className="text-xs text-red-500 mt-2">
              {createMutation.error.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Existing quests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Existing Quests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading quests…</p>
          )}
          {error && (
            <p className="text-sm text-red-500">
              Failed to load quests. Make sure /api/quests is available and you are logged in.
            </p>
          )}
          {!isLoading &&
            !error &&
            (!data?.quests || data.quests.length === 0) && (
              <p className="text-sm text-muted-foreground">
                No quests found yet. Use the form above to create your first quest.
              </p>
            )}

          {data?.quests && data.quests.length > 0 && (
            <div className="space-y-2">
              {data.quests.map((quest) => (
                <div
                  key={quest.id}
                  className="flex flex-wrap items-center justify-between gap-3 border rounded-md px-3 py-2 text-xs"
                >
                  <div className="flex-1 min-w-[220px]">
                    <div className="font-medium flex items-center gap-2">
                      {quest.title}
                      <Badge variant="outline" className="text-[10px]">
                        {quest.questType}
                      </Badge>
                      {quest.category && (
                        <Badge variant="outline" className="text-[10px]">
                          {quest.category}
                        </Badge>
                      )}
                      {!quest.isActive && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-destructive text-destructive"
                        >
                          inactive
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground">
                      {quest.description}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span>Slug: {quest.slug}</span>
                      <span>Difficulty: {quest.difficulty}</span>
                      <span>Target: {quest.targetValue}</span>
                      <span>XP: {quest.xpReward}</span>
                      {quest.recurringPattern && (
                        <span>Pattern: {quest.recurringPattern}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-[11px]">
                    <Button
                      size="sm"
                      variant={quest.isActive ? "outline" : "default"}
                      disabled={toggleActiveMutation.isPending}
                      onClick={() => toggleActiveMutation.mutate(quest)}
                      className="flex items-center gap-1"
                    >
                      {quest.isActive ? (
                        <>
                          <ToggleRight className="h-3 w-3" />
                          Disable
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-3 w-3" />
                          Activate
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
