import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CreatorFollowButton } from "@/components/nutrition/social/MealPlannerSocial";
import { ChefHat, Heart, MessageCircle, Search, ShoppingBag, Users } from "lucide-react";

type Creator = {
  creatorId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  specialty: string | null;
  followerCount: number;
  planCount: number;
  sharedWeekCount: number;
  totalLikes: number;
  totalSaves: number;
  totalComments: number;
  totalSales: number;
  viewerIsFollowing: boolean;
};

export default function MealPlanCreatorsDiscoveryPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("most-followed");
  const { data, isLoading, error } = useQuery<{ creators: Creator[] }>({ queryKey: ["/api/meal-plan-creators"] });
  const creators = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = data?.creators || [];
    if (filter === "marketplace-sellers") rows = rows.filter((creator) => creator.planCount > 0 || creator.totalSales > 0);
    if (filter === "shared-week-creators") rows = rows.filter((creator) => creator.sharedWeekCount > 0);
    if (q) rows = rows.filter((creator) => [creator.displayName, creator.username, creator.bio, creator.specialty].some((value) => String(value || "").toLowerCase().includes(q)));
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (filter === "most-liked") return b.totalLikes - a.totalLikes;
      if (filter === "most-saved") return b.totalSaves - a.totalSaves;
      if (filter === "most-active") return (b.planCount + b.sharedWeekCount + b.totalComments) - (a.planCount + a.sharedWeekCount + a.totalComments);
      if (filter === "marketplace-sellers") return (b.totalSales + b.planCount) - (a.totalSales + a.planCount);
      if (filter === "shared-week-creators") return b.sharedWeekCount - a.sharedWeekCount;
      return b.followerCount - a.followerCount;
    });
    return sorted;
  }, [data?.creators, search, filter]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl"><ChefHat className="h-6 w-6 text-green-600" /> Meal Plan Creators</CardTitle>
          <CardDescription>Discover creators with marketplace plans, public shared weeks, and social planner activity.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search creators, specialties, or bios…" className="pl-10" />
            </div>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="most-followed">Most followed</option>
              <option value="most-liked">Most liked</option>
              <option value="most-saved">Most saved</option>
              <option value="most-active">Most active</option>
              <option value="marketplace-sellers">Marketplace sellers</option>
              <option value="shared-week-creators">Shared-week creators</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading creators…</p> : null}
      {error ? <Card><CardHeader><CardTitle>Unable to load creators</CardTitle><CardDescription>Please try again later.</CardDescription></CardHeader></Card> : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {creators.map((creator) => (
          <Card key={creator.creatorId} className="overflow-hidden">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <Avatar className="h-14 w-14"><AvatarImage src={creator.avatarUrl || undefined} /><AvatarFallback>{(creator.displayName || creator.username || "C").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold">{creator.displayName || creator.username}</h2>
                  <p className="text-sm text-muted-foreground">@{creator.username}</p>
                  {creator.specialty ? <Badge className="mt-2" variant="secondary">{creator.specialty}</Badge> : null}
                </div>
              </div>
              {creator.bio ? <p className="line-clamp-3 text-sm text-muted-foreground">{creator.bio}</p> : <p className="text-sm text-muted-foreground">This creator is sharing meal-planning content.</p>}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Stat icon={<Users className="h-4 w-4" />} label="Followers" value={creator.followerCount} />
                <Stat icon={<ShoppingBag className="h-4 w-4" />} label="Plans" value={creator.planCount} />
                <Stat icon={<ChefHat className="h-4 w-4" />} label="Shared weeks" value={creator.sharedWeekCount} />
                <Stat icon={<Heart className="h-4 w-4" />} label="Likes" value={creator.totalLikes} />
                <Stat icon={<MessageCircle className="h-4 w-4" />} label="Comments" value={creator.totalComments} />
                <Stat icon={<ShoppingBag className="h-4 w-4" />} label="Sales" value={creator.totalSales} />
              </div>
              <div className="flex gap-2">
                <CreatorFollowButton creatorId={creator.creatorId} compact />
                <Button asChild variant="outline" className="flex-1"><Link href={`/nutrition/creators/${creator.creatorId}`}>View profile</Link></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-lg border p-2"><div className="flex items-center gap-1 font-semibold">{icon}{Number(value || 0).toLocaleString()}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}
