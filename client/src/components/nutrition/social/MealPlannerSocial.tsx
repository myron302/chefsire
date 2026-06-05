import type React from "react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { Bookmark, Heart, MessageCircle, Send, Trash2, UserPlus } from "lucide-react";

export type MealPlannerSocialStats = {
  likeCount: number;
  saveCount: number;
  commentCount: number;
  viewerHasLiked: boolean;
  viewerHasSaved: boolean;
};

type CommentItem = {
  id: string;
  comment: string;
  createdAt: string;
  user: { id: string; username: string | null; displayName: string | null; avatar?: string | null };
};

type SocialTarget = "meal-plan" | "shared-week";

const EMPTY_STATS: MealPlannerSocialStats = {
  likeCount: 0,
  saveCount: 0,
  commentCount: 0,
  viewerHasLiked: false,
  viewerHasSaved: false,
};

function socialBase(target: SocialTarget, id: string) {
  return target === "meal-plan"
    ? `/api/meal-plans/${encodeURIComponent(id)}`
    : `/api/meal-planner/week/shared/${encodeURIComponent(id)}`;
}

export function MealPlannerSocialActions({
  target,
  id,
  initialStats,
  compact = false,
  onChange,
}: {
  target: SocialTarget;
  id: string;
  initialStats?: Partial<MealPlannerSocialStats> | null;
  compact?: boolean;
  onChange?: (stats: MealPlannerSocialStats) => void;
}) {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [stats, setStats] = useState<MealPlannerSocialStats>({ ...EMPTY_STATS, ...(initialStats || {}) });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setStats({ ...EMPTY_STATS, ...(initialStats || {}) });
  }, [initialStats?.likeCount, initialStats?.saveCount, initialStats?.commentCount, initialStats?.viewerHasLiked, initialStats?.viewerHasSaved]);

  const mutate = async (kind: "like" | "save") => {
    if (!user) {
      toast({ title: "Sign in required", description: `Sign in to ${kind} this ${target === "meal-plan" ? "meal plan" : "shared week"}.` });
      setLocation("/auth/login");
      return;
    }
    const active = kind === "like" ? stats.viewerHasLiked : stats.viewerHasSaved;
    setBusy(kind);
    try {
      const res = await fetch(`${socialBase(target, id)}/${kind}`, {
        method: active ? "DELETE" : "POST",
        credentials: "include",
      });
      const next = await res.json().catch(() => null);
      if (!res.ok) throw new Error(next?.message || `Unable to update ${kind}`);
      setStats(next);
      onChange?.(next);
    } catch (error: any) {
      toast({ title: "Social action failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const sizeClass = compact ? "h-8 px-2 text-xs" : "";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant={stats.viewerHasLiked ? "default" : "outline"} size={compact ? "sm" : "default"} className={sizeClass} onClick={() => mutate("like")} disabled={busy === "like"}>
        <Heart className={`mr-1 h-4 w-4 ${stats.viewerHasLiked ? "fill-current" : ""}`} />
        {stats.likeCount}
      </Button>
      <Button type="button" variant={stats.viewerHasSaved ? "default" : "outline"} size={compact ? "sm" : "default"} className={sizeClass} onClick={() => mutate("save")} disabled={busy === "save"}>
        <Bookmark className={`mr-1 h-4 w-4 ${stats.viewerHasSaved ? "fill-current" : ""}`} />
        {stats.saveCount}
      </Button>
      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <MessageCircle className="h-4 w-4" /> {stats.commentCount}
      </span>
    </div>
  );
}

export function MealPlannerCommentsPanel({
  target,
  id,
  title = "Comments",
}: {
  target: SocialTarget;
  id: string;
  title?: string;
}) {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [stats, setStats] = useState<MealPlannerSocialStats>(EMPTY_STATS);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadComments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${socialBase(target, id)}/comments`, { credentials: "include" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message || "Unable to load comments");
      setComments(payload?.comments || []);
      setStats({ ...EMPTY_STATS, ...(payload?.social || {}) });
    } catch (error: any) {
      toast({ title: "Comments unavailable", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [target, id]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      setLocation("/auth/login");
      return;
    }
    const comment = draft.trim();
    if (!comment) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${socialBase(target, id)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ comment }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message || "Unable to post comment");
      setDraft("");
      await loadComments();
    } catch (error: any) {
      toast({ title: "Comment failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (commentId: string) => {
    try {
      const res = await fetch(`${socialBase(target, id)}/comments/${encodeURIComponent(commentId)}`, { method: "DELETE", credentials: "include" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message || "Unable to delete comment");
      await loadComments();
    } catch (error: any) {
      toast({ title: "Delete failed", description: error?.message || "Please try again.", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" /> {title}
        </CardTitle>
        <CardDescription>{stats.commentCount} comment{stats.commentCount === 1 ? "" : "s"} from the meal-planner community.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {user ? (
          <form onSubmit={submit} className="space-y-2">
            <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a helpful note or question…" rows={3} maxLength={1000} />
            <Button type="submit" disabled={submitting || !draft.trim()}>
              <Send className="mr-2 h-4 w-4" /> {submitting ? "Posting…" : "Post comment"}
            </Button>
          </form>
        ) : (
          <Button variant="outline" onClick={() => setLocation("/auth/login")}>Sign in to comment</Button>
        )}

        <div className="space-y-3">
          {loading ? <p className="text-sm text-muted-foreground">Loading comments…</p> : null}
          {!loading && comments.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet. Be the first to start the conversation.</p> : null}
          {comments.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-lg border p-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={item.user.avatar || undefined} />
                <AvatarFallback>{(item.user.displayName || item.user.username || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{item.user.displayName || item.user.username || "Community member"}</p>
                    <p className="text-xs text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString() : "Just now"}</p>
                  </div>
                  {user?.id === item.user.id ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(item.id)} aria-label="Delete comment">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.comment}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CreatorFollowButton({ creatorId, compact = false }: { creatorId?: string | null; compact?: boolean }) {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState<{ isFollowing: boolean; isRequested: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!creatorId || !user || user.id === creatorId) return;
    fetch(`/api/follows/status/${encodeURIComponent(creatorId)}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => payload && setStatus({ isFollowing: !!payload.isFollowing, isRequested: !!payload.isRequested }))
      .catch(() => undefined);
  }, [creatorId, user?.id]);

  if (!creatorId || user?.id === creatorId) return null;

  const toggle = async () => {
    if (!user) {
      setLocation("/auth/login");
      return;
    }
    setBusy(true);
    try {
      const active = status?.isFollowing || status?.isRequested;
      const res = await fetch(`/api/follows/${encodeURIComponent(creatorId)}`, { method: active ? "DELETE" : "POST", credentials: "include" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message || "Unable to update follow");
      setStatus({ isFollowing: payload?.status === "following", isRequested: payload?.status === "requested" });
    } catch (error: any) {
      toast({ title: "Follow failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const active = status?.isFollowing || status?.isRequested;
  return (
    <Button type="button" variant={active ? "secondary" : "outline"} size={compact ? "sm" : "default"} onClick={toggle} disabled={busy}>
      <UserPlus className="mr-1 h-4 w-4" /> {status?.isFollowing ? "Following" : status?.isRequested ? "Requested" : "Follow"}
    </Button>
  );
}

export function CreatorProfileLink({ creatorId, children }: { creatorId?: string | null; children: React.ReactNode }) {
  if (!creatorId) return <>{children}</>;
  return <Link href={`/nutrition/creators/${creatorId}`} className="underline-offset-4 hover:underline">{children}</Link>;
}
