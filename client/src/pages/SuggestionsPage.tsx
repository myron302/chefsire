import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb, ThumbsUp, ThumbsDown, Clock, TrendingUp, Brain,
  Sparkles, Sun, Moon, Apple, Droplets, Heart, X, Check
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { formatDistanceToNow } from "date-fns";

type Suggestion = {
  id: string;
  userId: string;
  drinkId: string;
  drinkName: string;
  drinkImage: string | null;
  suggestionType: "weather_based" | "time_based" | "nutrition_gap" | "streak_motivation";
  reason: string;
  confidence: number;
  viewed: boolean;
  viewedAt: string | null;
  accepted: boolean;
  acceptedAt: string | null;
  dismissed: boolean;
  dismissedAt: string | null;
  date: string;
  createdAt: string;
};

export default function SuggestionsPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"current" | "accepted" | "dismissed">("current");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/suggestions/today", user?.id],
    queryFn: async () => {
      const response = await fetch("/api/suggestions/today", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch suggestions");
      const result = await response.json();
      return result.suggestions as Suggestion[];
    },
    enabled: !!user,
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/suggestions/${id}/accept`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to accept suggestion");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions/today"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/suggestions/${id}/dismiss`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to dismiss suggestion");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions/today"] });
    },
  });

  const suggestions = data || [];
  const currentSuggestions = suggestions.filter((s) => !s.accepted && !s.dismissed);
  const acceptedSuggestions = suggestions.filter((s) => s.accepted);
  const dismissedSuggestions = suggestions.filter((s) => s.dismissed);

  const getSuggestionTypeIcon = (type: string) => {
    switch (type) {
      case "weather_based":
        return Sun;
      case "time_based":
        return Clock;
      case "nutrition_gap":
        return Apple;
      case "streak_motivation":
        return TrendingUp;
      default:
        return Sparkles;
    }
  };

  const getSuggestionTypeLabel = (type: string) => {
    switch (type) {
      case "weather_based":
        return "Weather-Based";
      case "time_based":
        return "Time-Based";
      case "nutrition_gap":
        return "Nutrition Gap";
      case "streak_motivation":
        return "Streak Boost";
      default:
        return "Personalized";
    }
  };

  const getSuggestionTypeColor = (type: string) => {
    switch (type) {
      case "weather_based":
        return "bg-yellow-500";
      case "time_based":
        return "bg-blue-500";
      case "nutrition_gap":
        return "bg-green-500";
      case "streak_motivation":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Lightbulb className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Please Log In</h2>
            <p className="text-muted-foreground mb-4">
              Log in to get personalized AI-powered drink suggestions!
            </p>
            <Button asChild>
              <a href="/auth">Log In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Loading suggestions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-xl p-8 mb-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <Brain className="h-10 w-10" />
                AI Suggestions
              </h1>
              <p className="text-white/90 text-lg">
                Personalized drink recommendations powered by AI
              </p>
            </div>
            <div className="text-center bg-white/20 backdrop-blur rounded-lg p-4">
              <Lightbulb className="h-8 w-8 mx-auto mb-1" />
              <div className="text-3xl font-bold">{currentSuggestions.length}</div>
              <div className="text-sm text-white/80">Active Today</div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4 text-center">
                <Sparkles className="h-6 w-6 mx-auto mb-2 text-yellow-300" />
                <div className="text-2xl font-bold">{currentSuggestions.length}</div>
                <div className="text-sm text-white/80">Pending</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4 text-center">
                <Check className="h-6 w-6 mx-auto mb-2 text-green-300" />
                <div className="text-2xl font-bold">{acceptedSuggestions.length}</div>
                <div className="text-sm text-white/80">Accepted</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4 text-center">
                <X className="h-6 w-6 mx-auto mb-2 text-red-300" />
                <div className="text-2xl font-bold">{dismissedSuggestions.length}</div>
                <div className="text-sm text-white/80">Dismissed</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={tab === "current" ? "default" : "outline"}
            onClick={() => setTab("current")}
            className="flex-1"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Current ({currentSuggestions.length})
          </Button>
          <Button
            variant={tab === "accepted" ? "default" : "outline"}
            onClick={() => setTab("accepted")}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-2" />
            Accepted ({acceptedSuggestions.length})
          </Button>
          <Button
            variant={tab === "dismissed" ? "default" : "outline"}
            onClick={() => setTab("dismissed")}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            Dismissed ({dismissedSuggestions.length})
          </Button>
        </div>

        {/* Suggestion Lists */}
        <div className="space-y-4">
          {tab === "current" && currentSuggestions.length === 0 && (
            <Card className="p-8 text-center">
              <Lightbulb className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-bold mb-2">No Suggestions Yet</h3>
              <p className="text-muted-foreground">
                Check back later - our AI is working on personalized suggestions for you!
              </p>
            </Card>
          )}

          {tab === "current" &&
            currentSuggestions.map((suggestion) => {
              const Icon = getSuggestionTypeIcon(suggestion.suggestionType);
              return (
                <Card key={suggestion.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {suggestion.drinkImage && (
                        <img
                          src={suggestion.drinkImage}
                          alt={suggestion.drinkName}
                          className="w-24 h-24 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getSuggestionTypeColor(suggestion.suggestionType)}>
                            <Icon className="h-3 w-3 mr-1" />
                            {getSuggestionTypeLabel(suggestion.suggestionType)}
                          </Badge>
                          <Badge variant="outline">
                            {Math.round(suggestion.confidence * 100)}% Match
                          </Badge>
                        </div>

                        <h3 className="text-2xl font-bold mb-2">{suggestion.drinkName}</h3>
                        <p className="text-muted-foreground mb-4">{suggestion.reason}</p>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => acceptMutation.mutate(suggestion.id)}
                            disabled={acceptMutation.isPending}
                            className="flex-1"
                          >
                            <ThumbsUp className="h-4 w-4 mr-2" />
                            I'll Make This!
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => dismissMutation.mutate(suggestion.id)}
                            disabled={dismissMutation.isPending}
                            className="flex-1"
                          >
                            <ThumbsDown className="h-4 w-4 mr-2" />
                            Not Now
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

          {tab === "accepted" && acceptedSuggestions.length === 0 && (
            <Card className="p-8 text-center">
              <Check className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-bold mb-2">No Accepted Suggestions</h3>
              <p className="text-muted-foreground">
                Suggestions you accept will appear here!
              </p>
            </Card>
          )}

          {tab === "accepted" &&
            acceptedSuggestions.map((suggestion) => {
              const Icon = getSuggestionTypeIcon(suggestion.suggestionType);
              return (
                <Card key={suggestion.id} className="bg-green-50 border-green-200">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {suggestion.drinkImage && (
                        <img
                          src={suggestion.drinkImage}
                          alt={suggestion.drinkName}
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getSuggestionTypeColor(suggestion.suggestionType)}>
                            <Icon className="h-3 w-3 mr-1" />
                            {getSuggestionTypeLabel(suggestion.suggestionType)}
                          </Badge>
                          <Badge className="bg-green-500">
                            <Check className="h-3 w-3 mr-1" />
                            Accepted
                          </Badge>
                        </div>

                        <h3 className="text-xl font-bold mb-2">{suggestion.drinkName}</h3>
                        <p className="text-muted-foreground mb-2">{suggestion.reason}</p>
                        {suggestion.acceptedAt && (
                          <p className="text-sm text-green-600">
                            Accepted {formatDistanceToNow(new Date(suggestion.acceptedAt), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

          {tab === "dismissed" && dismissedSuggestions.length === 0 && (
            <Card className="p-8 text-center">
              <X className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-bold mb-2">No Dismissed Suggestions</h3>
              <p className="text-muted-foreground">
                Suggestions you dismiss will appear here!
              </p>
            </Card>
          )}

          {tab === "dismissed" &&
            dismissedSuggestions.map((suggestion) => {
              const Icon = getSuggestionTypeIcon(suggestion.suggestionType);
              return (
                <Card key={suggestion.id} className="opacity-60">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {suggestion.drinkImage && (
                        <img
                          src={suggestion.drinkImage}
                          alt={suggestion.drinkName}
                          className="w-20 h-20 rounded-lg object-cover grayscale"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">
                            <Icon className="h-3 w-3 mr-1" />
                            {getSuggestionTypeLabel(suggestion.suggestionType)}
                          </Badge>
                          <Badge variant="outline">Dismissed</Badge>
                        </div>

                        <h3 className="text-xl font-bold mb-2 line-through">{suggestion.drinkName}</h3>
                        <p className="text-muted-foreground">{suggestion.reason}</p>
                        {suggestion.dismissedAt && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Dismissed {formatDistanceToNow(new Date(suggestion.dismissedAt), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      </div>
    </div>
  );
}
