/**
 * Creates a one-time staff portal invite and prints its link. Used to bootstrap the first Owner (and as a fallback
 * when no Owner can sign in). The link works once and expires in 72 hours; only its hash is stored.
 *
 *   npx tsx server/scripts/create-staff-invite.ts --login myron --name "Myron" --owner [--group grp-support]
 *
 * Once an active Owner exists, staff are invited from the portal. An Owner invite from here is then refused unless
 * --emergency is given (lost access to every Owner account); that use is recorded in the audit log.
 */
import "../lib/load-env";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { randomToken, sha256 } from "../lib/staff-crypto";
import { opsHost } from "../lib/ops-host";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const login = (arg("login") ?? "").trim().toLowerCase();
const name = (arg("name") ?? "").trim();
const owner = process.argv.includes("--owner");
const groups = process.argv.flatMap((v, i) => (process.argv[i - 1] === "--group" ? [v] : []));
if (!/^[a-z0-9][a-z0-9._-]{1,39}$/.test(login) || !name) {
  console.error('Usage: --login <login> --name "<display name>" [--owner] [--group <group id>]...');
  process.exit(1);
}
const emergency = process.argv.includes("--emergency");
const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);
const [owners] = rowsOf(await db.execute(sql`SELECT count(*)::int AS n FROM staff_users WHERE is_owner AND status = 'active'`));
if ((owners?.n ?? 0) > 0 && !emergency) {
  console.error("An active Owner already exists: invite staff from the portal. Use --emergency only if every Owner has lost access.");
  process.exit(1);
}
const token = randomToken(32);
await db.execute(sql`
  INSERT INTO staff_invites (token_hash, login, display_name, is_owner, group_ids, expires_at)
  VALUES (${sha256(token)}, ${login}, ${name}, ${owner}, ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(groups)}::jsonb)), now() + interval '72 hours')
`);
await db.execute(sql`
  INSERT INTO admin_audit_log (actor_type, actor_id, actor_label, action, target_type, target_id, reason, details)
  VALUES ('system', NULL, 'Server script', 'staff.invite.bootstrap', 'staff_invite', ${login},
    ${emergency ? "Emergency Owner recovery" : "First Owner setup"}, ${JSON.stringify({ login, isOwner: owner, groups, emergency })}::jsonb)
`);
console.log(`Invite for ${login}${owner ? " (Owner)" : ""}: https://${opsHost() ?? "ops.chefsire.com"}/invite#${token}`);
process.exit(0);
