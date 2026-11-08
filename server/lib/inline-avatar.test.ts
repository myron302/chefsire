import test from "node:test";
import assert from "node:assert/strict";
import {
  INLINE_AVATAR_MAX_BASE64_CHARS,
  decodeInlineImage,
  inlineAvatarVersion,
  isInlineImageDataUri,
  publicAvatarValue,
} from "./inline-avatar";
import { serializePublicUser } from "../serializers/public-user";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_BYTES = Buffer.concat([PNG_SIGNATURE, Buffer.from("0000000d49484452", "hex")]);
const PNG_URI = `data:image/png;base64,${PNG_BYTES.toString("base64")}`;

test("inline raster data URIs are detected; URLs and SVG are not", () => {
  assert.equal(isInlineImageDataUri(PNG_URI), true);
  assert.equal(isInlineImageDataUri("data:image/jpeg;base64,/9j/4AAQ"), true);
  assert.equal(isInlineImageDataUri("https://cdn.example.com/a.webp"), false);
  assert.equal(isInlineImageDataUri("/uploads/a.jpg"), false);
  assert.equal(isInlineImageDataUri("data:image/svg+xml;base64,PHN2Zz4="), false);
  assert.equal(isInlineImageDataUri(null), false);
});

test("public avatar value replaces inline raster data with a short versioned URL", () => {
  const value = publicAvatarValue("user-1", PNG_URI);
  assert.equal(value, `/api/users/user-1/avatar?v=${inlineAvatarVersion(PNG_URI)}`);
  assert.ok(value!.length < 80);
  assert.equal(publicAvatarValue("user-1", "https://cdn.example.com/a.webp"), "https://cdn.example.com/a.webp");
  assert.equal(publicAvatarValue("user-1", null), null);
});

test("non-raster data: avatars (SVG, unknown types) are withheld from public responses", () => {
  assert.equal(publicAvatarValue("u", "data:image/svg+xml;base64,PHN2Zz4="), null);
  assert.equal(publicAvatarValue("u", "data:text/html;base64,PGgxPg=="), null);
  assert.equal(publicAvatarValue("u", " DATA:image/svg+xml,<svg/>"), null);
});

test("version reflects the entire value: equal length and equal suffix but different bytes differ", () => {
  // Same total length, identical last 32+ characters, different near the beginning.
  const tail = Buffer.alloc(48, 7);
  const a = Buffer.concat([PNG_SIGNATURE, Buffer.from([1, 1, 1, 1]), tail]);
  const b = Buffer.concat([PNG_SIGNATURE, Buffer.from([2, 2, 2, 2]), tail]);
  const uriA = `data:image/png;base64,${a.toString("base64")}`;
  const uriB = `data:image/png;base64,${b.toString("base64")}`;
  assert.equal(uriA.length, uriB.length);
  assert.equal(uriA.slice(-32), uriB.slice(-32));
  assert.notEqual(inlineAvatarVersion(uriA), inlineAvatarVersion(uriB));
  assert.notEqual(publicAvatarValue("same-user", uriA), publicAvatarValue("same-user", uriB));
  assert.equal(inlineAvatarVersion(uriA), inlineAvatarVersion(uriA));
});

test("decoding returns the original bytes for a valid raster image", () => {
  const decoded = decodeInlineImage(PNG_URI);
  assert.ok(decoded);
  assert.equal(decoded.contentType, "image/png");
  assert.deepEqual(decoded.body, PNG_BYTES);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
  assert.equal(decodeInlineImage(`data:image/jpg;base64,${jpeg.toString("base64")}`)?.contentType, "image/jpeg");
});

test("decoding refuses SVG, empty, mismatched signatures and oversized values", () => {
  assert.equal(decodeInlineImage("data:image/svg+xml;base64,PHN2Zz4="), null);
  assert.equal(decodeInlineImage("data:image/png;base64,"), null);
  // Declared PNG but the bytes are HTML.
  assert.equal(decodeInlineImage(`data:image/png;base64,${Buffer.from("<html>hi</html>").toString("base64")}`), null);
  const oversized = `data:image/png;base64,${"A".repeat(INLINE_AVATAR_MAX_BASE64_CHARS + 4)}`;
  assert.equal(decodeInlineImage(oversized), null);
});

test("public user projection no longer embeds base64 avatars", () => {
  const user = { id: "abc", username: "chef", avatar: PNG_URI } as any;
  const projected = serializePublicUser(user);
  assert.ok(!String(projected.avatar).startsWith("data:"));
  assert.ok(String(projected.avatar).startsWith("/api/users/abc/avatar?v="));
  assert.equal(serializePublicUser({ id: "abc", avatar: "data:image/svg+xml;base64,PHN2Zz4=" } as any).avatar, null);
  const urlUser = { id: "abc", username: "chef", avatar: "https://cdn.example.com/a.webp" } as any;
  assert.equal(serializePublicUser(urlUser).avatar, "https://cdn.example.com/a.webp");
});
