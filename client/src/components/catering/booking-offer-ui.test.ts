import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/** Source-level pins for the negotiation surface: persistence-first state, accessibility, mobile reach, cache scoping and conflict handling. */
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.join(here, "..", "..", "..", "..", relative), "utf8");
const offer = read("client/src/components/catering/BookingOffer.tsx");
const manager = read("client/src/components/catering/BookingManager.tsx");
const workspace = read("client/src/pages/services/catering-booking-workspace.tsx");
const provider = read("client/src/pages/services/catering-provider.tsx");
const inquiries = read("client/src/components/catering/CustomerInquiries.tsx");

test("the offer is read from the server under an actor- and booking-scoped key, and refetches when either changes", () => {
  assert.match(offer, /const key = cateringOfferRevisionKey\(userId, bookingId\)/);
  assert.match(offer, /queryKey: key, queryFn: \(\) => fetchNegotiation\(bookingId\)/);
  assert.match(offer, /\/api\/catering\/bookings\/\$\{encodeURIComponent\(bookingId\)\}\/offer`/);
  assert.match(offer, /useEffect\(\(\) => \{ setReviseOpen\(false\);[^}]*\}, \[userId, bookingId\]\)/);
  assert.match(offer, /refetchOnWindowFocus: true/);
});

test("no request carries an actor: identity is the session", () => {
  assert.doesNotMatch(offer, /userId:\s*userId,?\s*(role|providerId)|customerId:|actorRole|proposedBy:/);
  assert.match(offer, /credentials: "include"/);
  assert.doesNotMatch(offer, /body: JSON\.stringify\(\{[^}]*(userId|customerId|providerId)/);
});

test("acceptance names the exact revision on screen and is confirmed in an accessible dialog, not window.confirm", () => {
  assert.match(offer, /customer-confirm`, \{ revisionId: variables\.revisionId \}/);
  assert.match(offer, /accept\.mutate\(\{ identity, revisionId: negotiation\.currentRevisionId \}\)/);
  assert.match(offer, /<AlertDialog open=\{confirm === "accept"\}/);
  assert.match(offer, /AlertDialogTitle>Accept this offer\?</);
  assert.doesNotMatch(offer, /window\.confirm|confirm\(/);
  assert.match(offer, /if \(!open && !accept\.isPending\) setConfirm\(null\)/);
});

test("a revision names the revision it edits and carries one retry key per submission", () => {
  assert.match(offer, /expectedRevisionId: negotiation\.currentRevisionId, clientRequestId: requestId\.current/);
  assert.match(offer, /const requestId = useRef\(newCateringClientRequestId\(\)\)/);
  assert.match(offer, /requestId\.current = newCateringClientRequestId\(\)/);
});

test("'accepted' is shown from the persisted negotiation, never because a mutation started", () => {
  assert.match(offer, /negotiation\.state === "accepted"/);
  assert.doesNotMatch(offer, /accept\.isPending\s*\?\s*"Terms accepted|accept\.isPending && .*Terms accepted/);
  assert.match(offer, /onSuccess: async \(_data, variables\) => \{ if \(isCurrentOfferTarget\(shown\.current, variables\.identity\)\)/);
  assert.doesNotMatch(offer, /optimistic|onMutate/);
});

test("a stale-revision answer is surfaced, re-reads the offer, and keeps the customer's typed message", () => {
  assert.match(offer, /error\.isConflict/);
  assert.match(offer, /setConflict\(error\.message\); setConfirm\(null\); setReviseOpen\(false\)/);
  assert.match(offer, /await client\.invalidateQueries\(\{ queryKey: cateringOfferRevisionKey\(identity\.userId, identity\.bookingId\) \}\)/);
  assert.match(offer, /role="alert"[^>]*>\{conflict\} The latest terms are shown below/);
  assert.doesNotMatch(offer, /onFailure[\s\S]{0,400}setChangeMessage\(""\)/, "a conflict does not discard what the customer wrote");
});

test("request changes states plainly that it does not alter the booking", () => {
  assert.match(offer, /Sending this does not change the booking or its terms/);
  assert.match(offer, /nothing is confirmed until you accept one/);
});

test("results for another account or booking are dropped, and the cache is never cleared globally", () => {
  assert.match(offer, /const shown = useRef<OfferMutationIdentity>\(\{ userId, bookingId \}\);\s*shown\.current = \{ userId, bookingId \}/);
  assert.equal((offer.match(/isCurrentOfferTarget\(shown\.current/g) ?? []).length >= 5, true);
  assert.doesNotMatch(offer + manager + provider, /queryClient\.clear\(\)|client\.clear\(\)|invalidateQueries\(\)|resetQueries\(\)/);
  assert.match(offer, /invalidateQueries\(\{ queryKey: \[\.\.\.queryKey\] \}\)/);
});

test("loading, error, empty, pending and read-only states all exist and are announced", () => {
  assert.match(offer, /query\.isLoading\) return <p role="status"[^>]*>Loading offer…/);
  assert.match(offer, /query\.isError \|\| !negotiation\) \{[\s\S]*role="alert"[\s\S]*Retry/);
  assert.match(offer, /aria-busy=\{query\.isFetching\}/);
  assert.match(offer, /pending \? pendingLabel : submitLabel/);
  assert.match(offer, /requestChanges\.isPending \? "Sending…" : "Send change request"/);
  assert.match(offer, /accept\.isPending \? "Accepting…" : "Accept and confirm"/);
  assert.match(offer, /This negotiation is closed and read-only/);
  assert.match(offer, /before revision history existed, so there are no earlier versions to show/);
  assert.match(offer, /disabled=\{busy\}/);
});

test("revision status is words, not colour, and history is a list rather than a table", () => {
  assert.match(offer, /"Replaced by a newer revision"/);
  assert.match(offer, /"Current offer"/);
  assert.match(offer, /return "Change request"/);
  assert.match(offer, /<ol className="space-y-3" aria-label="Offer history, newest first">/);
  assert.doesNotMatch(offer, /<table|<Table|onMouseEnter|hover:/);
});

test("it works at phone width: touch-sized actions, wrapping text, no horizontal scroll dependency", () => {
  assert.equal((offer.match(/min-h-11/g) ?? []).length >= 10, true);
  assert.match(offer, /flex flex-wrap gap-2/);
  assert.match(offer, /break-words/);
  assert.match(offer, /whitespace-pre-wrap break-words/);
  assert.match(offer, /min-w-0/);
  assert.doesNotMatch(offer, /overflow-x-scroll|min-w-\[[0-9]{3,}/);
});

test("forms are keyboard-accessible: labelled inputs, described errors, no hidden-until-hover controls", () => {
  assert.match(offer, /<Label htmlFor=\{`\$\{idPrefix\}-price`\}>/);
  assert.match(offer, /aria-invalid=\{Boolean\(errors\.price\)\}/);
  assert.match(offer, /aria-describedby=\{errors\.price \? `\$\{idPrefix\}-price-error` : undefined\}/);
  assert.match(offer, /inputMode="decimal"/);
  assert.match(offer, /<form className="space-y-3" onSubmit=\{submit\} noValidate aria-label="Offer terms">/);
  assert.match(offer, /<summary className="min-h-11/);
});

test("the customer can review, accept, request changes and decline from the existing booking surfaces; the provider can revise", () => {
  assert.match(offer, /acceptLabel/);
  assert.match(offer, />Request changes</);
  assert.match(offer, />Decline offer</);
  assert.match(offer, /"Revise offer"/);
  assert.match(manager, /<BookingOffer bookingId=\{booking\.id\} userId=\{userId\} role=\{mode\} providerId=\{booking\.providerId\} \/>/);
  assert.match(workspace, /<BookingOffer bookingId=\{params\.bookingId\} userId=\{user\.id\} role=\{workspace\.role\} providerId=\{workspace\.booking\.providerId\} \/>/);
  assert.match(inquiries, /"Review offer"/, "the Phase 2M entry point to the offer is kept");
});

test("the old one-tap confirmation, which could accept stale terms, is gone from the booking list", () => {
  assert.doesNotMatch(manager, /action: "customer-confirm"/);
  assert.doesNotMatch(manager, /Confirm booking terms/);
});

test("declining goes through the existing booking cancellation, and the generic cancel is not duplicated beside it", () => {
  assert.match(offer, /\/cancel`, \{\}/);
  assert.match(manager, /booking\.status === "confirmed" \|\| \(booking\.status === "pending_confirmation" && mode === "provider"\)/);
});

test("the provider's first offer is a form, not a bodyless one-tap, and it sends cents-based terms", () => {
  assert.match(provider, /<OfferTermsForm idPrefix=\{`first-offer-\$\{inquiry\.id\}`\}/);
  assert.doesNotMatch(provider, /body: "\{\}"[^;]*provider-confirm|provider-confirm`, \{ method: "POST", credentials: "include", headers: \{ "Content-Type": "application\/json" \}, body: "\{\}" \}/);
  assert.match(provider, /body: JSON\.stringify\(terms\)/);
});
