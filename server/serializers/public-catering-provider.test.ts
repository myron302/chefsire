import assert from "node:assert/strict";
import test from "node:test";
import { serializePublicCateringProvider } from "./public-catering-provider";

test("public catering serialization allowlists marketplace fields", () => {
  const serialized = serializePublicCateringProvider({
    id: "provider-1",
    username: "chef",
    displayName: "Chef Example",
    avatar: null,
    specialty: "Seasonal menus",
    cateringBio: "Locally sourced event catering.",
    cateringLocation: "Boston, MA",
    cateringRadius: 25,
    cateringAvailable: true,
    cateringEnabled: true,
    distance: 4.25,
    email: "private@example.com",
    password: "hash",
  } as Parameters<typeof serializePublicCateringProvider>[0] & { email: string; password: string });

  assert.deepEqual(Object.keys(serialized).sort(), [
    "avatar", "cateringAvailable", "cateringBio", "cateringEnabled", "cateringLocation",
    "cateringRadius", "displayName", "distance", "id", "specialty",
  ]);
  assert.equal("email" in serialized, false);
  assert.equal("password" in serialized, false);
});

test("public catering serialization uses professional persisted defaults", () => {
  const serialized = serializePublicCateringProvider({
    id: "provider-2", username: "chef_name", displayName: null, avatar: null,
    specialty: null, cateringBio: null, cateringLocation: null, cateringRadius: null,
    cateringAvailable: null, cateringEnabled: null,
  });
  assert.equal(serialized.displayName, "chef_name");
  assert.equal(serialized.cateringAvailable, false);
  assert.equal(serialized.cateringEnabled, false);
});
