import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Local private writes must persist the WHOLE buffer before reporting success.
 *
 * `FileHandle.write` returns `bytesWritten` and is not obliged to take the entire buffer in one call. A single
 * unchecked call is how a truncated booking document is produced -- and it fails silently in the worst way: the
 * metadata row still records the original byte size and SHA-256, the route still answers 201, and the shortfall is
 * only discovered when somebody downloads the file.
 *
 * The loop is exercised behaviourally against a fake handle that deliberately writes short, because a real
 * filesystem will not reliably reproduce a partial write on demand. That the production code uses this loop, on the
 * hardened descriptor rather than a re-opened path, is asserted structurally alongside.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "private-storage.ts"), "utf8");
const writeLoop = source.slice(source.indexOf("async function writeWholeBuffer"), source.indexOf("export async function readPrivateObject"));

/** The production loop, mirrored exactly, so the fake handle below exercises the real control flow. */
async function writeWholeBuffer(handle: { write: (body: Buffer, offset: number, length: number, position: number) => Promise<{ bytesWritten: number }> }, body: Buffer): Promise<void> {
  let written = 0;
  while (written < body.length) {
    const { bytesWritten } = await handle.write(body, written, body.length - written, written);
    if (bytesWritten <= 0) throw new Error("Private storage write made no progress");
    written += bytesWritten;
  }
}

/** A handle that accepts the chunk sizes it is told to, recording exactly what landed and where. */
function fakeHandle(chunks: number[]) {
  const landed: Buffer[] = [];
  const calls: { offset: number; length: number; position: number }[] = [];
  let closed = false;
  let index = 0;
  return {
    landed, calls,
    get closed() { return closed; },
    close: async () => { closed = true; },
    write: async (body: Buffer, offset: number, length: number, position: number) => {
      calls.push({ offset, length, position });
      const allowed = index < chunks.length ? chunks[index] : length;
      index += 1;
      const bytesWritten = Math.min(allowed, length);
      landed.push(Buffer.from(body.subarray(offset, offset + bytesWritten)));
      return { bytesWritten };
    },
  };
}
const BODY = Buffer.from("%PDF-1.7\nthis is the whole booking document, every byte of it\n%%EOF\n");

test("A. a normal full write succeeds in one call and stores the exact bytes", async () => {
  const handle = fakeHandle([BODY.length]);
  await writeWholeBuffer(handle, BODY);
  assert.equal(Buffer.concat(handle.landed).equals(BODY), true);
  assert.equal(handle.calls.length, 1);
  assert.deepEqual(handle.calls[0], { offset: 0, length: BODY.length, position: 0 });
});

test("B. a short first write is completed by a second, producing the exact full contents", async () => {
  const handle = fakeHandle([10]);
  await writeWholeBuffer(handle, BODY);
  // The decisive assertion: what landed is byte-for-byte the original, not the first 10 bytes.
  assert.equal(Buffer.concat(handle.landed).equals(BODY), true);
  assert.equal(handle.calls.length, 2);
  // The resumption starts at exactly the next byte, in both the buffer offset and the file position.
  assert.deepEqual(handle.calls[1], { offset: 10, length: BODY.length - 10, position: 10 });
});

test("C. many short writes still produce the exact original buffer, in order", async () => {
  const handle = fakeHandle([1, 7, 3, 20, 2]);
  await writeWholeBuffer(handle, BODY);
  assert.equal(Buffer.concat(handle.landed).equals(BODY), true);
  // Every call resumes from the running total, so no byte is skipped and none is written twice.
  let expected = 0;
  for (const call of handle.calls) {
    assert.equal(call.offset, expected);
    assert.equal(call.position, expected);
    assert.equal(call.length, BODY.length - expected);
    expected += Math.min(call.length, handle.landed[handle.calls.indexOf(call)].length);
  }
  assert.equal(Buffer.concat(handle.landed).length, BODY.length);
});

test("D. zero progress throws rather than looping forever", async () => {
  // A descriptor that accepts nothing is not going to start; spinning inside a request is worse than a failed upload.
  const handle = fakeHandle([0]);
  await assert.rejects(() => writeWholeBuffer(handle, BODY), /no progress/);
  assert.equal(handle.calls.length, 1, "it must not retry a descriptor that accepted nothing");
  // A negative report is treated the same way.
  await assert.rejects(() => writeWholeBuffer(fakeHandle([-1]), BODY), /no progress/);
});

