import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Source-level pins for Phase 2M. The behavior itself is proven over real HTTP and PostgreSQL in
 * catering-customer-inquiry-http.test.ts, which only runs where a local test database is configured. These pins run
 * everywhere, so the rules that suite depends on cannot be edited away without a failure in a database-less CI.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const routes = read("server/routes/catering.ts");
const bookings = read("server/routes/catering-bookings.ts");
const service = read("server/services/catering-inquiry-withdrawal.ts");
const migration = read("server/migrations/20261003_catering_inquiry_contact.sql");
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const section = (source: string, from: string, to: string) => { const start = source.indexOf(from); assert.notEqual(start, -1, from); const end = source.indexOf(to, start + from.length); return source.slice(start, end === -1 ? undefined : end); };

const mine = section(routes, 'r.get("/inquiries/mine"', 'async function withdrawInquiryAs');
const withdrawRoute = section(routes, 'r.post("/inquiries/:id/withdraw"', "/**\n * GET /api/catering/users/:id/inquiries");
const withdrawHelper = section(routes, "async function withdrawInquiryAs", "/**\n * POST /api/catering/inquiries/:id/withdraw");
const putRoute = section(routes, 'r.put("/inquiries/:id"', "/**\n * GET /api/catering/users/:id/status");
const createRoute = section(routes, 'r.post("/inquiries", requireAuth', "/**\n * GET /api/catering/inquiries/mine");

