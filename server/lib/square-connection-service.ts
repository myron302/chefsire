import { randomUUID } from "node:crypto";
import {
  classifySquareFailure,
  hasRequiredSquareScopes,
  selectPaymentLocation,
  squareFailureStatus,
  squareOauthApplication,
  type SquareLocationFacts,
  type SquareMerchantProfile,
  type SquareProviderApi,
} from "./square-integration";
import {
  assertSecretBoxConfigured,
  decryptSecret,
  encryptSecret,
  isSecretBoxConfigured,
  sealedSecretNeedsRotation,
  SecretBoxError,
} from "./secret-box";

/**
 * Trustworthy state for a provider's connected Square account.
 *
 * A payment_methods row existing means NOTHING here. A connection is usable only when every one of these holds,
 * and each is re-derived from persisted, verified facts on every check:
 *   - the row is `active` and carries a sealed credential pair that opens under the server key;
 *   - the access token is not about to expire (it is refreshed, under a row lock, before it does);
 *   - Square reports the token belongs to the merchant that was authorized and carries every required scope;
 *   - Square lists an ACTIVE location of that merchant that can process cards.
 *
 * Square is asked to confirm these facts at most once per VERIFY_TTL unless the caller forces it, and a failure to
 * REACH Square never changes stored state: only an authoritative answer that the credential is bad does.
 *
 * Tokens leave this module only through `getReadyConnectedCredentials`, which is for server-side payment code, and
 * through nothing else. No log line, error message or return value of any other function contains one.
 */

export type SqlResult = { rows: Record<string, unknown>[]; rowCount: number | null };
export interface SqlClient {
  query(text: string, params?: unknown[]): Promise<SqlResult>;
}
export interface SqlPool extends SqlClient {
  connect(): Promise<SqlClient & { release(): void }>;
}

export type SquareReadinessState =
  | "not_connected"
  | "active"
  | "needs_reauthorization"
  | "no_payment_location"
  | "configuration_error"
  | "verification_unavailable";

export type SquarePaymentReadiness = {
  state: SquareReadinessState;
  paymentReady: boolean;
  merchantId: string | null;
  merchantName: string | null;
  locationId: string | null;
  locationName: string | null;
  locationCurrency: string | null;
};

/** The ONLY shape the status endpoint returns. No id, token, ciphertext, scope list or provider detail. */
export type SquareConnectionStatusView = {
  state: SquareReadinessState;
  connected: boolean;
  paymentReady: boolean;
  needsReauthorization: boolean;
  merchantDisplayName: string | null;
  locationDisplayName: string | null;
};

export const SQUARE_TOKEN_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const SQUARE_VERIFICATION_TTL_MS = 6 * 60 * 60 * 1000;
const LOCK_TIMEOUT = "10s";

export interface SquareConnectionLogger {
  warn(event: string, fields: Record<string, string | number | boolean | null>): void;
}
const defaultLogger: SquareConnectionLogger = {
  warn: (event, fields) => console.warn(JSON.stringify({ event, ...fields })),
};

export type ConnectionRow = {
  id: string;
  user_id: string;
  provider_id: string;
  account_status: string | null;
  account_details: Record<string, unknown> | null;
  encrypted_access_token: string | null;
  encrypted_refresh_token: string | null;
  token_expires_at: Date | null;
  last_refreshed_at: Date | null;
  location_id: string | null;
  location_name: string | null;
  location_currency: string | null;
  merchant_name: string | null;
  granted_scopes: string[] | null;
  last_verified_at: Date | null;
  /** bigint, delivered by the driver as a string. Identifies the credential snapshot; see 20261008_square_credential_generation.sql. */
  credential_generation: string;
};

const ROW_COLUMNS = `id, user_id, provider_id, account_status, account_details, encrypted_access_token, encrypted_refresh_token,
  token_expires_at, last_refreshed_at, location_id, location_name, location_currency, merchant_name, granted_scopes, last_verified_at, credential_generation`;

const LEGACY_SECRET_KEYS = ["accessToken", "refreshToken", "tokenExpiresAt"] as const;

const accessAad = (id: string) => `payment_methods:${id}:square_access_token`;
const refreshAad = (id: string) => `payment_methods:${id}:square_refresh_token`;

/** Square answered, the credential is bad, and the connection has been taken out of service. */
export type ConnectionOutcome = { kind: "ok"; accessToken: string; row: ConnectionRow } | { kind: "needs_reauthorization"; row: ConnectionRow | null };

/** What a verification attempt concluded about the EXACT snapshot it started from. `stale` means that snapshot is gone. */
type VerificationOutcome =
  | { kind: "verified"; row: ConnectionRow }
  | { kind: "needs_reauthorization"; row: ConnectionRow }
  | { kind: "stale" };

/** A snapshot changing under an attempt is retried from a fresh read this many times, then reported as unverifiable. */
const MAX_SNAPSHOT_RETRIES = 3;

export class SquareConnectionUnavailableError extends Error {
  constructor() {
    super("Square could not be reached to verify the connection.");
    this.name = "SquareConnectionUnavailableError";
  }
}
/**
 * Square rejected CHEFSIRE'S OWN application credentials (wrong, stale or rotating application secret, disabled client).
 * That is a configuration fault, not evidence about any provider's grant: nothing stored is changed because of it.
 */
export class SquareApplicationAuthError extends Error {
  constructor() {
    super("Square rejected ChefSire's application credentials.");
    this.name = "SquareApplicationAuthError";
  }
}
/**
 * A merchant-wide revocation committed after this authorization was obtained (so the token it carries is no longer valid even
 * though Square issued it), or the connection changed concurrently. The authorization is not stored; the provider connects again.
 */
