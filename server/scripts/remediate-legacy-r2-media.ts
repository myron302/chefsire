/**
 * Operator-run remediation for public R2 objects written before upload validation existed.
 *
 * WHAT THIS IS FOR. `lib/uploads-static` hardens the objects ChefSire serves itself. It does nothing for R2:
 * when R2 is configured, clients are handed direct `R2_PUBLIC_BASE_URL` addresses and those requests never touch
 * Express. Historical objects therefore keep whatever key and `Content-Type` the vulnerable upload paths gave
 * them -- including `posts/*.svg` stored as `image/svg+xml`, which is a script-capable document served inline.
 * This script is the only part of the repair that can reach them.
 *
 *   DRY RUN BY DEFAULT.  npm run r2:remediate:legacy
 *   APPLY.               npm run r2:remediate:legacy -- --apply
 *   SCOPE.               --prefix=posts/ --prefix=avatars/        (default: all three public prefixes)
 *   DELETE INSTEAD.      --apply --delete-illegitimate
 *   BOUND A RUN.         --max=500
 *
 * SAFETY PROPERTIES, EACH DELIBERATE.
 *   - Dry run is the default. Nothing is written unless `--apply` is passed explicitly.
 *   - Only the PUBLIC bucket (`R2_BUCKET`). The private catering bucket is never opened; this script does not
 *     even read `R2_PRIVATE_BUCKET`.
 *   - Only ChefSire's own key prefixes. Anything else in the bucket is listed as out of scope and skipped.
 *   - Neutralize, not delete, by default: the bytes are preserved and only the served metadata changes, so a
 *     misjudged object is recoverable. Deletion is a separate opt-in flag.
 *   - Canonical media is never touched, and an object whose extension and stored type merely disagree -- both
 *     inert -- is reported and left alone rather than modified on a guess.
 *   - Idempotent: a neutralized object is recognised by its own metadata and skipped on every later run.
 *   - Every candidate and every action is logged with its key and reason. Failures are counted, reported at the
 *     end, and make the process exit non-zero; one failure never aborts the rest of the run.
 */
import "../lib/load-env";
import { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { isR2Configured, r2Client } from "../lib/r2";
import {
  LEGACY_PUBLIC_PREFIXES,
  NEUTRALIZED_CONTENT_DISPOSITION,
  NEUTRALIZED_CONTENT_TYPE,
  classifyLegacyObject,
  emptyLegacySummary,
  isIllegitimateUnderCurrentPolicy,
  type LegacyReason,
} from "../services/legacy-media-remediation";

type Options = { apply: boolean; deleteIllegitimate: boolean; prefixes: string[]; max: number };

function parseArgs(argv: string[]): Options {
  const prefixes = argv.filter((a) => a.startsWith("--prefix=")).map((a) => a.slice("--prefix=".length));
  const maxArg = argv.find((a) => a.startsWith("--max="));
  return {
    apply: argv.includes("--apply"),
    deleteIllegitimate: argv.includes("--delete-illegitimate"),
    prefixes: prefixes.length > 0 ? prefixes : [...LEGACY_PUBLIC_PREFIXES],
    max: maxArg ? Math.max(1, Number(maxArg.slice("--max=".length)) || 0) : Number.POSITIVE_INFINITY,
  };
}

/** Rewrites an object's served metadata in place, preserving its bytes. R2 supports S3 copy-onto-self. */
async function neutralize(bucket: string, key: string): Promise<void> {
  await r2Client.send(new CopyObjectCommand({
    Bucket: bucket,
    Key: key,
    CopySource: `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`,
    MetadataDirective: "REPLACE",
    ContentType: NEUTRALIZED_CONTENT_TYPE,
    ContentDisposition: NEUTRALIZED_CONTENT_DISPOSITION,
    CacheControl: "no-store",
  }));
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));

  if (!isR2Configured()) {
    console.error("R2 is not configured for this environment; there is no public bucket to remediate.");
    console.error("Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_BASE_URL.");
    return 2;
  }
  const bucket = process.env.R2_BUCKET!.trim();

  console.log(`[legacy-r2] bucket=${bucket} mode=${options.apply ? "APPLY" : "DRY RUN"} prefixes=${options.prefixes.join(",")}`);
  console.log(`[legacy-r2] remediation=${options.deleteIllegitimate ? "delete objects that cannot legitimately exist" : "neutralize metadata (bytes preserved)"}`);
  if (!options.apply) console.log("[legacy-r2] nothing will be modified; re-run with --apply to act");

  const summary = emptyLegacySummary();
  const failures: { key: string; error: string }[] = [];
  let scanned = 0;
  let acted = 0;

  for (const prefix of options.prefixes) {
    let continuationToken: string | undefined;
    do {
      const page = await r2Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken, MaxKeys: 1000 }));
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;

      for (const entry of page.Contents ?? []) {
        const key = entry.Key;
        if (!key || key.endsWith("/")) continue;
        scanned += 1;
        if (acted >= options.max) { continuationToken = undefined; break; }

        // The listing does not carry Content-Type, so each candidate's metadata is read individually.
        let contentType: string | undefined;
        let contentDisposition: string | undefined;
        try {
          const head = await r2Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
          contentType = head.ContentType;
          contentDisposition = head.ContentDisposition;
        } catch (error: unknown) {
          failures.push({ key, error: error instanceof Error ? error.message : "could not read object metadata" });
          continue;
        }

        const disposition = classifyLegacyObject({ key, contentType, contentDisposition }, options.prefixes);
        summary[disposition.reason as LegacyReason] += 1;

        if (disposition.action === "keep") continue;

        const willDelete = options.deleteIllegitimate && isIllegitimateUnderCurrentPolicy(disposition.reason);
        const verb = willDelete ? "DELETE" : "NEUTRALIZE";
        console.log(`[legacy-r2] ${options.apply ? verb : `would ${verb}`}  ${key}  (stored type: ${contentType ?? "none"}; reason: ${disposition.reason})`);

        if (!options.apply) { acted += 1; continue; }
        try {
          if (willDelete) await r2Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
          else await neutralize(bucket, key);
          acted += 1;
        } catch (error: unknown) {
          failures.push({ key, error: error instanceof Error ? error.message : "remediation failed" });
        }
      }
    } while (continuationToken);
  }

  console.log(`\n[legacy-r2] scanned ${scanned} object(s)`);
  for (const [reason, count] of Object.entries(summary)) {
    if (count > 0) console.log(`[legacy-r2]   ${reason}: ${count}`);
  }
  console.log(`[legacy-r2] ${options.apply ? "remediated" : "candidates"}: ${acted}`);

  if (failures.length > 0) {
    console.error(`\n[legacy-r2] ${failures.length} object(s) could not be processed:`);
    for (const failure of failures.slice(0, 50)) console.error(`[legacy-r2]   ${failure.key}: ${failure.error}`);
    if (failures.length > 50) console.error(`[legacy-r2]   ... and ${failures.length - 50} more`);
    return 1;
  }

  if (!options.apply && acted > 0) {
    console.log("\n[legacy-r2] re-run with --apply to remediate the candidates above.");
  }
  return 0;
}

main().then((code) => process.exit(code), (error) => {
  console.error("[legacy-r2] run failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
