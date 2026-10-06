/**
 * Side-effect import for suites that load `server/db/index` through other modules: it must run BEFORE any of them, because that module
 * builds its pool only if DATABASE_URL is set at first import. The URL is a non-routable placeholder; suites replace the pool's `connect`
 * and `query` with their own throw-away database, so it is never dialled.
 */
process.env.DATABASE_URL ||= "postgres://u:p@placeholder-database.invalid/none";
