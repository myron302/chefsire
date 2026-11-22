// Read-only PNG inspection. Never re-encodes or rewrites image bytes.
import zlib from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * Validate a PNG buffer. Returns { ok: true, width, height, bitDepth, colorType, interlace }
 * or { ok: false, reason }.
 */
export function inspectPng(buf) {
  if (buf.length < SIGNATURE.length + 12) return { ok: false, reason: "file too small to be a PNG" };
  if (!buf.subarray(0, 8).equals(SIGNATURE)) return { ok: false, reason: "missing PNG signature" };

  let offset = 8;
  let ihdr = null;
  let sawIend = false;
  const idat = [];
  let first = true;

  while (offset < buf.length) {
    if (sawIend) return { ok: false, reason: "unexpected data after IEND chunk" };
    if (offset + 12 > buf.length) return { ok: false, reason: "truncated chunk header" };
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("latin1", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (length > 0x7fffffff || end > buf.length) return { ok: false, reason: `truncated ${type} chunk` };
    const data = buf.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = buf.readUInt32BE(offset + 8 + length);
    if (crc32(buf.subarray(offset + 4, offset + 8 + length)) !== expectedCrc) {
      return { ok: false, reason: `CRC mismatch in ${type} chunk` };
    }
    if (first) {
      if (type !== "IHDR" || length !== 13) return { ok: false, reason: "first chunk is not a valid IHDR" };
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
      first = false;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      sawIend = true;
    }
    offset = end;
  }

  if (!ihdr) return { ok: false, reason: "no IHDR chunk" };
  if (!sawIend) return { ok: false, reason: "missing IEND chunk (truncated file)" };
  if (ihdr.width === 0 || ihdr.height === 0) return { ok: false, reason: "zero image dimension" };
  if (!(ihdr.colorType in CHANNELS)) return { ok: false, reason: `invalid colour type ${ihdr.colorType}` };
  if (idat.length === 0) return { ok: false, reason: "no IDAT image data" };

  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat));
  } catch (err) {
    return { ok: false, reason: `image data does not decompress (${err.code ?? err.message})` };
  }
  if (ihdr.interlace === 0) {
    const rowBytes = Math.ceil((ihdr.width * CHANNELS[ihdr.colorType] * ihdr.bitDepth) / 8);
    const expected = (rowBytes + 1) * ihdr.height;
    if (raw.length !== expected) {
      return { ok: false, reason: `decompressed image data is ${raw.length} bytes, expected ${expected}` };
    }
  }
  return { ok: true, ...ihdr };
}
