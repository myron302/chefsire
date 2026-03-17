import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { getCanonicalDrinkRecipeBySlug } from "@/data/drinks/canonical";
import { recordDrinkRemixActivity } from "@/lib/drinks-activity";

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

type RemixMode = "lighter" | "stronger" | "alcohol-free" | "swap" | "pantry" | "custom";

type RemixResult = {
  name: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  notes: string[];
};

const REMIX_MODE_LABELS: Record<RemixMode, string> = {
  lighter: "Make it lighter",
  stronger: "Make it stronger",
  "alcohol-free": "Make it alcohol-free",
  swap: "Swap ingredients",
  pantry: "Remix from pantry ingredients",
  custom: "Create your own variation",
};

const ALCOHOL_TOKENS = [
  "vodka",
  "gin",
  "rum",
  "tequila",
  "mezcal",
  "whiskey",
  "whisky",
  "bourbon",
  "scotch",
  "brandy",
  "cognac",
  "liqueur",
  "triple sec",
  "campari",
  "vermouth",
  "wine",
  "beer",
  "champagne",
  "prosecco",
  "amaro",
];

const SWEETENER_TOKENS = ["simple syrup", "syrup", "sugar", "honey", "agave", "grenadine", "liqueur"];

const ALCOHOL_FREE_REPLACEMENTS: Array<{ match: string; replacement: string }> = [
  { match: "gin", replacement: "2 oz juniper-forward non-alcoholic spirit" },
  { match: "vodka", replacement: "2 oz non-alcoholic vodka alternative" },
  { match: "rum", replacement: "2 oz non-alcoholic dark rum alternative" },
  { match: "tequila", replacement: "2 oz non-alcoholic agave spirit" },
  { match: "whiskey", replacement: "2 oz non-alcoholic whiskey alternative" },
  { match: "bourbon", replacement: "2 oz non-alcoholic bourbon alternative" },
  { match: "brandy", replacement: "2 oz non-alcoholic brandy alternative" },
  { match: "vermouth", replacement: "1 oz de-alcoholized aromatized wine" },
  { match: "campari", replacement: "1 oz non-alcoholic bitter aperitivo" },
  { match: "liqueur", replacement: "0.75 oz non-alcoholic liqueur alternative" },
];

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

