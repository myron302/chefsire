// Test fixtures only. Generated solid-colour PNGs are NOT ChefSire photographs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
export const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function chunk(type, data) {
  const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])));
  return Buffer.concat([head, data, crc]);
}

export function makePng(width = 12, height = 8, seed = 0) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  const raw = Buffer.concat(Array.from({ length: height }, (_, y) => { const r = Buffer.from(row); for (let i = 1; i < r.length; i++) r[i] = (seed * 37 + y * 11 + i) & 0xff; return r; }));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

export function tmpDir(prefix = "dpt-") { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

/** A throwaway data root with a small inventory. */
export function makeRoot(extra = {}) {
  const root = tmpDir("dpt-root-");
  const categories = [
    { id: "drinks-hub", title: "Main Drinks Hub", level: "hub", route: "/drinks", group: null, masterFilename: "drinks-hub-original.png" },
    { id: "tropical-smoothies", title: "Tropical Smoothies", level: "leaf", route: "/drinks/smoothies/tropical", group: "smoothies", masterFilename: "tropical-smoothies-original.png" },
    { id: "mocktails", title: "Mocktails", level: "leaf", route: "/drinks/potent-potables/mocktails", group: "potent-potables", masterFilename: "mocktails-original.png",
      aliases: [{ id: "virgin-cocktails", route: "/drinks/potent-potables/virgin-cocktails", masterFilename: "virgin-cocktails-original.png", kind: "redirect" }] },
    { id: "gin", title: "Gin", level: "leaf", route: "/drinks/potent-potables/gin", group: "potent-potables", masterFilename: "gin-original.png" },
  ];
  fs.writeFileSync(path.join(root, "categories.json"), JSON.stringify({ schemaVersion: 1, reconciliation: { status: "RECONCILED", expectedDestinationCount: 4 }, categories, ...extra }, null, 2));
  return root;
}

export function writeInput(files) {
  const dir = tmpDir("dpt-in-");
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name); fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, typeof content === "string" || Buffer.isBuffer(content) ? content : JSON.stringify(content));
  }
  return dir;
}

/** Minimal zip writer (stored or deflated entries). */
export function makeZip(entries, { deflate = true } = {}) {
  const locals = []; const central = []; let offset = 0;
  for (const [name, data] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name); const comp = deflate ? zlib.deflateRawSync(data) : data;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(deflate ? 8 : 0, 8);
    lh.writeUInt32LE(crc32(data), 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBuf.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(deflate ? 8 : 0, 10);
    ch.writeUInt32LE(crc32(data), 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, nameBuf, comp); central.push(ch, nameBuf); offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(central); const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(Object.keys(entries).length, 8); eocd.writeUInt16LE(Object.keys(entries).length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

/** Minimal ustar writer. */
export function makeTar(entries) {
  const blocks = [];
  for (const [name, data] of Object.entries(entries)) {
    const h = Buffer.alloc(512); h.write(name, 0); h.write("0000644\0", 100); h.write(data.length.toString(8).padStart(11, "0") + "\0", 124); h[156] = 48; h.write("ustar\0", 257);
    h.fill(0x20, 148, 156); let sum = 0; for (const b of h) sum += b; h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
    blocks.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  return Buffer.concat([...blocks, Buffer.alloc(1024)]);
}
