import test from "node:test";
import assert from "node:assert/strict";
import { assertInternalClosureMutationAllowed, PERMANENT_CLOSURE_AVAILABLE } from "./closure-feature";
import { scrubMemberIdentityWithinClosure } from "./closure-identity-scrub";
import { redactOrdinaryDmWithinClosure } from "./closure-message-redaction";
import { enqueueClosureMediaCandidate } from "./closure-media-outbox";
import { writeMemberClosureAuditWithinTransaction } from "./closure-audit";
import { unpublishClosingSellerWithinTransaction } from "./closure-store-unpublish";

test("permanent closure remains hard-disabled outside isolated PostgreSQL tests", async () => {
  assert.equal(PERMANENT_CLOSURE_AVAILABLE, false);
  const previousMode = process.env.NODE_ENV;
  const previousUrl = process.env.CS_TEST_PG_URL;
  let called = false;
  const fakeTx = {execute: async()=> { called = true; throw new Error("SQL MUST NOT RUN"); }};
  try {
    process.env.NODE_ENV = "production";
    process.env.CS_TEST_PG_URL = "postgres://localhost/chefsire_test";
    assert.throws(()=>assertInternalClosureMutationAllowed(),/disabled/);
    await assert.rejects(scrubMemberIdentityWithinClosure(fakeTx,"u"),/disabled/);
    await assert.rejects(redactOrdinaryDmWithinClosure(fakeTx,"u"),/disabled/);
    await assert.rejects(unpublishClosingSellerWithinTransaction(fakeTx,"u"),/disabled/);
    await assert.rejects(enqueueClosureMediaCandidate(fakeTx,{
      memberId:"u",provider:"local",objectKey:"uploads/photo.png",sourceKind:"avatar",
    }),/disabled/);
    await assert.rejects(writeMemberClosureAuditWithinTransaction(fakeTx,{
      memberId:"u",actor:{kind:"member",memberId:"u"},
      counts:{personalContentRows:0,messagesRedacted:0,productsUnpublished:0,mediaCandidatesQueued:0},
    }),/disabled/);
    assert.equal(called,false,"production safety gate refuses every mutation before SQL execution");
    process.env.NODE_ENV = "test";
    delete process.env.CS_TEST_PG_URL;
    assert.throws(()=>assertInternalClosureMutationAllowed(),/disabled/,
      "NODE_ENV=test alone is insufficient");
  } finally {
    if(previousMode===undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV=previousMode;
    if(previousUrl===undefined) delete process.env.CS_TEST_PG_URL; else process.env.CS_TEST_PG_URL=previousUrl;
  }
});
