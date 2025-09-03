import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PostCard from "@/components/post-card";
import RecipeCard from "@/components/recipe-card";
import { StoriesRow } from "@/components/StoriesRow";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { PostWithUser, User, Recipe } from "@shared/schema";

export default function Feed() {
  const currentUserId = "user-1"; // In a real app, this would come from authentication

  const { data: posts, isLoading: postsLoading } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/feed", currentUserId],
  });

  const { data: suggestedUsers, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users", currentUserId, "suggested"],
  });

  const { data: trendingRecipes, isLoading: recipesLoading } = useQuery<(Recipe & { post: PostWithUser })[]>({
    queryKey: ["/api/recipes/trending"],
  });

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
      {/* Main Feed */}
      <div className="flex-1 max-w-4xl px-4 py-6">
        {/* Stories Section */}
        <BitesRow />

        {/* Feed Posts */}
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

        {/* Load More */}
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

      {/* Right Sidebar */}
      <aside className="hidden xl:block w-80 p-6 bg-card border-l border-border">
        {/* Suggested Chefs */}
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
              {suggestedUsers?.map((user) => (
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

        {/* Trending Recipes */}
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
              {trendingRecipes?.map((recipe) => (
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

        {/* Popular Categories */}
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
