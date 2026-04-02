import React from 'react';
import { Clock, Sparkles, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Recipe = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  description?: string;
  prepTime?: string;
  difficulty?: string;
  tags?: string[];
};

type AIRecipeModalProps = {
  open: boolean;
  selectedMealSlot: { day: string; type: string } | null;
  isLoadingAiRecipes: boolean;
  aiRecipes: Recipe[];
  onClose: () => void;
  onRefresh: () => void;
  onAddRecipe: (recipe: Recipe) => void;
};

const AIRecipeModal = ({
  open,
  selectedMealSlot,
  isLoadingAiRecipes,
  aiRecipes,
  onClose,
  onRefresh,
  onAddRecipe,
}: AIRecipeModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-orange-500" />
            AI Recipe Suggestions
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoadingAiRecipes}
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              {isLoadingAiRecipes ? (
                <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 animate-pulse" />Generating…</span>
              ) : (
                <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" />Refresh</span>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Personalized recipes based on your calorie goal
          {selectedMealSlot ? ` for ${selectedMealSlot.type}` : ''}.
        </p>

        {isLoadingAiRecipes ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse rounded-lg border p-4">
                <div className="h-5 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-full mb-3" />
                <div className="flex gap-2">
                  {[1,2,3,4].map(j => <div key={j} className="h-5 bg-gray-100 rounded w-16" />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {aiRecipes.map((recipe, idx) => (
              <Card key={idx} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1">
                      <h4 className="font-semibold text-base">{recipe.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        {recipe.prepTime && <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{recipe.prepTime}</span>}
                        {recipe.difficulty && <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${recipe.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : recipe.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{recipe.difficulty}</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white shrink-0 ml-3"
                      onClick={() => onAddRecipe(recipe)}
                    >
                      Add
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 my-2">{recipe.description}</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">{recipe.calories} cal</Badge>
                    <Badge variant="secondary" className="text-xs">P: {recipe.protein}g</Badge>
                    <Badge variant="secondary" className="text-xs">C: {recipe.carbs}g</Badge>
                    <Badge variant="secondary" className="text-xs">F: {recipe.fat}g</Badge>
                  </div>
                  {recipe.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {recipe.tags.map((tag, ti) => (
                        <span key={ti} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIRecipeModal;
