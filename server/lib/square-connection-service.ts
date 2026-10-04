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
};

const ROW_COLUMNS = `id, user_id, provider_id, account_status, account_details, encrypted_access_token, encrypted_refresh_token,
  token_expires_at, last_refreshed_at, location_id, location_name, location_currency, merchant_name, granted_scopes, last_verified_at`;

const LEGACY_SECRET_KEYS = ["accessToken", "refreshToken", "tokenExpiresAt"] as const;

const accessAad = (id: string) => `payment_methods:${id}:square_access_token`;
const refreshAad = (id: string) => `payment_methods:${id}:square_refresh_token`;

/** Square answered, the credential is bad, and the connection has been taken out of service. */
export type ConnectionOutcome = { kind: "ok"; accessToken: string; row: ConnectionRow } | { kind: "needs_reauthorization"; row: ConnectionRow | null };

export class SquareConnectionUnavailableError extends Error {
  constructor() {
    super("Square could not be reached to verify the connection.");
    this.name = "SquareConnectionUnavailableError";
  }
}
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

  /** Takes a connection out of service. Keeps merchant/location identity; removes every secret. Only from `active`. */
  async function markNeedsReauthorization(db: SqlClient, rowId: string, reason: string): Promise<void> {
    const result = await db.query(
      `UPDATE payment_methods
       SET account_status = 'needs_reauthorization',
           encrypted_access_token = NULL, encrypted_refresh_token = NULL, token_expires_at = NULL,
           account_details = COALESCE(account_details, '{}'::jsonb) - 'accessToken' - 'refreshToken' - 'tokenExpiresAt',
           status_changed_at = $2, updated_at = $2
       WHERE id = $1 AND account_status = 'active'`,
      [rowId, now()],
    );
    if (result.rowCount) log.warn("square_connection_needs_reauthorization", { paymentMethodId: rowId, reason });
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
           updated_at = now()
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
    try {
      const grant = await api.exchangeAuthorizationCode(code);
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
        },
      };
    } catch (error) {
      log.warn("square_authorization_verification_failed", { status: squareFailureStatus(error), kind: classifySquareFailure(error, { tokenGrant: true }) });
      return { ok: false, reason: classifySquareFailure(error, { tokenGrant: true }) === "auth" ? "provider_rejected" : "unavailable" };
    }
  }

  /**
   * Stores a verified authorization INSIDE the caller's transaction, so it commits or rolls back together with the
   * OAuth transaction's consume. Tokens are sealed here, bound to the row id; nothing is written in plaintext.
   */
  async function persistVerifiedConnection(db: SqlClient, userId: string, verified: VerifiedAuthorization): Promise<{ paymentMethodId: string }> {
    const existing = await loadRow(db, userId, true);
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
             status_changed_at = $7, disconnected_at = NULL, verified_at = $7, last_verified_at = $7, updated_at = $7
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
        if (classifySquareFailure(error, { tokenGrant: true }) === "auth") {
          await markNeedsReauthorization(client, row.id, "refresh_rejected");
          await client.query("COMMIT");
          return { kind: "needs_reauthorization", row };
        }
        await client.query("ROLLBACK");
        log.warn("square_token_refresh_unavailable", { paymentMethodId: row.id, status: squareFailureStatus(error) });
        throw new SquareConnectionUnavailableError();
      }
      // The refreshed token must still belong to the merchant this connection was authorized for.
      let grantMerchantId = grant.merchantId;
      if (!grantMerchantId) {
        try {
          grantMerchantId = (await api.retrieveMerchant(grant.accessToken)).id;
        } catch (error) {
          if (classifySquareFailure(error) === "auth") {
            await markNeedsReauthorization(client, row.id, "refresh_identity_rejected");
            await client.query("COMMIT");
            return { kind: "needs_reauthorization", row };
          }
          await client.query("ROLLBACK");
          throw new SquareConnectionUnavailableError();
        }
      }
      if (grantMerchantId !== row.provider_id) {
        await markNeedsReauthorization(client, row.id, "refresh_merchant_mismatch");
        await client.query("COMMIT");
        return { kind: "needs_reauthorization", row };
      }
      const at = now();
      await client.query(
        `UPDATE payment_methods
         SET encrypted_access_token = $2,
             encrypted_refresh_token = COALESCE($3, encrypted_refresh_token),
             token_expires_at = $4, last_refreshed_at = $5, updated_at = $5
         WHERE id = $1 AND account_status = 'active'`,
        [row.id, encryptSecret(grant.accessToken, accessAad(row.id)),
          grant.refreshToken && grant.refreshToken !== refreshToken ? encryptSecret(grant.refreshToken, refreshAad(row.id)) : null,
          grant.expiresAt, at],
      );
      await client.query("COMMIT");
      const refreshed = await loadRow(pool, userId, false);
      return refreshed?.account_status === "active" && refreshed.encrypted_access_token
        ? { kind: "ok", accessToken: openAccessToken(refreshed), row: refreshed }
        : { kind: "needs_reauthorization", row: refreshed };
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

  /** Asks Square for the facts a payment depends on and stores them, never overwriting a concurrent state change. */
  async function verifyConnection(row: ConnectionRow, accessToken: string): Promise<ConnectionRow | null> {
    let merchant: SquareMerchantProfile;
    let scopes: string[];
    let locations: SquareLocationFacts[];
    try {
      merchant = await api.retrieveMerchant(accessToken);
      scopes = (await api.retrieveTokenStatus(accessToken)).scopes;
      locations = await api.listLocations(accessToken);
    } catch (error) {
      if (classifySquareFailure(error) === "auth") {
        await markNeedsReauthorization(pool, row.id, "verification_rejected");
        return null;
      }
      log.warn("square_connection_verification_unavailable", { paymentMethodId: row.id, status: squareFailureStatus(error) });
      throw new SquareConnectionUnavailableError();
    }
    if (merchant.id !== row.provider_id) {
      await markNeedsReauthorization(pool, row.id, "verification_merchant_mismatch");
      return null;
    }
    if (!hasRequiredSquareScopes(scopes)) {
      await markNeedsReauthorization(pool, row.id, "insufficient_scopes");
      return null;
    }
    const location = selectPaymentLocation(locations, merchant.id, { currentLocationId: row.location_id, mainLocationId: merchant.mainLocationId });
    const at = now();
    await pool.query(
      `UPDATE payment_methods
       SET granted_scopes = $2, merchant_name = $3, location_id = $4, location_name = $5, location_currency = $6,
           last_verified_at = $7, verified_at = COALESCE(verified_at, $7), updated_at = $7
       WHERE id = $1 AND account_status = 'active' AND encrypted_access_token IS NOT NULL`,
      [row.id, scopes, merchant.businessName, location?.id ?? null, location?.name ?? null, location?.currency ?? null, at],
    );
    return loadRow(pool, row.user_id, false);
  }

  /* ----------------------------------------------------------------------------------------------------------- *
   * Readiness
   * ----------------------------------------------------------------------------------------------------------- */

  async function evaluate(userId: string, options: { force?: boolean } = {}): Promise<{ readiness: SquarePaymentReadiness; accessToken?: string }> {
    if (!isSecretBoxConfigured() || !squareOauthApplication()) return { readiness: emptyReadiness("configuration_error") };
    try {
      let row = await loadRow(pool, userId, false);
      if (!row || row.account_status === "disconnected") return { readiness: emptyReadiness("not_connected", null) };
      if (row.encrypted_access_token === null && hasLegacySecrets(row.account_details)) {
        const converted = await convertLegacyRowInTransaction(row.id);
        if (converted.kind === "malformed") return { readiness: emptyReadiness("needs_reauthorization", row) };
        row = await loadRow(pool, userId, false);
        if (!row) return { readiness: emptyReadiness("not_connected", null) };
      }
      if (row.account_status === "needs_reauthorization") return { readiness: emptyReadiness("needs_reauthorization", row) };
      if (row.account_status !== "active") return { readiness: emptyReadiness("not_connected", null) };

      const credentials = await ensureFreshCredentials(userId);
      if (credentials.kind !== "ok") return { readiness: emptyReadiness("needs_reauthorization", credentials.row ?? row) };
      let current = credentials.row;
      if (options.force || verificationDue(current)) {
        const verified = await verifyConnection(current, credentials.accessToken);
        if (!verified) return { readiness: emptyReadiness("needs_reauthorization", current) };
        current = verified;
      }
      const hasLocation = Boolean(current.location_id) && Boolean(current.location_currency);
      const readiness: SquarePaymentReadiness = { ...emptyReadiness(hasLocation ? "active" : "no_payment_location", current), paymentReady: hasLocation };
      return hasLocation ? { readiness, accessToken: credentials.accessToken } : { readiness };
    } catch (error) {
      if (error instanceof SquareConnectionUnavailableError) return { readiness: emptyReadiness("verification_unavailable") };
      if (error instanceof SquareCredentialError || error instanceof SecretBoxError) return { readiness: emptyReadiness("configuration_error") };
      throw error;
    }
  }

  /* ----------------------------------------------------------------------------------------------------------- *
   * Disconnect
   * ----------------------------------------------------------------------------------------------------------- */

  /**
   * The owner disconnects their own Square account. There is no id in the request: the row is resolved from the
   * authenticated user, so there is nothing to guess and no way to reach another user's connection.
   *
   * Idempotent: with no connection, or one already disconnected, it changes nothing and says so. The token is
   * revoked at Square only when no OTHER active ChefSire connection uses the same merchant (Square revokes every
   * token of the application for a merchant, so revoking one would silently kill the other). If revocation cannot be
   * confirmed the local credentials are still removed -- the owner's decision stands and ChefSire can no longer use
   * the token -- and the result says the provider revocation was not confirmed.
   */
  async function disconnect(userId: string): Promise<{ changed: boolean; providerRevoked: boolean }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`);
      const row = await loadRow(client, userId, true);
      if (!row || row.account_status === "disconnected") {
        await client.query("COMMIT");
        return { changed: false, providerRevoked: false };
      }
      let providerRevoked = false;
      if (row.encrypted_access_token && isSecretBoxConfigured() && squareOauthApplication()) {
        const sharedMerchant = await client.query(
          `SELECT 1 FROM payment_methods WHERE provider = 'square' AND provider_id = $1 AND id <> $2 AND account_status = 'active' AND encrypted_access_token IS NOT NULL LIMIT 1`,
          [row.provider_id, row.id],
        );
        if (!sharedMerchant.rows.length) {
          try {
            await api.revokeAccessToken(openAccessToken(row));
            providerRevoked = true;
          } catch (error) {
            // An authoritative "this token is already dead" is as good as a revocation; anything else is unconfirmed.
            providerRevoked = error instanceof SquareCredentialError ? false : classifySquareFailure(error) === "auth";
            log.warn("square_disconnect_revocation_unconfirmed", { paymentMethodId: row.id, status: squareFailureStatus(error), revoked: providerRevoked });
          }
        }
      }
      const at = now();
      await client.query(
        `UPDATE payment_methods
         SET account_status = 'disconnected',
             encrypted_access_token = NULL, encrypted_refresh_token = NULL, token_expires_at = NULL,
             account_details = COALESCE(account_details, '{}'::jsonb) - 'accessToken' - 'refreshToken' - 'tokenExpiresAt',
             is_default = false, status_changed_at = $2, disconnected_at = $2, updated_at = $2
         WHERE id = $1`,
        [row.id, at],
      );
      await client.query("COMMIT");
      return { changed: true, providerRevoked };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    verifyAuthorizationCode,
    persistVerifiedConnection,
    convertLegacyRow,
    convertAllLegacyRows,
    disconnect,
    /** The reusable gate Catering Phase 2Q consults: tokens are never part of the result. */
    getSquarePaymentReadiness: async (userId: string, options: { force?: boolean } = {}) => (await evaluate(userId, options)).readiness,
    /**
     * For SERVER-SIDE payment code only. Returns a decrypted access token solely when the connection is verified and
     * payment ready; otherwise `null`. The token must never be logged, serialized or sent to a browser.
     */
    getReadyConnectedCredentials: async (userId: string) => {
      const { readiness, accessToken } = await evaluate(userId);
      return readiness.paymentReady && accessToken && readiness.merchantId && readiness.locationId
        ? { accessToken, merchantId: readiness.merchantId, locationId: readiness.locationId, currency: readiness.locationCurrency }
        : null;
    },
    /** For future payment code that receives an authoritative 401 from Square while using a connection. */
    reportAuthorizationFailure: async (userId: string) => {
      const row = await loadRow(pool, userId, false);
      if (row) await markNeedsReauthorization(pool, row.id, "payment_call_rejected");
    },
    status: async (userId: string, options: { force?: boolean } = {}) => toSquareConnectionStatusView((await evaluate(userId, options)).readiness),
  };
}

export type SquareConnectionService = ReturnType<typeof createSquareConnectionService>;
