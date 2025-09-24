import * as React from "react";
import { useRecipesFilters } from "@/hooks/useRecipesFilters";

/** What the cards in RecipesListPage expect */
export type RecipeCardData = {
  id: string;
  title: string;
  image?: string | null;
  cuisine?: string | null;
  mealType?: string | null;
  cookTime?: number | null;
  servings?: number | null;
  difficulty?: "Easy" | "Medium" | "Hard" | null;
  ratingSpoons?: number | null;
  dietTags?: string[] | null;
};

/** Build query string from filters */
function buildQuery(state: ReturnType<typeof useRecipesFilters>["state"]) {
  const params = new URLSearchParams();

  const q = (state as any).search?.trim();
  if (q) params.set("q", q);

  const addList = (key: string, arr: string[]) => {
    if (arr && arr.length) params.set(key, arr.join(","));
  };

  addList("cuisines", state.cuisines);
  addList("diets", state.dietary);
  addList("mealTypes", state.mealTypes);

  // Optional knobs
  if (state.maxCookTime != null) params.set("maxCookTime", String(state.maxCookTime));
  if (state.minSpoons != null) params.set("minSpoons", String(state.minSpoons));
  if (state.onlyRecipes) params.set("onlyRecipes", "1");

  // sortBy: map to what the service understands (keep it simple for now)
  if (state.sortBy) params.set("sortBy", state.sortBy);

  // paging defaults (client can tune later)
  params.set("pageSize", "24");
  params.set("offset", "0");

  return params.toString();
}

/** Try to parse JSON, but gracefully fall back to text */
async function readBodySafely(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text; // e.g. HTML error page
  }
}

/** Normalize any service item into RecipeCardData */
function asCard(item: any): RecipeCardData {
  // tolerate various shapes
  const id = String(item.id ?? item.postId ?? cryptoRandom());
  const title =
    item.title ??
    item.recipe?.title ??
    item.post?.caption ??
    "Untitled recipe";

  const image =
    item.image ??
    item.imageUrl ??
    item.recipe?.image ??
    item.post?.imageUrl ??
    null;

  // difficulty can come as "Easy"/"Medium"/"Hard" or lowercase, etc.
  const diffRaw =
    item.difficulty ??
    item.recipe?.difficulty ??
    null;
  const difficulty =
    typeof diffRaw === "string"
      ? (["Easy", "Medium", "Hard"].includes(cap(diffRaw)) ? (cap(diffRaw) as "Easy" | "Medium" | "Hard") : null)
      : null;

  // ratingSpoons can be numeric or nested
  const ratingSpoons =
    item.ratingSpoons ??
    item.recipe?.ratingSpoons ??
    item.rating ??
    null;

  // some services provide cuisine/mealType tags
  const cuisine =
    item.cuisine ??
    item.recipe?.cuisine ??
    null;

  const mealType =
    item.mealType ??
    item.recipe?.mealType ??
    null;

  const cookTime =
    item.cookTime ??
    item.recipe?.cookTime ??
    null;

  const servings =
    item.servings ??
    item.recipe?.servings ??
    null;

  const dietTags: string[] | null =
    item.dietTags ??
    item.recipe?.dietTags ??
    null;

  return {
    id,
    title,
    image,
    cuisine,
    mealType,
    cookTime: numOrNull(cookTime),
    servings: numOrNull(servings),
    difficulty,
    ratingSpoons: numOrNull(ratingSpoons),
    dietTags: Array.isArray(dietTags) ? dietTags : null,
  };
}

function cap(s: string) {
  return s.length ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}
function numOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function cryptoRandom() {
  // stable enough fallback id for client display
  return Math.random().toString(36).slice(2);
}

export function useRecipesData() {
  const { state } = useRecipesFilters();
  const [recipes, setRecipes] = React.useState<RecipeCardData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let aborted = false;

    async function go() {
      setLoading(true);
      setErr(null);

      const qs = buildQuery(state);

      // 1) Try the new canonical endpoint
      const firstUrl = `/api/recipes/search?${qs}`;
      // 2) Fallback to older alias if the first 404s
      const fallbackUrl = `/api/search?${qs}`;

      const tryOnce = async (url: string) => {
        const res = await fetch(url);
        const body = await readBodySafely(res);
        return { res, body };
      };

      try {
        let { res, body } = await tryOnce(firstUrl);

        // If the server returned HTML or a non-ok status, handle it
        if (!res.ok) {
          // graceful fallback for older servers still on /api/search
          if (res.status === 404) {
            const second = await tryOnce(fallbackUrl);
            res = second.res;
            body = second.body;
          }
        }

        if (!res.ok) {
          const message =
            typeof body === "string"
              ? // hide long HTML
                `HTTP ${res.status} ${res.statusText}${
                  body.startsWith("<") ? " (server returned HTML error page)" : `: ${body}`
                }`
              : body?.error || `HTTP ${res.status} ${res.statusText}`;

          throw new Error(message);
        }

        // Accept either { ok, items } or raw array
        const items = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];

        const mapped: RecipeCardData[] = items.map(asCard);

        if (!aborted) {
          setRecipes(mapped);
          setLoading(false);
        }
      } catch (e: any) {
        if (!aborted) {
          setRecipes([]);
          setErr(e?.message || "Failed to load recipes");
          setLoading(false);
        }
      }
    }

    go();
    return () => {
      aborted = true;
    };
  }, [
    state.search,
    state.cuisines.join(","),
    state.dietary.join(","),
    state.mealTypes.join(","),
    state.ethnicities.join(","), // included in query later if you wire it server-side
    state.maxCookTime,
    state.minSpoons,
    state.onlyRecipes,
    state.sortBy,
  ]);

  return { recipes, loading, err };
}
