/**
 * SSRF-safe outbound HTML fetch for user-supplied URLs (CS-CL-02).
 *
 * Invariant: a user-controlled URL may only cause server-side connections to validated
 * public/global addresses, and that holds for EVERY hop.
 *
 *  - http(s) only, no embedded credentials, ports 80/443 only.
 *  - Hostname is resolved by us (all A/AAAA); ANY unsafe/empty/failed answer rejects the hop.
 *  - The socket is pinned to the validated address through the request's own `lookup`, so the
 *    HTTP client never does a second, independent DNS resolution (no validate-then-refetch TOCTOU).
 *    The original hostname is still used for the Host header, TLS SNI and certificate verification
 *    (node:https derives servername from the URL host; rejectUnauthorized is left at its default).
 *  - Redirects are handled manually: each Location is re-validated and re-pinned before connecting.
 *  - Bounded time, redirects and streamed body size. Compression is not requested.
 *
 * The lookup override is per-request only; nothing global (agents, dns module) is modified.
 */
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { IncomingMessage } from "node:http";

export const MAX_REDIRECTS = 3;
export const FETCH_TIMEOUT_MS = 12_000;
export const MAX_BODY_BYTES = 4 * 1024 * 1024;
const ALLOWED_PORTS = new Set([80, 443]);

/** Message shown to clients for any network-policy/transport failure. Never contains internals. */
export const SAFE_FETCH_CLIENT_MESSAGE = "That URL could not be fetched. Please use a public recipe page URL.";

export class SafeFetchError extends Error {
  /** Safe to return to clients. */
  readonly clientMessage: string;
  constructor(detail: string, clientMessage: string = SAFE_FETCH_CLIENT_MESSAGE) {
    super(detail);
    this.name = "SafeFetchError";
    this.clientMessage = clientMessage;
  }
}

// ---------------------------------------------------------------------------------------------
// IP classification
// ---------------------------------------------------------------------------------------------

const blockedV4 = new net.BlockList();
for (const [net_, prefix] of [
  ["0.0.0.0", 8], // "this" network / unspecified
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local incl. cloud metadata
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 3], // multicast + reserved + broadcast (224.0.0.0 - 255.255.255.255)
] as const) {
  blockedV4.addSubnet(net_, prefix, "ipv4");
}

function expandIPv6(addr: string): number[] | null {
  let a = addr.toLowerCase();
  const zone = a.indexOf("%");
  if (zone !== -1) a = a.slice(0, zone);
  // Trailing dotted IPv4 (::ffff:1.2.3.4)
  const lastColon = a.lastIndexOf(":");
  const tail = a.slice(lastColon + 1);
  if (tail.includes(".")) {
    if (net.isIPv4(tail) === false) return null;
    const o = tail.split(".").map(Number);
    a = a.slice(0, lastColon + 1) + ((o[0] << 8) | o[1]).toString(16) + ":" + ((o[2] << 8) | o[3]).toString(16);
  }
  const halves = a.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...rest].map((g) => parseInt(g, 16));
  if (groups.length !== 8 || groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) return null;
  return groups;
}

/**
 * True only for addresses that are global unicast and safe to connect to. Fails closed:
 * anything unparsable or not positively global is unsafe.
 */
export function isPublicIpAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return !blockedV4.check(address, "ipv4");
  if (family !== 6) return false;

  const g = expandIPv6(address);
  if (!g) return false;

  // IPv4-mapped (::ffff:a.b.c.d): classify the embedded IPv4 address.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    const v4 = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
    return !blockedV4.check(v4, "ipv4");
  }

  // Only global unicast 2000::/3 may pass; everything else (::, ::1, fc00::/7, fe80::/10, ff00::/8,
  // IPv4-compatible, NAT64 64:ff9b::/96, ...) is rejected.
  if ((g[0] & 0xe000) !== 0x2000) return false;
  // Special-purpose space inside 2000::/3.
  if (g[0] === 0x2001 && g[1] < 0x0200) return false; // 2001::/23 (Teredo, protocol assignments)
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // documentation
  if (g[0] === 0x2002) return false; // 6to4 (embeds arbitrary IPv4)
  if (g[0] === 0x3fff && g[1] < 0x1000) return false; // documentation 3fff::/20
  return true;
}

