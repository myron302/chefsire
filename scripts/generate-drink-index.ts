import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { drinkRouteRegistry, type DrinkRouteRegistryEntry } from "../client/src/data/drinks";

type DrinkIndexEntry = { name: string; route: string };
type DrinkRoute = { route: string; title: string };
type DuplicateEntry = {
  key: string;
  name: string;
  keptRoute: string;
  duplicateRoute: string;
};

type DrinkIndexFile = {
  recipes: Record<string, DrinkIndexEntry>;
  routes: DrinkRoute[];
  duplicates: DuplicateEntry[];
  generatedAt: string;
};

type DrinkRecipeLike = { name?: string };

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
  const duplicates: DuplicateEntry[] = [];

  for (const routeEntry of drinkRouteRegistry) {
    const routeRecipes = await loadRouteRecipes(routeEntry);

    for (const recipe of routeRecipes) {
      const name = String(recipe?.name ?? "").trim();
      if (!name) continue;

      const key = normalizeKey(name);
      if (!key) continue;

      if (!recipes[key]) {
        recipes[key] = { name, route: routeEntry.route };
      } else if (recipes[key].route !== routeEntry.route) {
        duplicates.push({
          key,
          name,
          keptRoute: recipes[key].route,
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
