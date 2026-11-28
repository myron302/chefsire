/**
 * Rendering smoke check: the three things that can be wrong with a page while every test passes, every
 * build succeeds and nothing is logged anywhere.
 *
 * It exists because of a real incident. `index.css` once declared
 *
 *     --font-sans: Inter, var(--font-sans);
 *
 * A custom property that references itself is invalid at computed-value time, so `--font-sans` resolved to
 * nothing, every `font-family: var(--font-sans)` became an invalid declaration, and the entire site rendered
 * in the browser's default serif -- Times New Roman -- with no error in the console, no failing test, no
 * build warning and no server log. Nothing in the pipeline could have caught it, because catching it needs a
 * real browser to resolve the cascade: jsdom does not compute custom properties, and `tsc`, `vite build` and
 * every unit suite in this repo are all perfectly happy with a self-referential CSS variable.
 *
 * So this runs the built client in real Chromium and asserts three things about what a visitor actually sees:
 *
 *   1. text is laid out in the sans-serif it is supposed to be, not in the browser's fallback serif
 *   2. the brand colour resolves to an actual colour, not to nothing
 *   3. the feed column actually lays out posts, and nothing that is supposed to be a picture or a video
 *      anywhere on the page is laid out at zero size
 *
 * By default it serves `dist/public` (so a PR is checked before it can be deployed, not after). Point
 * SMOKE_BASE_URL at a deployed origin to run the same three assertions against that instead.
 *
 * Headings are deliberately serif ("Playfair Display"), so assertion 1 is made against body text and the
 * navigation, never against a heading -- otherwise it would fail on the design as intended.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { Browser } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIST = path.join(ROOT, "dist", "public");
const EXTERNAL = process.env.SMOKE_BASE_URL?.trim();
/** The route whose rendering matters most, and the one the incident was reported on. */
const ROUTE = process.env.SMOKE_ROUTE?.trim() || "/feed";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".map": "application/json",
};

/** Serves the built client with SPA fallback, so a client route resolves to index.html exactly as in production. */
function serveDist(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    let file = path.join(DIST, decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname));
    if (!path.resolve(file).startsWith(DIST)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
    res.writeHead(200, { "content-type": CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ baseUrl: `http://127.0.0.1:${port}`, close: () => new Promise((done) => server.close(() => done())) });
    });
  });
}