function toLineItems(value: unknown): string[] {
  return asTextAreaValue(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeRemixSlug(value: string): string | undefined {
  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : undefined;
}

function isAlcoholIngredient(item: string) {
  const normalized = item.toLowerCase();
  return ALCOHOL_TOKENS.some((token) => normalized.includes(token));
}

function parseLeadingAmount(item: string): { amountText: string; rest: string } {
  const trimmed = item.trim();
  const amountMatch = trimmed.match(/^([\d./]+(?:\s*[\d./]+)?\s*(?:oz|ounce|ounces|ml|cl|cups?|tbsp|tsp)?)\s*(.*)$/i);
  if (!amountMatch) return { amountText: "", rest: trimmed };

  return {
    amountText: amountMatch[1].trim(),
    rest: amountMatch[2].trim(),
  };
}

function scaleAmountText(amountText: string, factor: number): string {
  const numericMatch = amountText.match(/^(\d+(?:\.\d+)?)/);
  if (!numericMatch) return amountText;
  const currentValue = Number(numericMatch[1]);
  if (!Number.isFinite(currentValue)) return amountText;
  const scaled = Math.max(0.25, Math.round(currentValue * factor * 100) / 100);
  return amountText.replace(numericMatch[1], `${scaled}`);
}

function getAlcoholFreeReplacement(item: string): string | null {
  const normalized = item.toLowerCase();
  const found = ALCOHOL_FREE_REPLACEMENTS.find((entry) => normalized.includes(entry.match));
  return found?.replacement ?? null;
}

function createRemix(source: RemixSource, mode: RemixMode, pantryItems: string[]): RemixResult {
  const sourceIngredients = toLineItems(source.ingredients);
  const sourceInstructions = toLineItems(source.instructions);
  const notes: string[] = [];
  const pantrySet = new Set(pantryItems.map((item) => item.toLowerCase()));

  const remixedIngredients = sourceIngredients.map((ingredient) => ingredient);
  const remixedInstructions = sourceInstructions.map((instruction) => instruction);

  if (mode === "alcohol-free") {
    const kept = sourceIngredients.filter((item) => !isAlcoholIngredient(item));
    const replacements = sourceIngredients
      .filter((item) => isAlcoholIngredient(item))
      .map((item) => getAlcoholFreeReplacement(item))
      .filter((item): item is string => Boolean(item));

    if (kept.length) {
      remixedIngredients.splice(0, remixedIngredients.length, ...kept, ...replacements);
    }

    notes.push("Removed alcoholic ingredients and suggested non-alcoholic alternatives.");
    remixedInstructions.unshift("Build over ice and keep ratios balanced with your zero-proof replacements.");
  }

  if (mode === "lighter") {
    const lighterIngredients = sourceIngredients.map((item) => {
      const lower = item.toLowerCase();
      if (SWEETENER_TOKENS.some((token) => lower.includes(token))) {
        const { amountText, rest } = parseLeadingAmount(item);
        const reducedAmount = amountText ? scaleAmountText(amountText, 0.5) : "Half the usual";
        return `${reducedAmount} ${rest || item}`.trim();
      }

      if (isAlcoholIngredient(item)) {
        const { amountText, rest } = parseLeadingAmount(item);
        const reducedAmount = amountText ? scaleAmountText(amountText, 0.75) : item;
        return amountText ? `${reducedAmount} ${rest}`.trim() : item;
      }

      return item;
    });

    remixedIngredients.splice(0, remixedIngredients.length, ...lighterIngredients);
    if (!lighterIngredients.some((item) => item.toLowerCase().includes("soda"))) {
      remixedIngredients.push("Top with 1-2 oz soda water for a lighter finish");
    }

    notes.push("Reduced sweeteners and spirit volume where possible.");
  }

  if (mode === "stronger") {
    const strongerIngredients = sourceIngredients.map((item) => {
      if (!isAlcoholIngredient(item)) return item;
      const { amountText, rest } = parseLeadingAmount(item);
      if (!amountText) return `${item} (increase pour by ~25%)`;
      return `${scaleAmountText(amountText, 1.25)} ${rest}`.trim();
    });

    remixedIngredients.splice(0, remixedIngredients.length, ...strongerIngredients);
    notes.push("Increased spirit proportions by about 25%.");
  }

  if (mode === "swap") {
    const swapped = sourceIngredients.map((item) => {
      const lower = item.toLowerCase();
      if (lower.includes("lemon")) return item.replace(/lemon/gi, "lime");
      if (lower.includes("lime")) return item.replace(/lime/gi, "lemon");
      if (lower.includes("simple syrup")) return item.replace(/simple syrup/gi, "honey syrup");
      if (lower.includes("bourbon")) return item.replace(/bourbon/gi, "rye whiskey");
      if (lower.includes("gin")) return item.replace(/gin/gi, "botanical vodka");
      return item;
    });

    remixedIngredients.splice(0, remixedIngredients.length, ...swapped);
    notes.push("Swapped compatible ingredients while preserving drink structure.");
  }

  if (mode === "pantry") {
    const pantryFriendly = sourceIngredients.map((item) => {
      const normalized = item.toLowerCase();
      const hasDirectMatch = [...pantrySet].some((pantryItem) => normalized.includes(pantryItem));
      if (hasDirectMatch || pantrySet.size === 0) return item;
      if (isAlcoholIngredient(item)) return `${item} (or any available base spirit from pantry)`;
      if (normalized.includes("citrus")) return `${item} (use any available lemon/lime/orange)`;
      if (normalized.includes("syrup") || normalized.includes("sugar")) return `${item} (sub with honey or maple syrup if available)`;
      return `${item} (substitute with closest pantry equivalent)`;
    });

    remixedIngredients.splice(0, remixedIngredients.length, ...pantryFriendly);
    notes.push("Annotated substitutions based on pantry-friendly equivalents.");
  }

  if (mode === "custom") {
    notes.push("Use the prefilled draft as a starting point and edit freely.");
  }

  const sourceName = typeof source.name === "string" && source.name.trim() ? source.name.trim() : "Drink";

  return {
    name: `${sourceName} (${REMIX_MODE_LABELS[mode]})`,
    description: `Remix of ${sourceName}. ${notes.join(" ")}`,
    ingredients: remixedIngredients,
    instructions: remixedInstructions,
    notes,
  };
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
  const [location, setLocation] = useLocation();
  const remixSlug = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("remix")?.trim() ?? "";
  }, [location]);

  const challengeSlug = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("challenge")?.trim() ?? "";
  }, [location]);

  const [sourceDrink, setSourceDrink] = useState<RemixSource | null>(null);
  const [remixMode, setRemixMode] = useState<RemixMode>("custom");
  const [remixNotes, setRemixNotes] = useState<string[]>([]);
  const [pantryInput, setPantryInput] = useState("");
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
    if (!remixSlug) {
      setSourceDrink(null);
      setRemixNotes([]);
      return;
    }

    const canonicalRecipe = getCanonicalDrinkRecipeBySlug(remixSlug);
    if (canonicalRecipe) {
      const recipeSource = {
        ...canonicalRecipe.recipe,
        name: canonicalRecipe.name,
        category: canonicalRecipe.sourceRoute.replace("/drinks/", "").split("/")[0] ?? "smoothies",
        subcategory: canonicalRecipe.sourceRoute.replace("/drinks/", "").split("/")[1] ?? "",
      };
      setSourceDrink(recipeSource);
      setForm(toFormValues(recipeSource));
      setRemixNotes([`Loaded canonical recipe from ${canonicalRecipe.sourceTitle}.`]);
      return;
    }

    setRemixLoading(true);
    fetch(`/api/drinks/user/${encodeURIComponent(remixSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        const source = payload?.recipe;
        if (!source) return;
        setSourceDrink(source);
        setForm(toFormValues(source));
        setRemixNotes(["Loaded user-submitted drink as remix source."]);
      })
      .finally(() => setRemixLoading(false));
  }, [remixSlug]);

  function applyRemix(mode: RemixMode) {
    if (!sourceDrink) return;
    setRemixMode(mode);
    const pantryItems = pantryInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const remix = createRemix(sourceDrink, mode, pantryItems);

    setForm((prev) => ({
      ...prev,
      name: remix.name,
      description: remix.description,
      ingredients: remix.ingredients.join("\n"),
      instructions: remix.instructions.join("\n"),
    }));
    setRemixNotes(remix.notes);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const payload = {
      ...form,
      remixedFromSlug: normalizeRemixSlug(remixSlug),
      challengeSlug: normalizeRemixSlug(challengeSlug),
      prepTime: form.prepTime ? Number(form.prepTime) : undefined,
      ingredients: form.ingredients.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
      instructions: form.instructions.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    };

    if (import.meta.env.DEV) {
      console.info("[drink-submit] submitting payload", payload);
    }

    const res = await fetch("/api/drinks/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.recipe?.slug) {
      const serverReason = typeof json?.error === "string" && json.error.trim() ? json.error : "Unable to submit recipe";
      if (import.meta.env.DEV) {
        console.error("[drink-submit] submit failed", {
          status: res.status,
          statusText: res.statusText,
          response: json,
          payload,
        });
      }

      setError(import.meta.env.DEV ? `${serverReason} (HTTP ${res.status})` : serverReason);
      setSubmitting(false);
      return;
    }

    recordDrinkRemixActivity({
      slug: json.recipe.slug,
      remixedFromSlug: normalizeRemixSlug(remixSlug) ?? null,
      category: form.category,
    });
    setLocation(`/drinks/recipe/${json.recipe.slug}`);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <DrinksPlatformNav current="submit" />

      {remixSlug || challengeSlug ? (
        <Card>
          <CardHeader>
            <CardTitle>Remix Drink</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Source slug: <span className="font-mono">{remixSlug || "none"}</span></p>
            {challengeSlug ? <p className="text-sm text-muted-foreground">Challenge: <span className="font-mono">{challengeSlug}</span></p> : null}
            {sourceDrink ? (
              <>
                <div>
                  <h3 className="font-semibold">Original drink: {sourceDrink.name}</h3>
                  {sourceDrink.description ? <p className="text-sm text-muted-foreground mt-1">{sourceDrink.description}</p> : null}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Original ingredients</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {toLineItems(sourceDrink.ingredients).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Original instructions</h4>
                    <ol className="list-decimal list-inside text-sm space-y-1">
                      {toLineItems(sourceDrink.instructions).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ol>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium">Remix options</h4>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(REMIX_MODE_LABELS) as RemixMode[]).map((mode) => (
                      <Button key={mode} type="button" variant={remixMode === mode ? "default" : "outline"} onClick={() => applyRemix(mode)}>
                        {REMIX_MODE_LABELS[mode]}
                      </Button>
                    ))}
                  </div>
                  <div>
                    <Label>Pantry ingredients (comma-separated, used by pantry remix)</Label>
                    <Input value={pantryInput} onChange={(e) => setPantryInput(e.target.value)} placeholder="e.g., gin, lemon, honey, soda water" />
                  </div>
                  {remixNotes.length ? (
                    <ul className="text-sm text-muted-foreground list-disc list-inside">
                      {remixNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No source drink found yet. You can still submit a drink manually.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{remixSlug ? "Submit Your Remix" : "Submit a Drink Recipe"}</CardTitle>
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
