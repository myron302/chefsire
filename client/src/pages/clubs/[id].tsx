import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import {
  Users,
  MessageSquare,
  ArrowLeft,
  Send,
  Calendar,
  Crown,
  Pencil,
  Save,
  X,
  Trash2,
  Lock,
  Unlock,
  UserPlus,
  Check,
  Ban,
} from "lucide-react";

// Server /api/clubs/:id returns: { club: { club: ClubRow, creator: Creator }, stats: Stats }
type ClubRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  coverImage: string | null;
  isPublic: boolean;
  rules: string | null;
  createdAt: string;
  creatorId?: string; // some endpoints return raw club row
};

type Creator = {
  id: string;
  username: string;
  displayName: string | null;
};

type Stats = {
  memberCount: number;
  postCount: number;
};

type ClubDetailResponse = {
  club: {
    club: ClubRow;
    creator: Creator;
  };
  stats: Stats;
};

type MembershipRow = {
  id: string;
  clubId: string;
  userId: string;
  role: string;
  joinedAt: string;
};

type MembershipResponse = {
  membership: MembershipRow | null;
  isOwner: boolean;
  isPublic: boolean;
};

type Post = {
  post: {
    id: string;
    clubId: string;
    userId: string;
    content: string;
    imageUrl: string | null;
    likesCount: number;
    commentsCount: number;
    createdAt: string;
  };
  author: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

type JoinRequest = {
  membership: MembershipRow;
  user: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

export default function ClubDetailPage() {
  const { id } = useParams();
  const clubId = String(id || "");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const [newPostContent, setNewPostContent] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState("");

  // Club edit modal state (owner only)
  const [editClubOpen, setEditClubOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRules, setEditRules] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);

  // Fetch club details
  const { data: clubData, isLoading: clubLoading } = useQuery<ClubDetailResponse>({
    queryKey: [`/api/clubs/${clubId}`],
    enabled: !!clubId,
  });

  // Fetch club posts
  const { data: postsData, isLoading: postsLoading } = useQuery<{ posts: Post[] }>({
    queryKey: [`/api/clubs/${clubId}/posts`],
    enabled: !!clubId,
  });

  // Membership status (fixes the "no post box" issue even if /my-clubs is broken)
  const { data: membershipData } = useQuery<MembershipResponse>({
    queryKey: [`/api/clubs/${clubId}/membership`],
    enabled: !!clubId && !!user,
  });

  const membershipRole = membershipData?.membership?.role || null;
  const isPending = membershipRole === "pending";
  const isMember = membershipRole === "member" || membershipRole === "owner";
  const isOwner = useMemo(() => {
    const creatorId = clubData?.club?.creator?.id;
    if (!user?.id) return false;
    return membershipData?.isOwner === true || creatorId === user.id || membershipRole === "owner";
  }, [clubData?.club?.creator?.id, membershipData?.isOwner, membershipRole, user?.id]);

  const club = clubData?.club?.club;
  const creator = clubData?.club?.creator;
  const stats = clubData?.stats;

  // Seed edit dialog when opening
  const openEditDialog = () => {
    if (!club) return;
    setEditName(club.name || "");
    setEditDescription(club.description || "");
    setEditRules(club.rules || "");
    setEditIsPublic(!!club.isPublic);
    setEditClubOpen(true);
  };

  // Join club mutation (public joins immediately; private creates a pending request)
  const joinClubMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clubs/${clubId}/join`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to join club");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/membership`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/posts`] });

      if (club?.isPublic) {
        toast({ title: "✓ Joined club", description: "Welcome to the club!" });
      } else {
        toast({ title: "Request sent", description: "The club owner will review your request." });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  // Leave club mutation
  const leaveClubMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clubs/${clubId}/leave`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to leave club");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/membership`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ title: "Left club", description: "You have left the club." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to leave club", description: error.message, variant: "destructive" });
    },
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clubs/${clubId}/posts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newPostContent }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create post");
      }
      return res.json();
    },
    onSuccess: () => {
      setNewPostContent("");
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/posts`] });
      toast({ title: "Posted", description: "Your post is live." });
    },
    onError: (error: Error) => {
      toast({ title: "Post failed", description: error.message, variant: "destructive" });
    },
  });

  const handleCreatePost = () => {
    if (!newPostContent.trim()) return;
    createPostMutation.mutate();
  };

  // Update post mutation
  const updatePostMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const res = await fetch(`/api/clubs/${clubId}/posts/${postId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update post");
      }
      return res.json();
    },
    onSuccess: () => {
      setEditingPostId(null);
      setEditPostContent("");
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/posts`] });
      toast({ title: "Saved", description: "Your changes were saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const startEditingPost = (p: Post) => {
    setEditingPostId(p.post.id);
    setEditPostContent(p.post.content);
  };

  const cancelEditingPost = () => {
    setEditingPostId(null);
    setEditPostContent("");
  };

  const saveEditedPost = () => {
    if (!editingPostId) return;
    updatePostMutation.mutate({ postId: editingPostId, content: editPostContent });
  };

  // Delete post (owner or author)
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/clubs/${clubId}/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete post");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/posts`] });
      toast({ title: "Deleted", description: "Post removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  // Edit club mutation (owner)
  const updateClubMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clubs/${clubId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          rules: editRules,
          isPublic: editIsPublic,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update club");
      }
      return res.json();
    },
    onSuccess: () => {
      setEditClubOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/membership`] });
      toast({ title: "Updated", description: "Club updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  // Delete club mutation (owner)
  const deleteClubMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clubs/${clubId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete club");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Club deleted", description: "Your club has been deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs/my-clubs"] });
      setLocation("/clubs");
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  // Join requests (owner only; private club)
  const { data: joinRequestsData } = useQuery<{ requests: JoinRequest[] }>({
    queryKey: [`/api/clubs/${clubId}/join-requests`],
    enabled: !!clubId && !!user && !!isOwner && club?.isPublic === false,
  });

  const approveJoinMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const res = await fetch(`/api/clubs/${clubId}/join-requests/${membershipId}/approve`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to approve request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/join-requests`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ title: "Approved", description: "Member approved." });
    },
    onError: (error: Error) => {
      toast({ title: "Approve failed", description: error.message, variant: "destructive" });
    },
  });

  const denyJoinMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const res = await fetch(`/api/clubs/${clubId}/join-requests/${membershipId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to deny request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/join-requests`] });
      toast({ title: "Denied", description: "Request denied." });
    },
    onError: (error: Error) => {
      toast({ title: "Deny failed", description: error.message, variant: "destructive" });
    },
  });

  const pageTitle = club?.name || "Club";

  const canPost = !!user && isMember && !isPending;

  if (clubLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading club...</p>
      </div>
    );
  }

  if (!club || !creator || !stats) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-muted-foreground">Club not found.</p>
        <Link href="/clubs">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clubs
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/clubs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{pageTitle}</h1>
              <Badge variant="secondary" className="capitalize">
                {club.category}
              </Badge>
              {club.isPublic ? (
                <Badge variant="outline" className="gap-1">
                  <Unlock className="h-3.5 w-3.5" />
                  Public
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <Lock className="h-3.5 w-3.5" />
                  Private
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Created by {creator.displayName || creator.username}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {user ? (
            <>
              {isMember ? (
                <Button variant="outline" onClick={() => leaveClubMutation.mutate()} disabled={leaveClubMutation.isPending}>
                  Leave
                </Button>
              ) : isPending ? (
                <Button variant="outline" disabled>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Request Pending
                </Button>
              ) : (
                <Button onClick={() => joinClubMutation.mutate()} disabled={joinClubMutation.isPending}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {club.isPublic ? "Join" : "Request to Join"}
                </Button>
              )}

              {isOwner ? (
                <>
                  <Button variant="outline" onClick={openEditDialog}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Club
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Club
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this club?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the club, posts, and memberships. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteClubMutation.mutate()} className="bg-red-600 hover:bg-red-700">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : null}
            </>
          ) : (
            <Badge variant="outline">Log in to join</Badge>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Members</p>
              <p className="text-xl font-semibold">{stats.memberCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-600 to-rose-500 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Posts</p>
              <p className="text-xl font-semibold">{stats.postCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules */}
      {club.rules ? (
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              Club Rules
            </CardTitle>
            <CardDescription>{club.rules}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* Private club pending notice */}
      {user && isPending ? (
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium">Request pending</p>
              <p className="text-sm text-muted-foreground">
                You can’t post until the club owner approves your join request.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Owner: Pending join requests (private only) */}
      {isOwner && club.isPublic === false ? (
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Join Requests
            </CardTitle>
            <CardDescription>Approve or deny membership requests for this private club.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {joinRequestsData?.requests?.length ? (
              joinRequestsData.requests.map((r) => (
                <div key={r.membership.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-white/70">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.user.displayName || r.user.username}</p>
                    <p className="text-xs text-muted-foreground truncate">@{r.user.username}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approveJoinMutation.mutate(r.membership.id)} disabled={approveJoinMutation.isPending}>
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => denyJoinMutation.mutate(r.membership.id)}
                      disabled={denyJoinMutation.isPending}
                    >
                      <Ban className="h-4 w-4 mr-1" />
                      Deny
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No pending requests.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* New Post */}
      {user && isMember ? (
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Create a Post</CardTitle>
            <CardDescription>Share something with the club</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder={isPending ? "Awaiting approval..." : "Write your post..."}
              rows={4}
              disabled={!canPost}
            />
            <div className="flex justify-end">
              <Button onClick={handleCreatePost} disabled={!canPost || createPostMutation.isPending}>
                <Send className="h-4 w-4 mr-2" />
                {createPostMutation.isPending ? "Posting..." : "Post"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Posts */}
      <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Posts</CardTitle>
          <CardDescription>Latest updates from members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {postsLoading ? (
            <p className="text-sm text-muted-foreground">Loading posts...</p>
          ) : !postsData?.posts?.length ? (
            <p className="text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            postsData.posts.map((p) => {
              const isCreatorPost = p.author.id === creator.id;
              const canEdit = user?.id === p.post.userId;
              const canDelete = user?.id === p.post.userId || isOwner;

              return (
                <Card key={p.post.id} className="border bg-white/70">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>
                            {(p.author.displayName || p.author.username || "?").slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{p.author.displayName || p.author.username}</p>
                            {isCreatorPost ? (
                              <Badge className="gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                                <Crown className="h-3.5 w-3.5" />
                                Creator
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">@{p.author.username}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canDelete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deletePostMutation.mutate(p.post.id)}
                            disabled={deletePostMutation.isPending}
                            title={isOwner && user?.id !== p.post.userId ? "Remove post (owner)" : "Delete post"}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {editingPostId === p.post.id ? (
                      <>
                        <Textarea value={editPostContent} onChange={(e) => setEditPostContent(e.target.value)} rows={3} />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={cancelEditingPost}>
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                          <Button size="sm" onClick={saveEditedPost} disabled={updatePostMutation.isPending}>
                            <Save className="h-4 w-4 mr-1" />
                            {updatePostMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap text-slate-800">{p.post.content}</p>
                        {canEdit ? (
                          <div className="flex justify-end">
                            <Button variant="outline" size="sm" onClick={() => startEditingPost(p)}>
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Edit Club Dialog */}
      <Dialog open={editClubOpen} onOpenChange={setEditClubOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Club</DialogTitle>
            <DialogDescription>Update your club details.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="club-name">Name</Label>
              <Input id="club-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="club-desc">Description</Label>
              <Textarea id="club-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="club-rules">Rules</Label>
              <Textarea id="club-rules" value={editRules} onChange={(e) => setEditRules(e.target.value)} rows={3} />
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={editIsPublic ? "default" : "outline"}
                onClick={() => setEditIsPublic(true)}
                className="gap-2"
              >
                <Unlock className="h-4 w-4" />
                Public
              </Button>
              <Button
                type="button"
                variant={!editIsPublic ? "default" : "outline"}
                onClick={() => setEditIsPublic(false)}
                className="gap-2"
              >
                <Lock className="h-4 w-4" />
                Private
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditClubOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => updateClubMutation.mutate()} disabled={updateClubMutation.isPending}>
                {updateClubMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
