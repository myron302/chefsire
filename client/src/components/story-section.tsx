import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { StoryWithUser } from "@shared/schema";

interface StorySectionProps {
  userId: string;
  onCreateStory: () => void;
}

export default function StorySection({ userId, onCreateStory }: StorySectionProps) {
  const { data: stories, isLoading } = useQuery<StoryWithUser[]>({
    queryKey: ["/api/stories/active", userId],
  });

  if (isLoading) {
    return (
      <section className="mb-8">
        <div className="flex space-x-4 pb-4 overflow-x-auto">
          {[...Array(5)].map((_, i) => (
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
        {stories?.map((story) => (
          <div key={story.id} className="flex-shrink-0 text-center">
            <Button
              variant="ghost"
              className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-r from-primary to-accent hover:scale-105 transition-transform"
              data-testid={`story-${story.id}`}
            >
              <Avatar className="w-full h-full">
                <AvatarImage src={story.imageUrl} alt={story.user.displayName} />
                <AvatarFallback>{story.user.displayName[0]}</AvatarFallback>
              </Avatar>
            </Button>
            <span className="text-xs text-muted-foreground block mt-2 truncate w-16">
              {story.user.displayName.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
