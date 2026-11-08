import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

if (!PG_URL) {
  test("Wedding vendor quotes (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  test("quotes only reach published vendors, and delivery is reported honestly", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: quotesRouter, quoteDelivery } = await import("./wedding-vendor-quotes");
    const { default: listingsRouter } = await import("./wedding-vendor-listings");
    const app = express();
    app.use(express.json());
    app.use("/api/wedding", quotesRouter);
    app.use("/api/wedding", listingsRouter);
    const server = app.listen(0, "127.0.0.1");
    const sent: any[] = [];
    const originalSend = quoteDelivery.send;
    let failDelivery = false;
    quoteDelivery.send = async (params) => {
      if (failDelivery) throw new Error("smtp down");
      sent.push(params);
      return undefined as any;
    };
    try {
      await local.query(`
        DROP TABLE IF EXISTS wedding_vendor_quotes, wedding_vendor_listings, users CASCADE;
        ${ddl(schema.users, "users")};
      `);
      const couple = (await local.query(
        "INSERT INTO users (username, email, display_name, password, auth_version) VALUES ('couple','couple@example.test','couple','fixture',1) RETURNING id",
      )).rows[0].id;
      const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, () => couple);

      // Creates the listings table through the route's own DDL.
      assert.equal((await call("GET", "/api/wedding/vendor-listings/public")).status, 200);
      const insert = (name: string, status: string, email: string | null) =>
        local.query(
          "INSERT INTO wedding_vendor_listings (business_name, category, city, state, email, phone, contact_name, status, agree) VALUES ($1,'Florist','Hartford','CT',$2,'555-0100','Owner',$3,true) RETURNING id",
          [name, email, status],
        ).then((r) => Number(r.rows[0].id));
      const published = await insert("Real Blooms", "published", "blooms@example.test");
      const pending = await insert("Pending Co", "pending", "pending@example.test");
      const noEmail = await insert("Walk-in Only", "published", null);

      // Public directory: only published, and no private contact fields.
      const dir = await call("GET", "/api/wedding/vendor-listings/public");
      const names = dir.json.listings.map((l: any) => l.businessName).sort();
      assert.deepEqual(names, ["Real Blooms", "Walk-in Only"]);
      for (const l of dir.json.listings) {
        assert.equal("email" in l, false);
        assert.equal("phone" in l, false);
        assert.equal("contactName" in l, false);
      }

      const body = (vendorId: number) => ({ vendorId, vendorName: "Spoofed Name", weddingDate: "2027-06-01", guestCount: 120, contactEmail: "couple@example.test", message: "Hi" });

      // Unpublished and nonexistent vendors are refused, and nothing is sent.
      assert.equal((await call("POST", "/api/wedding/vendor-quotes", "couple", body(pending))).status, 404);
      assert.equal((await call("POST", "/api/wedding/vendor-quotes", "couple", body(999999))).status, 404);
      assert.equal(sent.length, 0);

      // Signed-out callers cannot submit.
      assert.equal((await call("POST", "/api/wedding/vendor-quotes", "anon", body(published))).status, 401);

      // Published vendor with an email: delivered to THAT address; stored name comes from the listing.
      const ok = await call("POST", "/api/wedding/vendor-quotes", "couple", body(published));
      assert.equal(ok.status, 200, ok.text);
      assert.equal(ok.json.delivered, true);
      assert.equal(ok.json.vendorName, "Real Blooms");
      assert.equal(ok.json.quote.vendorName, "Real Blooms");
      assert.equal(sent.length, 1);
      assert.equal(sent[0].vendorTo, "blooms@example.test");

      // Published vendor without an email: saved but NOT reported as delivered, and no fallback inbox is used.
      const saved = await call("POST", "/api/wedding/vendor-quotes", "couple", body(noEmail));
      assert.equal(saved.status, 200, saved.text);
      assert.equal(saved.json.delivered, false);
      assert.equal(sent.length, 1);

      // Mailer failure: not reported as delivered.
      failDelivery = true;
      const failed = await call("POST", "/api/wedding/vendor-quotes", "couple", body(published));
      assert.equal(failed.status, 200, failed.text);
      assert.equal(failed.json.delivered, false);
    } finally {
      quoteDelivery.send = originalSend;
      server.close();
      // Leave the shared CI database as we found it: later steps create these tables from scratch.
      await local.query("DROP TABLE IF EXISTS wedding_vendor_quotes, wedding_vendor_listings, users CASCADE").catch(() => {});
      await local.end();
    }
  });
}
