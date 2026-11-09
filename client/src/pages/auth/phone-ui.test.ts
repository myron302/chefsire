import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("login, signup and settings offer phone sign-in consistently with the server's rule", () => {
  assert.match(read("./login.tsx"), /Email, Username or Phone \*/);
  const signup = read("./signup.tsx");
  assert.match(signup, /import \{ normalizePhone \} from "@shared\/phone"/);
  assert.match(signup, /!phone\.trim\(\) \|\| normalizePhone\(phone\) !== null/);
  const settings = read("../settings.tsx");
  assert.match(settings, /id="phone"/);
  // Saving other profile fields never sends (and so never clears) the phone.
  assert.match(settings, /profile\.phone\.trim\(\) !== \(user\.phone \|\| ""\) \? \{ phone: profile\.phone\.trim\(\) \} : \{\}/);
});