test("the customer list requires a session and takes the customer from it, never from the request", () => {
  assert.match(mine, /r\.get\("\/inquiries\/mine", requireAuth,/);
  assert.match(mine, /const customerId = \(req\.user as \{ id: string \}\)\.id;/);
  assert.doesNotMatch(mine, /req\.(params|body)/);
  assert.doesNotMatch(mine, /req\.query\.(customerId|userId)/);
  assert.equal(mine.match(/eq\(cateringInquiries\.customerId, customerId\)/g)?.length, 1);
  assert.match(mine, /\.where\(ownedByCustomer\)/);
  assert.match(mine, /select\(\{ value: count\(\) \}\)\.from\(cateringInquiries\)\.where\(ownedByCustomer\)/);
});

test("the customer list reuses the bounded inquiry pagination contract with a deterministic order", () => {
  assert.match(mine, /cateringInquiryPageSchema\.parse\(req\.query\)/);
  assert.match(mine, /\.orderBy\(desc\(cateringInquiries\.createdAt\), desc\(cateringInquiries\.id\)\)/);
  assert.match(mine, /\.limit\(limit\)\.offset\(\(page - 1\) \* limit\)/);
  const pagination = read("server/services/catering-inquiry-pagination.ts");
  assert.match(pagination, /CATERING_INQUIRY_MAX_PAGE_SIZE = 50/);
  assert.match(pagination, /\.max\(CATERING_INQUIRY_MAX_PAGE_SIZE\)/);
});

test("the customer list answers through the explicit serializer and selects no private booking columns", () => {
  assert.match(mine, /serializeCateringCustomerInquiry\(/);
  assert.doesNotMatch(mine, /res\.json\(\{ inquiries: rows\b/);
  const booking = section(mine, "booking: {", "provider: {");
  for (const column of ["cancellationReason", "cancelledBy", "closedOutBy", "createdBy"]) assert.doesNotMatch(booking, new RegExp(column));
  assert.doesNotMatch(read("server/serializers/catering-customer-inquiry.ts"), /\.\.\.(row|inquiry|booking)\b/);
});

test("the route is registered where no parameterised inquiry route can shadow it", () => {
  assert.doesNotMatch(routes, /r\.get\("\/inquiries\/:/);
});

test("withdrawal takes the actor from the session, ignores the body, and answers uniformly for strangers", () => {
  assert.match(withdrawRoute, /requireAuth/);
  assert.match(withdrawRoute, /\(req\.user as \{ id: string \}\)\.id, req\.params\.id, res/);
  assert.doesNotMatch(withdrawRoute, /req\.body/);
  assert.match(withdrawHelper, /z\.string\(\)\.uuid\(\)\.safeParse/);
  assert.equal(withdrawHelper.match(/status\(404\)\.json\(\{ message: "Inquiry not found" \}\)/g)?.length, 2);
});

test("withdrawal runs in one transaction that locks the inquiry before it looks for a booking", () => {
  assert.match(withdrawHelper, /db\.transaction\(\(tx: typeof db\) => withdrawCateringInquiry\(tx,/);
  const lockAt = service.indexOf("lockCateringInquiry(tx, input.inquiryId)");
  const bookingAt = service.indexOf("from(cateringBookings)");
  const updateAt = service.indexOf(".update(cateringInquiries)");
  assert.ok(lockAt !== -1 && lockAt < bookingAt && bookingAt < updateAt);
  assert.match(service, /\.limit\(1\)\.for\("update"\)/);
  assert.match(service, /locked\.customerId !== input\.customerId/);
});

test("withdrawal writes the inquiry and nothing else: no booking, billing, payment or activity write", () => {
  assert.equal(service.match(/\.update\(/g)?.length, 1);
  assert.doesNotMatch(service, /\.(insert|delete)\(/);
  assert.doesNotMatch(service, /update\(cateringBookings/);
  assert.doesNotMatch(code(service), /billing|invoice|payment|refund|square|cateringBookingActivity/i);
  assert.match(service, /where\(and\(eq\(cateringInquiries\.id, locked\.id\), eq\(cateringInquiries\.customerId, input\.customerId\)/);
});

test("the provider's offer locks the same inquiry row before it judges the status", () => {
  const offer = section(bookings, 'r.post("/inquiries/:inquiryId/provider-confirm"', 'r.post("/bookings/:id/customer-confirm"');
  const lockAt = offer.indexOf("lockCateringInquiry(tx, inquiryId)");
  const judgeAt = offer.indexOf("mayInquiryProduceBooking(inquiry)");
  const insertAt = offer.indexOf("tx.insert(cateringBookings)");
  assert.ok(lockAt !== -1 && lockAt < judgeAt && judgeAt < insertAt);
  assert.match(offer, /locked && locked\.chefId === providerId \? locked : undefined/);
});

test("a withdrawal tells the provider only when it actually happened, and a failure to tell is swallowed", () => {
  assert.match(withdrawHelper, /if \(result\.kind === "withdrawn"\) \{[\s\S]*type: "catering_inquiry_withdrawn"[\s\S]*\.catch\(\(\) => undefined\)/);
  assert.match(withdrawHelper, /userId: result\.inquiry\.chefId/);
  assert.match(withdrawHelper, /linkUrl: CATERING_PROVIDER_INQUIRIES_URL/);
  assert.doesNotMatch(withdrawHelper, /customerEmail|customerPhone|message: .*\$\{/);
});

test("a provider decline notifies the customer once, only on the real transition, with no contact or private text", () => {
  const decline = section(putRoute, 'if (status === "declined")', "res.json({ message");
  assert.match(decline, /userId: updated\.customerId/);
  assert.match(decline, /type: "catering_inquiry_declined"/);
  assert.match(decline, /linkUrl: CATERING_CUSTOMER_REQUESTS_URL/);
  assert.match(decline, /\.catch\(\(\) => undefined\)/);
  assert.doesNotMatch(decline, /customerEmail|customerPhone|updated\.message/);
  assert.ok(putRoute.indexOf("storage.updateCateringInquiry") < putRoute.indexOf('if (status === "declined")'));
  assert.doesNotMatch(putRoute, /status === "accepted"[\s\S]{0,200}notifications/);
});

test("the legacy status PUT delegates a customer's cancel to the one withdrawal rule", () => {
  assert.match(putRoute, /role === "customer" && status === "cancelled"\) return await withdrawInquiryAs\(userId, inquiry\.id, res\)/);
});

test("notification links resolve to real surfaces", () => {
  const app = read("client/src/App.tsx");
  assert.match(app, /<Route path="\/services\/catering" component=\{CateringMarketplace\}/);
  assert.match(app, /<Route path="\/services\/catering\/provider" component=\{CateringProvider\}/);
  assert.match(read("client/src/components/catering/CustomerInquiries.tsx"), /<Card id=\{CATERING_CUSTOMER_REQUESTS_SECTION\}/);
});

test("new inquiries persist structured contact through the validated schema, never the client's customer id", () => {
  assert.match(createRoute, /\.and\(cateringInquiryContactSchema\)\.parse\(req\.body\)/);
  assert.match(createRoute, /const customerId = \(req\.user as \{ id: string \}\)\.id;/);
  assert.doesNotMatch(createRoute, /pick\(\{[^}]*customerId/);
  assert.match(createRoute, /storage\.createCateringInquiry\(\{ \.\.\.input, customerId \}\)/);
  assert.doesNotMatch(createRoute, /sendCateringRequestNotification\([^)]*(customerEmail|customerPhone)/);
});

test("the customer UI no longer folds contact details into the free-text message", () => {
  const marketplace = read("client/src/pages/services/catering.tsx");
  assert.doesNotMatch(marketplace, /`Email: \$\{/);
  assert.doesNotMatch(marketplace, /`Phone: \$\{/);
  assert.match(marketplace, /customerEmail: form\.contactEmail\.trim\(\) \|\| undefined/);
  assert.match(marketplace, /customerPhone: form\.contactPhone\.trim\(\) \|\| undefined/);
  assert.doesNotMatch(marketplace, /customerId: user\.id/);
});

test("the migration is additive, nullable and never rewrites or backfills existing rows", () => {
  const statements = migration.split("\n").filter((line) => !line.trim().startsWith("--") && line.trim());
  assert.deepEqual(statements, [
    "ALTER TABLE catering_inquiries ADD COLUMN IF NOT EXISTS customer_email varchar(254);",
    "ALTER TABLE catering_inquiries ADD COLUMN IF NOT EXISTS customer_phone varchar(32);",
  ]);
  assert.doesNotMatch(statements.join("\n"), /\b(UPDATE|DELETE|DROP|NOT NULL|DEFAULT|INSERT)\b|regexp|substring/i);
});

test("the shared schema declares both contact columns nullable with the migration's lengths", () => {
  const schema = read("shared/schema/domains/social-content.ts");
  assert.match(schema, /customerEmail: varchar\("customer_email", \{ length: 254 \}\),/);
  assert.match(schema, /customerPhone: varchar\("customer_phone", \{ length: 32 \}\),/);
});

test("Phase 2M stays out of booking, billing, payment and excluded-feature code", () => {
  for (const file of ["server/services/catering-inquiry-withdrawal.ts", "server/serializers/catering-customer-inquiry.ts", "shared/catering-inquiries.ts", "client/src/components/catering/CustomerInquiries.tsx", "client/src/pages/services/catering-customer-inquiry-state.ts"]) {
    assert.doesNotMatch(code(read(file)), /square|stripe|payout|refund|invoice|amendment|creator|negotiat|settlement/i, file);
  }
  assert.doesNotMatch(read("server/serializers/catering-customer-inquiry.ts"), /import .*catering-booking-(billing|closeout|execution)/);
});
