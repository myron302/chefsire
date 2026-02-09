import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, TrendingUp, MessageSquare, Search, Filter } from "lucide-react";

type Club = {
  club: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    coverImage: string | null;
    isPublic: boolean;
    createdAt: string;
  };
  memberCount: number;
  postCount: number;
};

export default function ClubsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [fallbackClubs, setFallbackClubs] = useState<Club[]>([]);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const [clubForm, setClubForm] = useState({
    name: "",
    description: "",
    category: "general",
    rules: "",
  });

  useEffect(() => {
    const saved = localStorage.getItem("royal_clubs_fallback");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Club[];
      if (Array.isArray(parsed)) {
        setFallbackClubs(parsed);
      }
    } catch {
      localStorage.removeItem("royal_clubs_fallback");
    }
  }, []);

  // Fetch clubs
  const { data: clubsData, isLoading } = useQuery({
    queryKey: ["/api/clubs", { search: searchQuery, category: categoryFilter, sort: sortBy }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (sortBy !== "newest") params.set("sort", sortBy);

      const url = `/api/clubs${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });

      if (!res.ok) {
        setBackendUnavailable(true);
        return { clubs: fallbackClubs };
      }

      setBackendUnavailable(false);
      return res.json();
    },
  });

  const clubs: Club[] = clubsData?.clubs || [];

  // Create club mutation
  const createClubMutation = useMutation({
    mutationFn: async (data: typeof clubForm) => {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        let errorMessage = "Failed to create club";

        try {
          const error = await res.json();
          errorMessage = error.message || errorMessage;
        } catch {
          // Ignore JSON parsing failures and keep default message
        }

        throw new Error(errorMessage);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs"] });
      toast({ title: "✓ Club created", description: "Your club has been created successfully!" });
      setShowCreateDialog(false);
      setClubForm({ name: "", description: "", category: "general", rules: "" });
    },
    onError: (error: Error) => {
      const fallbackClub: Club = {
        club: {
          id: `local-${crypto.randomUUID()}`,
          name: clubForm.name,
          description: clubForm.description || null,
          category: clubForm.category,
          coverImage: null,
          isPublic: true,
          createdAt: new Date().toISOString(),
        },
        memberCount: 1,
        postCount: 0,
      };

      const updatedFallbackClubs = [fallbackClub, ...fallbackClubs];
      setFallbackClubs(updatedFallbackClubs);
      localStorage.setItem("royal_clubs_fallback", JSON.stringify(updatedFallbackClubs));
      setShowCreateDialog(false);
      setClubForm({ name: "", description: "", category: "general", rules: "" });
      setBackendUnavailable(true);

      toast({
        title: "Backend unavailable: saved locally",
        description: `${error.message}. Club saved in local mode until Neon/backend is configured.`,
      });

      queryClient.setQueryData(["/api/clubs", { search: searchQuery, category: categoryFilter, sort: sortBy }], {
        clubs: updatedFallbackClubs,
      });
    },
  });

  const handleCreateClub = () => {
    if (!clubForm.name.trim()) {
      toast({ title: "Name required", description: "Please enter a club name", variant: "destructive" });
      return;
    }
    createClubMutation.mutate(clubForm);
  };

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "general", label: "General" },
    { value: "cooking", label: "Cooking" },
    { value: "baking", label: "Baking" },
    { value: "drinks", label: "Drinks" },
    { value: "health", label: "Health & Nutrition" },
    { value: "regional", label: "Regional Cuisine" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            🏛️ Royal Clubs
          </h1>
          <p className="text-slate-600">Join communities, participate in challenges, and earn badges!</p>
          {backendUnavailable && (
            <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 inline-block">
              Backend is currently unavailable. Royal Clubs is running in local mode (saved in this browser).
            </p>
          )}
        </div>

        {/* Actions Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search clubs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <TrendingUp className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="members">Most Members</SelectItem>
              <SelectItem value="activity">Most Active</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Club
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a New Club</DialogTitle>
                <DialogDescription>
                  Start a community around your favorite cooking topics!
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Club Name</Label>
                  <Input
                    id="name"
                    value={clubForm.name}
                    onChange={(e) => setClubForm({ ...clubForm, name: e.target.value })}
                    placeholder="e.g., Vegan Bakers United"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={clubForm.description}
                    onChange={(e) => setClubForm({ ...clubForm, description: e.target.value })}
                    placeholder="What is your club about?"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={clubForm.category} onValueChange={(value) => setClubForm({ ...clubForm, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => c.value !== "all").map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="rules">Club Rules (Optional)</Label>
                  <Textarea
                    id="rules"
                    value={clubForm.rules}
                    onChange={(e) => setClubForm({ ...clubForm, rules: e.target.value })}
                    placeholder="Guidelines for members..."
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleCreateClub}
                  disabled={createClubMutation.isPending}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  {createClubMutation.isPending ? "Creating..." : "Create Club"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Clubs Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : clubs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <p className="text-slate-600 mb-4">
                {searchQuery || categoryFilter !== "all"
                  ? "No clubs found matching your filters"
                  : "No clubs yet. Be the first to create one!"}
              </p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create the First Club
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clubs.map(({ club, memberCount, postCount }) => (
              <Link key={club.id} href={`/clubs/${club.id}`}>
                <Card className="hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer border-2 border-slate-200 hover:border-purple-400">
                  {club.coverImage && (
                    <div className="h-32 bg-gradient-to-r from-purple-400 to-pink-400 rounded-t-lg"></div>
                  )}
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{club.name}</span>
                      {club.isPublic ? (
                        <Badge variant="outline">Public</Badge>
                      ) : (
                        <Badge variant="secondary">Private</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {club.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{memberCount} members</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>{postCount} posts</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Badge variant="secondary">{club.category}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
