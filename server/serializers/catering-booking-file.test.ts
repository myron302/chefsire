import assert from "node:assert/strict";
import test from "node:test";
import { serializeBookingFile, type SerializableBookingFile } from "./catering-booking-file";

const NAMES = new Map([["provider", "Chef Ada"], ["customer", "Sam Rivera"]]);
const base: SerializableBookingFile = {
  id: "file-1", visibility: "shared", originalFilename: "menu.pdf", contentType: "application/pdf", byteSize: 2048,
  uploadedBy: "provider", createdAt: new Date("2026-09-01T12:00:00.000Z"), deletedAt: null,
};
const context = (over: Partial<Parameters<typeof serializeBookingFile>[1]> = {}) => ({ providerId: "provider", customerId: "customer", actorId: "provider", status: "confirmed" as const, names: NAMES, ...over });

test("a serialized file never carries a storage key, a storage provider, or any URL", () => {
  const view = serializeBookingFile({ ...base }, context());
  const keys = Object.keys(view);
  for (const forbidden of ["storageKey", "storage_key", "storageProvider", "url", "downloadUrl", "signedUrl", "publicUrl", "sha256", "path"]) {
    assert.equal(keys.includes(forbidden), false, forbidden);
  }
  // Nothing in the serialized payload resembles an address either.
  assert.equal(JSON.stringify(view).includes("catering-bookings/"), false);
  assert.equal(JSON.stringify(view).includes("http"), false);
});
test("a serialized file carries only display metadata the actor is entitled to", () => {
  assert.deepEqual(serializeBookingFile({ ...base }, context()), {
    id: "file-1", visibility: "shared", filename: "menu.pdf", contentType: "application/pdf", byteSize: 2048,
    uploadedBy: "provider", uploadedByRole: "provider", uploaderName: "Chef Ada",
    createdAt: "2026-09-01T12:00:00.000Z", mine: true, mayDelete: true,
  });
});
test("the uploader role derives from the persisted booking, never from the file row", () => {
  assert.equal(serializeBookingFile({ ...base, uploadedBy: "customer" }, context()).uploadedByRole, "customer");
  // The same file serialized for the other actor is not "mine" and is not deletable by them.
  const forCustomer = serializeBookingFile({ ...base }, context({ actorId: "customer" }));
  assert.equal(forCustomer.mine, false);
  assert.equal(forCustomer.mayDelete, false);
});
test("delete affordance follows the uploader rule and closes on a terminal booking", () => {
  assert.equal(serializeBookingFile({ ...base }, context({ status: "pending_confirmation" })).mayDelete, true);
  for (const status of ["cancelled", "completed"] as const) {
    assert.equal(serializeBookingFile({ ...base }, context({ status })).mayDelete, false, status);
  }
});
test("an uploader with no display name serializes as null rather than leaking an identifier as a name", () => {
  assert.equal(serializeBookingFile({ ...base }, context({ names: new Map() })).uploaderName, null);
});
test("byte size is serialized as a number even when the driver returns a bigint-backed string", () => {
  const view = serializeBookingFile({ ...base, byteSize: "4096" as unknown as number }, context());
  assert.equal(view.byteSize, 4096);
  assert.equal(typeof view.byteSize, "number");
});
