import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeInlineImage,
  inlineAvatarVersion,
  isInlineImageDataUri,
  publicAvatarValue,
} from "./inline-avatar";
import { serializePublicUser } from "../serializers/public-user";

const PNG_BYTES = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const PNG_URI = `data:image/png;base64,${PNG_BYTES.toString("base64")}`;

test("inline raster data URIs are detected; URLs and SVG are not", () => {
  assert.equal(isInlineImageDataUri(PNG_URI), true);
  assert.equal(isInlineImageDataUri("data:image/jpeg;base64,/9j/4AAQ"), true);
  assert.equal(isInlineImageDataUri("https://cdn.example.com/a.webp"), false);
  assert.equal(isInlineImageDataUri("/uploads/a.jpg"), false);
  assert.equal(isInlineImageDataUri("data:image/svg+xml;base64,PHN2Zz4="), false);
  assert.equal(isInlineImageDataUri(null), false);
});

test("public avatar value replaces inline data with a short versioned URL", () => {
  const value = publicAvatarValue("user-1", PNG_URI);
  assert.equal(value, `/api/users/user-1/avatar?v=${inlineAvatarVersion("user-1", PNG_URI)}`);
  assert.ok(value!.length < 80);
  assert.equal(publicAvatarValue("user-1", "https://cdn.example.com/a.webp"), "https://cdn.example.com/a.webp");
  assert.equal(publicAvatarValue("user-1", null), null);
});

test("version changes when the stored avatar changes", () => {
  const other = `data:image/png;base64,${Buffer.from("different-bytes").toString("base64")}`;
  assert.notEqual(inlineAvatarVersion("u", PNG_URI), inlineAvatarVersion("u", other));
  assert.equal(inlineAvatarVersion("u", PNG_URI), inlineAvatarVersion("u", PNG_URI));
});

test("decoding returns the original bytes and a safe content type", () => {
  const decoded = decodeInlineImage(PNG_URI);
  assert.ok(decoded);
  assert.equal(decoded.contentType, "image/png");
  assert.deepEqual(decoded.body, PNG_BYTES);
  assert.equal(decodeInlineImage("data:image/jpg;base64,AAAA")?.contentType, "image/jpeg");
  assert.equal(decodeInlineImage("data:image/svg+xml;base64,PHN2Zz4="), null);
  assert.equal(decodeInlineImage("data:image/png;base64,"), null);
});

test("public user projection no longer embeds base64 avatars", () => {
  const user = { id: "abc", username: "chef", avatar: PNG_URI } as any;
  const projected = serializePublicUser(user);
  assert.ok(!String(projected.avatar).startsWith("data:"));
  assert.ok(String(projected.avatar).startsWith("/api/users/abc/avatar?v="));
  const urlUser = { id: "abc", username: "chef", avatar: "https://cdn.example.com/a.webp" } as any;
  assert.equal(serializePublicUser(urlUser).avatar, "https://cdn.example.com/a.webp");
});
