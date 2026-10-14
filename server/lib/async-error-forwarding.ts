/**
 * Stability Phase 2B: forward promise rejections from Express 4 route handlers and middleware to `next(error)`.
 *
 * Express 4 only catches SYNCHRONOUS throws. An `async` handler that rejects returns a rejected promise nobody awaits, so the request
 * hangs and the rejection reaches `process.on("unhandledRejection")`, which in server/index.ts logs and `process.exit(1)`s: one failing
 * request restarts the whole server for every user. Express 5 forwards rejections itself, so this is a no-op there.
 *
 * Design: wrap the handlers that are passed to Express's PUBLIC registration methods -- `Route.prototype[verb|all]` (which also backs
 * `router.get/post/...`, `app.get/post/...` and `router.route()`) and `Router.use` (which also backs `app.use` for plain functions).
 * No Router/Layer internals (`stack`, `Layer`, `handle_request`) are touched, so request order, route matching and method behaviour are
 * exactly Express's own. Only the function handed to Express is replaced by an equivalent one of arity 3.
 *
 * Rules the wrapper keeps:
 *  - arity-4 functions (error handlers) are never wrapped; `fn.length` of the wrapper is 3, so Express still treats it as a normal handler
 *  - routers / sub-apps (`.handle` / `.stack`) are never wrapped
 *  - already-wrapped functions (this wrapper or `asyncHandler`) are not wrapped twice
 *  - a synchronous throw propagates unchanged into Express's own try/catch
 *  - a rejection is forwarded at most once, and never after the handler itself called `next()` (that would run the chain twice); in that
 *    case the rejection is logged instead of forwarded, so it is neither swallowed nor allowed to reach `unhandledRejection`
 *  - the original rejection value reaches the error handler unmodified, except values `next()` would misread as control flow (see forwardableError)
 */
import { createRequire } from "node:module";
import express from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";

export const ASYNC_FORWARDED = Symbol.for("chefsire.asyncForwarded");
export const ASYNC_ORIGINAL = Symbol.for("chefsire.asyncOriginal");
const INSTALLED = Symbol.for("chefsire.asyncForwardingInstalled");

type AnyHandler = (req: Request, res: Response, next: NextFunction) => unknown;

/**
 * `next(x)` treats a falsy x as "no error" and the strings "route" / "router" as control flow, so rejecting with `undefined`, `null`,
 * `0`, `""`, `"route"` would silently continue the chain (a 404 or a skipped handler) instead of failing. Those values are wrapped in
 * an Error (original kept as `cause`); every other rejection value is forwarded untouched.
 */
function forwardableError(error: unknown): unknown {
  if (!error || error === "route" || error === "router") {
    const wrapped = new Error("Request handler rejected with a non-error value", { cause: error });
    return wrapped;
  }
  return error;
}

export function forwardAsyncErrors<T extends AnyHandler>(fn: T): RequestHandler {
  if ((fn as any)[ASYNC_FORWARDED]) return fn as unknown as RequestHandler;
  const wrapped = function asyncForwarded(this: unknown, req: Request, res: Response, next: NextFunction) {
    let nextCalled = false;
    const guardedNext = ((arg?: unknown) => {
      nextCalled = true;
      return (next as any)(arg);
    }) as NextFunction;
    const result = fn.call(this, req, res, guardedNext);
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      (result as PromiseLike<unknown>).then(undefined, (error: unknown) => {
        if (nextCalled) {
          console.error("[ChefSire] Handler rejected after it had already called next(); not forwarding (would re-enter the chain):", error);
          return;
        }
        nextCalled = true;
        next(forwardableError(error) as any);
      });
    }
    return undefined;
  };
  (wrapped as any)[ASYNC_FORWARDED] = true;
  (wrapped as any)[ASYNC_ORIGINAL] = fn;
  return wrapped as unknown as RequestHandler;
}

function shouldWrap(fn: unknown): fn is AnyHandler {
  if (typeof fn !== "function") return false;
  const f = fn as any;
  if (f.length === 4) return false; // error handler
  if (f[ASYNC_FORWARDED]) return false;
  if (f.handle || f.stack) return false; // express.Router() / sub-app
  return true;
}

/** Wrap every function in an argument list (arrays are handler lists or path lists; non-functions are left for Express to validate). */
function mapArgs(args: unknown[]): unknown[] {
  return args.map((a) => (Array.isArray(a) ? mapArgs(a) : shouldWrap(a) ? forwardAsyncErrors(a) : a));
}

function patch(target: any, name: string) {
  const original = target[name];
  if (typeof original !== "function") return;
  target[name] = function (this: unknown, ...args: unknown[]) {
    return original.apply(this, mapArgs(args));
  };
}

/** Idempotent. Must run before any router registers a handler (import it first from the entrypoints). */
export function installAsyncErrorForwarding(): { installed: boolean; reason?: string } {
  const major = Number(String(createRequire(import.meta.url)("express/package.json").version).split(".")[0]);
  if (major >= 5) return { installed: false, reason: "Express 5 forwards rejected promises natively" };
  const Router: any = (express as any).Router;
  if (Router[INSTALLED]) return { installed: false, reason: "already installed" };
  const Route: any = (express as any).Route;
  const skip = new Set(["_handles_method", "_options", "dispatch"]);
  const verbs = Object.keys(Route.prototype).filter((k) => typeof Route.prototype[k] === "function" && !skip.has(k));
  for (const v of verbs) patch(Route.prototype, v);
  patch(Router, "use");
  Router[INSTALLED] = true;
  return { installed: true };
}
