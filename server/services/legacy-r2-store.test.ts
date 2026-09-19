/**
 * The R2 adapter: the bounded read, and the metadata rewrite that preserves what it is not changing.
 *
 * Both are review findings against head e46e167, and both are asserted against the behaviour observed there:
 *
 *   THE 25MB BOUND WAS NOT A MEMORY BOUND. The adapter called `transformToByteArray()` and compared the result's
 *   length afterwards. Reproduced: a 200MB body was materialised in full (~401MB rss delta) and only then
 *   refused. The HEAD `ContentLength` that was supposed to prevent that is not a control -- absent it becomes
 *   `Number(undefined ?? 0)` = 0 and the gate passes, and it can equally be understated or stale.
 *
 *   `MetadataDirective: "REPLACE"` DISCARDED UNRELATED METADATA. Reproduced: pinning a content type on a valid
 *   image left `{ContentType}` alone on the object -- its `Cache-Control`, `Content-Language`, `Expires` and all
 *   custom `x-amz-meta-*` entries were erased.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { planObjectMetadata } from "./legacy-media-remediation";
import { boundedRangeHeader, createR2ObjectStore, readBoundedBody, type S3Like } from "./legacy-r2-store";

const MAX = 25 * 1024 * 1024;

/* ------------------------------------------------------------------ a recording client */

type Sent = { name: string; input: Record<string, unknown> };

function recordingClient(responses: Record<string, unknown>): { client: S3Like; sent: Sent[] } {
  const sent: Sent[] = [];
  const client: S3Like = {
    async send(command: unknown) {
      const shaped = command as { constructor: { name: string }; input: Record<string, unknown> };
      sent.push({ name: shaped.constructor.name, input: shaped.input });
      return (responses[shaped.constructor.name] ?? {}) as Record<string, unknown>;
    },
  };
  return { client, sent };
}

/** A stream that reports how much of it was actually pulled, so "never fully buffered" is measurable. */
function countingStream(totalBytes: number, chunkSize = 64 * 1024): Readable & { delivered: number } {
  let produced = 0;
  const stream = new Readable({
    read() {
      if (produced >= totalBytes) { this.push(null); return; }
      const size = Math.min(chunkSize, totalBytes - produced);
      produced += size;
      (stream as Readable & { delivered: number }).delivered = produced;
      this.push(Buffer.alloc(size, 0x41));
    },
  }) as Readable & { delivered: number };
  stream.delivered = 0;
  return stream;
}

/* ------------------------------------------------------------------ FINDING 1: the read bound */

test("an object smaller than the limit reads completely", async () => {
  const read = await readBoundedBody(Readable.from([Buffer.alloc(1024, 0x41)]), MAX);
  assert.equal(read.kind, "bytes");
  assert.equal(read.kind === "bytes" && read.bytes.length, 1024);
});

test("an object exactly at the limit reads completely", async () => {
  const read = await readBoundedBody(countingStream(MAX), MAX);
  assert.equal(read.kind, "bytes", "exactly at the bound is within the bound");
  assert.equal(read.kind === "bytes" && read.bytes.length, MAX);
});

test("an object one byte over the limit is refused", async () => {
  const read = await readBoundedBody(countingStream(MAX + 1), MAX);
  assert.equal(read.kind, "oversized");
});

test("an oversized body is never fully buffered, and the stream is abandoned", async () => {
  // Ten times the limit. If the bound were still a post-hoc length check, all 250MB would be pulled.
  const stream = countingStream(MAX * 10);
  const read = await readBoundedBody(stream, MAX);
  assert.equal(read.kind, "oversized");
  assert.equal(stream.delivered <= MAX + 64 * 1024, true, `pulled ${stream.delivered} bytes; must stop within one chunk of the bound`);
  assert.equal(stream.destroyed, true, "the rest of the transfer is abandoned rather than drained");
});

test("a missing, understated or stale HEAD ContentLength cannot bypass the bound", async () => {
  // Each of these is the HEAD lying. The read does not consult it at all, so none of them changes the outcome.
  for (const [label, body] of [
    ["missing ContentLength (HEAD said 0)", countingStream(MAX * 4)],
    ["understated ContentLength", countingStream(MAX * 2)],
    ["object grew between HEAD and GET", countingStream(MAX + 1)],
  ] as const) {
    const read = await readBoundedBody(body, MAX);
    assert.equal(read.kind, "oversized", label);
  }
});