export class SquareAuthorizationSupersededError extends Error {
  constructor() {
    super("The Square authorization was revoked while connecting.");
    this.name = "SquareAuthorizationSupersededError";
  }
}

/**
 * What a disconnect did at Square:
 *  - `revoked`                         Square confirmed ChefSire's authorization for the merchant is revoked (including an
 *                                      authoritative "this token is already invalid").
 *  - `retained_for_shared_connection`  Intentionally NOT revoked: another active ChefSire connection uses the same Square
 *                                      merchant, and Square revokes every token of the application for a merchant.
 *  - `unconfirmed`                     Square could not confirm a revocation (outage, rejected application credentials,
 *                                      encryption/configuration fault, or there was no stored credential left to revoke
 *                                      with). The local disconnect still completed; Square access may remain.
 *  - `not_applicable`                  Nothing was connected, so nothing was changed.
 */
export type ProviderRevocation = "revoked" | "retained_for_shared_connection" | "unconfirmed" | "not_applicable";

/** Stored credentials exist but cannot be opened with the configured key. A configuration fault: nothing is changed. */
export class SquareCredentialError extends Error {
  constructor() {
    super("Stored Square credentials could not be opened.");
    this.name = "SquareCredentialError";
  }
}

export type VerifiedAuthorization = {
  merchantId: string;
  merchantName: string | null;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  scopes: string[];
  location: SquareLocationFacts | null;
  /** When ChefSire began exchanging the authorization code (this service's clock). Compared with merchant-wide revocations. */
  authorizedAt: Date;
};

export type AuthorizationFailure = "provider_rejected" | "merchant_mismatch" | "scopes_insufficient" | "unavailable" | "not_configured";

export type LegacyConversionResult =
  | { kind: "converted" | "already_converted" | "nothing_to_convert"; id: string }
  | { kind: "malformed"; id: string; reason: string };

export type SquareConnectionServiceDeps = {
  pool: SqlPool;
  api: SquareProviderApi;
  now?: () => Date;
  log?: SquareConnectionLogger;
};

function hasLegacySecrets(details: Record<string, unknown> | null | undefined): boolean {
  return Boolean(details) && (typeof details!.accessToken === "string" || typeof details!.refreshToken === "string");
}

function emptyReadiness(state: SquareReadinessState, row?: ConnectionRow | null): SquarePaymentReadiness {
  return {
    state,
    paymentReady: false,
    merchantId: row?.provider_id ?? null,
    merchantName: row?.merchant_name ?? null,
    locationId: row?.location_id ?? null,
    locationName: row?.location_name ?? null,
    locationCurrency: row?.location_currency ?? null,
  };
}

export function toSquareConnectionStatusView(readiness: SquarePaymentReadiness): SquareConnectionStatusView {
  const connected = readiness.state === "active" || readiness.state === "no_payment_location"
    || readiness.state === "needs_reauthorization" || readiness.state === "verification_unavailable";
  return {
    state: readiness.state,
    connected,
    paymentReady: readiness.paymentReady,
    needsReauthorization: readiness.state === "needs_reauthorization",
    merchantDisplayName: connected ? readiness.merchantName : null,
    locationDisplayName: connected ? readiness.locationName : null,
  };
}

