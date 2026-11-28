#!/usr/bin/env node
/**
 * Finds suites that CI names and then does not run, because the environment variable they gate on is absent.
 *
 * Done-condition 1 is "every test suite in the repository runs in CI, or is listed below with the reason it
 * does not". Comparing filenames in the workflow against filenames on disk does NOT establish that, and the
 * campaign record said it did. Codex found the counterexample:
 *
 *   the `wedding-square-postgres-migration-tests` job supplies WEDDING_SQUARE_TEST_DATABASE_URL and its
 *   batches supply CS_TEST_PG_URL, but nothing supplies TEST_DATABASE_URL -- so db-outage.postgres,
 *   auth-db-outage.postgres and wedding-registry-links.postgres register SKIPPED placeholders and node exits
 *   0. Seven skipped, zero passed, green. Thirty-three real tests, dormant.
 *
 * `run-ci-batch.mjs` already rejects a skip, but only 26 of the workflow's 120 test steps go through it; the
 * other 94 invoke node directly and cannot see it. Rewriting all 94 is a bigger change than one run should
 * make blind, so this reads the workflow instead and answers the question for every step at once.
 *
 * HOW IT DECIDES. For each test file a step names, it collects the database-URL environment names that file
 * mentions. If the file can skip at all and NONE of those names is available to that step (job env, step env,
 * or the workflow's top-level env), the suite is reported: it is named by CI and will not run.
 *
 * WHAT IT CANNOT SEE: a suite that skips for a reason other than a missing database URL, and a step whose env
 * comes from a secret or an expression this does not evaluate. It is a floor, like the other audits here --
 * it catches the class that has actually bitten, and says so rather than implying more.
 *
 * UNKNOWN IS NEVER SAFE, which is the one rule that replaces four resolvers. Codex found four more false
 * cleans on #1541 and they were all the same line of reasoning: when this script could not resolve something
 * it returned an empty set of gate names, and the caller read an empty set as "this suite has no gate", i.e.
 * as safe. A bare package specifier was dropped silently; a traversal that hit the depth bound of 3 returned
 * nothing; an exported binding whose declaration carried no `export` modifier was dropped; and
 * `process.env["CS_TEST_PG_URL"]` was neither collected nor flagged. Each one cleared a suite that really did
 * produce 0 passes, 1 skip and exit 0 -- the exact silent green this script exists to catch.
 *
 * So: anything unresolvable now makes the suite UNDETERMINABLE, and an undeterminable suite is reported. The
 * resolvers below exist to keep that from being noisy, not to decide safety:
 *
 *   - relative specifiers, tsconfig `paths` aliases (read from the nearest tsconfig.json) and installed
 *     packages are resolved and followed;
 *   - a `node:` builtin is ignored, because a builtin cannot export a connection string;
 *   - an installed package is ignored only after its own code is scanned and found to contain no
 *     `process.env.<DB name>` read at all -- evidence rather than assumption;
 *   - the import walk is no longer bounded by depth, only by cycle detection, so a barrel chain of any length
 *     is followed;
 *   - and anything left -- an unresolvable relative path, an alias with no tsconfig, a package that is not
 *     installed, a package that does read one of these names, a dynamically-read gate -- is reported.
 *
 * The mirror of that rule is that calling a RESOLVABLE thing unknown is how a gate becomes noise, and a gate
 * nobody reads is how the silent skips got four days of green. So computed keys are resolved rather than
 * feared -- `process.env[SECRET_BOX_KEY_ENV]`, `keys.map((k) => process.env[k])` over an `as const` array,
 * and a `readEnv(name)` helper followed to its call sites. Treating all three as unknowable reported 33 real,
 * satisfied Square suites. Following the helper also closes a blind spot that was open the whole time: a gate
 * read through a helper called with "TEST_DATABASE_URL" is now a read OF that name rather than a miss.
 *
 * Measured on this repository at the time of the change: 130 candidate suites, 285 modules reached, 9 alias
 * specifiers (all `@shared/*`), 13 external packages, and ZERO of those packages reads a database name in
 * code (the two matches in @neondatabase/serverless are in its README). The honest rule therefore costs no
 * noise here -- and that number, not an argument, is what decided its shape. Re-measure it before trusting
 * this paragraph: if it ever reports a satisfied suite as undeterminable, the answer is a better resolver,
 * never a quieter rule.
 *
 * Usage: node server/scripts/audit-ci-skips.mjs [--ci] [--json] [workflow.yml...]
 */
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { dirname, join, extname, resolve as resolvePath } from "node:path";
import { builtinModules } from "node:module";
import { parse } from "yaml";
import ts from "typescript";

const args = process.argv.slice(2);
const ci = args.includes("--ci");
const asJson = args.includes("--json");
/** Positional arguments override the workflow list, so the suite below can point this at fixtures. */
const given = args.filter((a) => !a.startsWith("--"));
const WORKFLOWS = given.length > 0 ? given : [".github/workflows/pr-validation.yml"];

/**
 * The connection-string names these suites gate on; any one being present is enough for most.
 *
 * Matched only as `process.env.NAME`, never as a bare mention. The first version matched the bare name and
 * reported video-transcode.ffmpeg.test.ts, which skips when FFMPEG is missing and merely mentions
 * CS_TEST_PG_URL in a comment explaining that it skips "the same way the PostgreSQL suites skip". A checker
 * that cries wolf about a comment teaches people to ignore it.
 */
// PGURL is in the list because seven suites accept it: the schema-push fallback chains read
// `process.env.TEST_DATABASE_URL, process.env.PGURL, ...` and genuinely take either. Checked that no suite
// gates on it ALONE, so adding it cannot clear anything whose real gate is missing -- it only lets a step that
// supplies PGURL be judged correctly. Everything else that looked database-ish in a skippable suite turned out
// to be a feature flag (WEDDING_SQUARE_SANDBOX_*_ENABLED, a merchant id, a webhook URL), not a connection
// string, and those gates are outside what this script claims to judge.
const DB_NAMES = ["TEST_DATABASE_URL", "DATABASE_URL", "CS_TEST_PG_URL", "CATERING_TEST_PG_URL", "WEDDING_SQUARE_TEST_DATABASE_URL", "ADMIN_TEST_PG_URL", "PGURL"];
const isDbName = (name) => DB_NAMES.includes(name);

