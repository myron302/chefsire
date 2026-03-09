import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function SubmitDrinkRecipePage() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({
    name: "",
    description: "",
    ingredients: "",
    instructions: "",
    glassware: "",
    method: "",
    prepTime: "",
    difficulty: "Easy",
    category: "smoothies",
    subcategory: "",
    image: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const payload = {
      ...form,
      prepTime: form.prepTime ? Number(form.prepTime) : undefined,
      ingredients: form.ingredients.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
      instructions: form.instructions.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    };

    const res = await fetch("/api/drinks/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.recipe?.slug) {
      setError(json?.error ?? "Unable to submit recipe");
      setSubmitting(false);
      return;
    }

    setLocation(`/drinks/recipe/${json.recipe.slug}`);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Submit a Drink Recipe</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div><Label>Drink name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Ingredients (one per line)</Label><Textarea value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} /></div>
            <div><Label>Instructions (one per line)</Label><Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Glassware</Label><Input value={form.glassware} onChange={(e) => setForm({ ...form, glassware: e.target.value })} /></div>
              <div><Label>Method</Label><Input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} /></div>
              <div><Label>Prep time (minutes)</Label><Input type="number" min={0} value={form.prepTime} onChange={(e) => setForm({ ...form, prepTime: e.target.value })} /></div>
              <div><Label>Difficulty</Label><Input value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>Subcategory</Label><Input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} /></div>
            </div>
            <div><Label>Image URL</Label><Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit Recipe"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
