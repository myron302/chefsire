import * as React from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useUser } from "@/contexts/UserContext";
import {
  Trophy,
  PlusCircle,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

type DailyQuest = {
  id: string;
  slug: string;
  title: string;
  description: string;
  questType: string;
  category: string | null;
  targetValue: number | null;
  xpReward: number | null;
  difficulty: string | null;
  isActive: boolean;
  recurringPattern: string | null;
  createdAt?: string;
};

type QuestsResponse = {
  quests: DailyQuest[];
};

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export default function QuestsAdminPage() {
  const { user, loading } = useUser();
  const queryClient = useQueryClient();

  // --- Create form state ---
  const [form, setForm] = React.useState({
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

  // --- Fetch all quests for admin view ---
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<QuestsResponse>({
    queryKey: ["/api/quests/admin"],
    queryFn: () => fetchJSON<QuestsResponse>("/api/quests/admin"),
    enabled: !loading && !!user,
  });

  const quests = data?.quests ?? [];

  // --- Create quest mutation ---
  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      fetchJSON<{ quest: DailyQuest }>("/api/quests/create", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          category: payload.category || null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quests/admin"] });
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

  // --- Update quest mutation (difficulty, xp, target, active, etc.) ---
  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; updates: Partial<DailyQuest> }) => {
      const { id, updates } = payload;
      return fetchJSON<{ quest: DailyQuest }>(`/api/quests/admin/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quests/admin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quests/daily"] });
    },
  });

  const handleToggleActive = (quest: DailyQuest) => {
    updateMutation.mutate({
      id: quest.id,
      updates: { isActive: !quest.isActive },
    });
  };

  const handleFieldChange = (
    quest: DailyQuest,
    field: "difficulty" | "xpReward" | "targetValue",
    value: string
  ) => {
    if (field === "difficulty") {
      updateMutation.mutate({
        id: quest.id,
        updates: { difficulty: value },
      });
      return;
    }

    const num = Number(value);
    if (!Number.isNaN(num)) {
      updateMutation.mutate({
        id: quest.id,
        updates: { [field]: num } as any,
      });
    }
  };

  const difficultyBadge = (difficulty: string | null) => {
    if (!difficulty) {
      return (
        <Badge variant="outline" className="text-xs">
          ?
        </Badge>
      );
    }
    const lower = difficulty.toLowerCase();
    if (lower === "easy") {
      return (
        <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
          Easy
        </Badge>
      );
    }
    if (lower === "medium") {
      return (
        <Badge className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
          Medium
        </Badge>
      );
    }
    if (lower === "hard") {
      return (
        <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
          Hard
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        {difficulty}
      </Badge>
    );
  };

  // Guard: must be logged in (and backend also enforces admin)
  if (!loading && !user) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Admin – Daily Quests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You must be logged in to manage quests.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="max-w-6xl mx-auto py-8 space-y-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-500" />
              Daily Quests Admin
            </h1>
            <p className="text-sm text-muted-foreground">
              View, create, and fine-tune the pool of daily quests that get assigned to users.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {quests.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {quests.length} quests
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Refresh
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-1" /> Refresh
                </>
              )}
            </Button>
          </div>
        </div>

        {/* --- Create quest --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlusCircle className="h-4 w-4" />
              Create New Quest
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

        {/* --- Existing quests --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Existing Quests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <p className="text-sm text-muted-foreground">Loading quests…</p>
            )}
            {isError && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertTriangle className="w-4 h-4" />
                {(error as Error)?.message || "Failed to load quests."}
              </div>
            )}
            {!isLoading && !isError && quests.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No quests found yet. Use the form above to create your first quest.
              </p>
            )}

            {!isLoading && !isError && quests.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 pr-2 text-left">Title</th>
                      <th className="py-2 px-2 text-left">Type</th>
                      <th className="py-2 px-2 text-left">Category</th>
                      <th className="py-2 px-2 text-left">Difficulty</th>
                      <th className="py-2 px-2 text-left">XP</th>
                      <th className="py-2 px-2 text-left">Target</th>
                      <th className="py-2 px-2 text-center">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quests.map((quest) => {
                      const loadingThis =
                        updateMutation.isPending &&
                        (updateMutation.variables as any)?.id === quest.id;

                      return (
                        <tr
                          key={quest.id}
                          className="border-b last:border-0 hover:bg-muted/40"
                        >
                          {/* Title + slug + description */}
                          <td className="py-2 pr-2 align-top">
                            <div className="font-medium truncate max-w-xs">
                              {quest.title}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                              {quest.slug}
                            </div>
                            <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                              {quest.description}
                            </div>
                          </td>

                          {/* Type */}
                          <td className="py-2 px-2 align-top whitespace-nowrap">
                            <Badge variant="outline" className="text-[11px]">
                              {quest.questType}
                            </Badge>
                          </td>

                          {/* Category */}
                          <td className="py-2 px-2 align-top whitespace-nowrap">
                            {quest.category ? (
                              <span className="text-xs">{quest.category}</span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>

                          {/* Difficulty (editable select) */}
                          <td className="py-2 px-2 align-top">
                            <Select
                              defaultValue={quest.difficulty || "easy"}
                              onValueChange={(val) =>
                                handleFieldChange(quest, "difficulty", val)
                              }
                              disabled={loadingThis}
                            >
                              <SelectTrigger className="h-8 w-[100px]">
                                <SelectValue placeholder="Difficulty" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="easy">Easy</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="hard">Hard</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="mt-1">
                              {difficultyBadge(quest.difficulty)}
                            </div>
                          </td>

                          {/* XP reward (editable number) */}
                          <td className="py-2 px-2 align-top">
                            <Input
                              type="number"
                              className="h-8 w-[80px]"
                              defaultValue={quest.xpReward ?? 0}
                              onBlur={(e) =>
                                handleFieldChange(
                                  quest,
                                  "xpReward",
                                  e.target.value
                                )
                              }
                              disabled={loadingThis}
                            />
                          </td>

                          {/* Target value (editable number) */}
                          <td className="py-2 px-2 align-top">
                            <Input
                              type="number"
                              className="h-8 w-[80px]"
                              defaultValue={quest.targetValue ?? 1}
                              onBlur={(e) =>
                                handleFieldChange(
                                  quest,
                                  "targetValue",
                                  e.target.value
                                )
                              }
                              disabled={loadingThis}
                            />
                          </td>

                          {/* Active toggle */}
                          <td className="py-2 px-2 align-top text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center justify-center gap-1">
                                  <Switch
                                    checked={quest.isActive}
                                    onCheckedChange={() =>
                                      handleToggleActive(quest)
                                    }
                                    disabled={loadingThis}
                                  />
                                  {loadingThis && (
                                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                {quest.isActive
                                  ? "Click to deactivate this quest"
                                  : "Click to activate this quest"}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
