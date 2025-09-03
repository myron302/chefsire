import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { StoryWithUser } from "@shared/schema";
import "./StorySection.css";

interface StorySectionProps {
  userId: string;
  onCreateStory: () => void;
}

export default function StorySection({ userId, onCreateStory }: StorySectionProps) {
  const { data: stories, isLoading } = useQuery<StoryWithUser[]>({
    queryKey: ["/api/stories/active", userId], // Updated to match schema
  });

  // Mock data for 5 sample stories with unique images (remove after API is populated)
  const sampleStories: StoryWithUser[] = [
    {
      id: "1",
      imageUrl: "https://via.placeholder.com/150?text=Chef+John+Story",
      user: { id: "user1", displayName: "Chef John", email: "john@example.com", username: "chefjohn" }, // Minimal user data
      caption: "My latest recipe!",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      createdAt: new Date().toISOString(),
    },
    {
      id: "2",
      imageUrl: "https://via.placeholder.com/150?text=Chef+Maria+Story",
      user: { id: "user2", displayName: "Chef Maria", email: "maria@example.com", username: "chefmaria" },
      caption: "Cooking tonight!",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: "3",
      imageUrl: "https://via.placeholder.com/150?text=Chef+Alex+Story",
      user: { id: "user3", displayName: "Chef Alex", email: "alex@example.com", username: "chefalex" },
      caption: "New technique!",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: "4",
      imageUrl: "https://via.placeholder.com/150?text=Chef+Emma+Story",
      user: { id: "user4", displayName: "Chef Emma", email: "emma@example.com", username: "chefemma" },
      caption: "Dessert time!",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: "5",
      imageUrl: "https://via.placeholder.com/150?text=Chef+Luca+Story",
      user: { id: "user5", displayName: "Chef Luca", email: "luca@example.com", username: "chefluca" },
      caption: "Italian classics!",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];

  const displayStories = stories && stories.length > 0 ? stories : sampleStories;

  if (isLoading) {
    return (
      <section className="mb-8">
        <div className="flex space-x-4 pb-4 overflow-x-auto">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 text-center animate-pulse">
              <div className="w-16 h-16 bg-muted rounded-full mb-2" />
              <div className="w-12 h-3 bg-muted rounded mx-auto" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2>Chef's Corner</h2>
      <div className="chef-corner-border">
        <div className="flex space-x-4 pb-4 overflow-x-auto">
          {/* Add Your Story */}
          <div className="flex-shrink-0 text-center">
            <Button
              onClick={onCreateStory}
              variant="ghost"
              className="w-16 h-16 rounded-full bg-muted border-2 border-dashed border-border p-0 hover:scale-105 transition-transform"
              data-testid="button-create-story"
            >
              <Plus className="h-6 w-6 text-muted-foreground" />
            </Button>
            <span className="text-xs text-muted-foreground block mt-2">Your Story</span>
          </div>

          {/* Stories */}
          {displayStories.map((story) => (
            <div key={story.id} className="flex-shrink-0 text-center">
              <Button
                variant="ghost"
                className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-r from-[#FFA500]/20 to-[#FF7518]/20 hover:scale-105 transition-transform"
                data-testid={`story-${story.id}`}
              >
                <Avatar className="w-full h-full">
                  <AvatarImage src={story.imageUrl} alt={story.user.displayName} />
                  <AvatarFallback>{story.user.displayName[0]}</AvatarFallback>
                </Avatar>
              </Button>
              <span className="text-xs text-muted-foreground block mt-2 truncate w-16">
                {story.user.displayName.split(" ")[0]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
