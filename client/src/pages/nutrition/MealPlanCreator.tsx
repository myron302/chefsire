import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ChefHat, Plus, DollarSign, Calendar, TrendingUp,
  Edit, Trash2, Eye, Crown, X, AlertTriangle,
} from "lucide-react";

type MealPlanBlueprint = {
  id: string;
  title: string;
  description: string | null;
  priceInCents: number;
  duration: number;
  durationUnit: string;
  difficulty: string | null;
  category: string | null;
  dietaryLabels: string[];
  tags: string[];
  servings: number;
  salesCount: number;
  status: string;
  createdAt: string;
  avgRating?: number;
  reviewCount?: number;
};

type FormState = {
  title: string;
  description: string;
  price: string;
  duration: string;
  difficulty: string;
  category: string;
  dietaryLabels: string;
  tags: string;
  servings: string;
  isPremiumContent: boolean;
};

const emptyForm = (): FormState => ({
  title: "",
  description: "",
  price: "",
  duration: "7",
  difficulty: "intermediate",
  category: "general",
  dietaryLabels: "",
  tags: "",
  servings: "4",
  isPremiumContent: false,
});

function blueprintToForm(p: MealPlanBlueprint): FormState {
  return {
    title: p.title,
    description: p.description || "",
    price: ((p.priceInCents || 0) / 100).toFixed(2),
    duration: String(p.duration || 7),
    difficulty: p.difficulty || "intermediate",
    category: p.category || "general",
    dietaryLabels: (p.dietaryLabels || []).join(", "),
    tags: (p.tags || []).join(", "),
    servings: String(p.servings || 4),
    isPremiumContent: false,
  };
}

function getCompletenessScore(title: string, description: string) {
  let score = 0;
  if (title.trim()) score += 40;
  if (description.trim()) score += 35;
  if (parseFloat(title) !== 0) score += 25;
  return Math.min(score, 100);
}

