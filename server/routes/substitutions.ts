// server/routes/substitutions.ts
import { Router } from "express";

type Alt = { name: string; note?: string; confidence?: number; tags?: string[] };

const r = Router();

/** tiny helper: parse "a,b,c" OR repeatable query into string[] */
function parseList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap((x) => String(x).split(",")).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** static, local library (no OpenAI) */
function suggestForOne(ingredientRaw: string, diet?: string, avoid: string[] = []): Alt[] {
  const ing = ingredientRaw.toLowerCase();
  const lib: Record<string, Alt[]> = {
    milk: [
      { name: "oat milk", note: "neutral flavor", confidence: 0.9, tags: ["vegan"] },
      { name: "almond milk", note: "light, nutty", confidence: 0.85, tags: ["vegan","nut"] },
      { name: "soy milk", note: "higher protein", confidence: 0.85, tags: ["vegan","legume"] },
      { name: "lactose-free milk", note: "still dairy", confidence: 0.7, tags: ["dairy"] },
    ],
    butter: [
      { name: "olive oil", note: "⅞ volume of butter", confidence: 0.85, tags: ["vegan"] },
      { name: "vegan butter", note: "1:1 swap", confidence: 0.9, tags: ["vegan"] },
      { name: "ghee", note: "clarified butter", confidence: 0.6, tags: ["dairy"] },
    ],
    cheese: [
      { name: "nutritional yeast", note: "cheesy umami", confidence: 0.75, tags: ["vegan"] },
      { name: "vegan mozzarella", note: "melting dishes", confidence: 0.7, tags: ["vegan"] },
      { name: "lactose-free cheese", note: "still dairy", confidence: 0.5, tags: ["dairy"] },
    ],
    egg: [
      { name: "flax egg", note: "1 tbsp ground flax + 3 tbsp water", confidence: 0.8, tags: ["vegan","seed"] },
      { name: "chia egg", note: "1 tbsp chia + 3 tbsp water", confidence: 0.75, tags: ["vegan","seed"] },
      { name: "unsweetened applesauce", note: "¼ cup per egg (baking)", confidence: 0.7, tags: ["vegan","fruit"] },
      { name: "silken tofu", note: "¼ cup per egg (custards/cakes)", confidence: 0.7, tags: ["vegan","soy"] },
    ],
    "all-purpose flour": [
      { name: "gluten-free flour blend", note: "1:1 if labeled", confidence: 0.8, tags: ["gluten-free"] },
      { name: "oat flour", note: "muffins/cookies", confidence: 0.6, tags: ["gluten-free"] },
    ],
    honey: [
      { name: "maple syrup", note: "slightly thinner", confidence: 0.85, tags: ["vegan"] },
      { name: "agave syrup", note: "neutral, sweeter", confidence: 0.75, tags: ["vegan"] },
    ],
    yogurt: [
      { name: "coconut yogurt", note: "1:1, richer", confidence: 0.8, tags: ["vegan"] },
      { name: "soy yogurt", note: "1:1, neutral", confidence: 0.75, tags: ["vegan","soy"] },
    ],
    cream: [
      { name: "coconut cream", note: "soups/curries", confidence: 0.8, tags: ["vegan"] },
      { name: "cashew cream", note: "blend soaked cashews", confidence: 0.75, tags: ["vegan","nut"] },
      { name: "oat cream", note: "savory sauces", confidence: 0.7, tags: ["vegan"] },
    ],
    "sour cream": [
      { name: "plant-based sour cream", note: "store-bought", confidence: 0.8, tags: ["vegan"] },
      { name: "coconut yogurt + lemon", note: "DIY tang", confidence: 0.7, tags: ["vegan"] },
    ],
  };

  // choose base list by fuzzy key
  const key =
    Object.keys(lib).find((k) => ing.includes(k)) ||
    (ing.includes("flour") ? "all-purpose flour" : "");

  let alts: Alt[] = key ? lib[key] : [];

  // diet filtering
  if (diet?.toLowerCase() === "vegan") {
    alts = alts.filter((a) => !(a.tags || []).includes("dairy") && !(a.name.toLowerCase().includes("honey")));
  }

  // avoid filtering: if "nut" in avoid, drop almond/cashew etc.
  const avoidL = avoid.map((s) => s.toLowerCase());
  if (avoidL.length) {
    alts = alts.filter((a) => {
      const name = a.name.toLowerCase();
      const tags = (a.tags || []).map((t) => t.toLowerCase());
      return !avoidL.some((bad) => name.includes(bad) || tags.includes(bad));
    });
  }

  // if we have no specific match, return generic fallbacks
  if (!alts.length) {
    if (diet?.toLowerCase() === "vegan") {
      alts = [
        { name: "olive oil", confidence: 0.5, tags: ["vegan"] },
        { name: "oat-based alternative", confidence: 0.45, tags: ["vegan"] },
      ];
    } else {
      alts = [{ name: "closest plant-based alternative", confidence: 0.3, tags: ["hint"] }];
    }
  }
  return alts;
}

function buildResponse(ingredients: string[], diet?: string, avoid?: string[]) {
  return {
    items: ingredients.map((ing) => ({
      original: ing,
      alternatives: suggestForOne(ing, diet, avoid),
    })),
    info: {
      diet: diet || null,
      avoid: avoid || [],
      engine: "local-rule-based",
    },
  };
}

/** GET — browser-friendly: /api/substitutions/suggest?ingredients=milk,butter&diet=vegan&avoid=dairy,nut */
r.get("/substitutions/suggest", (req, res) => {
  const ingredients = parseList(req.query.ingredients || req.query.q);
  const avoid = parseList(req.query.avoid);
  const diet = typeof req.query.diet === "string" ? req.query.diet : undefined;

  if (!ingredients.length) {
    return res.status(400).json({ message: "Provide ?ingredients=a,b,c (or ?q=...)" });
  }
  res.json(buildResponse(ingredients, diet, avoid));
});

/** POST — JSON body: { ingredients: [], diet?: "vegan", avoid?: [] } */
r.post("/substitutions/suggest", (req, res) => {
  const ingredients = Array.isArray(req.body?.ingredients) ? (req.body.ingredients as string[]) : [];
  const diet = typeof req.body?.diet === "string" ? (req.body.diet as string) : undefined;
  const avoid = Array.isArray(req.body?.avoid) ? (req.body.avoid as string[]) : [];

  if (!ingredients.length) {
    return res.status(400).json({ message: "Body must include { ingredients: string[] }" });
  }
  res.json(buildResponse(ingredients, diet, avoid));
});

export default r;