test("a server that ignores the Range header still cannot bypass the bound", async () => {
  // The Range is the first bound; this is the second, and it is the one that holds when the first is not honoured.
  const stream = countingStream(MAX * 6);
  const read = await readBoundedBody(stream, MAX);
  assert.equal(read.kind, "oversized");
  assert.equal(stream.delivered < MAX * 2, true, "the full response was not consumed");
});

test("the adapter asks for exactly one byte more than the limit allows", async () => {
  const { client, sent } = recordingClient({ GetObjectCommand: { Body: Readable.from([Buffer.alloc(16, 0x41)]) } });
  const store = createR2ObjectStore(client, "chefsire-public");
  await store.get("posts/a.jpg", MAX);
  const get = sent.find((call) => call.name === "GetObjectCommand")!;
  assert.equal(get.input.Range, `bytes=0-${MAX}`, "bytes 0..MAX inclusive is MAX+1 bytes: enough to detect one byte too many");
  assert.equal(boundedRangeHeader(MAX), "bytes=0-26214400");
  assert.equal(get.input.Key, "posts/a.jpg");
  assert.equal(get.input.Bucket, "chefsire-public");
});

test("the adapter never calls the SDK's unbounded transformToByteArray", async () => {
  let called = false;
  const body = Object.assign(Readable.from([Buffer.alloc(32, 0x41)]), {
    transformToByteArray: async () => { called = true; return new Uint8Array(0); },
  });
  const { client } = recordingClient({ GetObjectCommand: { Body: body } });
  const bytes = await createR2ObjectStore(client, "b").get("posts/a.jpg", MAX);
  assert.equal(called, false, "the unbounded read is exactly what this replaces");
  assert.equal(bytes?.length, 32);
});

test("an oversized or unreadable object yields no bytes, so the runner cannot mutate on it", async () => {
  const oversized = recordingClient({ GetObjectCommand: { Body: countingStream(MAX + 1) } });
  assert.equal(await createR2ObjectStore(oversized.client, "b").get("posts/a.jpg", MAX), null);
  const unreadable = recordingClient({ GetObjectCommand: { Body: undefined } });
  assert.equal(await createR2ObjectStore(unreadable.client, "b").get("posts/a.jpg", MAX), null);
});

test("a web-stream body is bounded by the same rule", async () => {
  const chunks = [Buffer.alloc(MAX, 0x41), Buffer.alloc(64, 0x41)];
  let cancelled = false;
  let index = 0;
  const webStream = {
    getReader: () => ({
      async read() {
        if (index >= chunks.length) return { done: true, value: undefined };
        return { done: false, value: new Uint8Array(chunks[index++]!) };
      },
      async cancel() { cancelled = true; },
    }),
  };
  const read = await readBoundedBody(webStream, MAX);
  assert.equal(read.kind, "oversized");
  assert.equal(cancelled, true, "the reader is cancelled rather than drained");
});

/* ------------------------------------------------------------------ FINDING 2: metadata preservation */

const existing = {
  key: "posts/uuid.html",
  contentType: "image/jpeg",
  contentDisposition: "inline",
  cacheControl: "public, max-age=31536000, immutable",
  contentLanguage: "en-GB",
  expires: "Wed, 21 Oct 2026 07:28:00 GMT",
  metadata: { "uploaded-by": "user-123", "original-name": "holiday.jpg" },
  size: 1024,
};

test("pinning a verified type preserves everything it is not changing", async () => {
  // OBSERVED ON e46e167: this rewrite left `{ContentType}` and erased the rest.
  const plan = planObjectMetadata(existing, { action: "pin_content_type", contentType: "image/jpeg", reason: "valid_media_unsafe_key", unsafeKeyRetained: true })!;
  assert.equal(plan.contentType, "image/jpeg", "the one intentional change");
  assert.equal(plan.cacheControl, "public, max-age=31536000, immutable", "retained");
  assert.equal(plan.contentLanguage, "en-GB", "retained");
  assert.equal(plan.expires, "Wed, 21 Oct 2026 07:28:00 GMT", "retained");
  assert.deepEqual(plan.metadata, { "uploaded-by": "user-123", "original-name": "holiday.jpg" }, "custom metadata retained");
  assert.equal(plan.contentDisposition, "inline", "a pin does not change how valid media is served");
});

