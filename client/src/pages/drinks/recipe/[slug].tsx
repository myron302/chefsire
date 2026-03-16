import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import RequireAgeGate from "@/components/RequireAgeGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { addItemsToShoppingList } from "@/lib/shopping-list";
import { addRecentlyViewedDrinkSlug } from "@/components/drinks/RecentlyViewedDrinks";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { getCanonicalDrinkRecipeBySlug } from "@/data/drinks/canonical";
import { postEngagementEvent } from "@/lib/engagement-events";
import CreatorFollowButton from "@/components/drinks/CreatorFollowButton";

type UserDrinkRecipe = {
  slug: string;
  name: string;
  description?: string | null;
  ingredients: string[];
  instructions: string[];
  image?: string | null;
  category: string;
  subcategory?: string | null;
  remixedFromSlug?: string | null;
  creatorId?: string | null;
  creatorUsername?: string | null;
};

type DrinkRemixItem = {
  slug: string;
  name: string;
  image?: string | null;
  creatorName?: string | null;
  creatorId?: string | null;
  createdAt?: string | null;
  route: string;
};

type RemixChainNode = {
  slug: string;
  name: string;
  image?: string | null;
  route: string;
  isCanonical: boolean;
  remixedFromSlug?: string | null;
  creatorId?: string | null;
  creatorUsername?: string | null;
};

type RemixChainDescendant = RemixChainNode & {
  parentSlug: string;
  depth: number;
};

type RemixChainResponse = {
  ok: boolean;
  current?: RemixChainNode;
  parent?: RemixChainNode | null;
  children?: RemixChainNode[];
  ancestors?: RemixChainNode[];
  descendants?: RemixChainDescendant[];
};

function resolveRemixDestination(remix: DrinkRemixItem): string {
  const fallback = `/drinks/recipe/${encodeURIComponent(remix.slug)}?community=1`;
  if (typeof remix.route !== "string") return fallback;
  const trimmed = remix.route.trim();
  if (!trimmed) return fallback;
  if (!trimmed.startsWith("/")) return fallback;

  if (trimmed.startsWith("/drinks/recipe/")) {
    return trimmed.includes("?") ? trimmed : `${trimmed}?community=1`;
  }

  return trimmed;
}
function resolveRecipeRoute(node: { slug: string; route?: string | null }): string {
  const fallback = `/drinks/recipe/${encodeURIComponent(node.slug)}`;
  const candidate = typeof node.route === "string" ? node.route.trim() : "";
  if (!candidate || !candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("/drinks/recipe/")) return candidate;
  return fallback;
}


function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|\./)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}


function logDrinkEvent(slug: string, eventType: "view" | "remix" | "grocery_add") {
  return postEngagementEvent(
    "/api/drinks/events",
    { slug, eventType },
    true
  );
}

