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
const generatedFilePath = path.join(repoRoot, "server", "generated", "drink-index.json");

function normalizeName(value: string): string {
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

function extractNamesFromFile(filePath: string): string[] {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set<string>();

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      for (const element of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(element)) continue;
        for (const property of element.properties) {
          if (!ts.isPropertyAssignment(property)) continue;

          const propertyName =
            ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
              ? property.name.text
              : undefined;

          if (propertyName !== "name") continue;

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

function main() {
  const pageFiles = walkIndexPages(drinksPagesRoot);
  const recipes: Record<string, DrinkIndexEntry> = {};
  const routes = new Map<string, DrinkRoute>();
  const duplicates: DuplicateEntry[] = [];

  for (const filePath of pageFiles) {
    const route = toRoute(filePath);
    routes.set(route, { route, title: toTitleFromRoute(route) });

    const names = extractNamesFromFile(filePath);
    for (const name of names) {
      const key = normalizeName(name);
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

  fs.mkdirSync(path.dirname(generatedFilePath), { recursive: true });
  fs.writeFileSync(generatedFilePath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(
    `[generate-drink-index] Indexed ${Object.keys(recipes).length} recipes across ${output.routes.length} routes (${duplicates.length} duplicates).`
  );
}

main();
