import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { drinkRouteRegistry, type DrinkRouteRegistryEntry } from "../client/src/data/drinks";
import { slugifyDrinkName } from "../client/src/data/drinks/types";

type DrinkIndexEntry = {
  name: string;
  route: string;
  sourceRoute: string;
  sourceTitle: string;
  slug: string;
  image: string | null;
};
type CanonicalDrinkRecipeEntry = {
  slug: string;
  name: string;
  sourceRoute: string;
  sourceTitle: string;
  recipe: Record<string, unknown>;
};
type DrinkRoute = { route: string; title: string };
type DuplicateEntry = {
  key: string;
  name: string;
  keptRoute: string;
  duplicateRoute: string;
};

type DrinkIndexFile = {
  recipes: Record<string, DrinkIndexEntry>;
  bySlug: Record<string, DrinkIndexEntry>;
  routes: DrinkRoute[];
  duplicates: DuplicateEntry[];
  generatedAt: string;
};
type CanonicalDrinkFile = {
  entries: CanonicalDrinkRecipeEntry[];
  bySlug: Record<string, CanonicalDrinkRecipeEntry>;
  generatedAt: string;
};

type DrinkRecipeLike = { name?: string; image?: unknown; imageUrl?: unknown };

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const drinksDataDirPath = path.join(repoRoot, "client", "src", "data", "drinks");
const serverGeneratedDirPath = path.join(repoRoot, "server", "generated");
const clientGeneratedDirPath = path.join(repoRoot, "client", "src", "generated");
const generatedFilePath = path.join(serverGeneratedDirPath, "drink-index.json");
const generatedCanonicalFilePath = path.join(clientGeneratedDirPath, "drink-canonical.json");

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function writeAtomically(filePath: string, contents: string) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, contents, "utf8");
  fs.renameSync(tempPath, filePath);
}

const DRINK_ROUTE_PRIORITY: Record<string, number> = {
  "/drinks/caffeinated/cold-brew": 50,
  "/drinks/caffeinated/espresso": 45,
  "/drinks/caffeinated/specialty": 20,
  "/drinks/smoothies/green": 40,
  "/drinks/smoothies/berry": 30,
  "/drinks/potent-potables/cocktails": 10,
  "/drinks/potent-potables/liqueurs": 20,
  "/drinks/potent-potables/mocktails": 20,
  "/drinks/potent-potables/seasonal": 15,
  "/drinks/potent-potables/gin": 50,
  "/drinks/potent-potables/rum": 50,
  "/drinks/potent-potables/whiskey-bourbon": 50,
  "/drinks/potent-potables/scotch-irish-whiskey": 45,
  "/drinks/potent-potables/hot-drinks": 60,
  "/drinks/potent-potables/spritz": 55,
  "/drinks/potent-potables/virgin-cocktails": 55,
  "/drinks/potent-potables/martinis": 60,
};

function getDrinkRoutePriority(route: string): number {
  return DRINK_ROUTE_PRIORITY[route] ?? 30;
}

