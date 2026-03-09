import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getCanonicalDrinkRecipeBySlug } from "@/data/drinks/canonical";

type RemixSource = {
  name?: string;
  description?: string | null;
  ingredients?: unknown;
  instructions?: unknown;
  glassware?: string | null;
  method?: string | null;
  prepTime?: number | null;
  servingSize?: string | null;
  difficulty?: string | null;
  spiritType?: string | null;
  abv?: string | null;
  category?: string | null;
  subcategory?: string | null;
  image?: string | null;
  imageUrl?: string | null;
};

function asTextAreaValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join("\n");
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|\./)
      .map((item) => item.trim())
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function toFormValues(source: RemixSource) {
  return {
    name: typeof source.name === "string" ? source.name : "",
    description: typeof source.description === "string" ? source.description : "",
    ingredients: asTextAreaValue(source.ingredients),
    instructions: asTextAreaValue(source.instructions),
    glassware: typeof source.glassware === "string" ? source.glassware : "",
    method: typeof source.method === "string" ? source.method : "",
    prepTime: typeof source.prepTime === "number" ? String(source.prepTime) : "",
    servingSize: typeof source.servingSize === "string" ? source.servingSize : "",
    difficulty: typeof source.difficulty === "string" ? source.difficulty : "Easy",
    spiritType: typeof source.spiritType === "string" ? source.spiritType : "",
    abv: typeof source.abv === "string" ? source.abv : "",
    category: typeof source.category === "string" && source.category ? source.category : "smoothies",
    subcategory: typeof source.subcategory === "string" ? source.subcategory : "",
    image: typeof source.image === "string" ? source.image : typeof source.imageUrl === "string" ? source.imageUrl : "",
  };
}

export default function SubmitDrinkRecipePage() {
  const [, setLocation] = useLocation();
  const remixSlug = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("remix")?.trim() ?? "";
  }, []);
  const [form, setForm] = useState({
    name: "",
    description: "",
    ingredients: "",
    instructions: "",
    glassware: "",
    method: "",
    prepTime: "",
    servingSize: "",
    difficulty: "Easy",
    spiritType: "",
    abv: "",
    category: "smoothies",
    subcategory: "",
    image: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [remixLoading, setRemixLoading] = useState(false);

  useEffect(() => {
    if (!remixSlug) return;

    const canonicalRecipe = getCanonicalDrinkRecipeBySlug(remixSlug);
    if (canonicalRecipe) {
      setForm(toFormValues({
        ...canonicalRecipe.recipe,
        name: canonicalRecipe.name,
        category: canonicalRecipe.sourceRoute.replace("/drinks/", "").split("/")[0] ?? "smoothies",
        subcategory: canonicalRecipe.sourceRoute.replace("/drinks/", "").split("/")[1] ?? "",
      }));
      return;
    }

    setRemixLoading(true);
    fetch(`/api/drinks/user/${encodeURIComponent(remixSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        const source = payload?.recipe;
        if (!source) return;
        setForm(toFormValues(source));
      })
      .finally(() => setRemixLoading(false));
  }, [remixSlug]);

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
              <div><Label>Serving size</Label><Input value={form.servingSize} onChange={(e) => setForm({ ...form, servingSize: e.target.value })} /></div>
              <div><Label>Difficulty</Label><Input value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} /></div>
              <div><Label>Spirit type</Label><Input value={form.spiritType} onChange={(e) => setForm({ ...form, spiritType: e.target.value })} /></div>
              <div><Label>ABV</Label><Input value={form.abv} onChange={(e) => setForm({ ...form, abv: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>Subcategory</Label><Input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} /></div>
            </div>
            <div><Label>Image URL</Label><Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></div>
            {remixLoading ? <p className="text-sm text-muted-foreground">Loading remix template…</p> : null}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit Recipe"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
