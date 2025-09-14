import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PostCard from "@/components/post-card";
import RecipeCard from "@/components/recipe-card";
import { BitesRow } from "@/components/BitesRow";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { PostWithUser, User, Recipe } from "@shared/schema";

const demoTrendingRecipes = [
  {
    id: "1",
    title: "Creamy Mushroom Risotto",
    cookTime: 35,
    post: {
      id: "post-1",
      imageUrl: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400&h=400&fit=crop&auto=format",
      user: {
        id: "chef-1",
        displayName: "Marco Romano"
      },
      likesCount: 245
    }
  },
  {
    id: "2", 
    title: "Classic Fish & Chips",
    cookTime: 25,
    post: {
      id: "post-2",
      imageUrl: "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=400&h=400&fit=crop&auto=format",
      user: {
        id: "chef-2",
        displayName: "Emma Watson"
      },
      likesCount: 189
    }
  },
  {
    id: "3",
    title: "Spicy Thai Green Curry",
    cookTime: 30,
    post: {
      id: "post-3", 
      imageUrl: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&h=400&fit=crop&auto=format",
      user: {
        id: "chef-3",
        displayName: "Anong Siriporn"
      },
      likesCount: 312
    }
  },
  {
    id: "4",
    title: "Chocolate Lava Cake",
    cookTime: 20,
    post: {
      id: "post-4",
      imageUrl: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=400&fit=crop&auto=format",
      user: {
        id: "chef-4",
        displayName: "Pierre Dubois"
      },
      likesCount: 567
    }
  },
  {
    id: "5",
    title: "Fresh Caesar Salad",
    cookTime: 15,
    post: {
      id: "post-5",
      imageUrl: "https://images.unsplash.com/photo-1551248429-40975aa4de74?w=400&h=400&fit=crop&auto=format", 
      user: {
        id: "chef-5",
        displayName: "Julia Green"
      },
      likesCount: 134
    }
  }
];

const demoSuggestedUsers = [
  {
    id: "chef-6",
    displayName: "Gordon Ramsay",
    specialty: "Fine Dining",
    avatar: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=100&h=100&fit=crop&auto=format"
  },
  {
    id: "chef-7", 
    displayName: "Nadia Singh",
    specialty: "Indian Cuisine",
    avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&auto=format"
  },
  {
    id: "chef-8",
    displayName: "Carlos Rodriguez", 
    specialty: "Mexican Street Food",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&auto=format"
  },
  {
    id: "chef-9",
    displayName: "Sakura Tanaka",
    specialty: "Japanese Fusion", 
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&auto=format"
  },
  {
    id: "chef-10",
    displayName: "Oliver Bennett",
    specialty: "Plant-Based",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&auto=format"
  }
];

export default function Feed() {
  const currentUserId = "user-1";

  const { data: posts, isLoading: postsLoading } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/feed", currentUserId],
  });

  const { data: suggestedUsers, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users", currentUserId, "suggested"],
  });

  const { data: trendingRecipes, isLoading: recipesLoading } = useQuery<(Recipe & { post: PostWithUser })[]>({
    queryKey: ["/api/recipes/trending"],
  });

  const displaySuggestedUsers = suggestedUsers || demoSuggestedUsers;
  const displayTrendingRecipes = trendingRecipes || demoTrendingRecipes;

  if (postsLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-8">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="w-full animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-muted rounded-full" />
                  <div className="space-y-2">
                    <div className="w-24 h-3 bg-muted rounded" />
                    <div className="w-16 h-2 bg-muted rounded" />
                  </div>
                </div>
                <div className="w-full h-96 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-7xl mx-auto">
      <div className="flex-1 max-w-4xl px-4 py-6">
        <BitesRow />

        <div className="space-y-8">
          {posts?.map((post) => 
            post.isRecipe ? (
              <RecipeCard 
                key={post.id} 
                post={post} 
                currentUserId={currentUserId} 
              />
            ) : (
              <PostCard 
                key={post.id} 
                post={post} 
                currentUserId={currentUserId} 
              />
            )
          )}
        </div>

        <div className="flex justify-center mt-8">
          <Button 
            variant="outline" 
            className="px-6 py-3"
            data-testid="button-load-more"
          >
            Load More Posts
          </Button>
        </div>
      </div>

      <aside className="hidden xl:block w-80 p-6 bg-card border-l border-border">
        <section className="mb-8">
          <h3 className="font-semibold mb-4">Suggested Chefs</h3>
          {usersLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between animate-pulse">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-muted rounded-full" />
                    <div className="space-y-2">
                      <div className="w-20 h-3 bg-muted rounded" />
                      <div className="w-16 h-2 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="w-16 h-6 bg-muted rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {displaySuggestedUsers.slice(0, 5).map((user) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user.avatar || ""} alt={user.displayName} />
                      <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium" data-testid={`text-suggested-chef-${user.id}`}>
                        {user.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">{user.specialty}</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    className="bg-primary text-primary-foreground hover:opacity-90"
                    data-testid={`button-follow-${user.id}`}
                  >
                    Follow
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-8">
          <h3 className="font-semibold mb-4">Trending Recipes</h3>
          {recipesLoading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex space-x-3 animate-pulse">
                  <div className="w-12 h-12 bg-muted rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="w-24 h-3 bg-muted rounded" />
                    <div className="w-16 h-2 bg-muted rounded" />
                    <div className="w-20 h-2 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {displayTrendingRecipes.slice(0, 5).map((recipe) => (
                <div 
                  key={recipe.id} 
                  className="flex space-x-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                  data-testid={`trending-recipe-${recipe.id}`}
                >
                  <img 
                    src={recipe.post.imageUrl} 
                    alt={recipe.title}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{recipe.title}</p>
                    <p className="text-xs text-muted-foreground">by {recipe.post.user.displayName}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-destructive">♥ {recipe.post.likesCount}</span>
                      <span className="text-xs text-muted-foreground">• {recipe.cookTime} min</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="font-semibold mb-4">Popular Categories</h3>
          <div className="flex flex-wrap gap-2">
            {["Italian", "Healthy", "Desserts", "Quick", "Vegan"].map((category) => (
              <Badge
                key={category}
                variant="outline"
                className="cursor-pointer hover:bg-primary/20 transition-colors"
                data-testid={`category-${category.toLowerCase()}`}
              >
                #{category}
              </Badge>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
