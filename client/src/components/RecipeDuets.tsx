// client/src/components/RecipeDuets.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, Play, User2 } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

type RecipeDuet = {
  id: string;
  originalRecipeId: string;
  originalUserId: string;
  duetUserId: string;
  duetVideoUrl?: string;
  duetImageUrl?: string;
  caption?: string;
  likesCount: number;
  viewsCount: number;
  createdAt: string;
  duetUser: {
    id: string;
    displayName: string;
    avatar?: string;
  };
  originalUser: {
    id: string;
    displayName: string;
    avatar?: string;
  };
  recipe?: {
    title: string;
    imageUrl?: string;
  };
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function postJSON<T>(url: string, data?: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

interface RecipeDuetsProps {
  recipeId: string;
  limit?: number;
}

export function RecipeDuets({ recipeId, limit = 10 }: RecipeDuetsProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [showCreateDuet, setShowCreateDuet] = useState(false);

  const { data, isLoading, error } = useQuery<{ duets: RecipeDuet[] }>({
    queryKey: ["/api/duets/recipe", recipeId],
    queryFn: () => fetchJSON<{ duets: RecipeDuet[] }>(`/api/duets/recipe/${recipeId}?limit=${limit}`),
  });

  const likeMutation = useMutation({
    mutationFn: (duetId: string) => postJSON(`/api/duets/${duetId}/like`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/duets/recipe", recipeId] });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recipe Duets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-lg mb-2" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Unable to load duets</p>
        </CardContent>
      </Card>
    );
  }

  const duets = data?.duets || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Recipe Duets
            {duets.length > 0 && (
              <Badge variant="secondary">{duets.length}</Badge>
            )}
          </CardTitle>
          {user && (
            <Button
              size="sm"
              onClick={() => setShowCreateDuet(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              Create Duet
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {duets.length === 0 ? (
          <div className="text-center py-8">
            <Play className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">
              No duets yet. Be the first to duet this recipe!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {duets.map((duet) => (
              <DuetCard
                key={duet.id}
                duet={duet}
                onLike={() => likeMutation.mutate(duet.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DuetCard({ duet, onLike }: { duet: RecipeDuet; onLike: () => void }) {
  const [isLiked, setIsLiked] = useState(false);

  const handleLike = () => {
    setIsLiked(!isLiked);
    onLike();
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-all">
      {/* Side-by-side video/image preview */}
      <div className="grid grid-cols-2 gap-0.5 bg-black">
        {/* Original Recipe Side */}
        <div className="relative aspect-video bg-muted">
          {duet.recipe?.imageUrl ? (
            <img
              src={duet.recipe.imageUrl}
              alt="Original recipe"
              className="w-full h-full object-cover opacity-60"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User2 className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          <div className="absolute bottom-2 left-2">
            <Badge variant="secondary" className="text-xs">
              Original
            </Badge>
          </div>
        </div>

        {/* Duet Side */}
        <div className="relative aspect-video bg-muted">
          {duet.duetImageUrl ? (
            <img
              src={duet.duetImageUrl}
              alt={`Duet by ${duet.duetUser.displayName}`}
              className="w-full h-full object-cover"
            />
          ) : duet.duetVideoUrl ? (
            <video
              src={duet.duetVideoUrl}
              className="w-full h-full object-cover"
              controls
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User2 className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          <div className="absolute bottom-2 right-2">
            <Badge className="text-xs bg-gradient-to-r from-purple-500 to-pink-500">
              Duet
            </Badge>
          </div>
        </div>
      </div>

      {/* Duet Info */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={duet.duetUser.avatar} />
              <AvatarFallback>{duet.duetUser.displayName[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{duet.duetUser.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(duet.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className="gap-2"
          >
            <Heart
              className={`h-4 w-4 ${isLiked ? "fill-red-500 text-red-500" : ""}`}
            />
            <span className="text-sm">{duet.likesCount}</span>
          </Button>
        </div>

        {duet.caption && (
          <p className="text-sm text-muted-foreground">{duet.caption}</p>
        )}
      </div>
    </div>
  );
}

// Export just the component
export default RecipeDuets;
