/**
 * THE one Square environment-selection policy. Every Square integration (marketplace capture / refund / reconciliation, provider OAuth,
 * Catering sandbox checkout, drink / membership / bundle checkout and their webhooks) resolves Sandbox versus Production here and nowhere
 * else. Pure: reads only the environment object it is given, makes no network call and never logs.
 *
 * Fail closed, never guess:
 *  - `SQUARE_ENV=sandbox`      -> Sandbox, in any runtime.
 *  - `SQUARE_ENV` unset/blank  -> Sandbox outside a production runtime (development and tests stay Sandbox); under `NODE_ENV=production`
 *                                 it is a configuration fault. A production deployment that forgot the variable is neither silently
 *                                 sent to LIVE nor silently pointed at Sandbox.
 *  - `SQUARE_ENV=production`   -> LIVE only when BOTH `NODE_ENV=production` AND `SQUARE_LIVE_PAYMENTS_ENABLED=true` are also set. Going live is
 *                                 therefore two deliberate settings plus a production runtime, never one typo or one inherited variable.
 *  - anything else             -> a configuration fault (a typo is never mapped to an environment).
 *
 * Errors carry a stable reason code and a fixed message. They never echo the configured value, which may be a mistyped secret.
 */

export type SquareEnvironmentName = "sandbox" | "production";

export type SquareEnvironmentFailureReason =
  | "missing_in_production_runtime"
  | "invalid_value"
  | "live_requires_production_runtime"
  | "live_not_enabled";

const MESSAGES: Record<SquareEnvironmentFailureReason, string> = {
  missing_in_production_runtime: "SQUARE_ENV must be set explicitly ('sandbox' or 'production') when NODE_ENV=production.",
  invalid_value: "SQUARE_ENV must be 'sandbox' or 'production'.",
  live_requires_production_runtime: "SQUARE_ENV=production is only honoured when NODE_ENV=production.",
  live_not_enabled: "Live Square payments require SQUARE_LIVE_PAYMENTS_ENABLED=true in addition to SQUARE_ENV=production.",
};

/** The Square environment configuration is missing, invalid or unsafe. Carries no secret and never the configured value. */
export class SquareEnvironmentConfigError extends Error {
  readonly reason: SquareEnvironmentFailureReason;
  constructor(reason: SquareEnvironmentFailureReason = "invalid_value") {
    super(MESSAGES[reason]);
    this.name = "SquareEnvironmentConfigError";
    this.reason = reason;
  }
}

/** Throws {@link SquareEnvironmentConfigError} unless the environment is explicitly and safely configured. */
export function resolveSquareEnvironment(env: NodeJS.ProcessEnv = process.env): SquareEnvironmentName {
  const explicit = env.SQUARE_ENV?.trim().toLowerCase();
  const productionRuntime = env.NODE_ENV === "production";
  if (!explicit) {
    if (productionRuntime) throw new SquareEnvironmentConfigError("missing_in_production_runtime");
    return "sandbox";
  }
  if (explicit === "sandbox") return "sandbox";
  if (explicit === "production") {
    if (!productionRuntime) throw new SquareEnvironmentConfigError("live_requires_production_runtime");
    if (env.SQUARE_LIVE_PAYMENTS_ENABLED?.trim().toLowerCase() !== "true") throw new SquareEnvironmentConfigError("live_not_enabled");
    return "production";
  }
  throw new SquareEnvironmentConfigError("invalid_value");
}

/**
 * True only when `SQUARE_ENV` is EXACTLY `sandbox`. Two differences from {@link resolveSquareEnvironment}, both deliberate:
 * it never defaults (an unset or blank `SQUARE_ENV` is not Sandbox here, it is "not said"), and it does not trim or fold case.
 *
 * The wedding-square sandbox subsystem needs exactly that stricter rule. Every one of its modules refuses to run at all unless the operator
 * has named sandbox out loud, because the feature exists only against Square's sandbox and a missing variable must not let it start on an
 * inherited default. Each of those modules used to ask `process.env.SQUARE_ENV !== "sandbox"` itself -- 47 reads across 44 files, a second
 * policy by sheer repetition, and the exact thing square-environment-selection.test.ts exists to prevent. It lives here instead, next to the
 * policy it is a stricter variant of.
 *
 * It does NOT trim or lower-case, and that is the point rather than an omission. An earlier version of this did, which left the subsystem
 * half-converted: `SQUARE_ENV=Sandbox` passed these gates but was still refused by `sandboxEnvironmentSchema` in
 * wedding-square-enrollment-preflight.ts (`z.literal("sandbox")`), so enrollment got further in and then failed anyway. Accepting a new
 * spelling is a change to make deliberately, in one move, across the subsystem and its schema -- not a side effect of moving a comparison
 * into a shared function. So this is the comparison those 44 files were already making, character for character.
 */
export function isExplicitSandboxEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SQUARE_ENV === "sandbox";
}

/** Never throws: the environment name, or null when the configuration is missing, invalid or unsafe (callers treat null as "not configured"). */
export function tryResolveSquareEnvironment(env: NodeJS.ProcessEnv = process.env): SquareEnvironmentName | null {
  try {
    return resolveSquareEnvironment(env);
  } catch {
    return null;
  }
}
