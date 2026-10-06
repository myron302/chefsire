import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  assertSecretBoxConfigured,
  decryptSecret,
  encryptSecret,
  isSecretBoxConfigured,
  SECRET_BOX_KEY_ENV,
  SECRET_BOX_PREVIOUS_KEY_ENV,
  sealedSecretNeedsRotation,
  SecretBoxError,
} from "./secret-box";

const newKey = () => randomBytes(32).toString("base64");
const AAD = "payment_methods:row-1:square_access_token";

function withKeys<T>(current: string | undefined, previous: string | undefined, fn: () => T): T {
  const before = { current: process.env[SECRET_BOX_KEY_ENV], previous: process.env[SECRET_BOX_PREVIOUS_KEY_ENV] };
  const restore = (name: string, value: string | undefined) => { if (value === undefined) delete process.env[name]; else process.env[name] = value; };
  restore(SECRET_BOX_KEY_ENV, current);
  restore(SECRET_BOX_PREVIOUS_KEY_ENV, previous);
  try {
    return fn();
  } finally {
    restore(SECRET_BOX_KEY_ENV, before.current);
    restore(SECRET_BOX_PREVIOUS_KEY_ENV, before.previous);
  }
}

test("a sealed value opens to exactly what was sealed, and the format is versioned", () => {
  withKeys(newKey(), undefined, () => {
    const sealed = encryptSecret("sentinel-access-token-value", AAD);
    assert.match(sealed, /^sqenc:v1:[0-9a-f]{8}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    assert.equal(decryptSecret(sealed, AAD), "sentinel-access-token-value");
    assert.equal(sealed.includes("sentinel-access-token-value"), false);
  });
});

test("every seal uses a fresh random nonce, so the same secret never produces the same ciphertext", () => {
  withKeys(newKey(), undefined, () => {
    const sealed = new Set(Array.from({ length: 200 }, () => encryptSecret("same-token", AAD)));
    assert.equal(sealed.size, 200);
    const nonces = new Set([...sealed].map((value) => value.split(":")[3]));
    assert.equal(nonces.size, 200);
  });
});

test("tampering with ANY part of a sealed value is rejected, never decrypted to something else", () => {
  withKeys(newKey(), undefined, () => {
    const sealed = encryptSecret("token-value", AAD);
    const parts = sealed.split(":");
    // iv, ciphertext and tag: flip one character of each.
    for (const index of [3, 4, 5]) {
      const altered = [...parts];
      altered[index] = (altered[index][0] === "A" ? "B" : "A") + altered[index].slice(1);
      assert.throws(() => decryptSecret(altered.join(":"), AAD), (error: unknown) => error instanceof SecretBoxError && error.code === "CIPHERTEXT_INVALID");
    }
    for (const malformed of ["", "plain-token", "sqenc:v1", "sqenc:v2:aaaaaaaa:a:b:c", `${sealed}:extra`, parts.slice(0, 5).join(":"), "sqenc:v1:aaaaaaaa:!!:!!:!!"]) {
      assert.throws(() => decryptSecret(malformed, AAD), (error: unknown) => error instanceof SecretBoxError && error.code === "CIPHERTEXT_INVALID");
    }
  });
});

test("a ciphertext is bound to its row and column through its associated data", () => {
  withKeys(newKey(), undefined, () => {
    const sealed = encryptSecret("token-value", AAD);
    assert.throws(() => decryptSecret(sealed, "payment_methods:row-2:square_access_token"), SecretBoxError);
    assert.throws(() => decryptSecret(sealed, "payment_methods:row-1:square_refresh_token"), SecretBoxError);
  });
});

test("a different key cannot open a sealed value, and the failure reveals nothing", () => {
  const sealed = withKeys(newKey(), undefined, () => encryptSecret("sentinel-secret-xyz", AAD));
  withKeys(newKey(), undefined, () => {
    assert.throws(() => decryptSecret(sealed, AAD), (error: unknown) => {
      assert.ok(error instanceof SecretBoxError);
      assert.equal(error.message.includes("sentinel-secret-xyz"), false);
      assert.equal(error.message.includes(sealed), false);
      return true;
    });
  });
});

test("rotation: a value sealed under the previous key still opens, and is reported as due to be re-sealed", () => {
  const oldKey = newKey();
  const sealed = withKeys(oldKey, undefined, () => encryptSecret("rotating-token", AAD));
  withKeys(newKey(), oldKey, () => {
    assert.equal(decryptSecret(sealed, AAD), "rotating-token");
    assert.equal(sealedSecretNeedsRotation(sealed), true);
    assert.equal(sealedSecretNeedsRotation(encryptSecret("rotating-token", AAD)), false);
  });
  withKeys(newKey(), undefined, () => assert.throws(() => decryptSecret(sealed, AAD), SecretBoxError));
});

test("a missing key fails closed: nothing is sealed and nothing falls back to plaintext", () => {
  withKeys(undefined, undefined, () => {
    assert.equal(isSecretBoxConfigured(), false);
    assert.throws(() => encryptSecret("token", AAD), (error: unknown) => error instanceof SecretBoxError && error.code === "KEY_MISSING");
    assert.throws(() => assertSecretBoxConfigured(), SecretBoxError);
  });
  withKeys("   ", undefined, () => assert.equal(isSecretBoxConfigured(), false));
});

test("a malformed key is refused with an explicit length and encoding rule", () => {
  const invalid = [
    "short",
    randomBytes(16).toString("base64"), // 16 bytes
    randomBytes(48).toString("base64"), // 48 bytes
    randomBytes(32).toString("hex"), // hex, 64 chars
    `${randomBytes(32).toString("base64")}=`, // too long
    `!${randomBytes(32).toString("base64url").slice(1)}`,
    Buffer.alloc(32, 7).toString("base64"), // constant bytes
    Buffer.alloc(32, 0).toString("base64"),
  ];
  for (const value of invalid) {
    withKeys(value, undefined, () => {
      assert.equal(isSecretBoxConfigured(), false, value);
      assert.throws(() => encryptSecret("token", AAD), (error: unknown) => error instanceof SecretBoxError && error.code === "KEY_INVALID");
    });
  }
  // Both standard base64 (padded) and base64url (unpadded) renderings of 32 bytes are accepted.
  const bytes = randomBytes(32);
  for (const value of [bytes.toString("base64"), bytes.toString("base64url")]) {
    withKeys(value, undefined, () => assert.equal(decryptSecret(encryptSecret("t", AAD), AAD), "t"));
  }
});

test("an invalid PREVIOUS key is a configuration error, not silently ignored", () => {
  withKeys(newKey(), "not-a-key", () => assert.equal(isSecretBoxConfigured(), false));
});

test("empty secrets are refused", () => {
  withKeys(newKey(), undefined, () => assert.throws(() => encryptSecret("", AAD), (error: unknown) => error instanceof SecretBoxError && error.code === "PLAINTEXT_INVALID"));
});