function CanonicalDrinkRecipeContent({ slug }: { slug: string }) {
  const { toast } = useToast();
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const forceCommunityRoute = searchParams?.get("community") === "1";
  const canonicalRecipe = forceCommunityRoute ? null : getCanonicalDrinkRecipeBySlug(slug);
  const [userRecipe, setUserRecipe] = useState<UserDrinkRecipe | null>(null);
  const [userRecipeLoaded, setUserRecipeLoaded] = useState(false);
  const [remixes, setRemixes] = useState<DrinkRemixItem[]>([]);
  const [remixesLoading, setRemixesLoading] = useState(false);
  const [remixChain, setRemixChain] = useState<RemixChainResponse | null>(null);
  const [remixChainLoading, setRemixChainLoading] = useState(false);

  useEffect(() => {
    if (canonicalRecipe) return;

    fetch(`/api/drinks/user/${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        setUserRecipe(payload?.recipe ?? null);
      })
      .catch(() => setUserRecipe(null))
      .finally(() => setUserRecipeLoaded(true));
  }, [canonicalRecipe, slug]);

  const trackedDrinkSlug = canonicalRecipe?.slug ?? userRecipe?.slug ?? "";

  useEffect(() => {
    if (!trackedDrinkSlug) return;

    addRecentlyViewedDrinkSlug(trackedDrinkSlug);

    void logDrinkEvent(trackedDrinkSlug, "view");
  }, [trackedDrinkSlug]);

  useEffect(() => {
    if (!canonicalRecipe?.slug) {
      setRemixes([]);
      setRemixesLoading(false);
      return;
    }

    setRemixesLoading(true);
    fetch(`/api/drinks/remixes/${encodeURIComponent(canonicalRecipe.slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        setRemixes(Array.isArray(payload?.items) ? payload.items : []);
      })
      .catch(() => setRemixes([]))
      .finally(() => setRemixesLoading(false));
  }, [canonicalRecipe?.slug]);

  useEffect(() => {
    if (!trackedDrinkSlug) {
      setRemixChain(null);
      setRemixChainLoading(false);
      return;
    }

    setRemixChainLoading(true);
    fetch(`/api/drinks/remix-chain/${encodeURIComponent(trackedDrinkSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: RemixChainResponse | null) => {
        setRemixChain(payload && payload.ok ? payload : null);
      })
      .catch(() => setRemixChain(null))
      .finally(() => setRemixChainLoading(false));
  }, [trackedDrinkSlug]);

  if (!canonicalRecipe && !userRecipe && userRecipeLoaded) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Recipe not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We couldn&apos;t find that drink recipe. Try browsing from the drinks hub.
            </p>
            <Link href="/drinks">
              <Button>Go to Drinks Hub</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canonicalRecipe && !userRecipe) {
    return <div className="container mx-auto px-4 py-10 max-w-3xl text-muted-foreground">Loading recipe...</div>;
  }

  const displayName = canonicalRecipe?.name ?? userRecipe?.name ?? "Drink Recipe";
  const sourceRoute = canonicalRecipe?.sourceRoute ?? `/drinks/${userRecipe?.category ?? "smoothies"}`;
  const sourceTitle = canonicalRecipe?.sourceTitle ?? "Community Recipes";

  const recipe = canonicalRecipe?.recipe;
  const imageUrl = (typeof recipe?.image === "string" ? recipe.image : typeof recipe?.imageUrl === "string" ? recipe.imageUrl : "") || userRecipe?.image || "";
  const ingredients = asList(recipe?.ingredients ?? userRecipe?.ingredients ?? []);
  const instructionSteps = asList(recipe?.instructions ?? userRecipe?.instructions ?? []);
  const description = recipe?.description ?? userRecipe?.description;
  const remixSourceSlug = canonicalRecipe?.slug ?? userRecipe?.slug;
  const remixChainAncestors = Array.isArray(remixChain?.ancestors) ? remixChain.ancestors : [];
  const remixChainChildren = Array.isArray(remixChain?.children) ? remixChain.children : [];
  const remixChainDescendants = Array.isArray(remixChain?.descendants) ? remixChain.descendants : [];
  const hasLineage = remixChainAncestors.length > 0 || remixChainChildren.length > 0;

  const addAllIngredients = async () => {
    const payload = ingredients
      .map((ingredient) => ({ name: ingredient, quantity: "1", unit: "", category: "From Recipe" }))
      .filter((item) => item.name.trim().length > 0);

    if (payload.length === 0) {
      toast({ title: "No ingredients found to add.", variant: "destructive" });
      return;
    }

    const result = await addItemsToShoppingList(payload);
    if (result.addedCount > 0) {
      void logDrinkEvent(trackedDrinkSlug, "grocery_add");
      toast({ title: `Added ${result.addedCount} ingredient${result.addedCount === 1 ? "" : "s"} to shopping list.` });
      return;
    }

    toast({ title: "Ingredients are already in your shopping list." });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <DrinksPlatformNav current="recipe" />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={sourceRoute}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to category
          </Button>
        </Link>
        <Badge variant="secondary">{canonicalRecipe ? "Canonical Recipe" : "ChefSire Community Recipe"}</Badge>
      </div>

      {remixSourceSlug ? (
        <div className="flex flex-wrap gap-2">
          {canonicalRecipe && !remixesLoading ? (
            <Badge variant="secondary" className="px-3">
              {remixes.length} remix{remixes.length === 1 ? "" : "es"}
            </Badge>
          ) : null}
          <Link href={`/drinks/submit?remix=${encodeURIComponent(remixSourceSlug)}`} onClick={() => void logDrinkEvent(trackedDrinkSlug, "remix")}>
            <Button>Remix</Button>
          </Link>
          <Button variant="outline" onClick={addAllIngredients}>
            Add Ingredients to Shopping List
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl">{displayName}</CardTitle>
          {description ? <p className="text-muted-foreground">{description}</p> : null}
          <div className="text-sm text-muted-foreground">
            Category:{" "}
            <Link href={sourceRoute} className="underline underline-offset-2">
              {sourceTitle}
            </Link>
          </div>
          {userRecipe?.creatorUsername ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>By <Link href={`/drinks/creator/${encodeURIComponent(userRecipe.creatorId ?? "")}`} className="underline underline-offset-2">@{userRecipe.creatorUsername}</Link></span>
              <CreatorFollowButton creatorId={userRecipe.creatorId ?? null} />
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={displayName}
              className="w-full max-h-[360px] object-cover rounded-lg border"
              loading="lazy"
            />
          ) : null}

          {ingredients.length > 0 ? (
            <section>
              <h2 className="font-semibold text-lg mb-2">Ingredients</h2>
              <ul className="list-disc pl-5 space-y-1">
                {ingredients.map((ingredient, index) => (
                  <li key={`${ingredient}-${index}`}>{ingredient}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {instructionSteps.length > 0 ? (
            <section>
              <h2 className="font-semibold text-lg mb-2">Instructions</h2>
              <ol className="list-decimal pl-5 space-y-1">
                {instructionSteps.map((step, index) => (
                  <li key={`${step}-${index}`}>{step}</li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="font-semibold text-lg">Remix Lineage</h2>
              {!remixChainLoading && hasLineage ? (
                <span className="text-sm text-muted-foreground">Part of a remix chain</span>
              ) : null}
            </div>

            {remixChainLoading ? <p className="text-sm text-muted-foreground">Loading remix lineage...</p> : null}

            {!remixChainLoading && remixChainAncestors.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Remixed from:</p>
                <ul className="space-y-1 text-sm">
                  {[...remixChainAncestors].reverse().map((ancestor) => (
                    <li key={ancestor.slug} className="flex flex-wrap items-center gap-2">
                      <Link href={resolveRecipeRoute(ancestor)} className="underline underline-offset-2 hover:text-primary">
                        {ancestor.name}
                      </Link>
                      {ancestor.creatorUsername ? <span className="text-muted-foreground">by <Link href={`/drinks/creator/${encodeURIComponent(ancestor.creatorId ?? "")}`} className="underline underline-offset-2">@{ancestor.creatorUsername}</Link></span> : null}
                      <CreatorFollowButton creatorId={ancestor.creatorId ?? null} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!remixChainLoading && remixChainChildren.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Inspired {remixChainChildren.length} remix{remixChainChildren.length === 1 ? "" : "es"}:</p>
                <ul className="space-y-1 text-sm">
                  {remixChainChildren.map((child) => (
                    <li key={child.slug} className="flex flex-wrap items-center gap-2">
                      <Link href={resolveRecipeRoute(child)} className="underline underline-offset-2 hover:text-primary">
                        {child.name}
                      </Link>
                      {child.creatorUsername ? <span className="text-muted-foreground">by <Link href={`/drinks/creator/${encodeURIComponent(child.creatorId ?? "")}`} className="underline underline-offset-2">@{child.creatorUsername}</Link></span> : null}
                      <CreatorFollowButton creatorId={child.creatorId ?? null} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!remixChainLoading && remixChainDescendants.some((desc) => desc.depth > 1) ? (
              <p className="text-xs text-muted-foreground">
                Total downstream remixes: {remixChainDescendants.length}
              </p>
            ) : null}

            {!remixChainLoading && !hasLineage ? (
              <p className="text-sm text-muted-foreground">No remix lineage yet. Be the first to remix this drink.</p>
            ) : null}
          </section>

          {canonicalRecipe ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="font-semibold text-lg">Remixes of this drink</h2>
                {!remixesLoading ? (
                  <span className="text-sm text-muted-foreground">{remixes.length} remix{remixes.length === 1 ? "" : "es"}</span>
                ) : null}
              </div>

              {remixesLoading ? <p className="text-sm text-muted-foreground">Loading remixes...</p> : null}

              {!remixesLoading && remixes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No remixes yet. Be the first to remix this drink.</p>
              ) : null}

              {!remixesLoading && remixes.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {remixes.map((remix) => {
                    const remixRoute = resolveRemixDestination(remix);
                    const createdAtLabel = remix.createdAt
                      ? new Date(remix.createdAt).toLocaleDateString()
                      : null;

                    return (
                      <Card key={remix.slug} className="h-full hover:border-primary/40 transition-colors">
                        <CardContent className="p-4 space-y-3">
                          {remix.image ? (
                            <Link href={remixRoute} className="block">
                              <img
                                src={remix.image}
                                alt={remix.name}
                                className="w-full h-36 object-cover rounded-md border"
                                loading="lazy"
                              />
                            </Link>
                          ) : null}
                          <div className="space-y-2">
                            <Link href={remixRoute} className="font-medium underline underline-offset-2 hover:text-primary">
                              {remix.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">Remixed from {displayName}</p>
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                              {remix.creatorName ? <span>By <Link href={`/drinks/creator/${encodeURIComponent(remix.creatorId ?? "")}`} className="underline underline-offset-2">@{remix.creatorName}</Link></span> : null}
                              {createdAtLabel ? <span>{createdAtLabel}</span> : null}
                              <CreatorFollowButton creatorId={remix.creatorId ?? null} />
                            </div>
                          </div>
                          <div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                window.location.assign(remixRoute);
                              }}
                            >
                              View Remix
                            </Button>
                          </div>
                          {import.meta.env.DEV ? (
                            <p className="text-[11px] text-muted-foreground break-all">Permalink: {remixRoute}</p>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CanonicalDrinkRecipePage() {
  const [matched, params] = useRoute<{ slug: string }>("/drinks/recipe/:slug");
  const slug = matched ? String(params.slug ?? "") : "";
  const canonicalRecipe = getCanonicalDrinkRecipeBySlug(slug);
  const needsAgeGate = canonicalRecipe?.sourceRoute.startsWith("/drinks/potent-potables") ?? false;

  if (needsAgeGate) {
    return (
      <RequireAgeGate>
        <CanonicalDrinkRecipeContent slug={slug} />
      </RequireAgeGate>
    );
  }

  return <CanonicalDrinkRecipeContent slug={slug} />;
}
