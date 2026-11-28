import { sql, type SQL } from 'drizzle-orm';
import type { RequestHandler } from 'express';

/** Deploying this code does not enable pg_trgm or change legacy search. */
export const searchTrigramEnabled = () => process.env.SEARCH_TRIGRAM_ENABLED === 'true';

export function searchTerm(value: string): string {
  if (value.length > 160 || /[\x00-\x1f\x7f]/.test(value)) throw new Error('Invalid search query');
  const normalized = value.normalize('NFKC').trim();
  if (normalized.length > 160) throw new Error('Invalid search query');
  return normalized;
}
export const literalContains = (query: string) => `%${query.replace(/[\\%_]/g, '\\$&')}%`;

/** Keep operators on the indexed lower(column) expression; no pooled-session threshold mutations. */
export function trigramMatch(column: any, query: string): SQL {
  const q = searchTerm(query).toLowerCase();
  const partial = sql`lower(${column}) LIKE ${literalContains(q)}`;
  if (q.length < 3 || /[\\%_]/.test(q)) return partial;
  const fuzzy = sql`(lower(${column}) % ${q} OR lower(${column}) %> ${q})`;
  // A typo in a word of a long title can fall below PostgreSQL's default whole-string
  // threshold. Preselect with indexed edge trigrams, then apply a fixed word score.
  // E.g. wiskey -> Bourbon Whiskey (whole similarity .278, word similarity .571).
  if (q.length < 6) return sql`(${partial} OR ${fuzzy})`;
  return sql`(${partial} OR ${fuzzy} OR ((lower(${column}) LIKE ${literalContains(q.slice(0, 3))}
    OR lower(${column}) LIKE ${literalContains(q.slice(-3))}) AND word_similarity(${q}, lower(${column})) >= 0.5))`;
}

/** Exact names precede prefixes, substrings, then fuzzy matches, regardless of popularity. */
export function trigramOrder(columns: any[], query: string): SQL[] {
  const q = searchTerm(query).toLowerCase();
  const ranks = columns.map(column => sql`CASE WHEN lower(${column}) = ${q} THEN 0
    WHEN lower(${column}) LIKE ${literalContains(q).slice(1)} THEN 1
    WHEN lower(${column}) LIKE ${literalContains(q)} THEN 2 ELSE 3 END`);
  const scores = columns.map(column => sql`coalesce(greatest(similarity(lower(${column}), ${q}), word_similarity(${q}, lower(${column}))), 0)`);
  const wholeScores = columns.map(column => sql`coalesce(similarity(lower(${column}), ${q}), 0)`);
  return [sql`least(${sql.join(ranks, sql`, `)})`, sql`greatest(${sql.join(scores, sql`, `)}) DESC`, sql`greatest(${sql.join(wholeScores, sql`, `)}) DESC`];
}

/** Reject malformed new-mode inputs before starting provider or database work. */
export const validateTrigramSearch: RequestHandler = (req, res, next) => {
  if (!searchTrigramEnabled()) return next();
  try {
    for (const key of ['q', 'query', 'search']) {
      const value = req.query[key];
      if (value !== undefined) {
        if (typeof value !== 'string') throw new Error('Invalid search query');
        searchTerm(value);
      }
    }
    next();
  } catch { res.status(400).json({ message: 'Search query must be a string of at most 160 characters without control characters' }); }
};
