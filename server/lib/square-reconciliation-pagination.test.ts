/**
 * Capture reconciliation over the REAL square SDK against a local HTTP server that serves paginated payment pages. The adapter returns
 * ONE page per call and the reference search walks pages lazily, so a known target is found (and the walk stops) however many unrelated
 * same-amount payments follow it, memory stays bounded by one page, and an UNMATCHED search is bounded and fails closed. No network
 * beyond 127.0.0.1; Sandbox only.
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { getSquareClient } from "./square-client";
import {
  MAX_RECONCILIATION_PAGES,
  evaluateSquareCapturePayment,
  findSquarePaymentByReference,
  getCaptureReconciliationWindow,
} from "./marketplace-payment";

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env.SQUARE_ACCESS_TOKEN = "platform-token-test";
process.env.SQUARE_ENV = "sandbox";

type Served = { query: URLSearchParams };
const PAGE_SIZE = 100;

async function withPagedServer(
  pageOf: (page: number) => { payments: Array<Record<string, unknown>>; hasNext: boolean } | "error",
  fn: (ctx: { client: ReturnType<typeof getSquareClient>; served: Served[] }) => Promise<void>,
) {
  const served: Served[] = [];
  const server = http.createServer((req, res) => {
    const [pathname, query = ""] = (req.url ?? "").split("?");
    res.setHeader("content-type", "application/json");
    if (req.method !== "GET" || pathname !== "/v2/payments") { res.statusCode = 404; res.end("{}"); return; }
    const params = new URLSearchParams(query);
    served.push({ query: params });
    const page = Number((params.get("cursor") ?? "p0").slice(1));
    const result = pageOf(page);
    if (result === "error") { res.statusCode = 503; res.end(JSON.stringify({ errors: [{ category: "API_ERROR", code: "SERVICE_UNAVAILABLE" }] })); return; }
    res.end(JSON.stringify({ payments: result.payments, ...(result.hasNext ? { cursor: `p${page + 1}` } : {}) }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const client = getSquareClient({ baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}` });
    await fn({ client, served });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const payment = (id: string, referenceId: string, extra: Record<string, unknown> = {}) => ({
  id, reference_id: referenceId, status: "COMPLETED", created_at: "2026-01-01T00:05:00Z", location_id: "LOC_1", total_money: { amount: 1250, currency: "USD" }, ...extra,
});
const fullPage = (page: number, extra: Array<Record<string, unknown>> = []) =>
  [...extra, ...Array.from({ length: PAGE_SIZE - extra.length }, (_, index) => payment(`P${page}_${index}`, `other-${page}-${index}`))];

const WINDOW = getCaptureReconciliationWindow(new Date("2026-01-01T00:05:00Z"));
const search = (client: ReturnType<typeof getSquareClient>, referenceId: string) => findSquarePaymentByReference({
  referenceId,
  listPage: async (cursor) => {
    const { result } = await client.paymentsApi.listPayments(WINDOW.beginTime, WINDOW.endTime, "DESC", cursor, "LOC_1", 1250n, undefined, undefined, PAGE_SIZE);
    return { payments: result.payments, cursor: result.cursor };
  },
});

test("a target on PAGE 1 is returned and the walk STOPS, even though 5,000 more same-amount payments follow (no >1,000 failure)", async () => {
  await withPagedServer((page) => ({ payments: fullPage(page, page === 0 ? [payment("PAY_TARGET", "ref-target")] : []), hasNext: page < 49 }), async ({ client, served }) => {
    const found = await search(client, "ref-target");
    assert.equal(found?.id, "PAY_TARGET");
    assert.equal(served.length, 1, "only the first page was requested; later pages were never fetched");
  });
});

test("a target on a LATER page is found through the cursor, stopping there", async () => {
  await withPagedServer((page) => ({ payments: fullPage(page, page === 3 ? [payment("PAY_LATE", "ref-late")] : []), hasNext: page < 49 }), async ({ client, served }) => {
    assert.equal((await search(client, "ref-late"))?.id, "PAY_LATE");
    assert.equal(served.length, 4);
    assert.deepEqual(served.map((request) => request.query.get("cursor")), [null, "p1", "p2", "p3"]);
  });
});

test("an error on a LATER page after the target was already found is irrelevant: iteration had stopped", async () => {
  await withPagedServer((page) => (page === 0 ? { payments: fullPage(0, [payment("PAY_TARGET", "ref-target")]), hasNext: true } : "error"), async ({ client, served }) => {
    assert.equal((await search(client, "ref-target"))?.id, "PAY_TARGET");
    assert.equal(served.length, 1);
  });
});

test("a page error BEFORE the match fails closed (the search rejects; it never reports no-match)", async () => {
  await withPagedServer((page) => (page === 2 ? "error" : { payments: fullPage(page), hasNext: true }), async ({ client }) => {
    await assert.rejects(search(client, "ref-never"));
  });
});

test("an UNMATCHED search over endless pages is bounded and fails closed after MAX_RECONCILIATION_PAGES, never scanning forever", async () => {
  await withPagedServer((page) => ({ payments: fullPage(page), hasNext: true }), async ({ client, served }) => {
    await assert.rejects(search(client, "ref-absent"), /exceeded its bound/);
    assert.equal(served.length, MAX_RECONCILIATION_PAGES);
  });
});

test("an unmatched search that simply runs out of pages reports no match (null), and same-amount unrelated payments are never accepted", async () => {
  await withPagedServer((page) => ({ payments: fullPage(page), hasNext: page < 2 }), async ({ client, served }) => {
    assert.equal(await search(client, "ref-absent"), null);
    assert.equal(served.length, 3);
  });
});

test("no unbounded accumulation: every adapter call returns at most one page and exactly one request", async () => {
  await withPagedServer((page) => ({ payments: fullPage(page), hasNext: true }), async ({ client, served }) => {
    let cursor: string | undefined;
    for (let call = 1; call <= 5; call += 1) {
      const { result } = await client.paymentsApi.listPayments(WINDOW.beginTime, WINDOW.endTime, "DESC", cursor, "LOC_1", 1250n, undefined, undefined, PAGE_SIZE);
      assert.ok(result.payments.length <= PAGE_SIZE);
      assert.equal(served.length, call, "one request per call: the adapter does not pre-fetch further pages");
      cursor = result.cursor;
      assert.ok(cursor);
    }
  });
});

test("the request keeps every narrowing filter: location, exact amount, the capture-attempt window, newest-first, page size", async () => {
  await withPagedServer(() => ({ payments: [payment("PAY_1", "ref-1")], hasNext: false }), async ({ client, served }) => {
    await search(client, "ref-1");
    const query = served[0].query;
    assert.equal(query.get("location_id"), "LOC_1");
    assert.equal(query.get("total"), "1250");
    assert.equal(query.get("begin_time"), WINDOW.beginTime);
    assert.equal(query.get("end_time"), WINDOW.endTime);
    assert.equal(query.get("sort_order"), "DESC");
    assert.equal(query.get("limit"), String(PAGE_SIZE));
    // Not broadened: the window is the +/- reconciliation skew around the attempt, nothing wider.
    assert.ok(new Date(WINDOW.endTime).getTime() - new Date(WINDOW.beginTime).getTime() <= 20 * 60 * 1000);
  });
});

test("a duplicate reference on one page is still ambiguous (throws), not a first-match win", async () => {
  await withPagedServer(() => ({ payments: [payment("PAY_A", "ref-dup"), payment("PAY_B", "ref-dup")], hasNext: false }), async ({ client }) => {
    await assert.rejects(search(client, "ref-dup"), /duplicate payment references/);
  });
});

test("the found payment must still pass the existing evidence checks: amount, currency, status and timestamp", async () => {
  const good = { id: "PAY_OK", status: "COMPLETED", createdAt: "2026-01-01T00:05:00Z", totalMoney: { amount: 1250n, currency: "USD" } };
  assert.equal(evaluateSquareCapturePayment(good, 1250n).squarePaymentId, "PAY_OK");
  for (const [label, bad] of [
    ["wrong amount", { ...good, totalMoney: { amount: 1251n, currency: "USD" } }],
    ["wrong currency", { ...good, totalMoney: { amount: 1250n, currency: "CAD" } }],
    ["not completed", { ...good, status: "APPROVED" }],
    ["no timestamp", { ...good, createdAt: undefined }],
  ] as const) {
    assert.throws(() => evaluateSquareCapturePayment(bad, 1250n), (error: unknown) => (error as { code?: string }).code === "PAYMENT_CAPTURE_UNVERIFIED", label);
  }
  assert.throws(() => evaluateSquareCapturePayment({ ...good, status: "FAILED" }, 1250n), (error: unknown) => (error as { code?: string }).code === "CAPTURE_DEFINITIVE_FAILURE");
  assert.throws(() => evaluateSquareCapturePayment(null, 1250n), (error: unknown) => (error as { code?: string }).code === "PAYMENT_CAPTURE_UNVERIFIED");
});
