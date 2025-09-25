// client/src/pages/recipes/RecipesListPage.tsx
import * as React from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, Users, ExternalLink } from "lucide-react";

/** Very permissive shape — we’ll normalize on the client */
type RecipeItem = {
  id: string;
  title: string;

  // images (varies by mapper)
  image?: string | null;
  imageUrl?: string | null;
  thumbnail?: string | null;

  // categorization
  cuisine?: string | null;
  mealType?: string | null;
  dietTags?: string[];

  // meta
  ratingSpoons?: number | null;
  cookTime?: number | null;
  servings?: number | null;

  // instructions (many possible shapes)
  instructions?: string | string[] | null;
  instruction?: string | string[] | null;
  steps?: string[] | { step?: string }[] | null;
  analyzedInstructions?: { steps?: { step?: string }[] }[] | null;
  strInstructions?: string | null; // raw MealDB sometimes leaks through

  // source links (varies by mapper)
  sourceUrl?: string | null;
  sourceURL?: string | null;
  source_link?: string | null;
  url?: string | null;
  source?: string | null; // sometimes a URL, sometimes just a label
};

type SearchResponse =
  | { ok: true; total: number; source?: string; items: RecipeItem[] }
  | { ok: false; error: string };

/** Spoons (0–5) */
function SpoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}>
      <path
        d="M10.5 2c2.485 0 4.5 2.015 4.5 4.5 0 1.61-.828 3.028-2.082 3.86l-.418.275V14a4.5 4.5 0 0 1-1.5 3.366V22h-3v-4.634A4.5 4.5 0 0 1 6 14V10.635l-.418-.275A4.5 4.5 0 0 1 3.5 6.5C3.5 4.015 5.515 2 8 2h2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
function SpoonRating({ value }: { value: number | null | undefined }) {
  const v = Math.max(0, Math.min(5, Math.round(value ?? 0)));
  return (
    <div className="flex items-center gap-1 text-orange-600">
      {Array.from({ length: 5 }).map((_, i) => (
        <SpoonIcon key={i} className={i < v ? "w-4 h-4" : "w-4 h-4 opacity-30"} />
      ))}
    </div>
  );
}

/** Try hard to extract a readable instruction string */
function extractInstructions(r: RecipeItem): string | null {
  // 1) direct string/string[]
  const direct =
    r.instructions ??
    r.instruction ??
    r.strInstructions ??
    null;

  if (direct) {
    const s = Array.isArray(direct)
      ? direct.filter(Boolean).join(" ")
      : String(direct);
    const cleaned = s.replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }

  // 2) steps as array of strings
  if (Array.isArray(r.steps) && r.steps.length) {
    const got = r.steps
      .map((s: any) => (typeof s === "string" ? s : s?.step ?? ""))
      .filter(Boolean)
      .join(" ");
    const cleaned = got.replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }

  // 3) spoonacular-like analyzedInstructions
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
function getInstructionPreview(r: RecipeItem, maxLen = 220): string | null {
  let text = extractInstructions(r);
  if (!text) return null;
  // strip repeated numeric prefixes like "1. "
  text = text.replace(/(?:^\d+\.\s*)+/g, "").trim();
  if (text.length > maxLen) text = text.slice(0, maxLen - 1).trimEnd() + "…";
  return text;
}

/** Choose best image field */
function getImage(r: RecipeItem): string | null {
  return r.image || r.imageUrl || r.thumbnail || null;
}

/** Choose best source URL; fallback to a Google search by title */
function getSourceUrl(r: RecipeItem): string | null {
  const candidates = [
    r.sourceUrl,
    r.sourceURL,
    r.source_link,
    r.url,
    // sometimes "source" is actually a URL:
    (r.source && /^https?:\/\//i.test(r.source) ? r.source : null),
  ].filter(Boolean) as string[];

  if (candidates.length) return candidates[0];

  // last resort: search by title
  if (r.title) {
    const q = encodeURIComponent(`${r.title} recipe`);
    return `https://www.google.com/search?q=${q}`;
  }
  return null;
}

function RecipeCard({ r }: { r: RecipeItem }) {
  const img = getImage(r);
  const preview = getInstructionPreview(r);
  const sourceHref = getSourceUrl(r);

  const ImageEl = (
    img ? (
      <img src={img} alt={r.title} className="w-full h-48 object-cover" loading="lazy" />
    ) : (
      <div className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground">
        No image
      </div>
    )
  );

  const TitleEl = (
    <h3 className="font-semibold leading-snug line-clamp-2">
      {r.title}
    </h3>
  );

  return (
    <Card className="overflow-hidden bg-card border border-border hover:shadow-md transition-shadow">
      {sourceHref ? (
        <a href={sourceHref} target="_blank" rel="noopener noreferrer" aria-label={`Open source for ${r.title}`}>
          {ImageEl}
        </a>
      ) : (
        ImageEl
      )}

      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          {sourceHref ? (
            <a
              href={sourceHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {TitleEl}
            </a>
          ) : (
            TitleEl
          )}
          <SpoonRating value={r.ratingSpoons ?? null} />
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {r.cookTime ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {r.cookTime} min
            </span>
          ) : null}
          {r.servings ? (
            <span className="inline-flex items-center gap-1">
              <Users className="w-4 h-4" />
              {r.servings} servings
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1">
          {r.cuisine ? <Badge variant="secondary">{r.cuisine}</Badge> : null}
          {r.mealType ? <Badge variant="outline">{r.mealType}</Badge> : null}
          {(r.dietTags || []).slice(0, 3).map((t) => (
            <Badge key={t} variant="outline" className="capitalize">
              {t}
            </Badge>
          ))}
        </div>

        {preview && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-4">{preview}</p>
        )}

        {sourceHref && (
          <div className="pt-1">
            <a
              href={sourceHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View source <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RecipesListPage() {
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<RecipeItem[]>([]);

  async function runSearch(term?: string) {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (term && term.trim()) params.set("q", term.trim());

      const res = await fetch(`/api/recipes/search?${params.toString()}`);
      const json = (await res.json()) as SearchResponse;

      if (!res.ok || !("ok" in json) || json.ok === false) {
        const msg = (json as any)?.error || (await res.text()) || `Request failed (${res.status})`;
        throw new Error(msg);
      }

      setItems(json.items || []);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    runSearch(); // initial load (server can return randoms or defaults)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Recipes</h1>
        <Link href="/recipes/filters">
          <Button variant="outline">Filters</Button>
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Input
          placeholder="Search recipes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch(q)}
          className="max-w-md"
          aria-label="Search recipes"
        />
        <Button onClick={() => runSearch(q)}>Search</Button>
        <Button variant="ghost" onClick={() => runSearch()}>Random</Button>
        <Link href="/recipes/filters">
          <Button variant="ghost">Advanced filters</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading recipes…
        </div>
      ) : err ? (
        <div className="text-destructive">Error: {err}</div>
      ) : items.length === 0 ? (
        <div className="text-muted-foreground">
          No recipes found. Try a different search or click Random.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((r) => (
            <RecipeCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}
