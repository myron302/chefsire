import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "../../shared/schema";
import { serializeAuthenticatedUser } from "./authenticated-user";

const baseUser = { id: "user-1", email: "user@example.com", username: "user" } as User;

test("ordinary users receive every catering key without exposing secrets", () => {
  const serialized = serializeAuthenticatedUser({
    ...baseUser,
    password: "password-hash",
    specialty: undefined,
    cateringEnabled: undefined,
    cateringLocation: undefined,
    cateringLatitude: undefined,
    cateringLongitude: undefined,
    cateringRadius: undefined,
    cateringBio: undefined,
    cateringAvailable: undefined,
  } as User);

  assert.deepEqual(
    {
      specialty: serialized.specialty,
      cateringEnabled: serialized.cateringEnabled,
      cateringLocation: serialized.cateringLocation,
      cateringLatitude: serialized.cateringLatitude,
      cateringLongitude: serialized.cateringLongitude,
      cateringRadius: serialized.cateringRadius,
      cateringBio: serialized.cateringBio,
      cateringAvailable: serialized.cateringAvailable,
    },
    {
      specialty: null,
      cateringEnabled: false,
      cateringLocation: null,
      cateringLatitude: null,
      cateringLongitude: null,
      cateringRadius: null,
      cateringBio: null,
      cateringAvailable: false,
    },
  );
  assert.equal("password" in serialized, false);
  assert.equal("resetToken" in serialized, false);
});

test("provider values, including false and a custom radius, are preserved", () => {
  const serialized = serializeAuthenticatedUser({
    ...baseUser,
    specialty: "Pastry",
    cateringEnabled: false,
    cateringLocation: "Boston, MA",
    cateringLatitude: "42.3601000",
    cateringLongitude: "-71.0589000",
    cateringRadius: 47,
    cateringBio: "Wedding desserts and pastries",
    cateringAvailable: false,
  } as User);

  assert.equal(serialized.specialty, "Pastry");
  assert.equal(serialized.cateringEnabled, false);
  assert.equal(serialized.cateringAvailable, false);
  assert.equal(serialized.cateringRadius, 47);
  assert.equal(serialized.cateringBio, "Wedding desserts and pastries");
});
