/**
 * The staff closure preview must never cost the member anything. It takes no row lock, it is bounded in total time
 * (not just per statement), and every failure, including running out of time, reports "unavailable" rather than a
 * clear result that could be mistaken for permission to close.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { BACK_OFFICE_SQL, CLEAN_UP_BACK_OFFICE, DROP_BACK_OFFICE } from "../test-support/staff-portal-harness";

if (!PG_URL) {
  test("Closure preview requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("the preview is bounded in total, never locks the member, and fails closed when it runs out of time", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { inspectMemberClosurePreview, PREVIEW_TOTAL_BUDGET_MS } = await import("./closure-preview");
    try {
      await local.query(`
        ${DROP_BACK_OFFICE}
        DROP TABLE IF EXISTS users CASCADE;
        ${ddl(schema.users, "users")};
        ${BACK_OFFICE_SQL}
      `);
      const memberId = (await local.query(
        "INSERT INTO users (username, email, display_name, password, auth_version) VALUES ('closing','closing@example.test','closing','x',1) RETURNING id",
      )).rows[0].id;

      assert.equal(PREVIEW_TOTAL_BUDGET_MS, 8000, "the documented budget is the one actually used");

      // A spent budget is a failure like any other: no blockers list, no eligibility, nothing to misread.
      const timedOut = await inspectMemberClosurePreview(memberId, { budgetMs: 0 });
      assert.equal(timedOut.verification, "unavailable");
      assert.equal(timedOut.permanentlyDisabled, true);
      assert.deepEqual(timedOut.localBlockers, []);
      assert.match(timedOut.reasons.join(" "), /timed out/,
        "a spent budget is reported as a timeout, so it cannot be mistaken for a broken account");

      // The distinction matters: any other failure on the same schema says "cannot be verified" instead, so this
      // test fails if the deadline is ever removed and the pass simply runs to completion or errors.
      const normal = await inspectMemberClosurePreview(memberId);
      assert.equal(normal.permanentlyDisabled, true);
      assert.doesNotMatch(normal.reasons.join(" "), /timed out/);

      // While a preview runs, the member's own row must stay writable: an earlier version held it FOR SHARE for
      // the whole pass, which would have blocked their purchases and sign-in.
      const holder = await local.connect();
      let finished = false;
      try {
        const running = inspectMemberClosurePreview(memberId);
        await holder.query("BEGIN");
        await holder.query("SET LOCAL lock_timeout = '4s'");
        await holder.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [memberId]);
        await holder.query("COMMIT");
        finished = true;
        const preview = await running;
        assert.equal(preview.permanentlyDisabled, true, "the preview never reports closure as available");
        assert.notEqual(preview.verification, undefined);
      } finally {
        if (!finished) await holder.query("ROLLBACK").catch(() => {});
        holder.release();
      }

      // An unknown account is reported plainly, not as an error and never as closable.
      const missing = await inspectMemberClosurePreview("00000000-0000-0000-0000-000000000000");
      assert.equal(missing.accountExists, false);
      assert.equal(missing.permanentlyDisabled, true);
    } finally {
      await local.query(`${CLEAN_UP_BACK_OFFICE} DROP TABLE IF EXISTS users CASCADE;`);
      await local.end();
    }
  });
}
