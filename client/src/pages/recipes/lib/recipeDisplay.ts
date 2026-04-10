import type { RecipeItem } from "./recipeList.types";

/** Try hard to extract a readable instruction string */
export function extractInstructions(r: RecipeItem): string | null {
  if (r.strInstructions && typeof r.strInstructions === "string") {
    const cleaned = r.strInstructions.replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }
  const direct = r.instructions ?? r.instruction ?? null;
  if (direct) {
    const s = Array.isArray(direct) ? direct.filter(Boolean).join(" ") : String(direct);
    const cleaned = s.replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }
  if (Array.isArray(r.steps) && r.steps.length) {
    const got = r.steps
      .map((s: any) => (typeof s === "string" ? s : s?.step ?? ""))
      .filter(Boolean)
      .join(" ");
    const cleaned = got.replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }
  if (Array.isArray(r.analyzedInstructions) && r.analyzedInstructions.length) {
    const parts: string[] = [];
    for (const blk of r.analyzedInstructions) {
      if (Array.isArray(blk.steps)) {
        for (const st of blk.steps) {
          if (st?.step) parts.push(st.step);
        }
      }
    }
    const cleaned = parts.join(" ").replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }
  return null;
}

/** Trim instruction text for card preview */
export function getInstructionPreview(r: RecipeItem, maxLen = 220): string | null {
  let text = extractInstructions(r);
  if (!text) return null;
  text = text.replace(/(?:^\d+\.\s*)+/g, "").trim();
  if (text.length > maxLen) text = text.slice(0, maxLen - 1).trimEnd() + "…";
  return text;
}

/** Choose best image field */
export function getImage(r: RecipeItem): string | null {
  return r.image || r.imageUrl || r.thumbnail || null;
}

/** Choose best source URL; fallback to a Google search by title */
export function getSourceUrl(r: RecipeItem): string | null {
  const candidates = [
    r.sourceUrl,
    r.sourceURL,
    r.source_link,
    r.url,
    r.source && /^https?:\/\//i.test(r.source) ? r.source : null,
  ].filter(Boolean) as string[];
  if (candidates.length) return candidates[0];
  if (r.title) {
    const q = encodeURIComponent(`${r.title} recipe`);
    return `https://www.google.com/search?q=${q}`;
  }
  return null;
}

export function getSourceLabel(r: RecipeItem): string {
  if (r.source === "chefsire") return "ChefSire";
  if (r.source === "external") return "External";
  if (r.source === "all") return "ChefSire + External";
  return "External";
}
