import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const drinksPagesRoot = path.join(repoRoot, "client", "src", "pages", "drinks");
const generatedDirPath = path.join(repoRoot, "server", "generated");
const generatedFilePath = path.join(generatedDirPath, "drink-index.json");

// Heuristic: only index objects that look like actual drink recipe cards,
// not every arbitrary "name" field that might appear in the file.
const recipeSignalFields = new Set([
  "ingredients",
  "instructions",
  "glassware",
  "method",
  "abv",
  "nutrition",
  "prepTime",
  "servingSize",
  "spiritType",
  "difficulty",
]);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toTitleFromRoute(route: string): string {
  const lastSegment = route.split("/").filter(Boolean).pop() || "drinks";
  return lastSegment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toRoute(filePath: string): string {
  const rel = path.relative(path.join(repoRoot, "client", "src", "pages"), filePath);
  const noIndex = rel.replace(/[/\\]index\.tsx$/, "");
  return `/${noIndex.split(path.sep).join("/")}`;
}

function walkIndexPages(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkIndexPages(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name === "index.tsx") {
      files.push(fullPath);
    }
  }

  return files;
}

function getPropertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }
  return null;
}

function hasRecipeSignals(objectLiteral: ts.ObjectLiteralExpression): boolean {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const propName = getPropertyName(property.name);
    if (propName && recipeSignalFields.has(propName)) {
      return true;
    }
  }
  return false;
}

function extractNamesFromFile(filePath: string): string[] {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set<string>();

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      for (const element of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(element) || !hasRecipeSignals(element)) continue;

        for (const property of element.properties) {
          if (!ts.isPropertyAssignment(property)) continue;

          const propName = getPropertyName(property.name);
          if (propName !== "name") continue;

          if (ts.isStringLiteral(property.initializer) || ts.isNoSubstitutionTemplateLiteral(property.initializer)) {
            const value = property.initializer.text.trim();
            if (value) names.add(value);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return [...names];
}

function writeAtomically(filePath: string, contents: string) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, contents, "utf8");
  fs.renameSync(tempPath, filePath);
}

function main() {
  if (!fs.existsSync(drinksPagesRoot)) {
    throw new Error(`Drinks pages root not found: ${drinksPagesRoot}`);
  }

  const pageFiles = walkIndexPages(drinksPagesRoot);
  const recipes: Record<string, DrinkIndexEntry> = {};
  const routes = new Map<string, DrinkRoute>();
  const duplicates: DuplicateEntry[] = [];

  for (const filePath of pageFiles) {
    const route = toRoute(filePath);
    routes.set(route, { route, title: toTitleFromRoute(route) });

    const names = extractNamesFromFile(filePath);
    for (const name of names) {
      const key = normalizeKey(name);
      if (!key) continue;

      if (!recipes[key]) {
        recipes[key] = { name, route };
      } else if (recipes[key].route !== route) {
        duplicates.push({
          key,
          name,
          keptRoute: recipes[key].route,
          duplicateRoute: route,
        });
      }
    }
  }

  const output: DrinkIndexFile = {
    recipes,
    routes: [...routes.values()].sort((a, b) => a.route.localeCompare(b.route)),
    duplicates,
    generatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(generatedDirPath, { recursive: true });
  writeAtomically(generatedFilePath, `${JSON.stringify(output, null, 2)}\n`);

  console.log(
    `[generate-drink-index] Indexed ${Object.keys(recipes).length} recipes across ${output.routes.length} routes (${duplicates.length} duplicates).`
  );
}

main();