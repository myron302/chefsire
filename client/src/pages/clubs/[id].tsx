import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { Users, MessageSquare, ArrowLeft, Send, Calendar, Crown, Pencil, Save, X } from "lucide-react";

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

export default function ClubDetailPage() {
  const { id } = useParams();
  const clubId = String(id || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const [newPostContent, setNewPostContent] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState("");

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

  // Check membership status
  const { data: myClubsData } = useQuery<{ clubs: any[] }>({
    queryKey: ["/api/clubs/my-clubs"],
    enabled: !!user,
  });

  const isMember = useMemo(() => {
    const list = myClubsData?.clubs;
    if (!Array.isArray(list) || !clubId) return false;

    // /api/clubs/my-clubs returns rows like: { club: ClubRow, membership: ..., memberCount: ... }
    // Be defensive in case of partial/legacy data.
    return list.some((c: any) => c?.club?.id === clubId || c?.clubId === clubId || c?.id === clubId);
  }, [myClubsData?.clubs, clubId]);

  // Join club mutation
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
      queryClient.invalidateQueries({ queryKey: ["/api/clubs/my-clubs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ title: "✓ Joined club", description: "Welcome to the club!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to join club", description: error.message, variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/clubs/my-clubs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ title: "✓ Left club" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to leave club", description: error.message, variant: "destructive" });
    },
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/clubs/${clubId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create post");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/posts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}`] });
      toast({ title: "✓ Post created" });
      setNewPostContent("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create post", description: error.message, variant: "destructive" });
    },
  });

  const handleCreatePost = () => {
    if (!newPostContent.trim()) {
      toast({ title: "Content required", description: "Please enter post content", variant: "destructive" });
      return;
    }
    createPostMutation.mutate(newPostContent);
  };


  const updatePostMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const res = await fetch(`/api/clubs/${clubId}/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update post");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/${clubId}/posts`] });
      toast({ title: "✓ Post saved" });
      setEditingPostId(null);
      setEditPostContent("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save post", description: error.message, variant: "destructive" });
    },
  });

  const startEditingPost = (post: Post) => {
    setEditingPostId(post.post.id);
    setEditPostContent(post.post.content);
  };

  const cancelEditingPost = () => {
    setEditingPostId(null);
    setEditPostContent("");
  };

  const saveEditedPost = () => {
    if (!editingPostId) return;

    if (!editPostContent.trim()) {
      toast({ title: "Content required", description: "Please enter post content", variant: "destructive" });
      return;
    }

    updatePostMutation.mutate({ postId: editingPostId, content: editPostContent.trim() });
  };

  if (clubLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        </div>
      </div>
    );
  }

  // Normalize data shape (defensive)
  const club = clubData?.club?.club;
  const creator = clubData?.club?.creator;
  const stats = clubData?.stats;

  if (!club || !creator || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-600">Club not found</p>
              <Link href="/clubs">
                <Button className="mt-4">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Clubs
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const posts = postsData?.posts || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Link href="/clubs">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clubs
          </Button>
        </Link>

        {/* Club Header */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-2xl font-bold">{club.name}</CardTitle>
                </div>

                {club.description ? (
                  <CardDescription className="text-base">{club.description}</CardDescription>
                ) : (
                  <CardDescription className="text-base text-slate-500">No description</CardDescription>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="secondary" className="capitalize">
                    {club.category}
                  </Badge>
                  {club.isPublic ? (
                    <Badge variant="outline">Public</Badge>
                  ) : (
                    <Badge variant="outline">Private</Badge>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center justify-end gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {stats.memberCount}
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    {stats.postCount}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 text-xs text-slate-500 mt-2">
                  <Calendar className="h-3 w-3" />
                  {new Date(club.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Creator & Join/Leave */}
            <div className="flex items-center justify-between gap-4 pt-2 border-t">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>
                    {(creator.displayName || creator.username || "U").slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <div className="text-sm font-medium">
                    {creator.displayName || creator.username}
                  </div>
                  <div className="text-xs text-slate-500">@{creator.username}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!user ? (
                  <Link href="/login">
                    <Button>Log in to Join</Button>
                  </Link>
                ) : isMember ? (
                  <Button
                    variant="outline"
                    onClick={() => leaveClubMutation.mutate()}
                    disabled={leaveClubMutation.isPending}
                  >
                    {leaveClubMutation.isPending ? "Leaving..." : "Leave Club"}
                  </Button>
                ) : (
                  <Button onClick={() => joinClubMutation.mutate()} disabled={joinClubMutation.isPending}>
                    {joinClubMutation.isPending ? "Joining..." : "Join Club"}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Rules */}
        {club.rules ? (
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Club Rules</CardTitle>
              <CardDescription className="whitespace-pre-wrap">{club.rules}</CardDescription>
            </CardHeader>
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
                placeholder="Write your post..."
                rows={4}
              />
              <div className="flex justify-end">
                <Button onClick={handleCreatePost} disabled={createPostMutation.isPending}>
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
            <CardTitle className="text-lg">Club Posts</CardTitle>
            <CardDescription>
              {postsLoading ? "Loading posts..." : `${posts.length} post${posts.length === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {!postsLoading && posts.length === 0 ? (
              <div className="text-center text-slate-500 py-10">No posts yet.</div>
            ) : (
              posts.map((p) => (
                <Card key={p.post.id} className="border border-slate-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {(p.author.displayName || p.author.username || "U").slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="leading-tight">
                        <div className="text-sm font-medium">
                          {p.author.displayName || p.author.username}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(p.post.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {editingPostId === p.post.id ? (
                      <>
                        <Textarea
                          value={editPostContent}
                          onChange={(e) => setEditPostContent(e.target.value)}
                          rows={3}
                        />
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
                        {user?.id === p.post.userId && (
                          <div className="flex justify-end">
                            <Button variant="outline" size="sm" onClick={() => startEditingPost(p)}>
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