function buildCanonicalSlug(name: string, sourceRoute: string, usedSlugs: Set<string>): string {
  const baseSlug = slugifyDrinkName(name);
  if (!baseSlug) {
    return "drink-recipe";
  }

  if (!usedSlugs.has(baseSlug)) {
    return baseSlug;
  }

  const routeSuffix = sourceRoute
    .replace(/^\/drinks\//, "")
    .split("/")
    .filter(Boolean)
    .join("-");

  const routeScopedSlug = slugifyDrinkName(`${baseSlug}-${routeSuffix}`);
  if (routeScopedSlug && !usedSlugs.has(routeScopedSlug)) {
    return routeScopedSlug;
  }

  let suffix = 2;
  while (usedSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|\.(?=\s|$)/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeRecipe(recipe: Record<string, unknown>, sourceTitle: string): Record<string, unknown> {
  const nestedRecipe = recipe?.recipe as { measurements?: unknown[]; directions?: unknown } | undefined;
  const nestedMeasurements = Array.isArray(nestedRecipe?.measurements)
    ? nestedRecipe.measurements
        .map((measurement) => {
          const entry = measurement as Record<string, unknown>;
          const amount = String(entry?.amount ?? "").trim();
          const unit = String(entry?.unit ?? "").trim();
          const item = String(entry?.item ?? "").trim();
          const note = String(entry?.note ?? "").trim();
          const line = [amount, unit, item].filter(Boolean).join(" ").trim();
          if (!line) return "";
          return note ? `${line} (${note})` : line;
        })
        .filter(Boolean)
    : [];

  const normalizedIngredients = asStringList(recipe?.ingredients);
  const normalizedInstructions = asStringList(recipe?.instructions);
  const fallbackIngredients = nestedMeasurements;
  const fallbackInstructions = asStringList(
    nestedRecipe?.directions ?? recipe?.steps ?? recipe?.method
  );
  const defaultInstruction = `Follow the preparation method shown on the ${sourceTitle} card and serve immediately.`;

  return {
    ...recipe,
    ingredients: normalizedIngredients.length > 0 ? normalizedIngredients : fallbackIngredients,
    instructions:
      normalizedInstructions.length > 0
        ? normalizedInstructions
        : fallbackInstructions.length > 0
          ? fallbackInstructions
          : [defaultInstruction],
  };
}

async function loadRouteRecipes(routeEntry: DrinkRouteRegistryEntry): Promise<DrinkRecipeLike[]> {
  const modulePath = path.join(drinksDataDirPath, `${routeEntry.dataModulePath}.ts`);
  const moduleFileUrl = pathToFileURL(modulePath).href;
  const loadedModule = await import(moduleFileUrl);
  const moduleRecipes = loadedModule?.[routeEntry.dataExportName];

  if (Array.isArray(moduleRecipes)) {
    return moduleRecipes;
  }

  if (Array.isArray(routeEntry.recipes)) {
    return routeEntry.recipes;
  }

  throw new Error(
    `[generate-drink-index] Could not resolve recipe array for route '${routeEntry.route}' from ${routeEntry.dataModulePath}:${routeEntry.dataExportName}.`
  );
}

async function main() {
  const recipes: Record<string, DrinkIndexEntry> = {};
  const bySlug: Record<string, DrinkIndexEntry> = {};
  const canonicalEntries: CanonicalDrinkRecipeEntry[] = [];
  const canonicalBySlug: Record<string, CanonicalDrinkRecipeEntry> = {};
  const duplicates: DuplicateEntry[] = [];
  const usedCanonicalSlugs = new Set<string>();
  const canonicalEntryByKey: Record<string, CanonicalDrinkRecipeEntry> = {};

  for (const routeEntry of drinkRouteRegistry) {
    const routeRecipes = await loadRouteRecipes(routeEntry);

    for (const recipe of routeRecipes) {
      const name = String(recipe?.name ?? "").trim();
      if (!name) continue;

      const key = normalizeKey(name);
      if (!key) continue;

      if (!recipes[key]) {
        const slug = buildCanonicalSlug(name, routeEntry.route, usedCanonicalSlugs);
        usedCanonicalSlugs.add(slug);
        recipes[key] = {
          name,
          slug,
          sourceRoute: routeEntry.route,
          sourceTitle: routeEntry.title,
          image:
            typeof recipe.image === "string"
              ? recipe.image
              : typeof recipe.imageUrl === "string"
                ? recipe.imageUrl
                : null,
          route: `/drinks/recipe/${slug}`
        };
        bySlug[slug] = recipes[key];
        const canonicalEntry: CanonicalDrinkRecipeEntry = {
          slug,
          name,
          sourceRoute: routeEntry.route,
          sourceTitle: routeEntry.title,
          recipe: normalizeRecipe(recipe as Record<string, unknown>, routeEntry.title),
        };
        canonicalEntries.push(canonicalEntry);
        canonicalBySlug[slug] = canonicalEntry;
        canonicalEntryByKey[key] = canonicalEntry;
      } else if (recipes[key].sourceRoute !== routeEntry.route) {
        const existing = recipes[key];
        const existingPriority = getDrinkRoutePriority(existing.sourceRoute);
        const nextPriority = getDrinkRoutePriority(routeEntry.route);

        if (nextPriority > existingPriority) {
          duplicates.push({
            key,
            name,
            keptRoute: routeEntry.route,
            duplicateRoute: existing.sourceRoute,
          });

          existing.sourceRoute = routeEntry.route;
          existing.sourceTitle = routeEntry.title;
          existing.image =
            typeof recipe.image === "string"
              ? recipe.image
              : typeof recipe.imageUrl === "string"
                ? recipe.imageUrl
                : existing.image;

          const canonicalEntry = canonicalEntryByKey[key];
          if (canonicalEntry) {
            canonicalEntry.sourceRoute = routeEntry.route;
            canonicalEntry.sourceTitle = routeEntry.title;
            canonicalEntry.recipe = normalizeRecipe(recipe as Record<string, unknown>, routeEntry.title);
          }
        } else {
          duplicates.push({
            key,
            name,
            keptRoute: existing.sourceRoute,
            duplicateRoute: routeEntry.route
          });
        }
      }
    }
  }

  const routes: DrinkRoute[] = [...drinkRouteRegistry]
    .map(({ route, title }) => ({ route, title }))
    .sort((a, b) => a.route.localeCompare(b.route));

  const output: DrinkIndexFile = {
    recipes,
    bySlug,
    routes,
    duplicates,
    generatedAt: new Date().toISOString()
  };
  const canonicalOutput: CanonicalDrinkFile = {
    entries: canonicalEntries,
    bySlug: canonicalBySlug,
    generatedAt: output.generatedAt,
  };

  fs.mkdirSync(serverGeneratedDirPath, { recursive: true });
  fs.mkdirSync(clientGeneratedDirPath, { recursive: true });
  writeAtomically(generatedFilePath, `${JSON.stringify(output, null, 2)}\n`);
  writeAtomically(generatedCanonicalFilePath, `${JSON.stringify(canonicalOutput, null, 2)}\n`);

  console.log(
    `[generate-drink-index] Indexed ${Object.keys(recipes).length} recipes across ${output.routes.length} routes (${duplicates.length} duplicates).`
  );
}

await main();
