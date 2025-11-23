import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  X,
  Coffee,
  TrendingUp,
  Heart,
  Sparkles,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

type AISuggestion = {
  id: string;
  userId: string;
  suggestionType: string; // morning_drink, nutrition_gap, mood_based, recipe_remix, trending
  title: string;
  description: string;
  reason: string;
  recipeId?: string | null;
  linkUrl?: string | null;
  imageUrl?: string | null;
  priority: string;
  viewed: boolean;
  dismissed: boolean;
  createdAt: string;
  expiresAt?: string | null;
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

export default function AISuggestions() {
  const { user, loading } = useUser();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);

  const {
    data: suggestionsResponse,
    isLoading,
    error,
  } = useQuery<{ suggestions: AISuggestion[] }>({
    queryKey: ["/api/suggestions/today", user?.id],
    queryFn: () => fetchJSON<{ suggestions: AISuggestion[] }>(`/api/suggestions/today`),
    enabled: !loading && !!user?.id, // Only fetch when loading is done AND user exists
    retry: false, // Don't retry on error
  });

  // Extract suggestions array from response
  const suggestions = suggestionsResponse?.suggestions;

  const dismissMutation = useMutation({
    mutationFn: (suggestionId: string) =>
      postJSON(`/api/suggestions/${suggestionId}/dismiss`, { userId: user?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions/today", user?.id] });
    },
  });

  const handleDismiss = (suggestionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dismissMutation.mutate(suggestionId);
  };

  const getSuggestionIcon = (type: string) => {
    const icons: Record<string, typeof Lightbulb> = {
      morning_drink: Coffee,
      nutrition_gap: TrendingUp,
      mood_based: Heart,
      recipe_remix: Sparkles,
      trending: Sparkles,
    };
    const Icon = icons[type] || Lightbulb;
    return <Icon className="h-5 w-5" />;
  };

  const getSuggestionColor = (type: string) => {
    const colors: Record<string, string> = {
      morning_drink: "from-orange-500 to-yellow-500",
      nutrition_gap: "from-green-500 to-emerald-500",
      mood_based: "from-pink-500 to-rose-500",
      recipe_remix: "from-purple-500 to-indigo-500",
      trending: "from-blue-500 to-cyan-500",
    };
    return colors[type] || "from-gray-500 to-gray-600";
  };

  // Don't show while user context is loading
  if (loading) return null;

  // Don't show if user is logged out
  if (!user) return null;

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-muted rounded w-1/2 mb-4" />
            <div className="h-4 bg-muted rounded w-full mb-2" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ensure suggestions is always an array
  const suggestionsArray = Array.isArray(suggestions) ? suggestions : [];

  // Hide component if there's an error (e.g., tables don't exist yet)
  if (error) {
    console.warn("AI Suggestions error:", error);
    return null;
  }

  if (suggestionsArray.length === 0) {
    return null; // Don't show if no suggestions
  }

  const activeSuggestions = suggestionsArray.filter((s) => !s.dismissed);

  if (activeSuggestions.length === 0) {
    return null;
  }

  const currentSuggestion = activeSuggestions[currentIndex];

  const nextSuggestion = () => {
    setCurrentIndex((prev) => (prev + 1) % activeSuggestions.length);
  };

  const prevSuggestion = () => {
    setCurrentIndex((prev) => (prev - 1 + activeSuggestions.length) % activeSuggestions.length);
  };

  const SuggestionCard = ({ suggestion }: { suggestion: AISuggestion }) => {
    const CardWrapper = suggestion.linkUrl ? Link : "div";
    const cardProps = suggestion.linkUrl ? { href: suggestion.linkUrl } : {};

    return (
      <CardWrapper {...cardProps} className={suggestion.linkUrl ? "cursor-pointer" : ""}>
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-background to-muted p-6 border border-border hover:border-primary/50 transition-all">
          <div
            className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${getSuggestionColor(
              suggestion.suggestionType
            )}`}
          />

          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0 rounded-full hover:bg-destructive/10"
            onClick={(e) => handleDismiss(suggestion.id, e)}
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="flex items-start gap-4">
            <div
              className={`flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br ${getSuggestionColor(
                suggestion.suggestionType
              )} flex items-center justify-center text-white`}
            >
              {getSuggestionIcon(suggestion.suggestionType)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs">
                  {suggestion.suggestionType.replace(/_/g, " ")}
                </Badge>
                {suggestion.priority === "high" && (
                  <Badge variant="destructive" className="text-xs">
                    Hot
                  </Badge>
                )}
              </div>

              <h3 className="text-lg font-semibold mb-2 leading-tight">{suggestion.title}</h3>

              <p className="text-sm text-muted-foreground mb-3">{suggestion.description}</p>

              {suggestion.reason && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{suggestion.reason}</span>
                </div>
              )}

              {suggestion.imageUrl && (
                <img
                  src={suggestion.imageUrl}
                  alt={suggestion.title}
                  className="mt-4 w-full h-32 object-cover rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      </CardWrapper>
    );
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold">Personalized for You</h3>
        </div>
        {activeSuggestions.length > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={prevSuggestion}
              disabled={activeSuggestions.length <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} / {activeSuggestions.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={nextSuggestion}
              disabled={activeSuggestions.length <= 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <SuggestionCard suggestion={currentSuggestion} />

      {activeSuggestions.length > 1 && (
        <div className="flex justify-center gap-1">
          {activeSuggestions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex ? "w-6 bg-primary" : "w-2 bg-muted"
              }`}
              aria-label={`Go to suggestion ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
