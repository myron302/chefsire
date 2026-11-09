import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";

process.env.WEDDING_VENDOR_IMPORT = "off";

if (!PG_URL) {
  test("Wedding vendor legacy table (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  test("an older production-shaped listings table is upgraded so imports and submissions work", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    try {
      // The shape production actually has: agreed_to_terms (no agree), email/category/city NOT NULL, integer id,
      // and CHECK constraints on status and plan from an older vocabulary.
      await local.query(`
        DROP TABLE IF EXISTS wedding_vendor_imports, wedding_vendor_listings, users CASCADE;
        ${ddl(schema.users, "users")};
        CREATE TABLE wedding_vendor_listings (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR,
          business_name VARCHAR NOT NULL,
          contact_name VARCHAR,
          email VARCHAR NOT NULL,
          phone VARCHAR,
          website VARCHAR,
          instagram_handle VARCHAR,
          category VARCHAR NOT NULL,
          city VARCHAR NOT NULL,
          state VARCHAR,
          description TEXT,
          min_price INTEGER,
          max_price INTEGER,
          years_in_business VARCHAR,
          plan VARCHAR NOT NULL DEFAULT 'basic' CONSTRAINT wedding_vendor_listings_plan_check CHECK (plan IN ('basic', 'featured', 'premium')),
          status VARCHAR NOT NULL DEFAULT 'pending' CONSTRAINT wedding_vendor_listings_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'suspended')),
          reviewed_at TIMESTAMP,
          reviewed_by VARCHAR,
          admin_notes TEXT,
          agreed_to_terms BOOLEAN NOT NULL DEFAULT false,
          ip_address VARCHAR,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        );
      `);
      const { ensureWeddingVendorListingsTable } = await import("./wedding-vendor-listings");
      const { importOpenVendors } = await import("../lib/wedding-vendor-import");
      await ensureWeddingVendorListingsTable();

      const result = await importOpenVendors({
        source: "overture",
        release: "2026-10-21.0",
        listings: [
          { source_id: "x1", business_name: "No Email Bakery", category: "Bakery & Cakes", city: "Milford", state: "CT", phone: "2035550100" },
          { source_id: "x2", business_name: "Has Email Florist", category: "Florist", city: "Avon", state: "CT", email: "f@example.test" },
        ],
      });
      assert.deepEqual(result, { imported: true, rows: 2, retired: 0 });
      const rows = (await local.query("SELECT business_name, status, agree, email FROM wedding_vendor_listings ORDER BY business_name")).rows;
      assert.deepEqual(rows.map((r: any) => [r.business_name, r.status, r.agree, r.email]), [
        ["Has Email Florist", "published", false, "f@example.test"],
        ["No Email Bakery", "published", false, null],
      ]);

      // Statuses and plans this code uses are accepted now.
      await local.query("UPDATE wedding_vendor_listings SET status = 'hidden', plan = 'pro' WHERE business_name = 'No Email Bakery'");
      await local.query("UPDATE wedding_vendor_listings SET status = 'retired' WHERE business_name = 'No Email Bakery'");
    } finally {
      await local.query("DROP TABLE IF EXISTS wedding_vendor_imports, wedding_vendor_listings, users CASCADE").catch(() => {});
      await local.end();
    }
  });
}
