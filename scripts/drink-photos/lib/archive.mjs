// Dependency-free extraction of .zip / .tar / .tar.gz / .tgz archives into a directory.
// Only regular files are extracted, flattened to their base names; anything unsafe is reported, not extracted.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const MAX_ENTRY_BYTES = 200 * 1024 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

export function isArchive(file) {
  return /\.(zip|tar|tar\.gz|tgz)$/i.test(file);
}

function safeBaseName(entryName) {
  const normalized = entryName.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.includes("..")) return { unsafe: true };
  const base = parts[parts.length - 1];
  if (base.startsWith(".") || parts.includes("__MACOSX")) return null; // OS metadata noise
  return { name: base };
}

class Extractor {
  constructor(destDir) {
    this.destDir = destDir;
    this.totalBytes = 0;
    this.extracted = [];
    this.problems = [];
    this.seen = new Set();
  }
  add(entryName, getData, size) {
    const base = safeBaseName(entryName);
    if (base === null) return;
    if (base.unsafe) return void this.problems.push({ entry: entryName, reason: "unsafe path in archive (path traversal)" });
    if (this.seen.has(base.name)) {
      // Ambiguous: neither copy may be trusted, so drop the one already extracted.
      fs.rmSync(path.join(this.destDir, base.name), { force: true });
      this.extracted = this.extracted.filter((n) => n !== base.name);
      return void this.problems.push({ entry: entryName, reason: `duplicate file name "${base.name}" in archive` });
    }
    if (size > MAX_ENTRY_BYTES || this.totalBytes + size > MAX_TOTAL_BYTES) {
      return void this.problems.push({ entry: entryName, reason: "archive entry exceeds size limit" });
    }
    let data;
    try {
      data = getData();
    } catch (err) {
      return void this.problems.push({ entry: entryName, reason: `cannot read archive entry (${err.message})` });
    }
    this.seen.add(base.name);
    this.totalBytes += data.length;
    fs.writeFileSync(path.join(this.destDir, base.name), data, { flag: "wx" });
    this.extracted.push(base.name);
  }
}

function extractZip(buf, ex) {
  // Locate end-of-central-directory record.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a valid zip archive (no end-of-central-directory record)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("corrupt zip central directory");
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const externalAttrs = buf.readUInt32LE(p + 38);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue; // directory
    const unixMode = externalAttrs >>> 16;
    if ((unixMode & 0o170000) === 0o120000) {
      ex.problems.push({ entry: name, reason: "symbolic link in archive (not extracted)" });
      continue;
    }
    if (flags & 1) { ex.problems.push({ entry: name, reason: "encrypted zip entry" }); continue; }
    ex.add(name, () => {
      if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("bad local header");
      const dataStart = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
      const comp = buf.subarray(dataStart, dataStart + compSize);
      if (method === 0) return Buffer.from(comp);
      if (method === 8) return zlib.inflateRawSync(comp);
      throw new Error(`unsupported compression method ${method}`);
    }, size);
  }
}

function extractTar(buf, ex) {
  let p = 0;
  while (p + 512 <= buf.length) {
    const header = buf.subarray(p, p + 512);
    if (header.every((b) => b === 0)) break;
    const name = header.toString("utf8", 0, 100).replace(/\0.*$/, "");
    const prefix = header.toString("utf8", 345, 500).replace(/\0.*$/, "");
    const size = parseInt(header.toString("latin1", 124, 136).replace(/\0.*$/, "").trim() || "0", 8);
    const type = String.fromCharCode(header[156] || 48);
    p += 512;
    const full = prefix ? `${prefix}/${name}` : name;
    if (type === "0") ex.add(full, () => Buffer.from(buf.subarray(p, p + size)), size);
    else if (type === "2" || type === "1") ex.problems.push({ entry: full, reason: "link in archive (not extracted)" });
    p += Math.ceil(size / 512) * 512;
  }
}

/** Extract an archive into destDir (must exist and be empty). Returns { files, problems }. */
export function extractArchive(archivePath, destDir) {
  const raw = fs.readFileSync(archivePath);
  const ex = new Extractor(destDir);
  const lower = archivePath.toLowerCase();
  if (lower.endsWith(".zip")) extractZip(raw, ex);
  else if (lower.endsWith(".tar")) extractTar(raw, ex);
  else extractTar(zlib.gunzipSync(raw), ex);
  return { files: ex.extracted, problems: ex.problems };
}
