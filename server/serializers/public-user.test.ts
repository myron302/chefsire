import assert from "node:assert/strict";
import test from "node:test";
import { serializePublicUser } from "./public-user";

test("public user responses exclude authentication and catering location fields", () => {
  const serialized = serializePublicUser({
    id: "user", username: "chef", displayName: "Chef", royalTitle: null, avatar: null,
    bio: "Public social bio", specialty: "Italian", isChef: true, isPrivate: false,
    followersCount: 1, followingCount: 2, postsCount: 3, email: "private@example.com",
    password: "hash", cateringLocation: "41.7,-72.6", cateringLatitude: "41.7",
    cateringLongitude: "-72.6",
  } as Parameters<typeof serializePublicUser>[0]);

  assert.equal("email" in serialized, false);
  assert.equal("password" in serialized, false);
  assert.equal("cateringLocation" in serialized, false);
  assert.equal("cateringLatitude" in serialized, false);
  assert.equal("cateringLongitude" in serialized, false);
});

