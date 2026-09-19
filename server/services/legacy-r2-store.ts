/**
 * The R2-backed storage adapter the legacy remediation runs against.
 *
 * It lives here rather than inside the script so every one of its guarantees can be asserted against a fake
 * client: the exact `Range` it requests, the fact that an oversized body is never fully buffered, and the exact
 * metadata a rewrite sends.
 *
 * TWO REVIEW CORRECTIONS ARE LOAD-BEARING IN THIS FILE.
 *
 * 1. THE READ BOUND IS REAL. The previous adapter called `transformToByteArray()` and only then compared the
 *    result's length to the limit. That materialises the whole object first: a 200MB object was buffered in full
 *    and *then* refused, and the HEAD `ContentLength` that was supposed to prevent it is not a control at all --
 *    it can be absent (`Number(undefined ?? 0)` is 0, so the gate passes), understated, or stale. The bound is
 *    now enforced twice: a `Range` header asks for at most `maxBytes + 1` bytes, and the body is consumed
 *    incrementally and abandoned the moment the cumulative total passes `maxBytes`. The second is what holds if
 *    a server ignores the first.
 *
 * 2. A METADATA REWRITE PRESERVES WHAT IT IS NOT CHANGING. `MetadataDirective: "REPLACE"` keeps only the fields
 *    the request supplies, so supplying three of them silently erased the rest -- custom `x-amz-meta-*` entries,
 *    `Content-Language`, `Expires`, and on a pin (which supplied only a content type) `Cache-Control` and
 *    `Content-Disposition` too. The adapter now sends a COMPLETE plan computed by `planObjectMetadata`, where
 *    every field that is absent is absent on purpose.
 */
import { CopyObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import type { LegacyObjectMetadata, ObjectMetadataPlan } from "./legacy-media-remediation";
import type { LegacyObjectStore } from "./legacy-media-remediation-run";

/** Only what this adapter needs, so a test can supply a recording double. */
export type S3Like = { send(command: unknown): Promise<Record<string, unknown>> };

export type BoundedRead =
  | { kind: "bytes"; bytes: Buffer }
  | { kind: "oversized" }
  | { kind: "unreadable" };

/**
 * Reads at most `maxBytes` from a response body, and gives up the moment it is clear there is more.
 *
 * Chunks are counted as they arrive and the stream is destroyed as soon as the running total exceeds the limit,
 * so the peak held in memory is bounded by `maxBytes` plus one chunk however large the object actually is. The
 * SDK's own `transformToByteArray()` is deliberately never called: it is exactly the unbounded read this
 * replaces.
 */
export async function readBoundedBody(body: unknown, maxBytes: number): Promise<BoundedRead> {
  if (!body || typeof body !== "object") return { kind: "unreadable" };

  const chunks: Buffer[] = [];
  let total = 0;
  /** Returns true when the limit has been passed and reading must stop. */
  const absorb = (chunk: Uint8Array): boolean => {
    total += chunk.byteLength;
    if (total > maxBytes) return true;
    chunks.push(Buffer.from(chunk));
    return false;
  };

  // Node runtime: the SDK body is a Readable, which is async-iterable.
  if (Symbol.asyncIterator in body) {
    const stream = body as AsyncIterable<Uint8Array> & { destroy?: (error?: Error) => void };
    for await (const chunk of stream) {
      if (absorb(chunk)) {
        // Stop pulling. Without this the rest of a large object would still be transferred.
        stream.destroy?.();
        return { kind: "oversized" };
      }
    }
    return { kind: "bytes", bytes: Buffer.concat(chunks, total) };
  }

  // Web-stream runtime: same rule, same bound.
  const webStream = body as { getReader?: () => { read(): Promise<{ done: boolean; value?: Uint8Array }>; cancel(): Promise<void> } };
  if (typeof webStream.getReader === "function") {
    const reader = webStream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && absorb(value)) {
        await reader.cancel().catch(() => undefined);
        return { kind: "oversized" };
      }
    }
    return { kind: "bytes", bytes: Buffer.concat(chunks, total) };
  }

  return { kind: "unreadable" };
}

/** The `Range` header for a bounded read: bytes 0..maxBytes inclusive, i.e. one more than the limit allows. */
export function boundedRangeHeader(maxBytes: number): string {
  return `bytes=0-${maxBytes}`;
}

export function createR2ObjectStore(client: S3Like, bucket: string): LegacyObjectStore {
  return {
    async list(prefix, continuationToken) {
      const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken, MaxKeys: 1000 })) as {
        Contents?: { Key?: string }[]; IsTruncated?: boolean; NextContinuationToken?: string;
      };
      return {
        keys: (page.Contents ?? []).map((entry) => entry.Key).filter((key): key is string => Boolean(key)),
        nextToken: page.IsTruncated ? page.NextContinuationToken : undefined,
      };
    },

    async head(key) {
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })) as {
        ContentType?: string; ContentDisposition?: string; CacheControl?: string; ContentEncoding?: string;
        ContentLanguage?: string; Expires?: Date; ExpiresString?: string; Metadata?: Record<string, string>;
        WebsiteRedirectLocation?: string; ContentLength?: number;
      };
      return {
        contentType: head.ContentType,
        contentDisposition: head.ContentDisposition,
        cacheControl: head.CacheControl,
        contentEncoding: head.ContentEncoding,
        contentLanguage: head.ContentLanguage,
        // `ExpiresString` is the raw header; `Expires` is the SDK's parsed Date, which can be undefined for a
        // value it could not parse. The raw form is what round-trips faithfully.
        expires: head.ExpiresString ?? (head.Expires instanceof Date ? head.Expires.toUTCString() : undefined),
        metadata: head.Metadata,
        websiteRedirectLocation: head.WebsiteRedirectLocation,
        size: Number(head.ContentLength ?? 0),
      };
    },

    async get(key, maxBytes) {
      // The Range is the first bound: a compliant server never sends more than `maxBytes + 1` bytes.
      const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: boundedRangeHeader(maxBytes) })) as { Body?: unknown };
      const read = await readBoundedBody(object.Body, maxBytes);
      // `oversized` and `unreadable` are both "no bytes to validate"; the runner treats that as unverifiable and
      // never mutates on the strength of it.
      return read.kind === "bytes" ? read.bytes : null;
    },

    async setMetadata(key, plan) {
      // Copy onto the same key: the bytes and the key are untouched, which is what keeps every database
      // reference valid. The plan is complete, so REPLACE writes exactly the intended final state.
      await client.send(new CopyObjectCommand({
        Bucket: bucket,
        Key: key,
        CopySource: `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`,
        MetadataDirective: "REPLACE",
        ContentType: plan.contentType,
        ContentDisposition: plan.contentDisposition,
        CacheControl: plan.cacheControl,
        ContentEncoding: plan.contentEncoding,
        ContentLanguage: plan.contentLanguage,
        Expires: plan.expires ? new Date(plan.expires) : undefined,
        Metadata: plan.metadata,
        WebsiteRedirectLocation: plan.websiteRedirectLocation,
      }));
    },
  };
}

export type { LegacyObjectMetadata, ObjectMetadataPlan };
