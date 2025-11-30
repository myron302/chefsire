import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChefHat, Plus, DollarSign, Calendar, Target, TrendingUp, Edit, Trash2, Eye } from "lucide-react";

type MealPlanBlueprint = {
  id: string;
  title: string;
  description: string | null;
  price: string;
  duration: number;
  difficulty: string | null;
  dietType: string | null;
  salesCount: number;
  averageRating: string;
  reviewCount: number;
  isPublished: boolean;
  createdAt: string;
};

export default function MealPlanCreator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [plans, setPlans] = useState<MealPlanBlueprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("7");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [dietType, setDietType] = useState("");
  const [targetCalories, setTargetCalories] = useState("");
  const [meals, setMeals] = useState<any[]>([]);

  useEffect(() => {
    fetchMyPlans();
  }, []);

  const fetchMyPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/my-plans", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans.map((p: any) => p.blueprint));
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !price) {
      toast({
        title: "Missing fields",
        description: "Title and price are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/meal-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          description,
          price: parseFloat(price),
          duration: parseInt(duration),
          difficulty,
          dietType: dietType || null,
          targetCalories: targetCalories ? parseInt(targetCalories) : null,
          meals: meals.length > 0 ? meals : [{ day: 1, mealType: "breakfast", recipeName: "Example meal" }],
        }),
      });

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Meal plan created successfully",
        });
        setShowCreateForm(false);
        resetForm();
        fetchMyPlans();
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.message || "Failed to create meal plan",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Create error:", error);
      toast({
        title: "Error",
        description: "Failed to create meal plan",
        variant: "destructive",
      });
    }
  };

  const handlePublish = async (planId: string) => {
    try {
      const response = await fetch(`/api/meal-plans/${planId}/publish`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        toast({
          title: "Published!",
          description: "Your meal plan is now live in the marketplace",
        });
        fetchMyPlans();
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.message || "Failed to publish",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to publish meal plan",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPrice("");
    setDuration("7");
    setDifficulty("intermediate");
    setDietType("");
    setTargetCalories("");
    setMeals([]);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ChefHat className="w-8 h-8 text-orange-500" />
            Meal Plan Creator
          </h1>
          <p className="text-muted-foreground mt-1">Create and sell your meal plan templates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation("/nutrition/analytics")}>
            <TrendingUp className="w-4 h-4 mr-2" />
            Analytics
          </Button>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="w-4 h-4 mr-2" />
            Create New Plan
          </Button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create New Meal Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Plan Title *</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="7-Day Keto Meal Plan"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Price (USD) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="29.99"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Duration (days)</label>
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="7"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Diet Type</label>
                  <Input
                    value={dietType}
                    onChange={(e) => setDietType(e.target.value)}
                    placeholder="Keto, Vegan, Paleo, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Target Calories/Day</label>
                  <Input
                    type="number"
                    value={targetCalories}
                    onChange={(e) => setTargetCalories(e.target.value)}
                    placeholder="2000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your meal plan..."
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create Plan</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Plans List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Your Meal Plans</h2>
        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : plans.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <ChefHat className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No meal plans yet</h3>
              <p className="text-muted-foreground mb-4">Create your first meal plan to start selling</p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {plans.map((plan) => (
              <Card key={plan.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{plan.title}</h3>
                        {plan.isPublished ? (
                          <Badge variant="default">Published</Badge>
                        ) : (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                      </div>
                      {plan.description && (
                        <p className="text-muted-foreground mb-3">{plan.description}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          ${plan.price}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {plan.duration} days
                        </span>
                        {plan.difficulty && (
                          <Badge variant="outline" className="capitalize">
                            {plan.difficulty}
                          </Badge>
                        )}
                        {plan.dietType && <Badge variant="outline">{plan.dietType}</Badge>}
                      </div>
                      <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                        <span>{plan.salesCount} sales</span>
                        <span>
                          {plan.reviewCount} reviews ({plan.averageRating} ⭐)
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!plan.isPublished && (
                        <Button
                          size="sm"
                          onClick={() => handlePublish(plan.id)}
                        >
                          Publish
                        </Button>
                      )}
                      <Button size="sm" variant="outline">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation(`/nutrition/meal-plans/${plan.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