export default function MealPlanCreator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [plans, setPlans] = useState<MealPlanBlueprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [userHasPremium, setUserHasPremium] = useState(false);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(emptyForm());
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [editingPlan, setEditingPlan] = useState<MealPlanBlueprint | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deletingPlan, setDeletingPlan] = useState<MealPlanBlueprint | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchMyPlans();
    checkPremiumStatus();
  }, []);

  const checkPremiumStatus = async () => {
    try {
      const res = await fetch("/api/user", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUserHasPremium(data.nutritionPremium || false);
      }
    } catch {}
  };

  const fetchMyPlans = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/my-plans", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans.map((p: any) => ({
          ...p.blueprint,
          avgRating: p.avgRating,
          reviewCount: Number(p.reviewCount || 0),
        })));
      }
    } catch {}
    finally { setLoading(false); }
  };

  // ── Create ──────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title || !createForm.price) {
      toast({ title: "Missing fields", description: "Title and price are required.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/meal-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: createForm.title,
          description: createForm.description || null,
          priceInCents: Math.round(parseFloat(createForm.price) * 100),
          duration: parseInt(createForm.duration),
          durationUnit: "days",
          difficulty: createForm.difficulty,
          category: createForm.category,
          dietaryLabels: createForm.dietaryLabels.split(",").map(s => s.trim()).filter(Boolean),
          tags: createForm.tags.split(",").map(s => s.trim()).filter(Boolean),
          servings: parseInt(createForm.servings),
          mealStructure: JSON.stringify([]),
        }),
      });
      if (res.ok) {
        toast({ title: "Created!", description: "Meal plan created as draft." });
        setShowCreateForm(false);
        setCreateForm(emptyForm());
        fetchMyPlans();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.message || "Failed to create.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally { setCreating(false); }
  };

  // ── Edit ─────────────────────────────────────────────────────
  const openEdit = (plan: MealPlanBlueprint) => {
    setEditingPlan(plan);
    setEditForm(blueprintToForm(plan));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/meal-plans/${editingPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description || null,
          priceInCents: Math.round(parseFloat(editForm.price) * 100),
          duration: parseInt(editForm.duration),
          difficulty: editForm.difficulty,
          category: editForm.category,
          dietaryLabels: editForm.dietaryLabels.split(",").map(s => s.trim()).filter(Boolean),
          tags: editForm.tags.split(",").map(s => s.trim()).filter(Boolean),
          servings: parseInt(editForm.servings),
        }),
      });
      if (res.ok) {
        toast({ title: "Saved!", description: "Meal plan updated." });
        setEditingPlan(null);
        fetchMyPlans();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.message || "Failed to save.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ── Delete ───────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deletingPlan) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/meal-plans/${deletingPlan.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Deleted", description: `"${deletingPlan.title}" removed.` });
        setDeletingPlan(null);
        fetchMyPlans();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.message || "Failed to delete.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally { setDeleting(false); }
  };

  // ── Publish ──────────────────────────────────────────────────
  const handlePublish = async (planId: string) => {
    try {
      const res = await fetch(`/api/meal-plans/${planId}/publish`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Published!", description: "Your meal plan is now live in the marketplace." });
        fetchMyPlans();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.message || "Failed to publish.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to publish.", variant: "destructive" });
    }
  };

  // ── Plan form fields (shared between create + edit) ──────────
  const PlanFormFields = ({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Plan Title *</label>
          <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="7-Day Keto Meal Plan" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Price (USD) *</label>
          <Input type="number" step="0.01" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="29.99" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Duration (days)</label>
          <Input type="number" min="1" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Servings per meal</label>
          <Input type="number" min="1" value={form.servings} onChange={e => setForm({ ...form, servings: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Difficulty</label>
          <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} className="w-full p-2 border rounded text-sm">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full p-2 border rounded text-sm">
            <option value="general">General</option>
            <option value="weight-loss">Weight Loss</option>
            <option value="muscle-gain">Muscle Gain</option>
            <option value="keto">Keto</option>
            <option value="vegan">Vegan</option>
            <option value="paleo">Paleo</option>
            <option value="mediterranean">Mediterranean</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe your meal plan..." rows={3} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Dietary Labels <span className="text-muted-foreground">(comma-separated)</span></label>
          <Input value={form.dietaryLabels} onChange={e => setForm({ ...form, dietaryLabels: e.target.value })} placeholder="Gluten-Free, Dairy-Free" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tags <span className="text-muted-foreground">(comma-separated)</span></label>
          <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="quick, budget, family" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6">

      {/* ── Edit Modal ── */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Edit Meal Plan</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setEditingPlan(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {editingPlan.status === "published" && (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                  This plan is published. Unpublish it first to make edits.
                </p>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <PlanFormFields form={editForm} setForm={setEditForm} />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={saving || editingPlan.status === "published"}>
                    {saving ? "Saving…" : "Save Changes"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditingPlan(null)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deletingPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">Delete "{deletingPlan.title}"?</h3>
                  <p className="text-sm text-muted-foreground">This cannot be undone. Only draft plans with no purchases can be deleted.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="flex-1">
                  {deleting ? "Deleting…" : "Yes, delete"}
                </Button>
                <Button variant="outline" onClick={() => setDeletingPlan(null)} className="flex-1">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Header ── */}
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

      {/* ── Create Form ── */}
      {showCreateForm && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Create New Meal Plan</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <PlanFormFields form={createForm} setForm={setCreateForm} />
              <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <input
                  type="checkbox"
                  id="isPremiumContent"
                  checked={createForm.isPremiumContent}
                  onChange={e => setCreateForm({ ...createForm, isPremiumContent: e.target.checked })}
                  disabled={!userHasPremium}
                  className="w-4 h-4"
                />
                <label htmlFor="isPremiumContent" className="flex items-center gap-2 text-sm cursor-pointer">
                  <Crown className="w-4 h-4 text-orange-500" />
                  {userHasPremium ? "Mark as premium content" : "Upgrade to create premium content"}
                </label>
                {!userHasPremium && (
                  <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => setLocation("/nutrition/meal-planner")}>
                    Upgrade
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create Plan"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Plans List ── */}
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
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-xl font-semibold truncate">{plan.title}</h3>
                        {plan.status === "published" ? (
                          <Badge className="bg-green-600 text-white">Published</Badge>
                        ) : (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                      </div>
                      {plan.description && (
                        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{plan.description}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          ${((plan.priceInCents || 0) / 100).toFixed(2)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {plan.duration} days
                        </span>
                        {plan.difficulty && <Badge variant="outline" className="capitalize">{plan.difficulty}</Badge>}
                        {plan.category && plan.category !== "general" && <Badge variant="outline">{plan.category}</Badge>}
                        <span>{plan.salesCount} sales</span>
                        {plan.reviewCount ? <span>{plan.reviewCount} reviews ({Number(plan.avgRating || 0).toFixed(1)} ⭐)</span> : null}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {plan.status === "draft" && (
                        <Button size="sm" onClick={() => handlePublish(plan.id)}>Publish</Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        title={plan.status === "published" ? "Unpublish to edit" : "Edit"}
                        onClick={() => openEdit(plan)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation(`/nutrition/meal-plans/${plan.id}`)}
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {plan.status === "draft" && plan.salesCount === 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 hover:bg-red-50 hover:border-red-300"
                          title="Delete"
                          onClick={() => setDeletingPlan(plan)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
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
