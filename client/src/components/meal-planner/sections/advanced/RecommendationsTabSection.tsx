import { Brain, ChefHat, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Recommendation {
  id: string;
  recipe?: any;
  reason: string;
  score: string;
  mealType: string;
}

interface RecommendationsTabSectionProps {
  recommendations: Recommendation[];
  onGenerateRecommendations: () => void;
  onAcceptRecommendation: (id: string) => void;
  onDismissRecommendation: (id: string) => void;
}

export const RecommendationsTabSection = ({
  recommendations,
  onGenerateRecommendations,
  onAcceptRecommendation,
  onDismissRecommendation,
}: RecommendationsTabSectionProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-500" />AI-Powered Meal Recommendations</CardTitle>
      <CardDescription>Personalized suggestions based on your goals, preferences, and nutrition gaps</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <Button onClick={onGenerateRecommendations} className="w-full"><Brain className="w-4 h-4 mr-2" />Generate Recommendations</Button>
      {recommendations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No recommendations yet. Generate some to get started!</p>
        </div>
      ) : recommendations.map((rec) => (
        <Card key={rec.id} className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <ChefHat className="w-4 h-4 text-purple-500" />
                  <h4 className="font-semibold">{rec.recipe?.title || 'Meal Suggestion'}</h4>
                  <Badge variant="secondary">{rec.mealType}</Badge>
                  <Badge variant="outline">{(Number(rec.score) * 100).toFixed(0)}% match</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{rec.reason}</p>
                {rec.recipe && (
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{rec.recipe.calories} cal</span><span>{rec.recipe.protein}g protein</span>
                    <span>{rec.recipe.carbs}g carbs</span><span>{rec.recipe.fat}g fat</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 ml-2">
                <Button size="sm" onClick={() => onAcceptRecommendation(rec.id)}>Add to Plan</Button>
                <Button size="sm" variant="ghost" onClick={() => onDismissRecommendation(rec.id)}>Dismiss</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </CardContent>
  </Card>
);

export default RecommendationsTabSection;
