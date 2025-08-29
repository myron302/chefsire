import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import PostCard from "@/components/post-card";
import RecipeCard from "@/components/recipe-card";
import { Search, Grid, List } from "lucide-react";
import type { PostWithUser } from "@shared/schema";

export default function Explore() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  const { data: posts, isLoading } = useQuery<PostWithUser[]>({
    queryKey: ["/api/posts/explore"],
  });

  const categories = ["All", "Italian", "Healthy", "Desserts", "Quick", "Vegan", "Seafood", "Asian"];

  const filteredPosts = posts?.filter(post => {
    const matchesSearch = !searchTerm || 
      post.caption?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = !selectedCategory || selectedCategory === "All" ||
      post.tags?.some(tag => tag.toLowerCase() === selectedCategory.toLowerCase());
    
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(9)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="w-full h-48 bg-muted" />
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="w-3/4 h-4 bg-muted rounded" />
                  <div className="w-1/2 h-3 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Explore</h1>
        
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Search recipes, chefs, or ingredients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 max-w-md"
            data-testid="input-explore-search"
          />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((category) => (
            <Badge
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              className="cursor-pointer transition-colors"
              onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
              data-testid={`category-filter-${category.toLowerCase()}`}
            >
              {category}
            </Badge>
          ))}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredPosts?.length || 0} posts found
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
              data-testid="button-grid-view"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              data-testid="button-list-view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Posts Grid/List */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts?.map((post) => (
            <Card key={post.id} className="group cursor-pointer hover:shadow-lg transition-shadow">
              <div className="relative overflow-hidden">
                <img
                  src={post.imageUrl}
                  alt="Post"
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  data-testid={`img-explore-post-${post.id}`}
                />
                {post.isRecipe && (
                  <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">
                    Recipe
                  </Badge>
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <img
                    src={post.user.avatar || ""}
                    alt={post.user.displayName}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-sm font-medium">{post.user.displayName}</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {post.caption}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>♥ {post.likesCount}</span>
                  <span>💬 {post.commentsCount}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {filteredPosts?.map((post) =>
            post.isRecipe ? (
              <RecipeCard key={post.id} post={post} />
            ) : (
              <PostCard key={post.id} post={post} />
            )
          )}
        </div>
      )}

      {/* Empty State */}
      {filteredPosts?.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">No posts found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search terms or category filters.
          </p>
        </div>
      )}
    </div>
  );
}
