export type SubstitutionRankContext = "baking" | "dairy" | "seasoning" | "general" | string;

export type RankableSubstitution = {
  ingredient: string;
  text: string;
  context?: string | null;
  provenance?: Array<{ source?: string | null }> | null;
  quality_score?: number | null;
  qualityScore?: number | null;
};

export type RankedSubstitution<T extends RankableSubstitution> = T & {
  rank_score: number;
  rank_tier: "best_match" | "good_fallback" | "last_resort";
};

export type TieredRankedSubstitutions<T extends RankableSubstitution> = {
  best_match: RankedSubstitution<T>[];
  good_fallback: RankedSubstitution<T>[];
  last_resort: RankedSubstitution<T>[];
};

const VAGUE_TERMS = [
  "alternative",
  "substitute",
  "replacement",
  "anything",
  "or similar",
  "etc",
  "to taste",
  "as needed",
  "optional",
];

const LOW_CONFIDENCE_FALLBACKS = new Set([
  "water",
  "stock",
  "broth",
  "vinegar",
  "oil",
  "sauce",
  "seasoning",
  "herbs",
  "spices",
]);

const stopwords = new Set(["and", "or", "for", "with", "the", "a", "an", "of"]);

function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().trim();
}

function extractTokens(value: string | null | undefined): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length > 1 && !stopwords.has(part));
}

function scoreQuality(substitution: RankableSubstitution): number {
  const quality = substitution.quality_score ?? substitution.qualityScore;
  if (typeof quality !== "number" || Number.isNaN(quality)) return 0;
  return Math.max(-2, Math.min(2, quality));
}

function scoreProvenance(substitution: RankableSubstitution): number {
  const provenance = substitution.provenance ?? [];
  if (!Array.isArray(provenance) || provenance.length === 0) return 0;

  let score = 0;
  for (const entry of provenance) {
    const src = normalize(entry?.source);
    if (!src) continue;
    if (src.includes("curated") || src.includes("manual") || src.includes("editor")) {
      score += 1.25;
    } else if (src.includes("import") || src.includes("pairs") || src.includes("generated")) {
      score -= 0.4;
    } else {
      score += 0.2;
    }
  }

  return Math.max(-1.5, Math.min(2, score));
}

function scoreFamilySimilarity(substitution: RankableSubstitution): number {
  const ingredient = normalize(substitution.ingredient);
  const text = normalize(substitution.text);

  if (!ingredient || !text) return -0.5;
  if (ingredient === text) return 2;
  if (text.includes(ingredient)) return 1.5;

  const ingredientTokens = extractTokens(ingredient);
  const substitutionTokens = new Set(extractTokens(text));
  if (ingredientTokens.length === 0) return 0;

  const overlapCount = ingredientTokens.filter((t) => substitutionTokens.has(t)).length;
  if (overlapCount === 0) return -0.2;

  const overlapRatio = overlapCount / ingredientTokens.length;
  if (overlapRatio >= 0.75) return 1.25;
  if (overlapRatio >= 0.4) return 0.65;
  return 0.2;
}

function scoreContext(substitution: RankableSubstitution, requestedContext?: SubstitutionRankContext): number {
  const value = normalize(substitution.context);
  const wanted = normalize(requestedContext);

  if (wanted) {
    if (value === wanted) return 1.2;
    if (!value || value === "general") return -0.2;
    return -0.4;
  }

  if (!value || value === "general") return 0;
  if (value === "baking" || value === "dairy" || value === "seasoning") return 0.45;
  return 0.2;
}

function scoreNameQuality(text: string): number {
  const normalized = normalize(text);
  if (!normalized) return -1;

  const words = extractTokens(normalized);
  const wordCount = words.length;

  let score = 0;
  if (wordCount <= 3) score += 0.25;
  else if (wordCount >= 8) score -= 0.2;

  if (/[,;/]/.test(normalized)) score -= 0.15;
  if (/\b(or|and\/or)\b/.test(normalized)) score -= 0.2;
  if (/\d/.test(normalized)) score -= 0.05;

  return score;
}

function penaltyForVagueness(text: string): number {
  const normalized = normalize(text);
  if (!normalized) return -1;

  let penalty = 0;

  for (const term of VAGUE_TERMS) {
    if (normalized.includes(term)) penalty -= 0.35;
  }

  const oneWord = extractTokens(normalized);
  if (oneWord.length === 1 && LOW_CONFIDENCE_FALLBACKS.has(oneWord[0])) {
    penalty -= 0.7;
  }

  if (oneWord.length <= 1 && oneWord[0] && oneWord[0].length <= 3) {
    penalty -= 0.3;
  }

  return penalty;
}

function classifyTier(score: number): "best_match" | "good_fallback" | "last_resort" {
  if (score >= 2.2) return "best_match";
  if (score >= 1) return "good_fallback";
  return "last_resort";
}

export function rankSubstitution<T extends RankableSubstitution>(
  substitution: T,
  options?: { requestedContext?: SubstitutionRankContext }
): RankedSubstitution<T> {
  const score =
    scoreQuality(substitution) +
    scoreProvenance(substitution) +
    scoreFamilySimilarity(substitution) +
    scoreContext(substitution, options?.requestedContext) +
    scoreNameQuality(substitution.text) +
    penaltyForVagueness(substitution.text);

  const rank_score = Number(score.toFixed(3));

  return {
    ...substitution,
    rank_score,
    rank_tier: classifyTier(rank_score),
  };
}

export function rankSubstitutions<T extends RankableSubstitution>(
  substitutions: T[],
  options?: { requestedContext?: SubstitutionRankContext }
): RankedSubstitution<T>[] {
  return substitutions
    .map((item) => rankSubstitution(item, options))
    .sort((a, b) => b.rank_score - a.rank_score || a.text.localeCompare(b.text));
}

export function tierSubstitutions<T extends RankableSubstitution>(
  substitutions: RankedSubstitution<T>[]
): TieredRankedSubstitutions<T> {
  return substitutions.reduce<TieredRankedSubstitutions<T>>(
    (acc, item) => {
      acc[item.rank_tier].push(item);
      return acc;
    },
    { best_match: [], good_fallback: [], last_resort: [] }
  );
}
