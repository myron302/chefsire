/**
 * The remediation run itself, expressed against a narrow port so every path -- including every failure path --
 * is testable without a bucket.
 *
 * THE PORT HAS NO DELETE. That is deliberate and is the structural half of the review correction: `--delete-
 * illegitimate` is gone, and this module could not delete an object even if a future caller asked it to. See
 * `legacy-media-remediation.ts` for why deletion is not the right remediation here -- in short, an extension
 * never proved the content, and ChefSire has no index from an object to the database rows referencing it, so a
 * deletion cannot be shown not to break something while neutralizing stops execution just as completely.
 */
import {
  LEGACY_INSPECT_MAX_BYTES,
  decideLegacyRemediation,
  planObjectMetadata,
  emptyLegacySummary,
  isKeyWithinOwnedScope,
  resolveRequestedPrefixes,
  triageLegacyObject,
  type LegacyObjectMetadata,
  type ObjectMetadataPlan,
  type LegacySummary,
} from "./legacy-media-remediation";
import { validateUploadedMedia } from "./media-validation";

/** Everything the run may do to storage. Read, and rewrite metadata in place. Nothing else exists. */
export type LegacyObjectStore = {
  list(prefix: string, continuationToken?: string): Promise<{ keys: string[]; nextToken?: string }>;
  /** Everything HEAD knows, in full, so a rewrite can preserve what it is not changing. */
  head(key: string): Promise<Omit<LegacyObjectMetadata, "key"> & { size: number }>;
  /**
   * Reads at most `maxBytes`, enforcing that at the read itself rather than after the fact, and returns null
   * when the object is larger than the bound or cannot be read.
   */
  get(key: string, maxBytes: number): Promise<Buffer | null>;
  /** Rewrites served metadata on the SAME key, to the COMPLETE state in the plan. Bytes and key never change. */
  setMetadata(key: string, plan: ObjectMetadataPlan): Promise<void>;
};

export type RemediationOptions = { apply: boolean; requestedPrefixes: readonly string[]; max: number };
export type RemediationLogLine = { key: string; action: string; reason: string; detail?: string };

export type RemediationOutcome = {
  ok: boolean;
  scanned: number;
  inspected: number;
  mutated: number;
  candidates: number;
  unsafeKeysRetained: number;
  summary: LegacySummary;
  log: RemediationLogLine[];
  failures: { key: string; error: string }[];
  /** Set when the requested scope was refused. Nothing is listed, read or written in that case. */
  rejectedPrefixes?: readonly string[];
};

function emptyOutcome(): RemediationOutcome {
  return { ok: true, scanned: 0, inspected: 0, mutated: 0, candidates: 0, unsafeKeysRetained: 0, summary: emptyLegacySummary(), log: [], failures: [] };
}

/**
 * Scans the code-owned prefixes and remediates what the bytes prove needs it.
 *
 * Scope is resolved BEFORE any request is made, so an invalid `--prefix` never reaches a listing, let alone a
 * mutation. Every key a listing returns is re-checked against the code-owned boundary before anything is read or
 * written, because listing by prefix is a request rather than a guarantee.
 */
export async function runLegacyRemediation(store: LegacyObjectStore, options: RemediationOptions): Promise<RemediationOutcome> {
  const outcome = emptyOutcome();

  // Fail closed, before a single network call.
  const scope = resolveRequestedPrefixes(options.requestedPrefixes);
  if (!scope.ok) {
    outcome.ok = false;
    outcome.rejectedPrefixes = scope.rejected;
    return outcome;
  }

  for (const prefix of scope.prefixes) {
    let continuationToken: string | undefined;
    let stop = false;
    do {
      const page = await store.list(prefix, continuationToken);
      continuationToken = page.nextToken;

      for (const key of page.keys) {
        if (outcome.candidates >= options.max) { stop = true; break; }

        // The boundary, re-asserted on the returned key rather than inferred from what we asked for.
        if (!isKeyWithinOwnedScope(key, scope.prefixes)) {
          outcome.summary.out_of_scope += 1;
          outcome.log.push({ key, action: "skip", reason: "outside_owned_scope" });
          continue;
        }
        outcome.scanned += 1;

        let metadata: Omit<LegacyObjectMetadata, "key"> & { size: number };
        try {
          metadata = await store.head(key);
        } catch (error: unknown) {
          outcome.failures.push({ key, error: error instanceof Error ? error.message : "could not read object metadata" });
          continue;
        }

        const object: LegacyObjectMetadata = { key, ...metadata };
        const triage = triageLegacyObject(object, scope.prefixes);
        outcome.summary[triage.reason] += 1;
        if (triage.action === "keep") continue;

        // The bytes decide. An extension never does.
        let validation: Parameters<typeof decideLegacyRemediation>[2];
        if (metadata.size > LEGACY_INSPECT_MAX_BYTES) {
          validation = { kind: "not_inspected", why: "too_large" };
        } else {
          let body: Buffer | null = null;
          try {
            body = await store.get(key, LEGACY_INSPECT_MAX_BYTES);
          } catch (error: unknown) {
            outcome.failures.push({ key, error: error instanceof Error ? error.message : "could not read object" });
            continue;
          }
          if (!body) {
            validation = { kind: "not_inspected", why: "unreadable" };
          } else {
            outcome.inspected += 1;
            validation = await validateUploadedMedia({
              source: { buffer: body },
              allow: ["image", "video", "document"],
              // Passed only so an inert ZIP-family member can be labelled; neither can make an object acceptable.
              declaredMimeType: metadata.contentType,
              originalName: key,
            });
          }
        }

        const decision = decideLegacyRemediation(object, triage, validation);
        outcome.summary[decision.reason] += 1;
        if (decision.action === "keep") continue;

        if (decision.action === "report_only") {
          outcome.log.push({ key, action: "report", reason: decision.reason, detail: `stored type: ${metadata.contentType ?? "none"}` });
          continue;
        }

        outcome.candidates += 1;
        if (decision.action === "pin_content_type" && decision.unsafeKeyRetained) outcome.unsafeKeysRetained += 1;

        // The COMPLETE metadata the object should end up with: what the remediation changes, plus everything it
        // is not changing, carried through explicitly so a REPLACE copy cannot quietly drop it.
        const plan = planObjectMetadata(object, decision);
        if (!plan) continue;

        outcome.log.push({
          key,
          action: options.apply ? decision.action : `would ${decision.action}`,
          reason: decision.reason,
          detail: `stored type: ${metadata.contentType ?? "none"} -> ${plan.contentType}`,
        });

        if (!options.apply) continue;
        try {
          // Same key, same bytes. Only the served metadata changes, so every existing reference still resolves.
          await store.setMetadata(key, plan);
          outcome.mutated += 1;
        } catch (error: unknown) {
          outcome.failures.push({ key, error: error instanceof Error ? error.message : "remediation failed" });
        }
      }
      if (stop) break;
    } while (continuationToken);
  }

  outcome.ok = outcome.failures.length === 0;
  return outcome;
}
