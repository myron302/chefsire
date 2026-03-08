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

type DrinkRecipeLike = { name?: string; image?: unknown; imageUrl?: unknown };

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const drinksDataDirPath = path.join(repoRoot, "client", "src", "data", "drinks");
const generatedDirPath = path.join(repoRoot, "server", "generated");
const generatedFilePath = path.join(generatedDirPath, "drink-index.json");

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function writeAtomically(filePath: string, contents: string) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, contents, "utf8");
  fs.renameSync(tempPath, filePath);
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
  const duplicates: DuplicateEntry[] = [];
  const usedCanonicalSlugs = new Set<string>();

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
      } else if (recipes[key].sourceRoute !== routeEntry.route) {
        duplicates.push({
          key,
          name,
          keptRoute: recipes[key].sourceRoute,
          duplicateRoute: routeEntry.route
        });
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

  fs.mkdirSync(generatedDirPath, { recursive: true });
  writeAtomically(generatedFilePath, `${JSON.stringify(output, null, 2)}\n`);

  console.log(
    `[generate-drink-index] Indexed ${Object.keys(recipes).length} recipes across ${output.routes.length} routes (${duplicates.length} duplicates).`
  );
}

await main();
