// server/lib/jwt-config.ts
/**
 * The single source of truth for ChefSire's JWT signing and verification configuration.
 *
 * Before this module existed, `server/middleware/auth.ts` and `server/routes/auth.ts` each
 * resolved the signing secret independently and each silently fell back to a literal that is
 * committed to this repository. A deployment that started without `JWT_SECRET` would therefore
 * issue and accept tokens signed with a publicly knowable value, with nothing but a console
 * warning to show for it.
 *
 * The rule this module enforces:
 *
 *   - Production (and any runtime we cannot positively identify as development or test) must be
 *     given a real, non-placeholder secret, or configuration resolution FAILS. There is no
 *     production code path that reaches the built-in fallback.
 *   - Development and test -- and only those, recognised by an explicit `NODE_ENV` value -- may
 *     use the deterministic development fallback so local work and the test suite keep working.
 *
 * Anything that is neither "production", "development" nor "test" (including an unset or blank
 * `NODE_ENV`) is deliberately treated with production strictness. Guessing "probably development"
 * for an unlabelled runtime is exactly the failure mode this repair exists to remove.
 *
 * No function in this module ever logs, returns or embeds a configured secret value in an error.
 */
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

/**
 * The deterministic secret used by local development and the test suite. It is public by
 * construction (it lives here, in a public repository) and is rejected outright in production.
 */
export const DEV_ONLY_FALLBACK_JWT_SECRET = "CHEFSIRE_DEV_FALLBACK_SECRET";

/** Signing algorithm. Pinned so verification cannot be talked into accepting something else. */
export const AUTH_TOKEN_ALGORITHM = "HS256" as const;

/** Existing product behaviour: ChefSire access tokens live for seven days. Unchanged here. */
export const AUTH_TOKEN_EXPIRES_IN = "7d";

/**
 * Secrets that are publicly knowable and must never authenticate production traffic: the built-in
 * development fallback, the placeholders shipped in `.env.example`, and a handful of values that
 * are common enough to be in any attacker's first guesses.
 */
const KNOWN_UNSAFE_SECRETS = new Set(
  [
    DEV_ONLY_FALLBACK_JWT_SECRET,
    "your-super-secret-jwt-key-change-this-in-production",
    "your-super-secret-session-key-change-this-in-production",
    "change-me",
    "changeme",
    "secret",
    "jwtsecret",
    "jwt_secret",
    "development",
    "production",
    "test",
    "password",
  ].map((value) => value.toLowerCase()),
);

/**
 * Minimum length for a production secret. A 32-character secret is the usual floor for HS256 and
 * is what `openssl rand -base64 48` or `openssl rand -hex 32` produces comfortably.
 */
export const MIN_PRODUCTION_SECRET_LENGTH = 32;

/** How the running process describes itself. `unknown` is handled as strictly as production. */
export type AuthRuntimeMode = "production" | "development" | "test" | "unknown";

/** Where the resolved secret came from. */
export type JwtSecretSource = "JWT_SECRET" | "SESSION_SECRET" | "development-fallback";

export type JwtConfig = {
  /** The authoritative signing/verification secret. Never logged. */
  readonly secret: string;
  readonly mode: AuthRuntimeMode;
  readonly source: JwtSecretSource;
  /** True only in development/test when no secret was configured at all. */
  readonly usingDevelopmentFallback: boolean;
  readonly algorithm: typeof AUTH_TOKEN_ALGORITHM;
  readonly expiresIn: string;
};

/** Thrown when the runtime is not allowed to continue with the configuration it was given. */
export class JwtConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtConfigError";
  }
}

/**
 * Classify the runtime from an explicit `NODE_ENV` value only. No inference, no heuristics:
 * an unrecognised or absent value is `unknown`, and `unknown` does not get the dev fallback.
 */
export function resolveAuthRuntimeMode(env: NodeJS.ProcessEnv = process.env): AuthRuntimeMode {
  switch ((env.NODE_ENV ?? "").trim().toLowerCase()) {
    case "production":
      return "production";
    case "development":
      return "development";
    case "test":
      return "test";
    default:
      return "unknown";
  }
}

/** Only these two runtimes may use a built-in or otherwise unsafe secret. */
export function allowsDevelopmentSecret(mode: AuthRuntimeMode): boolean {
  return mode === "development" || mode === "test";
}

/**
 * Describe why a configured secret is unsafe, or return `null` if it is acceptable.
 * The returned text never contains the secret itself.
 */
export function describeUnsafeSecret(secret: string): string | null {
  if (KNOWN_UNSAFE_SECRETS.has(secret.toLowerCase())) {
    return "it matches a publicly known development/placeholder value";
  }
  if (secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
    return `it is shorter than the required ${MIN_PRODUCTION_SECRET_LENGTH} characters`;
  }
  return null;
}

