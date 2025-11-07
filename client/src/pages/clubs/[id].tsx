import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { Users, MessageSquare, ArrowLeft, Send, Calendar, Crown } from "lucide-react";

type Club = {
  club: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    coverImage: string | null;
    isPublic: boolean;
    rules: string | null;
    createdAt: string;
  };
  creator: {
    id: string;
    username: string;
    displayName: string | null;
  };
  stats: {
    memberCount: number;
    postCount: number;
  };
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const [newPostContent, setNewPostContent] = useState("");

  // Fetch club details
  const { data: clubData, isLoading: clubLoading } = useQuery<Club>({
    queryKey: [`/api/clubs/clubs/${id}`],
  });

  // Fetch club posts
  const { data: postsData, isLoading: postsLoading } = useQuery<{ posts: Post[] }>({
    queryKey: [`/api/clubs/clubs/${id}/posts`],
  });

  // Check membership status
  const { data: myClubsData } = useQuery<{ clubs: any[] }>({
    queryKey: ["/api/clubs/my-clubs"],
    enabled: !!user,
  });

  const isMember = myClubsData?.clubs?.some(
    (c: any) => c.club.id === id
  );

  // Join club mutation
  const joinClubMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clubs/clubs/${id}/join`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to join club");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs/my-clubs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/clubs/${id}`] });
      toast({ title: "✓ Joined club", description: "Welcome to the club!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to join club", description: error.message, variant: "destructive" });
    },
  });

  // Leave club mutation
  const leaveClubMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clubs/clubs/${id}/leave`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to leave club");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs/my-clubs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/clubs/${id}`] });
      toast({ title: "✓ Left club" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to leave club", description: error.message, variant: "destructive" });
    },
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/clubs/clubs/${id}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create post");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/clubs/${id}/posts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clubs/clubs/${id}`] });
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

  if (!clubData) {
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

  const { club, creator, stats } = clubData;
  const posts = postsData?.posts || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Link href="/clubs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clubs
          </Button>
        </Link>

        {/* Club Header */}
        <Card>
          {club.coverImage && (
            <div className="h-48 bg-gradient-to-r from-purple-400 to-pink-400 rounded-t-lg"></div>
          )}
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-3xl mb-2">{club.name}</CardTitle>
                <CardDescription className="text-base">
                  {club.description || "No description"}
                </CardDescription>
                <div className="flex items-center gap-4 mt-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{stats.memberCount} members</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    <span>{stats.postCount} posts</span>
                  </div>
                  <Badge variant="secondary">{club.category}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                  <Crown className="h-3 w-3" />
                  <span>
                    Created by{" "}
                    <Link href={`/profile/${creator.id}`}>
                      <span className="text-purple-600 hover:underline cursor-pointer">
                        {creator.displayName || creator.username}
                      </span>
                    </Link>
                  </span>
                </div>
              </div>
              <div>
                {!user ? (
                  <Link href="/login">
                    <Button>Login to Join</Button>
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
                  <Button
                    onClick={() => joinClubMutation.mutate()}
                    disabled={joinClubMutation.isPending}
                    className="bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    {joinClubMutation.isPending ? "Joining..." : "Join Club"}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          {club.rules && (
            <CardContent>
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Club Rules</h3>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{club.rules}</p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Create Post Section (members only) */}
        {user && isMember && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create a Post</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  placeholder="Share something with the club..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleCreatePost}
                  disabled={createPostMutation.isPending || !newPostContent.trim()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {createPostMutation.isPending ? "Posting..." : "Post"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Posts Feed */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Club Posts</h2>
          {postsLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            </div>
          ) : posts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <p className="text-slate-600">No posts yet. Be the first to share!</p>
              </CardContent>
            </Card>
          ) : (
            posts.map(({ post, author }) => (
              <Card key={post.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {(author.displayName || author.username).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <Link href={`/profile/${author.id}`}>
                        <p className="font-semibold hover:underline cursor-pointer">
                          {author.displayName || author.username}
                        </p>
                      </Link>
                      <p className="text-sm text-slate-500">
                        {new Date(post.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{post.content}</p>
                  {post.imageUrl && (
                    <img
                      src={post.imageUrl}
                      alt="Post"
                      className="mt-4 rounded-lg max-w-full"
                    />
                  )}
                  <div className="flex items-center gap-4 mt-4 text-sm text-slate-600">
                    <button className="hover:text-purple-600 transition-colors">
                      ❤️ {post.likesCount}
                    </button>
                    <button className="hover:text-purple-600 transition-colors">
                      💬 {post.commentsCount}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