// ---------------------------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------------------------

/** Validates URL shape only (scheme, credentials, port). Network checks happen per hop. */
export function parseImportUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError("malformed url", "Please provide a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("unsupported protocol", "Only http(s) URLs are supported.");
  }
  if (url.username || url.password) {
    throw new SafeFetchError("credentials in url");
  }
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) {
    throw new SafeFetchError(`port ${port} not allowed`);
  }
  const host = hostOf(url);
  if (!host || host === "localhost" || host.endsWith(".localhost")) {
    throw new SafeFetchError("localhost host");
  }
  url.hash = "";
  return url;
}

function hostOf(url: URL): string {
  let h = url.hostname.toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  return h;
}

// ---------------------------------------------------------------------------------------------
// Resolution + pinned request
// ---------------------------------------------------------------------------------------------

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;
type RequestFn = (options: https.RequestOptions, cb: (res: IncomingMessage) => void) => http.ClientRequest;

const defaultResolver: Resolver = async (hostname) => {
  const results = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return results.map((r) => ({ address: r.address, family: r.family === 6 ? 6 : 4 }));
};

/** Resolve a hop's host and return validated addresses; throws if ANY candidate is unsafe. */
export async function resolvePublicAddresses(url: URL, resolver: Resolver = defaultResolver): Promise<ResolvedAddress[]> {
  const host = hostOf(url);
  const literal = net.isIP(host);
  if (literal) {
    if (!isPublicIpAddress(host)) throw new SafeFetchError("non-public literal address");
    return [{ address: host, family: literal === 6 ? 6 : 4 }];
  }
  let answers: ResolvedAddress[];
  try {
    answers = await resolver(host);
  } catch {
    throw new SafeFetchError("dns resolution failed");
  }
  if (!answers || answers.length === 0) throw new SafeFetchError("dns returned no addresses");
  for (const a of answers) {
    if (!isPublicIpAddress(a.address)) throw new SafeFetchError("dns answer includes non-public address");
  }
  return answers;
}

export type SafeFetchDeps = {
  resolver?: Resolver;
  httpRequest?: RequestFn;
  httpsRequest?: RequestFn;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBodyBytes?: number;
};

export type SafeFetchResult = { html: string; finalUrl: string };

/**
 * Fetch an HTML page from a user-supplied URL under the SSRF policy above.
 * Throws SafeFetchError (client-safe message) for every failure.
 */
export async function safeFetchPublicHtml(rawUrl: string, deps: SafeFetchDeps = {}): Promise<SafeFetchResult> {
  const resolver = deps.resolver ?? defaultResolver;
  const timeoutMs = deps.timeoutMs ?? FETCH_TIMEOUT_MS;
  const maxRedirects = deps.maxRedirects ?? MAX_REDIRECTS;
  const maxBody = deps.maxBodyBytes ?? MAX_BODY_BYTES;
  const deadline = Date.now() + timeoutMs;
  const seen = new Set<string>();

  let url = parseImportUrl(rawUrl);

  for (let hop = 0; ; hop++) {
    if (seen.has(url.toString())) throw new SafeFetchError("redirect loop");
    seen.add(url.toString());

    const addresses = await withDeadline(resolvePublicAddresses(url, resolver), deadline);
    const res = await requestPinned(url, addresses, deps, deadline, maxBody);

    const status = res.status;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.discard();
      if (hop >= maxRedirects) throw new SafeFetchError("too many redirects");
      let next: URL;
      try {
        next = new URL(String(res.headers.location), url);
      } catch {
        throw new SafeFetchError("malformed redirect location");
      }
      url = parseImportUrl(next.toString()); // re-validate shape; DNS/IP re-validated at loop top
      continue;
    }

    if (status < 200 || status >= 300) {
      res.discard();
      throw new SafeFetchError(`upstream HTTP ${status}`, `Failed to fetch page (HTTP ${status}).`);
    }

    const contentType = String(res.headers["content-type"] || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      res.discard();
      throw new SafeFetchError("non-html content", "URL did not return an HTML page.");
    }
    const declared = Number(res.headers["content-length"]);
    if (Number.isFinite(declared) && declared > maxBody) {
      res.discard();
      throw new SafeFetchError("too large", "Page is too large to import.");
    }

    const html = await res.readBody();
    return { html, finalUrl: url.toString() };
  }
}