export function createSquareConnectionService(deps: SquareConnectionServiceDeps) {
  const { pool, api } = deps;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? defaultLogger;

  async function loadRow(db: SqlClient, userId: string, forUpdate: boolean): Promise<ConnectionRow | null> {
    const result = await db.query(
      `SELECT ${ROW_COLUMNS} FROM payment_methods
       WHERE user_id = $1 AND provider = 'square'
       ORDER BY created_at ASC, id ASC LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
      [userId],
    );
    return (result.rows[0] as unknown as ConnectionRow | undefined) ?? null;
  }

  /**
   * Takes a connection out of service. Keeps merchant/location identity; removes every secret; advances the credential
   * generation. It applies ONLY to the exact snapshot the caller judged (id + generation + still active): a stale attempt
   * matches nothing, changes nothing and returns false, so it can never clear credentials that replaced the ones it saw.
   */
  async function markNeedsReauthorization(db: SqlClient, snapshot: Pick<ConnectionRow, "id" | "credential_generation">, reason: string): Promise<boolean> {
    const result = await db.query(
      `UPDATE payment_methods
       SET account_status = 'needs_reauthorization',
           encrypted_access_token = NULL, encrypted_refresh_token = NULL, token_expires_at = NULL,
           account_details = COALESCE(account_details, '{}'::jsonb) - 'accessToken' - 'refreshToken' - 'tokenExpiresAt',
           credential_generation = credential_generation + 1,
           status_changed_at = $3, updated_at = $3
       WHERE id = $1 AND account_status = 'active' AND credential_generation = $2::bigint`,
      [snapshot.id, snapshot.credential_generation, now()],
    );
    const changed = Boolean(result.rowCount);
    if (changed) log.warn("square_connection_needs_reauthorization", { paymentMethodId: snapshot.id, reason });
    else log.warn("square_connection_snapshot_changed", { paymentMethodId: snapshot.id, attempted: "needs_reauthorization" });
    return changed;
  }

  /**
   * MERCHANT-SCOPED LOCK. Everything that decides or changes which ChefSire accounts are connected to Square merchant M --
   * OAuth persistence, disconnect and the merchant-wide revoke decision -- first takes the transaction-scoped advisory lock
   * for M, so those decisions are serialized per merchant (and independent across merchants).
   *
   * LOCK ORDER (documented, and the only one used): users row (OAuth callback only) -> merchant advisory locks, ascending by
   * key -> the payment_methods row (FOR UPDATE). Token refresh and verification take only the row lock and never wait for a
   * merchant lock while holding it, so no cycle exists. Refresh does not change merchant membership (its merchant is verified
   * unchanged). A connection that Square itself rejects (needs_reauthorization) leaves the active set under the row lock only:
   * Square has already declared that credential unusable, so there is nothing left to revoke for it.
   */
  async function lockMerchants(db: SqlClient, merchantIds: ReadonlyArray<string | null | undefined>): Promise<void> {
    const keys = new Set<number>();
    for (const merchantId of Array.from(new Set(merchantIds))) {
      if (!merchantId) continue;
      const hashed = await db.query(`SELECT hashtext($1) AS key`, [`square-merchant:${merchantId}`]);
      keys.add(Number(hashed.rows[0].key));
    }
    for (const key of Array.from(keys).sort((a, b) => a - b)) await db.query(`SELECT pg_advisory_xact_lock($1::bigint)`, [key]);
  }

  /** The row as it stands once `markNeedsReauthorization` has applied to it: no credentials, not active. */
  function outOfService(row: ConnectionRow): ConnectionRow {
    return { ...row, account_status: "needs_reauthorization", encrypted_access_token: null, encrypted_refresh_token: null, token_expires_at: null };
  }

  /* ----------------------------------------------------------------------------------------------------------- *
   * Legacy plaintext conversion
   * ----------------------------------------------------------------------------------------------------------- */

  /**
   * Seals one row's legacy plaintext tokens. Idempotent and safe to run concurrently: it works under the row lock,
   * a converted row is a no-op, and a malformed row is reported (by id and reason only) and left exactly as it was.
   * The plaintext keys are removed in the SAME statement that stores the sealed values.
   */
  async function convertLegacyRow(db: SqlClient, rowId: string): Promise<LegacyConversionResult> {
    assertSecretBoxConfigured();
    const found = await db.query(`SELECT ${ROW_COLUMNS} FROM payment_methods WHERE id = $1 AND provider = 'square' FOR UPDATE`, [rowId]);
    const row = found.rows[0] as unknown as ConnectionRow | undefined;
    if (!row) return { kind: "nothing_to_convert", id: rowId };
    const details = row.account_details;
    if (!hasLegacySecrets(details) && !(details && "tokenExpiresAt" in details)) {
      return { kind: row.encrypted_access_token ? "already_converted" : "nothing_to_convert", id: rowId };
    }
    if (row.encrypted_access_token) {
      // Sealed credentials already exist; only stale plaintext remains, and it is simply removed.
      await db.query(
        `UPDATE payment_methods SET account_details = account_details - 'accessToken' - 'refreshToken' - 'tokenExpiresAt', updated_at = now() WHERE id = $1`,
        [rowId],
      );
      return { kind: "converted", id: rowId };
    }
    const accessToken = details?.accessToken;
    const refreshToken = details?.refreshToken;
    const expiresAt = typeof details?.tokenExpiresAt === "string" ? new Date(details.tokenExpiresAt) : null;
    if (typeof accessToken !== "string" || !accessToken || typeof refreshToken !== "string" || !refreshToken) {
      return { kind: "malformed", id: rowId, reason: "missing_or_non_string_token" };
    }
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) return { kind: "malformed", id: rowId, reason: "invalid_expiry" };
    if (row.account_status !== "active") return { kind: "malformed", id: rowId, reason: "inactive_connection_with_secrets" };
    await db.query(
      `UPDATE payment_methods
       SET encrypted_access_token = $2, encrypted_refresh_token = $3, token_expires_at = $4,
           account_details = account_details - 'accessToken' - 'refreshToken' - 'tokenExpiresAt',
           credential_generation = credential_generation + 1, updated_at = now()
       WHERE id = $1`,
      [rowId, encryptSecret(accessToken, accessAad(rowId)), encryptSecret(refreshToken, refreshAad(rowId)), expiresAt],
    );
    return { kind: "converted", id: rowId };
  }

  async function convertLegacyRowInTransaction(rowId: string): Promise<LegacyConversionResult> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await convertLegacyRow(client, rowId);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Converts every legacy row. Reports counts and ids only -- never a token. */
  async function convertAllLegacyRows(options: { dryRun?: boolean } = {}) {
    const candidates = await pool.query(
      `SELECT id FROM payment_methods WHERE provider = 'square' AND account_details ?| ARRAY['accessToken', 'refreshToken', 'tokenExpiresAt'] ORDER BY created_at ASC, id ASC`,
    );
    const summary = { found: candidates.rows.length, converted: 0, alreadyConverted: 0, malformed: [] as { id: string; reason: string }[] };
    if (options.dryRun) return summary;
    for (const candidate of candidates.rows) {
      const result = await convertLegacyRowInTransaction(String(candidate.id));
      if (result.kind === "converted") summary.converted += 1;
      else if (result.kind === "malformed") summary.malformed.push({ id: result.id, reason: result.reason });
      else summary.alreadyConverted += 1;
    }
    return summary;
  }

  /* ----------------------------------------------------------------------------------------------------------- *
   * Authorization (OAuth callback)
   * ----------------------------------------------------------------------------------------------------------- */

  /**
   * Everything that needs Square, with no database access: exchange the code, then PROVE who the token belongs to.
   * The merchant id in the token response must equal the merchant Square's own profile endpoint reports for that
   * token, which must equal the merchant the token status endpoint reports; the required scopes must all have been
   * granted. Any mismatch or doubt is a failure and nothing is stored.
   */
  async function verifyAuthorizationCode(code: string): Promise<{ ok: true; verified: VerifiedAuthorization } | { ok: false; reason: AuthorizationFailure }> {
    if (!isSecretBoxConfigured() || !squareOauthApplication()) return { ok: false, reason: "not_configured" };
    const authorizedAt = now();
    let surface: "token_grant" | "bearer" = "token_grant";
    try {
      const grant = await api.exchangeAuthorizationCode(code);
      surface = "bearer";
      if (!grant.refreshToken || !grant.merchantId) return { ok: false, reason: "provider_rejected" };
      const merchant: SquareMerchantProfile = await api.retrieveMerchant(grant.accessToken);
      if (merchant.id !== grant.merchantId) return { ok: false, reason: "merchant_mismatch" };
      const tokenStatus = await api.retrieveTokenStatus(grant.accessToken);
      if (tokenStatus.merchantId && tokenStatus.merchantId !== merchant.id) return { ok: false, reason: "merchant_mismatch" };
      if (!hasRequiredSquareScopes(tokenStatus.scopes)) return { ok: false, reason: "scopes_insufficient" };
      const locations = await api.listLocations(grant.accessToken);
      return {
        ok: true,
        verified: {
          merchantId: merchant.id,
          merchantName: merchant.businessName,
          accessToken: grant.accessToken,
          refreshToken: grant.refreshToken,
          tokenExpiresAt: grant.expiresAt,
          scopes: tokenStatus.scopes,
          location: selectPaymentLocation(locations, merchant.id, { mainLocationId: merchant.mainLocationId }),
          authorizedAt,
        },
      };
    } catch (error) {
      const failure = classifySquareFailure(error, { surface });
      log.warn("square_authorization_verification_failed", { status: squareFailureStatus(error), kind: failure, surface });
      // Rejected APPLICATION credentials are ChefSire's configuration problem, not the provider's grant being refused.
      if (failure === "application_auth") return { ok: false, reason: "not_configured" };
      return { ok: false, reason: failure === "provider_credential_invalid" ? "provider_rejected" : "unavailable" };
    }
  }

  /**
   * Stores a verified authorization INSIDE the caller's transaction, so it commits or rolls back together with the
   * OAuth transaction's consume. Tokens are sealed here, bound to the row id; nothing is written in plaintext.
   */
  async function persistVerifiedConnection(db: SqlClient, userId: string, verified: VerifiedAuthorization): Promise<{ paymentMethodId: string }> {
    // Merchant locks first (the merchant being connected, and the one this account is leaving if it is changing merchant),
    // then the row. Everything below runs inside the caller's transaction, so the locks are held until it commits.
    const preview = await loadRow(db, userId, false);
    await lockMerchants(db, [verified.merchantId, preview?.provider_id]);
    const existing = await loadRow(db, userId, true);
    if (existing && existing.provider_id !== verified.merchantId && existing.provider_id !== preview?.provider_id) {
      // The account changed merchant between the two reads. Taking a further merchant lock now could invert the lock order.
      throw new SquareAuthorizationSupersededError();
    }
    // A merchant-wide revocation that committed after this authorization began has invalidated the token it carries: Square
    // revokes every token of the application for a merchant, including one issued just before. Refuse to store it.
    const revoked = await db.query(
      `SELECT 1 FROM payment_methods WHERE provider = 'square' AND provider_id = $1 AND merchant_revoked_at IS NOT NULL AND merchant_revoked_at > $2 LIMIT 1`,
      // Strictly after: an authorization that began AFTER the revocation is a fresh grant and is unaffected. (Both times come
      // from the service clock; across instances their skew is the residual risk, and a token that did slip through is caught
      // by the next verification, which Square answers with 401.)
      [verified.merchantId, verified.authorizedAt],
    );
    if (revoked.rows.length) throw new SquareAuthorizationSupersededError();
    const id = existing?.id ?? randomUUID();
    const sealedAccess = encryptSecret(verified.accessToken, accessAad(id));
    const sealedRefresh = encryptSecret(verified.refreshToken, refreshAad(id));
    const at = now();
    const details = JSON.stringify({ merchantId: verified.merchantId });
    const location = verified.location;
    if (existing) {
      await db.query(
        `UPDATE payment_methods
         SET provider_id = $2, account_status = 'active', account_details = $3::jsonb,
             encrypted_access_token = $4, encrypted_refresh_token = $5, token_expires_at = $6, last_refreshed_at = $7,
             location_id = $8, location_name = $9, location_currency = $10, merchant_name = $11, granted_scopes = $12,
             status_changed_at = $7, disconnected_at = NULL, verified_at = $7, last_verified_at = $7, updated_at = $7,
             credential_generation = credential_generation + 1
         WHERE id = $1`,
        [id, verified.merchantId, details, sealedAccess, sealedRefresh, verified.tokenExpiresAt, at,
          location?.id ?? null, location?.name ?? null, location?.currency ?? null, verified.merchantName, verified.scopes],
      );
    } else {
      await db.query(
        `INSERT INTO payment_methods
           (id, user_id, provider, provider_id, account_status, account_details, is_default,
            encrypted_access_token, encrypted_refresh_token, token_expires_at, last_refreshed_at,
            location_id, location_name, location_currency, merchant_name, granted_scopes,
            status_changed_at, verified_at, last_verified_at)
         VALUES ($1, $2, 'square', $3, 'active', $4::jsonb, true, $5, $6, $7, $8, $9, $10, $11, $12, $13, $8, $8, $8)`,
        [id, userId, verified.merchantId, details, sealedAccess, sealedRefresh, verified.tokenExpiresAt, at,
          location?.id ?? null, location?.name ?? null, location?.currency ?? null, verified.merchantName, verified.scopes],
      );
    }
    return { paymentMethodId: id };
  }

  /* ----------------------------------------------------------------------------------------------------------- *
   * Credentials: open, refresh (single flight), verify
   * ----------------------------------------------------------------------------------------------------------- */

  function openAccessToken(row: ConnectionRow): string {
    try {
      return decryptSecret(row.encrypted_access_token!, accessAad(row.id));
    } catch (error) {
      if (error instanceof SecretBoxError) throw new SquareCredentialError();
      throw error;
    }
  }

  function refreshDue(row: ConnectionRow): boolean {
    return !row.token_expires_at || row.token_expires_at.getTime() - now().getTime() <= SQUARE_TOKEN_REFRESH_WINDOW_MS;
  }

  /**
   * Returns a usable access token, refreshing first when it expires within the safety window.
   *
   * SINGLE FLIGHT. Refresh runs in a transaction holding the connection row's FOR UPDATE lock, and re-reads the row
   * after taking it. Two concurrent callers therefore refresh at most once: the second waits, then sees an expiry
   * that is no longer near and uses the stored result. (Square's code-flow refresh returns the SAME refresh token;
   * if it ever returns a new one it is sealed and stored in the same statement.) Lock waits are bounded.
   */
  async function ensureFreshCredentials(userId: string): Promise<ConnectionOutcome> {
    const unlocked = await loadRow(pool, userId, false);
    if (!unlocked || unlocked.account_status !== "active" || !unlocked.encrypted_access_token || !unlocked.encrypted_refresh_token) {
      return { kind: "needs_reauthorization", row: unlocked };
    }
    if (!refreshDue(unlocked)) return { kind: "ok", accessToken: openAccessToken(unlocked), row: unlocked };

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`);
      const row = await loadRow(client, userId, true);
      if (!row || row.account_status !== "active" || !row.encrypted_access_token || !row.encrypted_refresh_token) {
        await client.query("COMMIT");
        return { kind: "needs_reauthorization", row };
      }
      if (!refreshDue(row)) {
        await client.query("COMMIT");
        return { kind: "ok", accessToken: openAccessToken(row), row };
      }
      let refreshToken: string;
      try {
        refreshToken = decryptSecret(row.encrypted_refresh_token, refreshAad(row.id));
      } catch (error) {
        await client.query("ROLLBACK");
        if (error instanceof SecretBoxError) throw new SquareCredentialError();
        throw error;
      }
      let grant;
      try {
        grant = await api.refreshAccessToken(refreshToken);
      } catch (error) {
        const failure = classifySquareFailure(error, { surface: "token_grant" });
        // ONLY Square positively saying the provider's grant is invalid may clear credentials, and only the snapshot judged here.
        if (failure === "provider_credential_invalid") {
          await markNeedsReauthorization(client, row, "refresh_rejected");
          await client.query("COMMIT");
          return { kind: "needs_reauthorization", row: outOfService(row) };
        }
        await client.query("ROLLBACK");
        log.warn(failure === "application_auth" ? "square_application_auth_failed" : "square_token_refresh_unavailable", { paymentMethodId: row.id, status: squareFailureStatus(error), kind: failure });
        if (failure === "application_auth") throw new SquareApplicationAuthError();
        throw new SquareConnectionUnavailableError();
      }
      // The refreshed token must still belong to the merchant this connection was authorized for.
      let grantMerchantId = grant.merchantId;
      if (!grantMerchantId) {
        try {
          grantMerchantId = (await api.retrieveMerchant(grant.accessToken)).id;
        } catch (error) {
          const failure = classifySquareFailure(error, { surface: "bearer" });
          if (failure === "provider_credential_invalid") {
            await markNeedsReauthorization(client, row, "refresh_identity_rejected");
            await client.query("COMMIT");
            return { kind: "needs_reauthorization", row: outOfService(row) };
          }
          await client.query("ROLLBACK");
          log.warn(failure === "application_auth" ? "square_application_auth_failed" : "square_token_refresh_unavailable", { paymentMethodId: row.id, status: squareFailureStatus(error), kind: failure });
          if (failure === "application_auth") throw new SquareApplicationAuthError();
          throw new SquareConnectionUnavailableError();
        }
      }
      if (grantMerchantId !== row.provider_id) {
        await markNeedsReauthorization(client, row, "refresh_merchant_mismatch");
        await client.query("COMMIT");
        return { kind: "needs_reauthorization", row: outOfService(row) };
      }
      const at = now();
      // The refresh transaction owns this row (FOR UPDATE, re-read above). The generation predicate is belt and braces:
      // the write applies only to the exact credentials this refresh was derived from, and advances the generation so a
      // verification that began on the old credentials can no longer write.
      const written = await client.query(
        `UPDATE payment_methods
         SET encrypted_access_token = $2,
             encrypted_refresh_token = $3,
             token_expires_at = $4, last_refreshed_at = $5, updated_at = $5,
             credential_generation = credential_generation + 1
         WHERE id = $1 AND account_status = 'active' AND credential_generation = $6::bigint
         RETURNING ${ROW_COLUMNS}`,
        [row.id, encryptSecret(grant.accessToken, accessAad(row.id)),
          // ALWAYS re-sealed under the current key, even when Square returns the same refresh token (or none): the
          // plaintext is in hand here, and leaving the old ciphertext would strand it under a retired key.
          encryptSecret(grant.refreshToken ?? refreshToken, refreshAad(row.id)),
          grant.expiresAt, at, row.credential_generation],
      );
      const refreshed = written.rows[0] as unknown as ConnectionRow | undefined;
      if (!refreshed) {
        await client.query("ROLLBACK");
        throw new SquareConnectionUnavailableError();
      }
      await client.query("COMMIT");
      // The token handed back is the one just written with the row it was written to: one snapshot, one generation.
      return { kind: "ok", accessToken: grant.accessToken, row: refreshed };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  function verificationDue(row: ConnectionRow): boolean {
    return !row.granted_scopes
      || !row.last_verified_at
      || now().getTime() - row.last_verified_at.getTime() >= SQUARE_VERIFICATION_TTL_MS;
  }

  /**
   * Asks Square for the facts a payment depends on, using `accessToken` -- which the caller decrypted from `snapshot` --
   * and records them ONLY if the row is still that exact snapshot.
   *
   * Success writes and every failure/needs-reauthorization write carry the snapshot's id, provider (merchant), status and
   * credential generation in their WHERE clause. If any of them has moved on (an OAuth reconnect, a refresh, a
   * disconnect, a revocation) the statement matches zero rows, nothing is overwritten or cleared, and the caller is told
   * `stale` so it re-reads the authoritative state instead of trusting what it learned about credentials that are gone.
   */
  async function verifyConnection(snapshot: ConnectionRow, accessToken: string): Promise<VerificationOutcome> {
    const needsReauthorization = async (reason: string): Promise<VerificationOutcome> =>
      (await markNeedsReauthorization(pool, snapshot, reason))
        ? { kind: "needs_reauthorization", row: outOfService(snapshot) }
        : { kind: "stale" };

    let merchant: SquareMerchantProfile;
    let scopes: string[];
    let locations: SquareLocationFacts[];
    try {
      merchant = await api.retrieveMerchant(accessToken);
      scopes = (await api.retrieveTokenStatus(accessToken)).scopes;
      locations = await api.listLocations(accessToken);
    } catch (error) {
      const failure = classifySquareFailure(error, { surface: "bearer" });
      if (failure === "provider_credential_invalid") return needsReauthorization("verification_rejected");
      log.warn(failure === "application_auth" ? "square_application_auth_failed" : "square_connection_verification_unavailable", { paymentMethodId: snapshot.id, status: squareFailureStatus(error), kind: failure });
      if (failure === "application_auth") throw new SquareApplicationAuthError();
      throw new SquareConnectionUnavailableError();
    }
    if (merchant.id !== snapshot.provider_id) return needsReauthorization("verification_merchant_mismatch");
    if (!hasRequiredSquareScopes(scopes)) return needsReauthorization("insufficient_scopes");

    const location = selectPaymentLocation(locations, merchant.id, { currentLocationId: snapshot.location_id, mainLocationId: merchant.mainLocationId });
    const at = now();
    const written = await pool.query(
      `UPDATE payment_methods
       SET granted_scopes = $4, merchant_name = $5, location_id = $6, location_name = $7, location_currency = $8,
           last_verified_at = $9, verified_at = COALESCE(verified_at, $9), updated_at = $9
       WHERE id = $1 AND provider_id = $2 AND credential_generation = $3::bigint
         AND account_status = 'active' AND encrypted_access_token IS NOT NULL
       RETURNING ${ROW_COLUMNS}`,
      [snapshot.id, snapshot.provider_id, snapshot.credential_generation, scopes, merchant.businessName,
        location?.id ?? null, location?.name ?? null, location?.currency ?? null, at],
    );
    const row = written.rows[0] as unknown as ConnectionRow | undefined;
    if (!row) {
      log.warn("square_connection_snapshot_changed", { paymentMethodId: snapshot.id, attempted: "verification" });
      return { kind: "stale" };
    }
    return { kind: "verified", row };
  }

  /* ----------------------------------------------------------------------------------------------------------- *
   * Readiness
   * ----------------------------------------------------------------------------------------------------------- */

  /**
   * The readiness a row ITSELF supports. Status is checked first and always: retained location or merchant fields on a
   * disconnected or revoked row are history, never evidence of a working connection.
   */
  function readinessOf(row: ConnectionRow): SquarePaymentReadiness {
    if (row.account_status === "needs_reauthorization") return emptyReadiness("needs_reauthorization", row);
    if (row.account_status !== "active" || !row.encrypted_access_token || !row.encrypted_refresh_token) {
      return emptyReadiness(row.account_status === "disconnected" ? "not_connected" : "needs_reauthorization", row.account_status === "disconnected" ? null : row);
    }
    const hasLocation = Boolean(row.location_id) && Boolean(row.location_currency);
    return { ...emptyReadiness(hasLocation ? "active" : "no_payment_location", row), paymentReady: hasLocation };
  }

  /**
   * Evaluates a connection from authoritative persisted state. It never returns a credential: callers that need one go
   * through `getReadyConnectedCredentials`, which re-reads and re-opens the CURRENT credential after this returns.
   * `generation` names the snapshot the answer was derived from.
   *
   * When a verification discovers its snapshot was replaced (zero rows written), this starts again from a fresh read --
   * it does not reuse anything learned about the old snapshot -- and gives up after MAX_SNAPSHOT_RETRIES as unverifiable.
   */
  async function evaluate(userId: string, options: { force?: boolean } = {}, attempt = 0): Promise<{ readiness: SquarePaymentReadiness; generation: string | null }> {
    const result = (readiness: SquarePaymentReadiness, row?: ConnectionRow | null) => ({ readiness, generation: row ? String(row.credential_generation) : null });
    if (!isSecretBoxConfigured() || !squareOauthApplication()) return result(emptyReadiness("configuration_error"));
    if (attempt >= MAX_SNAPSHOT_RETRIES) return result(emptyReadiness("verification_unavailable"));
    try {
      let row = await loadRow(pool, userId, false);
      if (!row || row.account_status === "disconnected") return result(emptyReadiness("not_connected", null));
      if (row.encrypted_access_token === null && hasLegacySecrets(row.account_details)) {
        const converted = await convertLegacyRowInTransaction(row.id);
        if (converted.kind === "malformed") return result(emptyReadiness("needs_reauthorization", row));
        row = await loadRow(pool, userId, false);
        if (!row) return result(emptyReadiness("not_connected", null));
      }
      if (row.account_status === "needs_reauthorization") return result(emptyReadiness("needs_reauthorization", row), row);
      if (row.account_status !== "active") return result(emptyReadiness("not_connected", null));

      const credentials = await ensureFreshCredentials(userId);
      if (credentials.kind !== "ok") {
        const current = credentials.row ?? row;
        return result(readinessOf(current), current);
      }
      let current = credentials.row;
      if (options.force || verificationDue(current)) {
        const outcome = await verifyConnection(current, credentials.accessToken);
        if (outcome.kind === "stale") return evaluate(userId, { ...options, force: false }, attempt + 1);
        if (outcome.kind === "needs_reauthorization") return result(emptyReadiness("needs_reauthorization", outcome.row), outcome.row);
        current = outcome.row;
      }
      return result(readinessOf(current), current);
    } catch (error) {
      if (error instanceof SquareConnectionUnavailableError) return result(emptyReadiness("verification_unavailable"));
      if (error instanceof SquareApplicationAuthError || error instanceof SquareCredentialError || error instanceof SecretBoxError) return result(emptyReadiness("configuration_error"));
      throw error;
    }
  }

  /**
   * A decrypted credential for server-side payment code -- only if, at THIS moment, the persisted row is active, is
   * still the credential generation that was just evaluated as payment ready, holds a sealed access token that opens,
   * and has a verified card-capable location. The token returned is decrypted HERE from that freshly read row; no token
   * decrypted earlier in the evaluation is ever carried across a database re-read.
   */
  async function readyCredentials(userId: string) {
    for (let attempt = 0; attempt < MAX_SNAPSHOT_RETRIES; attempt += 1) {
      const { readiness, generation } = await evaluate(userId);
      if (!readiness.paymentReady || generation === null) return null;
      const current = await loadRow(pool, userId, false);
      if (!current || current.account_status !== "active" || !current.encrypted_access_token || !current.encrypted_refresh_token) return null;
      if (String(current.credential_generation) !== generation) continue; // replaced since it was evaluated: start over
      if (!current.location_id || !current.location_currency || current.provider_id !== readiness.merchantId) return null;
      try {
        return {
          accessToken: openAccessToken(current),
          merchantId: current.provider_id,
          locationId: current.location_id,
          currency: current.location_currency,
          credentialGeneration: String(current.credential_generation),
        };
      } catch (error) {
        if (error instanceof SquareCredentialError) return null;
        throw error;
      }
    }
    return null;
  }

  /**
   * Key rotation: re-seals every stored credential that was sealed under a key other than the current one, so the previous
   * key can then be removed. The credential itself does not change, so the credential generation is NOT advanced. Each row
   * is handled under its lock; a row that cannot be opened is reported by id and left exactly as it was.
   */
  async function resealRotatedCredentials(options: { dryRun?: boolean } = {}) {
    assertSecretBoxConfigured();
    const candidates = await pool.query(
      `SELECT id FROM payment_methods WHERE provider = 'square' AND (encrypted_access_token IS NOT NULL OR encrypted_refresh_token IS NOT NULL) ORDER BY created_at ASC, id ASC`,
    );
    const summary = { checked: candidates.rows.length, resealed: 0, alreadyCurrent: 0, failed: [] as { id: string; reason: string }[] };
    for (const candidate of candidates.rows) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const found = await client.query(`SELECT ${ROW_COLUMNS} FROM payment_methods WHERE id = $1 FOR UPDATE`, [candidate.id]);
        const row = found.rows[0] as unknown as ConnectionRow | undefined;
        const sealed = [row?.encrypted_access_token, row?.encrypted_refresh_token];
        if (!row || sealed.every((value) => !value || !sealedSecretNeedsRotation(value))) {
          await client.query("COMMIT");
          summary.alreadyCurrent += 1;
          continue;
        }
        // Open both first: a row that cannot be opened is reported, in a dry run too, and never half re-sealed.
        const access = row.encrypted_access_token ? encryptSecret(decryptSecret(row.encrypted_access_token, accessAad(row.id)), accessAad(row.id)) : null;
        const refresh = row.encrypted_refresh_token ? encryptSecret(decryptSecret(row.encrypted_refresh_token, refreshAad(row.id)), refreshAad(row.id)) : null;
        if (options.dryRun) {
          await client.query("COMMIT");
          summary.resealed += 1;
          continue;
        }
        await client.query(
          `UPDATE payment_methods SET encrypted_access_token = $2, encrypted_refresh_token = $3, updated_at = $4 WHERE id = $1`,
          [row.id, access, refresh, now()],
        );
        await client.query("COMMIT");
        summary.resealed += 1;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        if (!(error instanceof SecretBoxError)) throw error;
        summary.failed.push({ id: String(candidate.id), reason: "cannot_decrypt" });
      } finally {
        client.release();
      }
    }
    return summary;
  }

  /* ----------------------------------------------------------------------------------------------------------- *
   * Disconnect
   * ----------------------------------------------------------------------------------------------------------- */

  /**
   * The owner disconnects their own Square account. There is no id in the request: the row is resolved from the
   * authenticated user, so there is nothing to guess and no way to reach another user's connection.
   *
   * Idempotent: with no connection, or one already disconnected, it changes nothing (`not_applicable`).
   *
   * The merchant-wide revoke decision is made while holding the merchant-scoped lock (see `lockMerchants`), so concurrent
   * disconnects and OAuth reconnects for one merchant are serialized: exactly the LAST active connection revokes, once.
   *
   * What the owner is told (`providerRevocation`) -- in every case the LOCAL disconnect completes and every stored secret is cleared:
   *  - `revoked`: Square confirmed the revocation (or authoritatively reported the token already invalid).
   *  - `retained_for_shared_connection`: another active ChefSire account uses the same Square merchant; revoking would break it,
   *    so Square authorization was intentionally left in place for it.
   *  - `unconfirmed`: the revoke call failed or could not be confirmed (Square unavailable, ChefSire's application credentials
   *    rejected, an encryption/configuration fault, or no credential left to revoke with). Square access MAY still be active.
   *  - `not_applicable`: there was nothing connected.
   */
  async function disconnect(userId: string): Promise<{ changed: boolean; providerRevocation: ProviderRevocation; providerRevoked: boolean }> {
    const outcome = (changed: boolean, providerRevocation: ProviderRevocation) => ({ changed, providerRevocation, providerRevoked: providerRevocation === "revoked" });
    for (let attempt = 0; attempt < MAX_SNAPSHOT_RETRIES; attempt += 1) {
      const preview = await loadRow(pool, userId, false);
      if (!preview || preview.account_status === "disconnected") return outcome(false, "not_applicable");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`);
        // Merchant lock first, THEN the row: the "is anyone else still connected?" decision below is made while holding it.
        await lockMerchants(client, [preview.provider_id]);
        const row = await loadRow(client, userId, true);
        if (!row || row.account_status === "disconnected") {
          await client.query("COMMIT");
          return outcome(false, "not_applicable");
        }
        if (row.provider_id !== preview.provider_id) {
          // The account moved to another merchant while we waited: start over against the merchant it is on now.
          await client.query("ROLLBACK");
          continue;
        }
        let providerRevocation: ProviderRevocation = "unconfirmed";
        if (row.encrypted_access_token && isSecretBoxConfigured() && squareOauthApplication()) {
          // Authoritative, under the merchant lock: any other ChefSire connection that is active and holds credentials.
          const sharedMerchant = await client.query(
            `SELECT 1 FROM payment_methods WHERE provider = 'square' AND provider_id = $1 AND id <> $2 AND account_status = 'active' AND encrypted_access_token IS NOT NULL LIMIT 1`,
            [row.provider_id, row.id],
          );
          if (sharedMerchant.rows.length) {
            providerRevocation = "retained_for_shared_connection";
          } else {
            try {
              await api.revokeAccessToken(openAccessToken(row));
              providerRevocation = "revoked";
            } catch (error) {
              // Square saying the token is already invalid is as good as a revocation. Anything else (an outage, rejected
              // APPLICATION credentials, an unreadable credential) is unconfirmed: the local disconnect still completes.
              const failure = error instanceof SquareCredentialError ? "unrecognized" : classifySquareFailure(error, { surface: "revoke" });
              providerRevocation = failure === "provider_credential_invalid" ? "revoked" : "unconfirmed";
              log.warn("square_disconnect_revocation_unconfirmed", { paymentMethodId: row.id, status: squareFailureStatus(error), kind: failure, revoked: providerRevocation === "revoked" });
            }
          }
        }
        const at = now();
        await client.query(
          `UPDATE payment_methods
           SET account_status = 'disconnected',
               encrypted_access_token = NULL, encrypted_refresh_token = NULL, token_expires_at = NULL,
               account_details = COALESCE(account_details, '{}'::jsonb) - 'accessToken' - 'refreshToken' - 'tokenExpiresAt',
               is_default = false, credential_generation = credential_generation + 1,
               merchant_revoked_at = CASE WHEN $3::boolean THEN $2 ELSE merchant_revoked_at END,
               status_changed_at = $2, disconnected_at = $2, updated_at = $2
           WHERE id = $1`,
          [row.id, at, providerRevocation === "revoked"],
        );
        await client.query("COMMIT");
        return outcome(true, providerRevocation);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
    // The account kept changing merchant underneath us. Nothing was changed; the caller may simply try again.
    throw new SquareConnectionUnavailableError();
  }

  return {
    verifyAuthorizationCode,
    persistVerifiedConnection,
    convertLegacyRow,
    convertAllLegacyRows,
    resealRotatedCredentials,
    disconnect,
    /** The reusable gate Catering Phase 2Q consults: tokens are never part of the result. */
    getSquarePaymentReadiness: async (userId: string, options: { force?: boolean } = {}) => (await evaluate(userId, options)).readiness,
    /**
     * For SERVER-SIDE payment code only. Returns a decrypted access token solely when the connection is, right now,
     * verified, active and payment ready; otherwise `null` (disconnected, needing reauthorization, misconfigured,
     * unverifiable and "no payment location" all yield null). The token must never be logged, serialized or sent to a
     * browser. `credentialGeneration` identifies the snapshot it came from, for `reportAuthorizationFailure`.
     */
    getReadyConnectedCredentials: readyCredentials,
    /**
     * For payment code that receives an authoritative 401 from Square while using a credential. It must name the
     * generation of the credential that was rejected: a report about credentials that have since been replaced changes nothing.
     */
    reportAuthorizationFailure: async (userId: string, credentialGeneration: string) => {
      const row = await loadRow(pool, userId, false);
      if (row) await markNeedsReauthorization(pool, { id: row.id, credential_generation: credentialGeneration }, "payment_call_rejected");
    },
    status: async (userId: string, options: { force?: boolean } = {}) => toSquareConnectionStatusView((await evaluate(userId, options)).readiness),
  };
}

export type SquareConnectionService = ReturnType<typeof createSquareConnectionService>;