function configurationRequiredMessage(
  mode: AuthRuntimeMode,
  detail: string,
  env: NodeJS.ProcessEnv,
): string {
  const runtime =
    mode === "production"
      ? "NODE_ENV=production"
      : `an unrecognised NODE_ENV (received ${JSON.stringify(env.NODE_ENV ?? "")})`;
  return (
    `JWT_SECRET is required in production: refusing to start with ${runtime} because ${detail}. ` +
    "Set JWT_SECRET (or SESSION_SECRET) to a private, randomly generated value of at least " +
    `${MIN_PRODUCTION_SECRET_LENGTH} characters before serving traffic -- for example ` +
    "`openssl rand -base64 48`. For local work set NODE_ENV=development or NODE_ENV=test instead."
  );
}

/**
 * Resolve the JWT configuration for a given environment. Pure: it reads `env`, touches nothing
 * else, and throws `JwtConfigError` rather than returning an insecure configuration.
 *
 * Precedence is `JWT_SECRET` then `SESSION_SECRET`, preserving ChefSire's existing convention so
 * deployments that only set `SESSION_SECRET` keep working.
 */
export function resolveJwtConfig(env: NodeJS.ProcessEnv = process.env): JwtConfig {
  const mode = resolveAuthRuntimeMode(env);
  const fromJwtSecret = typeof env.JWT_SECRET === "string" ? env.JWT_SECRET.trim() : "";
  const fromSessionSecret = typeof env.SESSION_SECRET === "string" ? env.SESSION_SECRET.trim() : "";

  // A missing, empty or whitespace-only value is indistinguishable from "not configured".
  const configured = fromJwtSecret || fromSessionSecret;
  const source: JwtSecretSource = fromJwtSecret ? "JWT_SECRET" : "SESSION_SECRET";

  if (!configured) {
    if (!allowsDevelopmentSecret(mode)) {
      throw new JwtConfigError(
        configurationRequiredMessage(
          mode,
          "no JWT signing secret is configured (missing, empty or whitespace-only)",
          env,
        ),
      );
    }
    return {
      secret: DEV_ONLY_FALLBACK_JWT_SECRET,
      mode,
      source: "development-fallback",
      usingDevelopmentFallback: true,
      algorithm: AUTH_TOKEN_ALGORITHM,
      expiresIn: AUTH_TOKEN_EXPIRES_IN,
    };
  }

  const problem = describeUnsafeSecret(configured);
  if (problem && !allowsDevelopmentSecret(mode)) {
    throw new JwtConfigError(
      configurationRequiredMessage(mode, `the configured JWT signing secret is unsafe -- ${problem}`, env),
    );
  }

  return {
    secret: configured,
    mode,
    source,
    usingDevelopmentFallback: false,
    algorithm: AUTH_TOKEN_ALGORITHM,
    expiresIn: AUTH_TOKEN_EXPIRES_IN,
  };
}

let cachedConfig: JwtConfig | null = null;
let warnedAboutDevelopmentFallback = false;

/**
 * The process-wide configuration, resolved once. Throws in production when configuration is
 * missing or unsafe; `assertJwtConfigured()` calls this at startup so the failure lands at boot
 * rather than on the first authenticated request.
 */
export function getJwtConfig(): JwtConfig {
  if (!cachedConfig) {
    cachedConfig = resolveJwtConfig(process.env);
    if (cachedConfig.usingDevelopmentFallback && !warnedAboutDevelopmentFallback) {
      warnedAboutDevelopmentFallback = true;
      console.warn(
        `[auth] No JWT_SECRET configured. Using the built-in development fallback (NODE_ENV=${cachedConfig.mode}). ` +
          "This is never reachable in production.",
      );
    }
  }
  return cachedConfig;
}

/** The authoritative signing/verification secret. */
export function getJwtSecret(): string {
  return getJwtConfig().secret;
}

/**
 * Validate configuration eagerly. Call this during startup so a production process with missing
 * or unsafe JWT configuration fails closed before it ever accepts a request.
 */
export function assertJwtConfigured(): JwtConfig {
  return getJwtConfig();
}

/** Test-only: drop the memoised configuration so a test can resolve a different environment. */
export function resetJwtConfigCacheForTests(): void {
  cachedConfig = null;
  warnedAboutDevelopmentFallback = false;
}

/** What ChefSire puts in an access token. Claims here identify; they do not authorize. */
export type AuthTokenClaims = {
  id: string;
  email?: string;
  username?: string;
};

/**
 * Sign a ChefSire access token. Every issuance path goes through here so the secret, algorithm
 * and lifetime cannot drift apart between the login route, the OAuth callbacks and the middleware.
 */
export function signAuthToken(
  claims: AuthTokenClaims,
  options: Omit<SignOptions, "algorithm"> = {},
): string {
  const config = getJwtConfig();
  return jwt.sign(claims, config.secret, {
    expiresIn: config.expiresIn,
    ...options,
    algorithm: config.algorithm,
  } as SignOptions);
}

/**
 * Verify a ChefSire access token with the same configuration used to sign it, pinned to the
 * expected algorithm so a token cannot ask to be verified some other way. Throws the usual
 * `jsonwebtoken` errors (`TokenExpiredError`, `JsonWebTokenError`) on failure.
 */
export function verifyAuthToken(token: string): JwtPayload & AuthTokenClaims {
  const config = getJwtConfig();
  return jwt.verify(token, config.secret, {
    algorithms: [config.algorithm],
  }) as JwtPayload & AuthTokenClaims;
}