test("neutralizing overrides only what neutralization requires, and preserves the rest", async () => {
  const plan = planObjectMetadata(existing, { action: "neutralize", reason: "active_content" })!;
  assert.equal(plan.contentType, "application/octet-stream", "overridden: the remediation");
  assert.equal(plan.contentDisposition, "attachment", "overridden: it must download, not render");
  assert.equal(plan.cacheControl, "no-store", "overridden: a cache must not keep serving the old response");
  assert.equal(plan.contentLanguage, "en-GB", "unrelated, retained");
  assert.equal(plan.expires, "Wed, 21 Oct 2026 07:28:00 GMT", "unrelated, retained");
  assert.deepEqual(plan.metadata, existing.metadata, "custom metadata is the uploader's, retained");
});

test("a neutralized object loses its content coding and any redirect, deliberately", async () => {
  const plan = planObjectMetadata(
    { ...existing, contentEncoding: "gzip", websiteRedirectLocation: "https://elsewhere.example" },
    { action: "neutralize", reason: "active_content" },
  )!;
  // Both tell a client to do something other than take the bytes literally, which is the whole point of
  // neutralizing content we have concluded we do not trust.
  assert.equal(plan.contentEncoding, undefined);
  assert.equal(plan.websiteRedirectLocation, undefined);
});

test("a content coding is preserved on a pin, because a pin can only happen without one", async () => {
  const plan = planObjectMetadata({ ...existing, contentEncoding: "identity" }, { action: "pin_content_type", contentType: "image/jpeg", reason: "valid_media_wrong_type", unsafeKeyRetained: false })!;
  assert.equal(plan.contentEncoding, "identity", "an identity coding is truthful and is left alone");
});

test("the adapter sends the complete plan, so REPLACE writes exactly the intended state", async () => {
  const { client, sent } = recordingClient({});
  const plan = planObjectMetadata(existing, { action: "neutralize", reason: "active_content" })!;
  await createR2ObjectStore(client, "chefsire-public").setMetadata("posts/uuid.html", plan);
  const copy = sent.find((call) => call.name === "CopyObjectCommand")!;
  assert.equal(copy.input.MetadataDirective, "REPLACE");
  assert.equal(copy.input.Key, "posts/uuid.html");
  assert.equal(copy.input.CopySource, "chefsire-public/posts/uuid.html", "copied onto itself: same key, same bytes");
  assert.equal(copy.input.ContentType, "application/octet-stream");
  assert.equal(copy.input.ContentDisposition, "attachment");
  assert.equal(copy.input.CacheControl, "no-store");
  assert.equal(copy.input.ContentLanguage, "en-GB");
  assert.deepEqual(copy.input.Metadata, existing.metadata);
  assert.equal((copy.input.Expires as Date).toUTCString(), "Wed, 21 Oct 2026 07:28:00 GMT");
  assert.equal(copy.input.ContentEncoding, undefined);
});

test("HEAD is read in full, including the fields a rewrite would otherwise discard", async () => {
  const { client } = recordingClient({
    HeadObjectCommand: {
      ContentType: "image/svg+xml", ContentDisposition: "inline", CacheControl: "max-age=60",
      ContentEncoding: "gzip", ContentLanguage: "fr", ExpiresString: "Wed, 21 Oct 2026 07:28:00 GMT",
      Metadata: { owner: "u1" }, WebsiteRedirectLocation: "/elsewhere", ContentLength: 4096,
    },
  });
  const head = await createR2ObjectStore(client, "b").head("posts/a.svg");
  assert.deepEqual(head, {
    contentType: "image/svg+xml", contentDisposition: "inline", cacheControl: "max-age=60",
    contentEncoding: "gzip", contentLanguage: "fr", expires: "Wed, 21 Oct 2026 07:28:00 GMT",
    metadata: { owner: "u1" }, websiteRedirectLocation: "/elsewhere", size: 4096,
  });
});

test("an Expires the SDK could only parse as a Date still round-trips", async () => {
  const { client } = recordingClient({ HeadObjectCommand: { Expires: new Date("2026-10-21T07:28:00Z"), ContentLength: 1 } });
  const head = await createR2ObjectStore(client, "b").head("posts/a.jpg");
  assert.equal(head.expires, "Wed, 21 Oct 2026 07:28:00 GMT");
});

test("nothing is planned for an object that is being kept or only reported", async () => {
  assert.equal(planObjectMetadata(existing, { action: "keep", reason: "already_correct" }), null);
  assert.equal(planObjectMetadata(existing, { action: "report_only", reason: "unverifiable_inert" }), null);
});