function withDeadline<T>(p: Promise<T>, deadline: number): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(new SafeFetchError("timeout", "The page took too long to respond."));
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SafeFetchError("timeout", "The page took too long to respond.")), remaining);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

type PinnedResponse = {
  status: number;
  headers: IncomingMessage["headers"];
  discard: () => void;
  readBody: () => Promise<string>;
};

function requestPinned(
  url: URL,
  addresses: ResolvedAddress[],
  deps: SafeFetchDeps,
  deadline: number,
  maxBody: number,
): Promise<PinnedResponse> {
  const isHttps = url.protocol === "https:";
  const doRequest: RequestFn = isHttps ? (deps.httpsRequest ?? https.request) : (deps.httpRequest ?? http.request);
  const host = hostOf(url);

  // Pinned lookup: whatever the socket layer asks to resolve, answer only with the validated set.
  const pinnedLookup = ((_hostname: string, options: any, cb: any) => {
    if (typeof options === "function") cb = options;
    if (options && typeof options === "object" && options.all) {
      cb(null, addresses.map((a) => ({ address: a.address, family: a.family })));
    } else {
      cb(null, addresses[0].address, addresses[0].family);
    }
  }) as unknown as net.LookupFunction;

  return new Promise<PinnedResponse>((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new SafeFetchError("timeout", "The page took too long to respond."));

    let settled = false;
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.destroy();
      reject(err instanceof SafeFetchError ? err : new SafeFetchError(`transport error: ${(err as any)?.code ?? "unknown"}`));
    };

    const req = doRequest(
      {
        protocol: url.protocol,
        hostname: host, // original hostname: Host header, SNI and cert verification use this
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        lookup: pinnedLookup,
        agent: false, // per-request socket; no shared pool/global agent state
        headers: {
          "user-agent": "ChefSireRecipeImporter/1.0 (+https://chefsire.com)",
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "accept-encoding": "identity", // body bytes == bytes counted against the cap
        },
      },
      (res) => {
        if (settled) return res.destroy();
        settled = true;
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          discard: () => {
            clearTimeout(timer);
            res.destroy();
          },
          readBody: () =>
            new Promise<string>((resolveBody, rejectBody) => {
              const chunks: Buffer[] = [];
              let total = 0;
              const bodyFail = (e: unknown) => {
                clearTimeout(timer);
                res.destroy();
                rejectBody(e instanceof SafeFetchError ? e : new SafeFetchError("body read error"));
              };
              res.on("data", (c: Buffer) => {
                total += c.length;
                if (total > maxBody) return bodyFail(new SafeFetchError("too large", "Page is too large to import."));
                chunks.push(c);
              });
              res.on("end", () => {
                clearTimeout(timer);
                resolveBody(Buffer.concat(chunks).toString("utf8"));
              });
              res.on("error", bodyFail);
              res.on("aborted", () => bodyFail(new SafeFetchError("aborted")));
            }),
        });
      },
    );

    // One overall deadline covers connect, headers and body.
    const timer = setTimeout(() => {
      const err = new SafeFetchError("timeout", "The page took too long to respond.");
      if (!settled) return fail(err);
      req.destroy(); // body phase: destroys socket, res emits aborted/error -> bodyFail
    }, remaining);

    req.on("error", fail);
    req.end();
  });
}