/**
 * The database URLs a suite READS, as distinct from the ones it WRITES.
 *
 * Codex's second finding here, and it made the gate unsound in the direction that matters. The first version
 * counted any `process.env.NAME` occurrence, so a suite that gates on TEST_DATABASE_URL and then ASSIGNS
 * `process.env.DATABASE_URL = scratch.url` -- which session-cookie-races.postgres.test.ts does, at lines 17
 * and 28 -- looked satisfied by DATABASE_URL alone. Supply only that name and the audit reported clean while
 * the suite skipped, zero passes, exit 0. The exact silent green this script exists to catch, waved through by
 * the script.
 *
 * An assignment target is not an input, so it is excluded. Walking the AST rather than matching text also
 * drops names in comments, which the version before this one got wrong the other way.
 */
/**
 * MODULE RESOLUTION, in service of "unknown is never safe".
 *
 * Every branch here either resolves a specifier to a file this script can read, ignores it for a stated
 * reason that cannot hide a gate, or records it as unresolved -- and unresolved propagates up as opaque.
 */
const BUILTIN = new Set(builtinModules);
/** `node:test` is not in builtinModules under its bare name, so the prefix has to be checked separately. */
const isBuiltinSpec = (spec) => spec.startsWith("node:") || BUILTIN.has(spec);

const SOURCE_EXT = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