/** A font stack that is only the browser's default serif is the signature of a font-family declaration that was discarded. */
const SERIF_FALLBACK = /^\s*(["']?times new roman["']?|["']?times["']?|serif|["']?liberation serif["']?|["']?tinos["']?|["']?dejavu serif["']?)\s*(,\s*serif\s*)?$/i;
const SANS = /(^|,)\s*(["']?inter["']?|ui-sans-serif|system-ui|sans-serif|["']?helvetica|["']?arial)/i;

const available = EXTERNAL ? true : fs.existsSync(path.join(DIST, "index.html"));
if (!available) console.log(`# ${path.join("dist", "public", "index.html")} is missing (run \`npm run build\` first) -- rendering smoke check skipped`);
const smokeTest = available ? test : test.skip;

smokeTest("the built feed renders in its own sans-serif, resolves the brand colour, and lays out no zero-sized media", { timeout: 180_000 }, async () => {
  let launch: typeof import("playwright").chromium;
  try {
    ({ chromium: launch } = await import("playwright"));
  } catch (error) {
    assert.fail(`playwright is required for the rendering smoke check but could not be loaded: ${(error as Error).message}`);
  }

  const served = EXTERNAL ? null : await serveDist();
  const baseUrl = EXTERNAL ?? served!.baseUrl;
  let browser: Browser | null = null;
  try {
    browser = await launch.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const response = await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: "load", timeout: 60_000 });
    assert.ok(response, `no response for ${ROUTE}`);
    assert.ok(response!.status() < 400, `${ROUTE} returned HTTP ${response!.status()}`);
    // The app is client-rendered, so nothing below may be read until it has painted its own content. Wait for its
    // text, then for the feed to lay out its media. A timeout here is not fatal on its own: it falls through to the
    // assertions, which report what was actually on the page rather than a bare "waitForFunction timed out".
    await page.waitForFunction(() => (document.body?.innerText ?? "").trim().length > 40, undefined, { timeout: 60_000 });
    await page
      .waitForFunction(
        () => Array.from(document.querySelectorAll("img, video")).filter((el) => el.getBoundingClientRect().width > 0).length >= 3,
        undefined,
        { timeout: 30_000 },
      )
      .catch(() => undefined);

    const seen = await page.evaluate(() => {
      const probe = document.createElement("div");
      // Resolving var(--primary) through a real declaration is the only way to prove the token is usable; reading the
      // custom property back only proves a string was stored, even if it is a string no browser can parse.
      // The property MUST be a non-inherited one. A var() that substitutes an unparseable value makes the declaration
      // invalid at computed-value time, and such a declaration falls back to the INHERITED value on an inherited
      // property and to the INITIAL value otherwise. Probing `color` therefore reports the body's perfectly valid text
      // colour for a token like `18 100% 60%` (hsl() wrapper missing), passing while every background, border and
      // button built on --primary renders transparent. `background-color` falls back to transparent, so it cannot.
      probe.setAttribute("style", "background-color: var(--primary); position: fixed; left: -9999px");
      document.body.appendChild(probe);
      const probedColor = getComputedStyle(probe).backgroundColor;
      probe.remove();

      const nav = document.querySelector("nav, header");
      const media = Array.from(document.querySelectorAll<HTMLImageElement | HTMLVideoElement>("img, video")).map((el) => {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          tag: el.tagName,
          width: box.width,
          height: box.height,
          src: (el instanceof HTMLImageElement ? el.currentSrc || el.src : el.currentSrc || el.src) || el.getAttribute("src") || "",
          hidden: style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0,
          ariaHidden: el.getAttribute("aria-hidden") === "true",
          // The feed's own posts, as distinct from the chrome around them: the sidebar sits INSIDE <main>, so
          // "inside main" cannot tell a post apart from a trending-recipe thumbnail or the header logo.
          inFeedColumn: Boolean(el.closest("main")) && !el.closest("aside, nav, header"),
        };
      });

      return {
        bodyFont: getComputedStyle(document.body).fontFamily,
        navFont: nav ? getComputedStyle(nav).fontFamily : null,
        fontSansToken: getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim(),
        primaryToken: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
        probedColor,
        media,
        textLength: (document.body.innerText ?? "").trim().length,
      };
    });

    // 1. Text is in the sans-serif stack it declares, not the browser's fallback serif.
    assert.doesNotMatch(seen.bodyFont, SERIF_FALLBACK,
      `body font-family computed to the browser's fallback serif (${seen.bodyFont}). A font-family declaration was discarded -- `
      + `most likely a CSS custom property that is invalid at computed-value time, such as one that references itself. --font-sans resolved to "${seen.fontSansToken}".`);
    assert.match(seen.bodyFont, SANS, `body font-family names no sans-serif family (${seen.bodyFont})`);
    assert.ok(seen.fontSansToken.length > 0, "--font-sans resolved to nothing, so every font-family using it is invalid");
    if (seen.navFont !== null) {
      assert.doesNotMatch(seen.navFont, SERIF_FALLBACK, `navigation font-family computed to the fallback serif (${seen.navFont})`);
    }

    // 2. The brand colour resolves to an actual colour.
    assert.ok(seen.primaryToken.length > 0, "--primary resolved to nothing");
    assert.match(seen.probedColor, /^(rgb|rgba|color|lab|oklab|lch|oklch)\(/i,
      `var(--primary) did not resolve to a usable colour: a declaration of background-color: var(--primary) computed to "${seen.probedColor}" (token was "${seen.primaryToken}")`);
    assert.doesNotMatch(seen.probedColor, /^rgba\([^)]*,\s*0\s*\)$/i, `var(--primary) resolved to fully transparent ("${seen.probedColor}")`);

    // 3. Nothing that is supposed to be a picture or a video is laid out at zero size.
    const expected = seen.media.filter((item) => !item.hidden && !item.ariaHidden && item.src !== "");
    // Guards the guard: if the feed ever stops rendering posts, this assertion must not start passing vacuously. The
    // floor is counted in the FEED COLUMN, never page-wide: the sidebar alone lays out five trending-recipe thumbnails
    // and the header a logo, so a page-wide floor of 3 is still met with the entire post list missing.
    const inFeed = expected.filter((item) => item.inFeedColumn);
    assert.ok(inFeed.length >= 3,
      `expected the feed column to lay out at least 3 visible media elements, found ${inFeed.length} `
      + `(${expected.length} visible in the whole page, of ${seen.media.length} img/video in the DOM). `
      + "Either the feed stopped rendering posts, or the page failed to render at all -- this check cannot pass vacuously.");
    const collapsed = expected.filter((item) => item.width === 0 || item.height === 0);
    assert.deepEqual(collapsed, [],
      `${collapsed.length} visible media element(s) are laid out at zero size: `
      + collapsed.map((item) => `${item.tag} ${item.src.slice(-60)} ${item.width}x${item.height}`).join("; "));
  } finally {
    await browser?.close().catch(() => undefined);
    await served?.close();
  }
});
