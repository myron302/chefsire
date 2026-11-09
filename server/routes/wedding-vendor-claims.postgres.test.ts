import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

// The test drives the import itself; keep the automatic boot import of the bundled file out of it.
process.env.WEDDING_VENDOR_IMPORT = "off";

if (!PG_URL) {
  test("Wedding vendor claims (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  test("open-data import, claim by business email, reports, and quote refusal for unclaimed listings", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: listingsRouter, ensureWeddingVendorListingsTable } = await import("./wedding-vendor-listings");
    const { default: claimsRouter, claimDelivery, maskEmail } = await import("./wedding-vendor-claims");
    const { default: quotesRouter, quoteDelivery } = await import("./wedding-vendor-quotes");
    const { importOpenVendors, normalizeWebsite } = await import("../lib/wedding-vendor-import");

    const app = express();
    app.use(express.json());
    app.use("/api/wedding", quotesRouter);
    app.use("/api/wedding", listingsRouter);
    app.use("/api/wedding", claimsRouter);
    const server = app.listen(0, "127.0.0.1");

    const mails: any[] = [];
    const originalClaimSend = claimDelivery.send;
    const originalQuoteSend = quoteDelivery.send;
    claimDelivery.send = async (p) => { mails.push(p); return undefined as any; };
    quoteDelivery.send = async () => { throw new Error("quotes must not be sent in this test"); };

    try {
      await local.query(`
        DROP TABLE IF EXISTS wedding_vendor_reports, wedding_vendor_claims, wedding_vendor_imports, wedding_vendor_quotes, wedding_vendor_listings, users CASCADE;
        ${ddl(schema.users, "users")};
      `);
      const ids: Record<string, string> = {};
      for (const name of ["owner", "stranger", "r1", "r2", "r3"]) {
        ids[name] = (await local.query(
          "INSERT INTO users (username, email, display_name, password, auth_version) VALUES ($1, $2, $1, 'fixture', 1) RETURNING id",
          [name, `${name}@example.test`],
        )).rows[0].id;
      }
      const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
      await ensureWeddingVendorListingsTable();

      // Import: website gets a scheme, rows are published and unclaimed.
      assert.equal(normalizeWebsite("www.blooms.example"), "https://www.blooms.example/");
      assert.equal(normalizeWebsite("not a url"), null);
      const release1 = {
        source: "overture",
        release: "r1",
        listings: [
          { source_id: "a", business_name: "Blooms Co", category: "Florist", city: "Hartford", state: "CT", website: "www.blooms.example", email: "Owner@Blooms.example", phone: "8605550100" },
          { source_id: "b", business_name: "Walk-in Cakes", category: "Bakery & Cakes", city: "Milford", state: "CT", phone: "2035550101" },
          { source_id: "c", business_name: "Closing Soon DJ", category: "DJ", city: "Bristol", state: "CT" },
          { source_id: "s", business_name: "Stale Claim Venue", category: "Venue", city: "Avon", state: "CT", email: "venue@example.test" },
        ],
      };
      assert.deepEqual(await importOpenVendors(release1), { imported: true, rows: 4, retired: 0 });
      assert.equal((await importOpenVendors(release1)).imported, false, "a release is imported once");

      const dir = await call("GET", "/api/wedding/vendor-listings/public");
      assert.equal(dir.status, 200);
      const byName = Object.fromEntries(dir.json.listings.map((l: any) => [l.businessName, l]));
      assert.equal(byName["Blooms Co"].unclaimed, true);
      assert.equal(byName["Blooms Co"].phone, "8605550100");
      assert.equal(byName["Blooms Co"].website, "https://www.blooms.example/");
      for (const l of dir.json.listings) assert.equal("email" in l, false, "email is never public");
      const bloomsId = Number(byName["Blooms Co"].id);
      const cakesId = Number(byName["Walk-in Cakes"].id);
      const djId = Number(byName["Closing Soon DJ"].id);
      const staleId = Number(byName["Stale Claim Venue"].id);

      // Unclaimed listings do not take quote requests.
      const quote = await call("POST", "/api/wedding/vendor-quotes", "stranger", { vendorId: bloomsId, contactEmail: "c@example.test" });
      assert.equal(quote.status, 409);
      assert.equal(quote.json.unclaimed, true);

      // Claim needs sign-in; with an email on file, the link goes ONLY to that address.
      assert.equal((await call("POST", `/api/wedding/vendor-listings/${bloomsId}/claim`, "anon")).status, 401);
      const claim = await call("POST", `/api/wedding/vendor-listings/${bloomsId}/claim`, "owner");
      assert.equal(claim.status, 200, claim.text);
      assert.equal(claim.json.method, "email");
      assert.equal(claim.json.sentTo, maskEmail("owner@blooms.example"));
      assert.equal(mails.length, 1);
      assert.equal(mails[0].to, "owner@blooms.example");
      const token = new URL(mails[0].verifyUrl).searchParams.get("token")!;
      assert.ok(token && token.length > 30);

      // Another account cannot use the link; a bad token is refused.
      assert.equal((await call("POST", "/api/wedding/vendor-listings/claims/verify", "stranger", { token })).status, 403);
      assert.equal((await call("POST", "/api/wedding/vendor-listings/claims/verify", "owner", { token: "nope" })).status, 404);

      const verified = await call("POST", "/api/wedding/vendor-listings/claims/verify", "owner", { token });
      assert.equal(verified.status, 200, verified.text);
      assert.equal(verified.json.listing.businessName, "Blooms Co");
      assert.equal((await call("POST", "/api/wedding/vendor-listings/claims/verify", "owner", { token })).status, 409, "single use");
      assert.equal((await local.query("SELECT user_id FROM wedding_vendor_listings WHERE id = $1", [bloomsId])).rows[0].user_id, ids.owner);

      // Claimed: no longer unclaimed, phone no longer public, cannot be claimed again.
      const after = await call("GET", "/api/wedding/vendor-listings/public");
      const blooms = after.json.listings.find((l: any) => Number(l.id) === bloomsId);
      assert.equal(blooms.unclaimed, false);
      assert.equal("phone" in blooms, false);
      assert.equal((await call("POST", `/api/wedding/vendor-listings/${bloomsId}/claim`, "stranger")).status, 409);

      // A claim started while published can't complete after the listing is hidden.
      assert.equal((await call("POST", `/api/wedding/vendor-listings/${staleId}/claim`, "stranger")).json.method, "email");
      const staleToken = new URL(mails.at(-1).verifyUrl).searchParams.get("token")!;
      await local.query("UPDATE wedding_vendor_listings SET status = 'hidden' WHERE id = $1", [staleId]);
      assert.equal((await call("POST", "/api/wedding/vendor-listings/claims/verify", "stranger", { token: staleToken })).status, 409);
      assert.equal((await local.query("SELECT user_id FROM wedding_vendor_listings WHERE id = $1", [staleId])).rows[0].user_id, null);
      const mailsBeforeReview = mails.length;

      // No email on file: the claim waits for review and nothing is mailed.
      const review = await call("POST", `/api/wedding/vendor-listings/${cakesId}/claim`, "stranger");
      assert.equal(review.json.method, "review");
      assert.equal(mails.length, mailsBeforeReview);

      // Reports: duplicates from one user count once; three different users hide an unclaimed listing.
      assert.equal((await call("POST", `/api/wedding/vendor-listings/${djId}/report`, "r1", { reason: "bogus" })).status, 400);
      for (const who of ["r1", "r1", "r2"]) {
        const r = await call("POST", `/api/wedding/vendor-listings/${djId}/report`, who, { reason: "closed" });
        assert.equal(r.json.hidden, false);
      }
      assert.equal((await call("POST", `/api/wedding/vendor-listings/${djId}/report`, "r3", { reason: "closed" })).json.hidden, true);
      const hiddenDir = await call("GET", "/api/wedding/vendor-listings/public");
      assert.equal(hiddenDir.json.listings.some((l: any) => Number(l.id) === djId), false);

      // An older or same release is ignored.
      assert.equal((await importOpenVendors({ ...release1, release: "r0" })).imported, false);

      // A much smaller file (looks broken) imports but retires nothing.
      const tiny = await importOpenVendors({ source: "overture", release: "r2", listings: [{ source_id: "a", business_name: "Blooms Co RENAMED", city: "Hartford", state: "CT" }] });
      assert.deepEqual(tiny, { imported: true, rows: 1, retired: 0 });
      assert.equal((await local.query("SELECT status FROM wedding_vendor_listings WHERE source_id = 'b'")).rows[0].status, "published");

      // Normal re-import: claimed listings are not overwritten, hidden listings stay hidden,
      // and an unclaimed listing missing from the new release is retired.
      const release3 = {
        source: "overture",
        release: "r3",
        listings: [
          { source_id: "a", business_name: "Blooms Co RENAMED", city: "Hartford", state: "CT" },
          { source_id: "c", business_name: "Closing Soon DJ", city: "Bristol", state: "CT" },
          { source_id: "d", business_name: "New Florist D", city: "Avon", state: "CT" },
          { source_id: "e", business_name: "New Florist E", city: "Avon", state: "CT" },
          { source_id: "s", business_name: "Stale Claim Venue", city: "Avon", state: "CT" },
        ],
      };
      const third = await importOpenVendors(release3);
      assert.equal(third.imported, true);
      assert.equal(third.retired, 1);
      const rows = (await local.query("SELECT source_id, business_name, status FROM wedding_vendor_listings ORDER BY source_id")).rows;
      assert.deepEqual(rows.map((r: any) => [r.source_id, r.business_name, r.status]), [
        ["a", "Blooms Co", "published"],
        ["b", "Walk-in Cakes", "retired"],
        ["c", "Closing Soon DJ", "hidden"],
        ["d", "New Florist D", "published"],
        ["e", "New Florist E", "published"],
        ["s", "Stale Claim Venue", "hidden"],
      ]);

      // Race: a newer and an older release imported at the same moment (two app instances, separate connections).
      // Without per-source serialization the older one reads the same "latest release", waits on the newer one's row
      // locks, then overwrites it. The directory must end on the newer release.
      const vendors = (tag: string) =>
        ["a", "c", "d", "e", "s"].map((id) => ({ source_id: id, business_name: `${tag} ${id}`, city: "Avon", state: "CT" }));
      const newer = importOpenVendors({ source: "overture", release: "r5", listings: vendors("V5") });
      const older = importOpenVendors({ source: "overture", release: "r4", listings: vendors("V4") });
      const [newerResult, olderResult] = await Promise.all([newer, older]);
      assert.equal(newerResult.imported, true);
      const unclaimedNames = (await local.query(
        "SELECT source_id, business_name, source_release FROM wedding_vendor_listings WHERE user_id IS NULL AND source_id IN ('d','e') ORDER BY source_id",
      )).rows;
      assert.deepEqual(unclaimedNames.map((r: any) => [r.business_name, r.source_release]), [["V5 d", "r5"], ["V5 e", "r5"]]);
      const latestMarker = (await local.query(
        "SELECT release FROM wedding_vendor_imports WHERE finished_at IS NOT NULL ORDER BY finished_at DESC, release DESC LIMIT 1",
      )).rows[0].release;
      assert.equal(latestMarker, "r5", `older release must not finish after the newer one (older result: ${JSON.stringify(olderResult)})`);
      // Claimed listing untouched throughout.
      assert.equal((await local.query("SELECT business_name FROM wedding_vendor_listings WHERE source_id = 'a'")).rows[0].business_name, "Blooms Co");
    } finally {
      claimDelivery.send = originalClaimSend;
      quoteDelivery.send = originalQuoteSend;
      server.close();
      await local.query("DROP TABLE IF EXISTS wedding_vendor_reports, wedding_vendor_claims, wedding_vendor_imports, wedding_vendor_quotes, wedding_vendor_listings, users CASCADE").catch(() => {});
      await local.end();
    }
  });
}
