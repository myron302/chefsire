// server/routes/substitutions.ts
import { Router } from "express";

// Server keeps a small copy of the catalog so the API can work
// without importing TS from the client. You can expand this list
// or later replace with a shared JSON file.
type SubOption = { name: string; note?: string };
type SubEntry = {
  id: string;
  name: string;
  synonyms?: string[];
  groupId: string;
  pantryCategory:
    | "produce" | "dairy" | "meat" | "seafood" | "grains"
    | "spices" | "pantry" | "frozen" | "canned" | "beverages" | "other";
  substitutes: SubOption[];
  caution?: string;
};

const DATA: SubEntry[] = [
  {
    id: "buttermilk",
    name: "Buttermilk",
    synonyms: ["cultured buttermilk"],
    groupId: "dairy",
    pantryCategory: "dairy",
    substitutes: [
      { name: "Milk + lemon juice", note: "1 cup milk + 1 Tbsp lemon; rest 5–10 min" },
      { name: "Milk + white vinegar", note: "1 cup milk + 1 Tbsp vinegar" },
      { name: "Plain yogurt + milk", note: "3/4 cup yogurt + 1/4 cup milk" },
    ],
  },
  {
    id: "egg",
    name: "Egg",
    synonyms: ["eggs"],
    groupId: "eggs",
    pantryCategory: "pantry",
    substitutes: [
      { name: "Applesauce (unsweetened)", note: "1/4 cup per egg" },
      { name: "Ground flax + water", note: "1 Tbsp flax + 3 Tbsp water = 1 egg" },
    ],
  },
  {
    id: "olive-oil",
    name: "Olive Oil",
    synonyms: ["evoo", "extra virgin olive oil"],
    groupId: "oils-fats",
    pantryCategory: "pantry",
    substitutes: [
      { name: "Avocado oil", note: "Neutral; high smoke point" },
      { name: "Canola or sunflower oil", note: "Neutral; 1:1" },
    ],
  },
  {
    id: "brown-sugar",
    name: "Brown Sugar",
    synonyms: ["light brown sugar", "dark brown sugar"],
    groupId: "sweeteners",
    pantryCategory: "pantry",
    substitutes: [
      { name: "White sugar + molasses", note: "1 cup + 1 Tbsp molasses (light)" },
      { name: "White sugar + maple syrup", note: "Adjust liquid in batter" },
    ],
  },
];

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreMatch(q: string, t: string) {
  if (t.startsWith(q)) return 1.0;
  if (t.includes(q)) return 0.8;
  return 0;
}

const router = Router();

/**
 * GET /api/substitutions?q=buttermilk
 * Optional: &groupId=dairy
 */
router.get("/", (req, res) => {
  const qRaw = String(req.query.q || "").trim();
  const groupId = req.query.groupId ? String(req.query.groupId) : undefined;
  const q = normalize(qRaw);
  if (!q) return res.json({ query: qRaw, results: [] });

  const scored: { entry: SubEntry; score: number; matchedAs: "name"|"synonym" }[] = [];

  for (const e of DATA) {
    if (groupId && e.groupId !== groupId) continue;

    const ns = normalize(e.name);
    const s = scoreMatch(q, ns);
    if (s > 0) scored.push({ entry: e, score: s, matchedAs: "name" });

    if (e.synonyms) {
      for (const syn of e.synonyms) {
        const ss = scoreMatch(q, normalize(syn));
        if (ss > 0) scored.push({ entry: e, score: ss * 0.95, matchedAs: "synonym" });
      }
    }
  }

  // dedupe by id keep best
  const best = new Map<string, typeof scored[number]>();
  for (const r of scored) {
    const prev = best.get(r.entry.id);
    if (!prev || r.score > prev.score) best.set(r.entry.id, r);
  }

  const results = [...best.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ entry, matchedAs, score }) => ({
      id: entry.id,
      name: entry.name,
      groupId: entry.groupId,
      pantryCategory: entry.pantryCategory,
      matchedAs,
      score,
      substitutes: entry.substitutes,
      caution: entry.caution,
    }));

  res.json({ query: qRaw, results });
});

export default router;
