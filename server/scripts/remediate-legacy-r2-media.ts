/**
 * Operator-run remediation for public R2 objects written before upload validation existed.
 *
 * WHAT THIS IS FOR. `lib/uploads-static` hardens the objects ChefSire serves itself. It does nothing for R2: when
 * R2 is configured, clients are handed direct `R2_PUBLIC_BASE_URL` addresses and those requests never touch
 * Express. Historical objects therefore keep whatever key and `Content-Type` the vulnerable upload paths gave
 * them -- including `posts/*.svg` stored as `image/svg+xml`, a script-capable document served inline.
 *
 *   DRY RUN BY DEFAULT.  npm run r2:remediate:legacy
 *   APPLY.               npm run r2:remediate:legacy -- --apply
 *   NARROW THE SCOPE.    --prefix=posts/          (exact; may only select from the code-owned list)
 *   BOUND A RUN.         --max=500
 *
 * SAFETY PROPERTIES, EACH DELIBERATE AND EACH TESTED.
 *   - Dry run is the default. Nothing is written unless `--apply` is passed explicitly.
 *   - SCOPE IS CODE-OWNED. `--prefix` may only SELECT from `LEGACY_PUBLIC_PREFIXES`, by exact match, and is
 *     validated before any request is made. `--prefix=`, `--prefix=post`, `--prefix=posts`, `--prefix=/`,
 *     `--prefix=../` and `--prefix=unrelated/` are all refused, and the run does nothing at all.
 *   - Every returned key is re-checked against the same boundary before it is read or written.
 *   - THE BYTES DECIDE, NEVER THE EXTENSION. Each candidate is fetched and run through the same
 *     `validateUploadedMedia` boundary that governs new uploads.
 *   - NOTHING IS EVER DELETED OR RENAMED. There is no delete switch, and the storage port this runs against has
 *     no delete operation to call. A real JPEG sitting at `posts/<uuid>.html` is preserved.
 *   - Only the PUBLIC bucket (`R2_BUCKET`). `R2_PRIVATE_BUCKET` is never read.
 *   - Idempotent: a neutralized object is recognised by its own metadata and skipped on every later run.
 *   - Failures are counted and reported, set a non-zero exit, and never abort the rest of the run.
 */
import "../lib/load-env";
import { isR2Configured, r2Client } from "../lib/r2";
import { LEGACY_PUBLIC_PREFIXES, REFERENCE_AUDIT, resolveRequestedPrefixes } from "../services/legacy-media-remediation";
import { runLegacyRemediation } from "../services/legacy-media-remediation-run";
import { createR2ObjectStore } from "../services/legacy-r2-store";

type Options = { apply: boolean; requestedPrefixes: string[]; max: number };

export function parseArgs(argv: string[]): Options {
  const maxArg = argv.find((a) => a.startsWith("--max="));
  return {
    apply: argv.includes("--apply"),
    // Taken verbatim and validated by the code-owned resolver. Nothing here normalises or repairs a value:
    // guessing what an operator meant is how `--prefix=post` would become `posts/`.
    requestedPrefixes: argv.filter((a) => a.startsWith("--prefix=")).map((a) => a.slice("--prefix=".length)),
    max: maxArg ? Math.max(1, Number(maxArg.slice("--max=".length)) || 0) : Number.POSITIVE_INFINITY,
  };
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));

  // Scope is validated before anything else, so a refused run never opens a connection.
  const scope = resolveRequestedPrefixes(options.requestedPrefixes);
  if (!scope.ok) {
    console.error(`[legacy-r2] refusing to run: ${scope.rejected.map((p) => JSON.stringify(p)).join(", ")} is not a ChefSire public-media prefix.`);
    console.error(`[legacy-r2] --prefix may only select one of: ${LEGACY_PUBLIC_PREFIXES.join(", ")} (exact match).`);
    console.error("[legacy-r2] nothing was listed, read or modified.");
    return 2;
  }

  if (!isR2Configured()) {
    console.error("R2 is not configured for this environment; there is no public bucket to remediate.");
    console.error("Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_BASE_URL.");
    return 2;
  }
  const bucket = process.env.R2_BUCKET!.trim();

  console.log(`[legacy-r2] bucket=${bucket} mode=${options.apply ? "APPLY" : "DRY RUN"} scope=${scope.prefixes.join(",")}`);
  console.log("[legacy-r2] remediation is in-place metadata only: nothing is renamed and nothing is deleted.");
  if (!options.apply) console.log("[legacy-r2] nothing will be modified; re-run with --apply to act");

  const outcome = await runLegacyRemediation(createR2ObjectStore(r2Client, bucket), options);

  for (const line of outcome.log) {
    console.log(`[legacy-r2] ${line.action}  ${line.key}  (${line.reason}${line.detail ? `; ${line.detail}` : ""})`);
  }

  console.log(`\n[legacy-r2] scanned ${outcome.scanned}, inspected ${outcome.inspected} object(s)`);
  for (const [reason, count] of Object.entries(outcome.summary)) {
    if (count > 0) console.log(`[legacy-r2]   ${reason}: ${count}`);
  }
  console.log(`[legacy-r2] ${options.apply ? `modified ${outcome.mutated}` : `candidates ${outcome.candidates}`}`);

  if (outcome.unsafeKeysRetained > 0) {
    console.log(`\n[legacy-r2] ${outcome.unsafeKeysRetained} object(s) hold valid media under a key whose extension is active.`);
    console.log("[legacy-r2] Their verified content type has been pinned, and the bytes and key are preserved.");
    console.log("[legacy-r2] The key is NOT rewritten: a media URL is denormalised into these columns, three of");
    console.log("[legacy-r2] them JSONB arrays, with no index from an object back to the rows referencing it --");
    for (const column of REFERENCE_AUDIT.columns) console.log(`[legacy-r2]     ${column}`);
    console.log("[legacy-r2] so renaming would orphan references. Migrating keys needs a deliberate data migration.");
  }

  if (outcome.failures.length > 0) {
    console.error(`\n[legacy-r2] ${outcome.failures.length} object(s) could not be processed:`);
    for (const failure of outcome.failures.slice(0, 50)) console.error(`[legacy-r2]   ${failure.key}: ${failure.error}`);
    if (outcome.failures.length > 50) console.error(`[legacy-r2]   ... and ${outcome.failures.length - 50} more`);
    return 1;
  }

  if (!options.apply && outcome.candidates > 0) {
    console.log("\n[legacy-r2] re-run with --apply to remediate the candidates above.");
  }
  return 0;
}

main().then((code) => process.exit(code), (error) => {
  console.error("[legacy-r2] run failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