test("E. a thrown write failure propagates, and the handle is still closed", async () => {
  const handle = fakeHandle([]);
  handle.write = async () => { throw new Error("ENOSPC: no space left on device"); };
  // The production shape: the loop runs inside try, the close inside finally.
  await assert.rejects(async () => {
    try {
      await writeWholeBuffer(handle, BODY);
    } finally {
      await handle.close();
    }
  }, /ENOSPC/);
  assert.equal(handle.closed, true);
  assert.equal(writeLoop.length > 0, true);
  const write = source.slice(source.indexOf("export async function writePrivateObject"), source.indexOf("async function writeWholeBuffer"));
  assert.equal(write.includes("try {\n    await writeWholeBuffer(handle, body);"), true);
  assert.equal(write.includes("} finally {\n    await handle.close();"), true);
});

test("F. an incomplete write can never be reported as a successful upload", async () => {
  // There is no path out of the loop with fewer bytes written than the body holds: it either completes or throws.
  const handle = fakeHandle([5, 5, 0]);
  await assert.rejects(() => writeWholeBuffer(handle, BODY), /no progress/);
  assert.equal(Buffer.concat(handle.landed).length < BODY.length, true, "the partial bytes are what make this a failure, not a success");
  // And the caller treats a throw as the uncertain write it is: the route compensates and never answers 201.
  const route = fs.readFileSync(path.join(here, "..", "routes", "catering-booking-files.ts"), "utf8");
  const attempt = route.slice(route.indexOf("await writePrivateObject(provider"), route.indexOf("const result = await db.transaction"));
  assert.equal(attempt.includes(`stored.reason = "uncertain_upload"`), true);
  assert.equal(attempt.includes("await compensateStoredObject(stored)"), true);
  assert.equal(attempt.includes("throw writeError"), true);
});

test("the production write loops on the hardened descriptor rather than re-opening by path", () => {
  // The secure open is the point: re-opening to reach `writeFile` would give back the symlink window O_NOFOLLOW
  // exists to close, so the completeness guarantee is added to that descriptor instead.
  assert.equal(writeLoop.includes("await handle.write(body, written, body.length - written, written)"), true);
  assert.equal(writeLoop.includes("if (bytesWritten <= 0) throw"), true);
  assert.equal(writeLoop.includes("written += bytesWritten;"), true);
  assert.equal(writeLoop.includes("while (written < body.length)"), true);
  // The open flags and the mode assertion are untouched.
  const write = source.slice(source.indexOf("export async function writePrivateObject"), source.indexOf("async function writeWholeBuffer"));
  assert.equal(write.includes("fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | O_NOFOLLOW, 0o600"), true);
  assert.equal(write.includes("await handle.chmod(0o600);"), true);
  assert.equal(write.includes("resolvePrivatePath(storageKey);"), true);
  assert.equal(write.includes("writeFile("), false, "the hardened descriptor must not be bypassed");
  // The R2 branch still returns before any of this.
  assert.equal(write.includes(`if (provider === "r2") return putPrivateObject(storageKey, body, contentType);`), true);
});

test("a real end-to-end write through the module still stores the exact bytes", async () => {
  const base = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "catering-shortwrite-"));
  process.env.PRIVATE_STORAGE_DIR = path.join(base, "private");
  const storage = await import("./private-storage");
  const key = "catering-bookings/77777777-7777-4777-8777-777777777777/doc.pdf";
  // Large enough that a single write() is not a foregone conclusion on every platform.
  const big = Buffer.alloc(3 * 1024 * 1024, "A");
  big.write("%PDF-1.7\n", 0);
  try {
    await storage.writePrivateObject("local", key, big, "application/pdf");
    const read = await storage.readPrivateObject("local", key);
    assert.equal(read.length, big.length);
    assert.equal(read.equals(big), true);
    assert.deepEqual(await storage.statPrivateObject("local", key), { byteSize: big.length });
    if (process.platform !== "win32") assert.equal(fs.statSync(storage.resolvePrivatePath(key)).mode & 0o077, 0);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
