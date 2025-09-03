import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { StoryWithUser } from "@shared/schema";
import './StorySection.css';

interface StorySectionProps {
  userId: string;
  onCreateStory: () => void;
}

export default function StorySection({ userId, onCreateStory }: StorySectionProps) {
  const { data: bites, isLoading } = useQuery<StoryWithUser[]>({
    queryKey: ["/api/bites/active", userId],
  });

  if (isLoading) {
    return (
      <section className="mb-8">
        <div className="flex space-x-4 pb-4 overflow-x-auto">
          {[...Array(4)].map((_, i) => ( // Updated to 4 placeholders
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
          {/* Add Your Bite */}
          <div className="flex-shrink-0 text-center">
            <Button
              onClick={onCreateStory}
              variant="ghost"
              className="w-16 h-16 rounded-full bg-muted border-2 border-dashed border-border p-0 hover:scale-105 transition-transform"
              data-testid="button-create-bite"
            >
              <Plus className="h-6 w-6 text-muted-foreground" />
            </Button>
            <span className="text-xs text-muted-foreground block mt-2">Your Bite</span>
          </div>

          {/* Bites */}
          {bites?.map((bite) => (
            <div key={bite.id} className="flex-shrink-0 text-center">
              <Button
                variant="ghost"
                className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-r from-[#FFA500] to-[#FF7518] hover:scale-105 transition-transform"
                data-testid={`bite-${bite.id}`}
              >
                <Avatar className="w-full h-full">
                  <AvatarImage src={bite.imageUrl} alt={bite.user.displayName} />
                  <AvatarFallback>{bite.user.displayName[0]}</AvatarFallback>
                </Avatar>
              </Button>
              <span className="text-xs text-muted-foreground block mt-2 truncate w-16">
                {bite.user.displayName.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
