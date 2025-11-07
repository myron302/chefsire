import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GitFork, Sparkles, ChefHat } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useMutation, useQuery } from "@tanstack/react-query";

type RemixStats = {
  originalId: string;
  remixCount: number;
  topRemixes: Array<{
    id: string;
    userId: string;
    remixType: string;
    createdAt: string;
    user?: { displayName: string; avatar?: string };
  }>;
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function postJSON<T>(url: string, data: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

type RecipeRemixButtonProps = {
  recipeId: string;
  recipeName: string;
  onRemixCreated?: (remixData: any) => void;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  showCount?: boolean;
};

export default function RecipeRemixButton({
  recipeId,
  recipeName,
  onRemixCreated,
  variant = "outline",
  size = "default",
  showCount = true,
}: RecipeRemixButtonProps) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRemixType, setSelectedRemixType] = useState<string>("variation");

  // Fetch remix stats
  const { data: remixStats } = useQuery<RemixStats>({
    queryKey: ["/api/remixes/recipe", recipeId],
    queryFn: () => fetchJSON<RemixStats>(`/api/remixes/recipe/${recipeId}`),
    enabled: showCount,
  });

  const createRemixMutation = useMutation({
    mutationFn: (data: {
      originalRecipeId: string;
      remixType: string;
      changes: any;
    }) => postJSON("/api/remixes", data),
    onSuccess: (data) => {
      setIsOpen(false);
      onRemixCreated?.(data);
      // Optionally navigate to edit page for the new remix
    },
  });

  const handleCreateRemix = () => {
    if (!user) {
      // Redirect to login
      window.location.href = "/login";
      return;
    }

    // For now, just create a placeholder remix entry
    // In a full implementation, this would navigate to a recipe editor
    createRemixMutation.mutate({
      originalRecipeId: recipeId,
      remixType: selectedRemixType,
      changes: {
        notes: `Remix of ${recipeName}`,
      },
    });
  };

  const remixTypes = [
    {
      value: "variation",
      label: "Variation",
      description: "Create your own twist on this recipe",
      icon: "🎨",
    },
    {
      value: "dietary_conversion",
      label: "Dietary Conversion",
      description: "Make it vegan, keto, gluten-free, etc.",
      icon: "🥗",
    },
    {
      value: "portion_adjustment",
      label: "Portion Adjustment",
      description: "Scale ingredients up or down",
      icon: "⚖️",
    },
    {
      value: "ingredient_swap",
      label: "Ingredient Swap",
      description: "Substitute ingredients for what you have",
      icon: "🔄",
    },
  ];

  if (!user) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant={variant} size={size} className="gap-2">
            <GitFork className="h-4 w-4" />
            Remix Recipe
            {showCount && remixStats && remixStats.remixCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {remixStats.remixCount}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Remix: {recipeName}
            </DialogTitle>
            <DialogDescription>
              Create your own version of this recipe. Choose how you'd like to customize it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {remixTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setSelectedRemixType(type.value)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedRemixType === type.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{type.icon}</div>
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">{type.label}</h4>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </div>
                  {selectedRemixType === type.value && (
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7"></path>
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {remixStats && remixStats.remixCount > 0 && (
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-2">
                <ChefHat className="h-4 w-4 inline mr-1" />
                {remixStats.remixCount} {remixStats.remixCount === 1 ? "chef has" : "chefs have"}{" "}
                remixed this recipe
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRemix} disabled={createRemixMutation.isPending}>
              {createRemixMutation.isPending ? "Creating..." : "Start Remixing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