/** A specifier's base path turned into an actual file, the way a bundler would. */
function resolveToFile(base) {
  const candidates = [];
  // `moduleResolution: bundler` with `allowImportingTsExtensions`: "./x.js" may well be x.ts on disk.
  if (/\.m?js$/.test(base)) candidates.push(base.replace(/\.mjs$/, ".mts").replace(/\.js$/, ".ts"));
  if (/\.cjs$/.test(base)) candidates.push(base.replace(/\.cjs$/, ".cts"));
  candidates.push(...SOURCE_EXT.map((e) => base + e), `${base}.d.ts`, base);
  candidates.push(...SOURCE_EXT.map((e) => join(base, `index${e}`)), join(base, "index.d.ts"));
  for (const candidate of candidates) {
    // `existsSync` is true for a directory, and `../test-support` is one -- the extension candidates have to
    // be tried first and the result has to be a FILE.
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * The tsconfig that declares `paths` for a file, found by walking up and following `extends`.
 *
 * Both halves are load-bearing here and the first version had neither: `server/tsconfig.json` is nearer to
 * every server suite than the root one and declares no `paths` of its own -- it `extends` the root. Stopping
 * at the nearest file left nine `@shared/*` specifiers unresolved, which under the new rule turned four real
 * suites into undeterminable hits. `baseUrl` and `paths` resolve against the directory of the config that
 * DECLARES them, which is why that directory is what gets returned.
 */
const tsconfigCache = new Map();
function readTsconfig(file, depth = 0) {
  if (depth > 8 || !existsSync(file) || !statSync(file).isFile()) return null;
  const parsed = ts.parseConfigFileTextToJson(file, readFileSync(file, "utf8"));
  const config = parsed.config ?? {};
  if (config.compilerOptions?.paths) {
    return { dir: dirname(file), paths: config.compilerOptions.paths, baseUrl: config.compilerOptions.baseUrl ?? "." };
  }
  if (typeof config.extends === "string") {
    const base = config.extends.startsWith(".")
      ? resolveToFile(resolvePath(dirname(file), config.extends)) ?? resolvePath(dirname(file), config.extends)
      : null;
    if (base) return readTsconfig(base, depth + 1);
  }
  return null;
}
function pathsFor(dir) {
  const chain = [];
  for (let cur = dir; ; cur = dirname(cur)) {
    if (tsconfigCache.has(cur)) {
      const hit = tsconfigCache.get(cur);
      for (const d of chain) tsconfigCache.set(d, hit);
      return hit;
    }
    chain.push(cur);
    const found = readTsconfig(join(cur, "tsconfig.json"));
    if (found) {
      for (const d of chain) tsconfigCache.set(d, found);
      return found;
    }
    const parent = dirname(cur);
    if (parent === cur) {
      for (const d of chain) tsconfigCache.set(d, null);
      return null;
    }
  }
}

/**
 * The paths a tsconfig alias could mean, or null when the specifier is not an alias at all.
 *
 * Codex's finding was that a gate behind `@/test-support/...` was discarded by the leading-dot test with no
 * trace. This repository defines `@/*` -> client/src and `@shared/*` -> shared, and nine `@shared/*`
 * specifiers are reachable from the suites examined.
 */
function aliasCandidates(file, spec) {
  const found = pathsFor(dirname(file));
  const paths = found?.paths;
  if (!paths) return null;
  const base = resolvePath(found.dir, found.baseUrl);
  const out = [];
  for (const [pattern, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets)) continue;
    const star = pattern.indexOf("*");
    if (star >= 0) {
      const pre = pattern.slice(0, star);
      const post = pattern.slice(star + 1);
      if (!spec.startsWith(pre) || !spec.endsWith(post) || spec.length < pre.length + post.length) continue;
      const stem = spec.slice(pre.length, spec.length - post.length);
      for (const t of targets) out.push(resolvePath(base, t.replace("*", stem)));
    } else if (pattern === spec) {
      for (const t of targets) out.push(resolvePath(base, t));
    }
  }
  return out.length > 0 ? out : null;
}

/** The installed directory for a bare specifier's package, by the same upward walk node does. */
function packageDirFor(fromDir, pkg) {
  for (let cur = fromDir; ; cur = dirname(cur)) {
    const candidate = join(cur, "node_modules", pkg);
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
    const parent = dirname(cur);
    if (parent === cur) return null;
  }
}

/**
 * Whether an installed package could possibly BE a gate: does its own code read any of these names anywhere?
 *
 * This is the one place the script clears something it has not followed, and it clears it on evidence. A
 * package with no `process.env.<DB name>` read in any code file cannot be the module a suite gates on, so
 * there is nothing to follow. A package that does read one is reported as undeterminable rather than
 * reasoned about, because reasoning about a published package's exports is a different job.
 *
 * Markdown is deliberately out of scope: @neondatabase/serverless shows `process.env.DATABASE_URL` in its
 * README a dozen times and reads it nowhere in code, and a checker that cries wolf about documentation is
 * the version of this script that cried wolf about a comment.
 */
const DB_READ_IN_CODE = /process\.env(?:\.|\[\s*["'])(?:TEST_DATABASE_URL|DATABASE_URL|CS_TEST_PG_URL|CATERING_TEST_PG_URL|WEDDING_SQUARE_TEST_DATABASE_URL|ADMIN_TEST_PG_URL|PGURL)\b/;
const CODE_EXT = new Set(SOURCE_EXT);
const packageGateCache = new Map();
function packageCouldGate(dir) {
  if (packageGateCache.has(dir)) return packageGateCache.get(dir);
  let answer = false;
  const stack = [dir];
  while (stack.length > 0 && !answer) {
    let entries;
    try { entries = readdirSync(stack.pop(), { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = join(entry.parentPath ?? entry.path, entry.name);
      if (entry.isDirectory()) { stack.push(full); continue; }
      if (!CODE_EXT.has(extname(entry.name))) continue;
      let text;
      try { text = readFileSync(full, "utf8"); } catch { continue; }
      if (DB_READ_IN_CODE.test(text)) { answer = true; break; }
      // THE ABSENCE OF THAT LITERAL IS NOT EVIDENCE OF SAFETY -- Codex's finding, and the last of this
      // round. A package can export a gate without naming it: `const key = "CS_TEST_PG_URL"; export const
      // PG_URL = process.env[key];` matches no literal pattern, so scanning for one cleared a suite that
      // skipped.
      //
      // The strict reading of that -- any computed `process.env[...]` makes a package undeterminable -- was
      // written and MEASURED before being rejected: express, pg and playwright each have one somewhere
      // inside, and it turned 125 of the 130 candidate suites undeterminable. A gate that flags everything
      // is a gate nobody reads, which is the same failure as one that flags nothing.
      //
      // So the question asked is narrower and is asked of the AST rather than a second regex, because every
      // regex in this script's history has missed a case the AST did not: does an unevaluable read here
      // initialise something this file EXPORTS? Only then can another module gate on it. Measured across the
      // installed packages these suites import, that is true of none of them and true of Codex's fixture.
      if (/process\.env\s*\[/.test(text)) {
        try {
          const read = envReads(full);
          // EITHER kind of answer makes the package a possible gate, and getting this wrong once is why both
          // are named here. My first version asked only `exportedOpaque` -- is there an unevaluable read
          // behind an export -- and the fixture still cleared, because in Codex's case the read is not
          // unevaluable at all: `const key = "CS_TEST_PG_URL"` is a constant this script resolves perfectly
          // well, so the package exports a KNOWN database gate and the old literal regex simply could not see
          // it. The test caught that, which is the only reason this comment is not a sixth finding.
          if (read.exportedOpaque || read.exported.size > 0) { answer = true; break; }
        } catch { /* unparsable: falls through to the literal scan's answer */ }
      }
    }
  }
  packageGateCache.set(dir, answer);
  return answer;
}

/**
 * A file's imports, split into the ones this script followed and the ones it could not judge.
 *
 * An unresolved specifier is NOT dropped. That was the bug behind four of Codex's findings at once.
 */
function resolveImports(sf, file) {
  const dir = dirname(file);
  const files = [];
  const unresolved = [];
  for (const stmt of sf.statements) {
    const spec = (ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt)) ? stmt.moduleSpecifier : undefined;
    if (!spec || !ts.isStringLiteral(spec)) continue;
    const text = spec.text;
    if (isBuiltinSpec(text)) continue;
    if (text.startsWith(".")) {
      const resolved = resolveToFile(resolvePath(dir, text));
      if (resolved) files.push(resolved); else unresolved.push(text);
      continue;
    }
    const aliased = aliasCandidates(file, text);
    if (aliased) {
      const resolved = aliased.map(resolveToFile).find(Boolean);
      if (resolved) files.push(resolved); else unresolved.push(text);
      continue;
    }
    const pkg = text.startsWith("@") ? text.split("/").slice(0, 2).join("/") : text.split("/")[0];
    const pkgDir = packageDirFor(dir, pkg);
    // Not installed is not the same as harmless: without the package there is nothing to read, so the only
    // honest answer is that the gate cannot be judged.
    if (!pkgDir) { unresolved.push(`${text} (not installed)`); continue; }
    if (packageCouldGate(pkgDir)) unresolved.push(`${text} (package reads a database name)`);
  }
  return { files, unresolved };
}

const sourceCache = new Map();
function sourceOf(file) {
  if (!sourceCache.has(file)) {
    sourceCache.set(file, ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS));
  }
  return sourceCache.get(file);
}

/**
 * String-literal constants a module declares: `export const SECRET_BOX_KEY_ENV = "SQUARE_OAUTH_..."`.
 *
 * Needed because `process.env[SECRET_BOX_KEY_ENV]` is a COMPUTED key whose value is perfectly knowable, and
 * treating every computed key as unknowable made 33 Square suites undeterminable in one stroke -- all of them
 * save/restore helpers over an imported encryption-key name that has nothing to do with a database. An
 * unknown must never clear a suite, but calling a resolvable thing unknown is how a gate becomes noise, and
 * noise is how a gate stops being read.
 */
const constantsCache = new Map();
function stringConstants(file) {
  if (constantsCache.has(file)) return constantsCache.get(file);
  const out = new Map();
  const sf = sourceOf(file);
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
        ts.isStringLiteral(node.initializer)) {
      out.set(node.name.text, node.initializer.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  constantsCache.set(file, out);
  return out;
}

/** Where an imported local name came from, specifier by specifier. */
function importSources(file) {
  const sf = sourceOf(file);
  const out = new Map();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const bindings = stmt.importClause.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) out.set(element.name.text, stmt.moduleSpecifier.text);
  }
  return out;
}

/** The string a computed-key identifier stands for, or null when this script genuinely cannot say. */
function literalForIdentifier(file, name, seen = new Set()) {
  if (seen.has(file)) return null;
  seen.add(file);
  const own = stringConstants(file);
  if (own.has(name)) return own.get(name);
  const from = importSources(file).get(name);
  const { files } = resolveImports(sourceOf(file), file);
  // Prefer the module the name was actually imported from; fall back to the rest, since a re-export chain
  // can put the declaration one hop further along.
  const ordered = from
    ? [...files].sort((a, b) => (b.includes(from.replace(/^\.+\//, "")) ? 1 : 0) - (a.includes(from.replace(/^\.+\//, "")) ? 1 : 0))
    : files;
  for (const imported of ordered) {
    const found = literalForIdentifier(imported, name, seen);
    if (found !== null) return found;
  }
  return null;
}

/**
 * A computed key's possible names: `process.env[k]` where k is not a literal but is still knowable.
 *
 * Three shapes, all of them real in this repository and none of them a gate -- which is exactly why they have
 * to be resolved rather than reported. Calling a resolvable thing unknown would have made 33 suites
 * undeterminable, and a gate that cries wolf 33 times stops being read, which is how the silent skips got
 * four days of green in the first place.
 *
 *   process.env[SECRET_BOX_KEY_ENV]          an imported string constant
 *   keys.map((key) => process.env[key])      a callback parameter over an array of literals
 *   const saved = process.env[name]          a save/restore helper, called with literals
 *
 * The third shape also answers a blind spot Codex raised on this PR and nobody had closed: a gate read
 * through a helper that takes the NAME as a string. If such a helper is called with "TEST_DATABASE_URL", that
 * is now collected as a read of TEST_DATABASE_URL rather than missed.
 *
 * Returns null when it genuinely cannot say, and null means undeterminable, not safe.
 */
const ITERATORS = new Set(["map", "forEach", "filter", "flatMap", "some", "every", "find"]);

/** `["A","B"] as const` is an AsExpression wrapping the array, which the first version did not see through. */
function unwrap(node) {
  let cur = node;
  while (cur && (ts.isAsExpression(cur) || ts.isParenthesizedExpression(cur) || ts.isTypeAssertionExpression?.(cur) ||
                 ts.isSatisfiesExpression?.(cur))) cur = cur.expression;
  return cur;
}

/** The string literals of an array expression, or null if any element is unknowable. */
function elementLiterals(file, expression) {
  const node = unwrap(expression);
  if (!node || !ts.isArrayLiteralExpression(node)) return null;
  const out = [];
  for (const element of node.elements) {
    if (ts.isStringLiteral(element)) { out.push(element.text); continue; }
    if (ts.isIdentifier(element)) {
      const lit = literalForIdentifier(file, element.text);
      if (lit !== null) { out.push(lit); continue; }
    }
    return null;
  }
  return out;
}

/** The string literals in `const NAME = ["a", "b"]`, or null if that is not what NAME is. */
function arrayLiterals(file, sf, name) {
  let found = null;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
      // One unknowable element makes the whole array unknowable, which is the strict direction.
      found = elementLiterals(file, node.initializer);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/**
 * The strings an identifier can hold at a use site: a constant, or a `for (const x of [...])` binding.
 *
 * The for-of shape is how `catering-square-payments` drives one test per webhook variable, and it reaches
 * `process.env[variable]` through a helper -- two indirections that are both perfectly determinable.
 */
function identifierLiterals(file, sf, at, name) {
  // THE BINDING VISIBLE AT THE USE SITE WINS, and the file-wide constant is only the fallback.
  //
  // Codex's finding, and it was a false clean of the worst kind -- the checker resolved a name to a value it
  // never holds. `const key = "NODE_ENV"; function readEnv(key) { return process.env[key]; }` with the suite
  // gating on `readEnv("TEST_DATABASE_URL")` resolved the access to NODE_ENV, because the file-wide constant
  // map is keyed by name alone and knows nothing about scope. The gate became invisible and the suite cleared.
  //
  // So the walk outward from the access happens FIRST, and `literalForIdentifier` is consulted only once
  // nothing between the access and the file scope declares the name.
  for (let cur = at; cur; cur = cur.parent) {
    // A parameter of an enclosing function: its values are its call sites' arguments, not any constant.
    if (ts.isArrowFunction(cur) || ts.isFunctionExpression(cur) || ts.isFunctionDeclaration(cur) ||
        ts.isMethodDeclaration(cur)) {
      const index = cur.parameters.findIndex((param) => ts.isIdentifier(param.name) && param.name.text === name);
      if (index >= 0) return parameterLiterals(file, sf, cur, index);
    }
    if (ts.isForOfStatement(cur)) {
      const list = cur.initializer;
      if (ts.isVariableDeclarationList(list) &&
          list.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === name)) {
        const subject = unwrap(cur.expression);
        if (ts.isIdentifier(subject)) return arrayLiterals(file, sf, subject.text);
        return elementLiterals(file, cur.expression);
      }
    }
    // A local declaration in an enclosing block or function body shadows the file-wide one. If its
    // initializer is a string literal that IS the answer; anything else and this script cannot say.
    if (ts.isBlock(cur) || ts.isFunctionDeclaration(cur) || ts.isArrowFunction(cur) ||
        ts.isFunctionExpression(cur) || ts.isMethodDeclaration(cur) || ts.isCaseClause(cur)) {
      const body = ts.isBlock(cur) ? cur.statements : (cur.body && ts.isBlock(cur.body) ? cur.body.statements : null);
      if (body) {
        for (const stmt of body) {
          if (!ts.isVariableStatement(stmt)) continue;
          for (const decl of stmt.declarationList.declarations) {
            if (!ts.isIdentifier(decl.name) || decl.name.text !== name) continue;
            if (decl.initializer && ts.isStringLiteral(decl.initializer)) return [decl.initializer.text];
            return null;
          }
        }
      }
    }
  }
  const constant = literalForIdentifier(file, name);
  if (constant !== null) return [constant];
  return null;
}

/**
 * Whether this name leaves the file: an `export` modifier on its declaration, or an `export { name }` list.
 *
 * It matters for ONE reason. A helper's parameter is resolved from its call sites, and this script reads one
 * file at a time -- so for an exported helper the call sites it can see are not all of them.
 */
function nameEscapesFile(sf, name) {
  let escapes = false;
  const exported = (node) => node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) === true;
  const visit = (node) => {
    if (escapes) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name && exported(node)) { escapes = true; return; }
    if (ts.isVariableStatement(node) && exported(node) &&
        node.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === name)) {
      escapes = true; return;
    }
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.some((e) => (e.propertyName ?? e.name).text === name)) {
      escapes = true; return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return escapes;
}

/** The literal(s) that reach a function's parameter at `index`, from its call sites in the same file. */
function parameterLiterals(file, sf, fn, index) {
  const parent = fn.parent;
  // Shape 2: a callback to array.map / forEach / ... -- the array's elements are what the parameter takes.
  if (index === 0 && parent && ts.isCallExpression(parent) && parent.arguments.includes(fn) &&
      ts.isPropertyAccessExpression(parent.expression) && ITERATORS.has(parent.expression.name.text)) {
    const subject = unwrap(parent.expression.expression);
    if (ts.isIdentifier(subject)) return arrayLiterals(file, sf, subject.text);
    return elementLiterals(file, parent.expression.expression);
  }
  // Shape 3: a named helper. Every call site must pass something knowable at that position, or the answer is
  // "cannot say" -- one dynamic call site is enough to make the whole parameter unknowable.
  let fnName = null;
  if (ts.isFunctionDeclaration(fn) && fn.name) fnName = fn.name.text;
  else if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) fnName = parent.name.text;
  if (!fnName) return null;
  // AN EXPORTED HELPER'S CALL SITES ARE NOT ALL IN THIS FILE, so the ones that are cannot settle its
  // parameter. Codex's finding: a harness exporting `function readEnv(name) { return process.env[name]; }`
  // and calling `readEnv("NODE_ENV")` itself made the parameter resolve to NODE_ENV alone, while the suite
  // importing it gated on `readEnv("TEST_DATABASE_URL")`. One local call site looked like proof and was a
  // coincidence of which caller happened to live in the same file.
  if (nameEscapesFile(sf, fnName)) return null;
  const out = [];
  let unknown = false;
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === fnName) {
      const arg = node.arguments[index];
      if (!arg) { unknown = true; }
      else if (ts.isStringLiteral(arg)) out.push(arg.text);
      else if (ts.isIdentifier(arg)) {
        const lits = identifierLiterals(file, sf, node, arg.text);
        if (lits) out.push(...lits); else unknown = true;
      } else unknown = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (unknown || out.length === 0) return null;
  return out;
}

function computedKeyNames(file, sf, node) {
  const arg = node.argumentExpression;
  if (ts.isStringLiteral(arg)) return [arg.text];
  if (!arg || !ts.isIdentifier(arg)) return null;
  const direct = identifierLiterals(file, sf, node, arg.text);
  if (direct) return direct;
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (!(ts.isArrowFunction(cur) || ts.isFunctionExpression(cur) || ts.isFunctionDeclaration(cur) ||
          ts.isMethodDeclaration(cur))) continue;
    const index = cur.parameters.findIndex((param) => ts.isIdentifier(param.name) && param.name.text === arg.text);
    if (index < 0) continue;
    return parameterLiterals(file, sf, cur, index);
  }
  return null;
}

/** The child of `ancestor` that `node` sits inside -- how a walk upward knows which branch it came up. */
function lastChildOnPath(ancestor, node) {
  let prev = node;
  for (let cur = node.parent; cur; prev = cur, cur = cur.parent) if (cur === ancestor) return prev;
  return null;
}

function envReads(file) {
  const sf = sourceOf(file);
  const reads = new Set();
  // A gate this function cannot read: `const { TEST_DATABASE_URL } = process.env`, or `process.env[name]` with
  // a key it cannot evaluate. Neither appears as a DB gate in this repository today -- checked, not assumed:
  // no test file destructures process.env at all, and every bracket access is a save/restore helper over
  // NODE_ENV, CORS or SQUARE_ names. But a suite that grew one would have an INVISIBLE gate and land straight
  // back in the silent-green class, so it is reported as undeterminable rather than quietly cleared.
  let opaque = false;
  /**
   * An unevaluable read that initialises an EXPORTED binding -- the only kind another module can GATE on.
   *
   * `opaque` alone is too blunt a question to ask of an installed package: express, pg and playwright all read
   * `process.env[...]` with a computed key somewhere inside, and treating that as "could gate" made 125 of the
   * 130 candidate suites undeterminable in one stroke. What matters is whether the unknown read could become
   * another module's gate, which means it must initialise something the package exports.
   */
  let exportedOpaque = false;
  /**
   * Reads that initialise an EXPORTED binding -- the only ones another module can gate on.
   *
   * Codex's fifth finding here, and the fifth false clean. marketplace-sample-listings gates on CS_TEST_PG_URL
   * through `export const PG_URL = process.env.CS_TEST_PG_URL` in authz-pg-harness. But that harness imports
   * auth-test-env, which imports load-env, whose line 53 reads `process.env.DATABASE_URL` inside an `if` --
   * module plumbing, nothing a suite could gate on. Taking every transitive read meant the suite "needed"
   * DATABASE_URL too, so a step supplying only that name cleared it while it skipped: 0 pass, 1 skip, exit 0,
   * and the audit said no silent skips.
   *
   * An imported read therefore counts only when it initialises something exported. The suite's OWN reads still
   * count however they appear, because those are the gate itself rather than a thing reached through it.
   */
  const exported = new Set();
  /**
   * Names this module exports through a separate `export { X }` declaration.
   *
   * Codex's finding: `const PG_URL = process.env.CS_TEST_PG_URL; export { PG_URL };` exports the binding, but
   * its VariableStatement carries no export modifier, so requiring the modifier dropped the gate and cleared
   * the suite. `export { X as Y }` names the LOCAL binding in propertyName, so that is the one to collect.
   */
  const namedExports = new Set();
  for (const stmt of sf.statements) {
    if (!ts.isExportDeclaration(stmt) || stmt.moduleSpecifier) continue;
    const clause = stmt.exportClause;
    if (!clause || !ts.isNamedExports(clause)) continue;
    for (const element of clause.elements) namedExports.add((element.propertyName ?? element.name).text);
  }
  const isFn = (node) => ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) || ts.isMethodDeclaration(node);
  /** The name a function is reached by, for the escape test: its own, or the variable it is assigned to. */
  const functionName = (fn) => {
    if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name && ts.isIdentifier(fn.name)) return fn.name.text;
    const parent = fn.parent;
    if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
    return null;
  };
  const initialisesExport = (node) => {
    for (let cur = node.parent; cur; cur = cur.parent) {
      if (ts.isVariableStatement(cur)) {
        if (cur.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return true;
        return cur.declarationList.declarations.some(
          (d) => ts.isIdentifier(d.name) && namedExports.has(d.name.text),
        );
      }
      // A read inside a function body is plumbing, not an export initialiser, however the function is exported.
      if (ts.isFunctionDeclaration(cur) || ts.isFunctionExpression(cur) || ts.isArrowFunction(cur) ||
          ts.isMethodDeclaration(cur) || ts.isIfStatement(cur) || ts.isBlock(cur)) {
        return false;
      }
    }
    return false;
  };
  /**
   * Whether a read's VALUE reaches a caller outside this file: it is returned, by a function whose name leaves
   * the module. `export function readEnv(name) { return process.env[name]; }` is a gate generator.
   *
   * THIS FEEDS THE OPACITY SIGNAL ONLY, NEVER THE SET OF NAMES, and the difference is the whole of the tenth
   * finding on this branch. My first attempt made a returned read count as an exported read, so its name
   * joined the set a suite's gate is checked against -- and `satisfied` is "the step supplies ANY of these",
   * so a LOOSER set makes clearing EASIER, not safer. It immediately re-opened the fifth finding: the fixture
   * module there returns `process.env.DATABASE_URL` from an exported arrow, DATABASE_URL joined the gate set,
   * the step supplied it, and a suite gating on CS_TEST_PG_URL was cleared while it skipped. The regression
   * test for finding five caught it, which is the only reason it is not finding eleven.
   *
   * So: a returned read that this script could not resolve makes the module undeterminable, which is the
   * strict direction. A returned read it CAN resolve adds nothing, because a name a caller might ask for is
   * not a name this suite's gate depends on -- and that distinction is exactly what finding five established.
   */
  /** Whether `name` appears as the whole of a `return` inside this function's body. */
  const returnsIdentifier = (fn, name) => {
    let found = false;
    const walk = (n) => {
      if (found) return;
      if (isFn(n) && n !== fn) return; // a nested function's returns are its own
      if (ts.isReturnStatement(n) && n.expression && ts.isIdentifier(unwrap(n.expression)) &&
          unwrap(n.expression).text === name) { found = true; return; }
      ts.forEachChild(n, walk);
    };
    if (fn.body) walk(fn.body);
    return found;
  };
  const enclosingFunction = (node) => {
    for (let cur = node.parent; cur; cur = cur.parent) if (isFn(cur)) return cur;
    return null;
  };
  const containsThrow = (n) => {
    let found = false;
    const walk = (x) => {
      if (found) return;
      if (isFn(x)) return;
      if (ts.isThrowStatement(x)) { found = true; return; }
      ts.forEachChild(x, walk);
    };
    walk(n);
    return found;
  };
  const escapesViaReturn = (node) => {
    let returning = false;
    for (let cur = node.parent; cur; cur = cur.parent) {
      if (ts.isReturnStatement(cur)) { returning = true; continue; }
      // SHAPE: `const v = process.env[name]; return v;` -- the read never crosses the `return` itself. Found
      // by probing this function's own weak spots rather than waiting for a tenth review round.
      if (!returning && ts.isVariableDeclaration(cur) && ts.isIdentifier(cur.name)) {
        const fn = enclosingFunction(cur);
        if (fn && returnsIdentifier(fn, cur.name.text)) { returning = true; continue; }
      }
      // SHAPE: a read in a condition whose branch THROWS. The value does not escape but the OUTCOME does, and
      // a caller can gate on it with try/catch. Distinguishable from load-env's shape, which is the reason
      // this is narrow: load-env's branch does a side effect and returns void, and must stay plumbing.
      if (!returning && ts.isIfStatement(cur) && cur.thenStatement &&
          (containsThrow(cur.thenStatement) || (cur.elseStatement && containsThrow(cur.elseStatement)))) {
        returning = true;
        continue;
      }
      if (isFn(cur)) {
        if (ts.isArrowFunction(cur) && cur.body === lastChildOnPath(cur, node)) returning = true;
        if (!returning) return false;
        const name = functionName(cur);
        if (name) {
          if (nameEscapesFile(sf, name)) return true;
          // A named function that does not escape may still itself be returned; keep walking, but its own
          // value is what travels now, not the read's.
          returning = false;
          continue;
        }
        // SHAPE: an ANONYMOUS function -- `export const api = { get: (name) => process.env[name] }`. It has no
        // name to test, so whether it escapes is whatever holds it, and the walk carries `returning` outward
        // instead of giving up. Previously it reset the flag and the read was cleared.
        continue;
      }
      if (returning && ts.isVariableStatement(cur)) {
        if (cur.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return true;
        if (cur.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && namedExports.has(d.name.text))) return true;
        // NOT a dead end. An inner `const v = process.env[name]` whose `v` is returned is exactly the shape
        // this walk exists to follow, and ending here on "that statement is not exported" cleared it -- the
        // enclosing FUNCTION is what decides whether the value leaves the module, so keep going.
        continue;
      }
    }
    return false;
  };
  const isAssignmentTarget = (node) => {
    const parent = node.parent;
    if (!parent) return false;
    if (ts.isBinaryExpression(parent) && parent.left === node) {
      // `=` and every compound assignment; a comparison is a read.
      return parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
        && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
    }
    if (ts.isDeleteExpression(parent)) return true;
    return false;
  };
  const isProcessEnv = (expr) =>
    ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression) &&
    expr.expression.text === "process" && expr.name.text === "env";
  const collect = (name, node) => {
    reads.add(name);
    if (initialisesExport(node)) exported.add(name);
    // A RESOLVED read that is handed to callers must still leave a signal, and this line is the one my own
    // opacity/name split forgot. Codex's eleventh finding on this branch:
    //
    //     const key = "TEST_DATABASE_URL";
    //     export function readEnv() { return process.env[key]; }
    //
    // The computed key resolves perfectly, so the read comes through HERE rather than the opaque branches --
    // and here the only question asked was "does it initialise an export?", which it does not. So it
    // contributed no name (correct: a name a caller might ask for is not this suite's gate) and no opacity
    // either (wrong: the package demonstrably hands out a database value). It cleared.
    //
    // Keeping the name out of the satisfying set is what avoids re-opening the fifth finding; discarding the
    // signal entirely is a different mistake. Opacity is the conservative answer in both cases.
    else if (escapesViaReturn(node)) exportedOpaque = true;
  };
  const visit = (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      isProcessEnv(node.expression) &&
      isDbName(node.name.text) &&
      !isAssignmentTarget(node)
    ) {
      collect(node.name.text, node);
    }
    // `const { ... } = process.env`
    if (
      ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer &&
      ts.isPropertyAccessExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "process" && node.initializer.name.text === "env"
    ) {
      opaque = true;
      if (initialisesExport(node) || escapesViaReturn(node)) exportedOpaque = true;
    }
    // `process.env["NAME"]` is the same read as `process.env.NAME` and was collected by neither branch:
    // the dot visitor does not see it, and the undeterminable fallback below explicitly excluded a literal.
    // So both the wanted set and `opaque` stayed empty and the suite was cleared -- Codex's finding, and the
    // only one of the four that was a plain omission rather than the unknown-is-safe reasoning.
    if (
      ts.isElementAccessExpression(node) && isProcessEnv(node.expression) &&
      node.argumentExpression && !isAssignmentTarget(node) &&
      !(node.parent && ts.isDeleteExpression(node.parent))
    ) {
      // A literal that is not a database name is as irrelevant here as `process.env.NODE_ENV` is.
      const names = computedKeyNames(file, sf, node);
      if (names) {
        for (const name of names) if (isDbName(name)) collect(name, node);
      } else {
        opaque = true;
        if (initialisesExport(node) || escapesViaReturn(node)) exportedOpaque = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { reads, exported, opaque, exportedOpaque, sf };
}

/**
 * The gate a suite reads, following its own relative imports.
 *
 * Codex's third finding here, and the largest: 53 suites in this repository gate on an IMPORTED constant --
 * `import { PG_URL } from "../test-support/authz-pg-harness"`, where the harness exports
 * `process.env.CS_TEST_PG_URL`. A suite like that has no local `process.env` read at all, so the version
 * before this cleared every one of them. Codex reproduced it on
 * marketplace-sample-listings.postgres.test.ts: remove CS_TEST_PG_URL from its step and the audit reported
 * zero hits while the suite produced zero passes, one skip, exit 0.
 *
 * Local reads and imported reads are kept SEPARATE, and a suite is judged on its local reads when it has any.
 * Unioning them was unsound, and the unsoundness was live rather than theoretical: 35 skippable suites here
 * have a local gate plus an imported `DATABASE_URL` their gate does not use, so with one set and
 * `some(available)`, supplying DATABASE_URL cleared a suite whose real gate was absent. Measured: dropping
 * TEST_DATABASE_URL from batch 1 while leaving DATABASE_URL reported 4 suites where it should report 8, and
 * square-connection-service.postgres.test.ts -- 0 pass, 1 skip with that environment -- was one of the four it
 * cleared. A gate that can clear a silently-green suite is the only failure that costs anything, and it is the
 * one I had just reintroduced while fixing another.
 *
 * Shapes measured across the skippable suites: 21 gate locally only, 53 gate through an import only, 35 do
 * both. Judging on local-when-present is correct for all three.
 */
const readsCache = new Map();
function cachedEnvReads(file) {
  if (!readsCache.has(file)) readsCache.set(file, envReads(file));
  return readsCache.get(file);
}

function gateReads(file, seen = new Set()) {
  // Cycle detection replaces the depth bound. The bound was 3, picked without evidence, and Codex built a
  // four-hop barrel chain that walked straight through it: at the cutoff this returned empty sets with
  // `opaque: false`, which the caller read as "no gate". The graph is finite; `seen` is what makes the walk
  // terminate, and a module already visited on this walk has already contributed its exports upward.
  if (seen.has(file)) return { local: new Set(), exported: new Set(), inherited: new Set(), unresolved: [], opaque: false };
  seen.add(file);
  const own = cachedEnvReads(file);
  const { files, unresolved } = resolveImports(own.sf, file);
  const inherited = new Set();
  const unknown = [...unresolved];
  let opaque = own.opaque;
  for (const imported of files) {
    const inner = gateReads(imported, seen);
    // Only what the imported module EXPORTS can be another module's gate.
    for (const name of inner.exported) inherited.add(name);
    for (const name of inner.inherited) inherited.add(name);
    opaque = opaque || inner.opaque;
    unknown.push(...inner.unresolved);
  }
  return { local: own.reads, exported: own.exported, inherited, unresolved: unknown, opaque: opaque || unknown.length > 0 };
}

/**
 * The names that actually decide this suite's gate: its own if it has any, otherwise the ones it imports --
 * and an explicit "cannot say" when BOTH exist and disagree.
 *
 * Codex's finding, and it is the exact mirror of the one before it. An earlier round unioned local and
 * imported reads, which let an unrelated transitive `DATABASE_URL` read satisfy a suite that gates only on
 * `CS_TEST_PG_URL`; the fix was to prefer local reads when a file has any. That fix then cleared the reverse
 * case: a suite that imports `PG_URL = process.env.CS_TEST_PG_URL`, saves `process.env.DATABASE_URL` locally
 * for a restore, and skips solely on `!PG_URL`. Supplying only DATABASE_URL cleared it, and the suite skipped.
 *
 * LOCALITY ALONE CANNOT ESTABLISH WHICH INPUT GATES. Telling them apart needs the skip condition's own
 * dependencies, which this script does not compute. So where the two sets disagree it reports undeterminable
 * rather than picking one: a wrong pick in either direction is a silent green.
 *
 * Measured before being written: NO suite in this repository is in that state today -- 514 named suites, zero
 * with an imported database name their local reads do not already include. So this closes a real hole at no
 * cost to the report, which is the same footing as the destructuring case above.
 */
function effectiveGate(file) {
  const { local, inherited, opaque, unresolved } = gateReads(file);
  const inheritedOnly = [...inherited].filter((name) => !local.has(name));
  if (local.size > 0 && inheritedOnly.length > 0) {
    return {
      reads: local,
      opaque: true,
      unresolved: [...new Set([...unresolved, `cannot tell whether this suite gates on its own ${[...local].sort().join("/")} or the imported ${inheritedOnly.sort().join("/")}`])].sort(),
    };
  }
  return { reads: local.size > 0 ? local : inherited, opaque, unresolved: [...new Set(unresolved)].sort() };
}

/**
 * Suites allowed to be named by CI and skip anyway, each with the reason and what would change it.
 * This is the "or is listed below with the reason it does not" half of done-condition 1, made executable.
 */
const ALLOWED = new Map([
  // ["server/foo.postgres.test.ts", "needs a second cluster; would run if CI started one"],
]);

/**
 * The environment names a step can ACTUALLY use: resolved by precedence, with empty values rejected.
 *
 * Codex's fourth finding here, and the fourth of the false-clean kind. The version before this one took
 * `Object.keys` of each layer and unioned them, so a key counted as satisfying a gate whatever it was set to.
 * Two shapes slipped through, both of which a suite treats as absent and node then exits 0 on:
 *
 *   env:
 *     TEST_DATABASE_URL: ""     # present as a key, empty as a value
 *
 *   job env: TEST_DATABASE_URL: postgres://...   # populated
 *   step env: TEST_DATABASE_URL: ""              # and overridden to nothing, which the union hid entirely
 *
 * Precedence is GitHub's: workflow env, then job env, then step env, each layer overriding the last -- so an
 * empty step-level value does not merely fail to help, it REMOVES a populated job-level one, and a union
 * could not express that. A value of `null` is the `NAME:` form with nothing after it, which Actions also
 * passes as the empty string.
 *
 * Neither shape exists in pr-validation.yml today -- checked, every database name there has a literal URL --
 * so this fixes a false clean that has not yet fired rather than one that has. It goes in because the gate is
 * now a CI gate: the cheap failure in this file is noise and the expensive one is silence, and silence is
 * what it has produced four times.
 *
 * Still not evaluated, and still the documented limit: a value from a secret or a `${{ }}` expression counts
 * as present, because this tool cannot know what it expands to. There are none in the workflow today.
 */
function effectiveEnv(...layers) {
  const resolved = new Map();
  for (const layer of layers) {
    if (!layer || typeof layer !== "object") continue;
    for (const [name, value] of Object.entries(layer)) resolved.set(name, value);
  }
  const usable = new Set();
  for (const [name, value] of resolved) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    usable.add(name);
  }
  return usable;
}

const findings = [];
const checked = { steps: 0, files: 0 };

for (const wf of WORKFLOWS) {
  if (!existsSync(wf)) continue;
  const doc = parse(readFileSync(wf, "utf8"));
  for (const [jobId, job] of Object.entries(doc.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      const run = typeof step.run === "string" ? step.run : "";
      if (!/node .*--test|run-ci-batch\.mjs/.test(run)) continue;
      const available = effectiveEnv(doc.env, job.env, step.env);
      const viaWrapper = run.includes("run-ci-batch.mjs");
      const files = [...run.matchAll(/\S+\.test\.(?:ts|tsx|mts)/g)].map((m) => m[0]);
      if (files.length === 0) continue;
      checked.steps += 1;
      for (const file of files) {
        if (!existsSync(file)) continue;
        checked.files += 1;
        const text = readFileSync(file, "utf8");
        // Only suites with a real skip MECHANISM are candidates. Matching the bare word "skip" flagged
        // wedding-square-renewal-scan.test.ts, which has no gate at all, always runs its 7 tests, and simply
        // contains a test NAMED "unchanged invoice is skipped, never reinserted or paid through twice". A
        // checker that reads test titles as control flow is the regex mistake again, one layer in.
        // `.skip` must match as a VALUE, not only as a call. The dominant postgres pattern in this repository
        // is `const postgresTest = adminUrl ? test : test.skip;` -- the alias form -- where `.skip` is never
        // invoked at that point. Requiring `(` missed schema-push-apply and schema-push-protected, which skip
        // 23 and 7 tests respectively without TEST_DATABASE_URL, so the audit reported 6 where the truth was 8.
        // `\.skip\b` does not match `.skipped`, so a destructured `{ skipped }` result stays out.
        if (!/\bskip\s*:|\.skip\b/.test(text)) continue;
        const { reads: wanted, opaque, unresolved } = effectiveGate(file);
        const satisfied = wanted.size > 0 && [...wanted].some((name) => available.has(name));
        // A named gate that the step does not supply is the clearest answer there is, so it is reported first
        // even when something else about the file was unresolvable.
        if (wanted.size > 0 && !satisfied) {
          findings.push({
            file,
            job: jobId,
            step: step.name ?? "(unnamed step)",
            wants: [...wanted].sort(),
            available: [...available].filter(isDbName).sort(),
            viaWrapper,
          });
          continue;
        }
        // AN UNKNOWN NEVER CLEARS A SUITE. Previously a suite was only undeterminable when it had no read at
        // all, so anything unresolvable alongside a satisfied read was waved through -- which is how the
        // depth bound, the bare specifier and the separate export declaration each cleared a suite that
        // skipped. If this script cannot see the whole gate, it says so rather than approving it.
        if (opaque) {
          findings.push({
            file, job: jobId, step: step.name ?? "(unnamed step)", undeterminable: true,
            wants: [...wanted].sort(), unresolved,
            available: [...available].filter(isDbName).sort(), viaWrapper,
          });
          continue;
        }
      }
    }
  }
}

const hits = findings.filter((f) => !ALLOWED.has(f.file));

if (asJson) {
  console.log(JSON.stringify({ checked, hits, excused: findings.length - hits.length }, null, 2));
} else {
  console.log(`audit-ci-skips: ${checked.steps} test steps, ${checked.files} named suites examined.`);
  if (hits.length === 0) {
    console.log("Every suite CI names has a connection string it can use, so none of them skips silently.");
  } else {
    console.log("");
    console.log(`${hits.length} suite(s) are NAMED BY CI AND WILL NOT RUN -- they skip, and node exits 0:`);
    console.log("");
    for (const h of hits) {
      console.log(`  ${h.file}`);
      console.log(`      in job "${h.job}", step "${h.step}"${h.viaWrapper ? " (via run-ci-batch, which will fail it)" : ""}`);
      if (h.undeterminable) {
        console.log("      this tool CANNOT SEE the whole of this suite's gate, so it will not clear it.");
        if (h.wants.length > 0) console.log(`      what it can see: ${h.wants.join(" or ")}`);
        if (h.unresolved?.length) console.log(`      what it cannot resolve: ${h.unresolved.join(", ")}`);
        else console.log("      its gate reads process.env dynamically (destructured, or a computed key).");
        console.log("      Give it a direct `process.env.NAME` read, make the import resolvable, or add it to");
        console.log("      ALLOWED with the reason.");
      } else {
        console.log(`      reads ${h.wants.join(" or ")}; that step has ${h.available.length ? h.available.join(", ") : "no database URL at all"}`);
      }
    }
    console.log("");
    console.log("Supply one of the names each suite reads in that job or step. If a suite genuinely cannot run");
    console.log("in CI, add it to ALLOWED in this script WITH the reason and what would change it -- which is");
    console.log("the 'or is listed with the reason it does not' half of done-condition 1.");
  }
}

process.exitCode = ci && hits.length > 0 ? 1 : 0;
