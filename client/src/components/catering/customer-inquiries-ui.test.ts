import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/** Source-level pins for the customer request surface: states, accessibility, mobile reachability and cache scoping. */
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.join(here, "..", "..", "..", "..", relative), "utf8");
const component = read("client/src/components/catering/CustomerInquiries.tsx");
const marketplace = read("client/src/pages/services/catering.tsx");
const publicProvider = read("client/src/pages/services/catering-public-provider.tsx");
const providerPage = read("client/src/pages/services/catering-provider.tsx");

test("the request list is the customer's own, keyed by their id, and refetches when the account changes", () => {
  assert.match(component, /queryKey: \[\.\.\.cateringCustomerInquiriesKey\(userId\), page, CATERING_CUSTOMER_INQUIRY_PAGE_SIZE\]/);
  assert.match(component, /\/api\/catering\/inquiries\/mine\?page=\$\{page\}&limit=\$\{CATERING_CUSTOMER_INQUIRY_PAGE_SIZE\}/);
  assert.match(component, /useEffect\(\(\) => \{ setPage\(1\); setTarget\(null\); \}, \[userId\]\)/);
  assert.doesNotMatch(component, /customerId=|userId=/);
});

test("withdrawal posts to the session-scoped route with no actor in the body and persists before reporting success", () => {
  assert.match(component, /\/api\/catering\/inquiries\/\$\{encodeURIComponent\(inquiryId\)\}\/withdraw/);
  assert.match(component, /method: "POST", credentials: "include", headers: \{[^}]*\}, body: "\{\}"/);
  assert.match(component, /if \(!response\.ok\) throw new Error\(body\.message \|\| "The request could not be withdrawn"\)/);
  assert.ok(component.indexOf("onSuccess") < component.indexOf("Request withdrawn. The caterer has been told."));
  assert.match(component, /withdraw\.isSuccess && target === null/);
});

test("withdrawal is confirmed in the accessible dialog, not window.confirm, and the dialog cannot close mid-request", () => {
  assert.match(component, /<AlertDialog open=\{target !== null\}/);
  assert.match(component, /AlertDialogTitle>Withdraw this request\?</);
  assert.doesNotMatch(component, /window\.confirm|confirm\(/);
  assert.match(component, /if \(!open && !withdraw\.isPending\) setTarget\(null\)/);
  assert.match(component, /<AlertDialogCancel className="min-h-11" disabled=\{withdraw\.isPending\}>/);
});

test("pending and error states are visible and announced", () => {
  assert.match(component, /disabled=\{!target \|\| withdraw\.isPending\}/);
  assert.match(component, /submittingThis \? "Withdrawing…" : "Withdraw request"/);
  assert.match(component, /withdraw\.isError && <p role="alert"[^>]*>\{withdraw\.error\.message\}/);
  assert.match(component, /query\.isLoading \? <p role="status">Loading your requests…<\/p>/);
  assert.match(component, /query\.isError \? \([\s\S]*role="alert"[\s\S]*Retry/);
  assert.match(component, /aria-busy=\{query\.isFetching\}/);
});

test("a refused withdrawal refreshes the list so the card shows what really happened", () => {
  assert.match(component, /onError: async \(\) => \{ await client\.invalidateQueries\(\{ queryKey: cateringCustomerInquiriesKey\(userId\) \}\); \}/);
});

test("the surface works on a phone: cards not tables, touch-sized actions, wrapping text, no hover-only controls", () => {
  assert.doesNotMatch(component, /<table|<thead|overflow-x/);
  assert.doesNotMatch(component, /hover:|group-hover|onMouse/);
  const buttons = component.match(/<Button[^>]*>/g) ?? [];
  assert.ok(buttons.length >= 6);
  for (const button of buttons) assert.match(button, /min-h-11/, button);
  assert.match(component, /break-words/);
  assert.match(component, /flex flex-wrap/);
});

test("terminal state is stated in words, not colour alone", () => {
  assert.match(component, /presentation\.terminal \? `Closed: \$\{presentation\.label\}` : presentation\.label/);
  assert.doesNotMatch(component, /text-(red|green)-\d00|bg-(red|green)-\d00/);
});

test("a request with a booking links to the existing customer workspace, and a terminal one has no action", () => {
  assert.match(component, /cateringBookingWorkspacePath\("customer", actions\.viewBookingId\)/);
  assert.match(component, /inquiry\.stage === "offered" \? "Review offer" : "View booking"/);
  assert.match(component, /\{\(actions\.withdraw \|\| actions\.viewBookingId\) && \(/);
  assert.match(component, /\{actions\.withdraw && \(/);
  assert.doesNotMatch(component, /cancel booking|customer-confirm/i);
});

test("the empty state is honest and shows no example or mock requests", () => {
  assert.match(component, /You have not sent any catering requests yet\./);
  assert.doesNotMatch(component, /mock|sample|lorem|example\.com|demo/i);
});

test("the requests section sits in the existing customer area above the booking manager", () => {
  assert.match(marketplace, /<CustomerInquiries userId=\{user\.id\} \/><BookingManager userId=\{user\.id\} mode="customer" \/>/);
  assert.match(component, /<Card id=\{CATERING_CUSTOMER_REQUESTS_SECTION\}>/);
  assert.match(component, /<CardTitle>My catering requests<\/CardTitle>/);
});

test("sending a request reconciles only this customer's request list, from both entry points", () => {
  assert.match(marketplace, /queryClient\.invalidateQueries\(\{ queryKey: cateringCustomerInquiriesKey\(user\.id\) \}\)/);
  assert.match(publicProvider, /queryClient\.invalidateQueries\(\{ queryKey: cateringCustomerInquiriesKey\(user\.id\) \}\)/);
  assert.doesNotMatch(publicProvider, /queryKey: \["catering", "inquiries"\]/);
});

test("the provider sees the structured contact only on the inquiry it was sent to", () => {
  assert.match(providerPage, /Customer contact: \{\[item\.customerEmail, item\.customerPhone\]\.filter\(Boolean\)\.join\(" · "\)\}/);
});
