import test from "node:test";
import assert from "node:assert/strict";
import { roomAffordances, hostAction } from "./competition-room-rules";

const base = { signedIn: true, isHost: false, hasEntry: false, competitorCount: 2 };

test("upcoming: no submit (server rejects it); waiting-for-host state instead", () => {
  const a = roomAffordances({ ...base, status: "upcoming" });
  assert.equal(a.canSubmit, false);
  assert.equal(a.waitingForHost, true);
  assert.equal(a.canVote, false);
  assert.equal(roomAffordances({ ...base, signedIn: false, status: "upcoming" }).promptSignInToCompete, false);
});

test("live: competitors can submit and non-participants can vote", () => {
  const a = roomAffordances({ ...base, status: "live" });
  assert.equal(a.canSubmit, true);
  assert.equal(a.waitingForHost, false);
  assert.equal(a.canVote, true);
  assert.equal(roomAffordances({ ...base, signedIn: false, status: "live" }).promptSignInToCompete, true);
});

test("judging: submissions still accepted (matches server) and voting open", () => {
  const a = roomAffordances({ ...base, status: "judging" });
  assert.equal(a.canSubmit, true);
  assert.equal(a.canVote, true);
});

test("completed and canceled: no submit, no vote", () => {
  for (const status of ["completed", "canceled"]) {
    const a = roomAffordances({ ...base, status });
    assert.equal(a.canSubmit, false);
    assert.equal(a.canVote, false);
    assert.equal(a.promptSignInToCompete, false);
  }
});

test("participants cannot vote; hosts do not get the submit form", () => {
  assert.equal(roomAffordances({ ...base, hasEntry: true, status: "live" }).canVote, false);
  assert.equal(roomAffordances({ ...base, isHost: true, status: "live" }).canSubmit, false);
  assert.equal(roomAffordances({ ...base, isHost: true, status: "upcoming" }).waitingForHost, false);
});

test("no competitors means nothing to vote on", () => {
  assert.equal(roomAffordances({ ...base, competitorCount: 0, status: "live" }).canVote, false);
});

test("host actions follow the server's state machine", () => {
  assert.equal(hostAction("upcoming")?.endpoint, "start");
  assert.equal(hostAction("live")?.endpoint, "end");
  assert.equal(hostAction("judging")?.endpoint, "complete");
  assert.equal(hostAction("completed"), null);
  assert.equal(roomAffordances({ ...base, status: "live" }).hostAction, null);
  assert.equal(roomAffordances({ ...base, isHost: true, status: "live" }).hostAction?.endpoint, "end");
});
