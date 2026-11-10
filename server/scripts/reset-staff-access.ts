/**
 * Emergency: reset a staff member's portal sign-in and print a one-time link (24 hours) to set a new password and
 * authenticator. For when nobody who could do it in the portal can sign in (e.g. the only Owner lost their phone).
 *
 *   npm run staff:reset-access -- --login myron --reason "Lost phone and recovery codes"
 *
 * In Plesk: Node.js > Run Node.js commands > npm > run staff:reset-access -- --login myron --reason "Lost phone"
 */
import "../lib/load-env";
import { issueStaffResetLink, StaffRecoveryError } from "../lib/staff-recovery";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const login = arg("login") ?? "";
const reason = arg("reason") ?? "";
if (!login || !reason) {
  console.error('Usage: --login <login> --reason "<why>"');
  process.exit(1);
}
try {
  const { link, expiresAt } = await issueStaffResetLink(login, reason);
  console.log(`Reset link for ${login.toLowerCase()} (works once, until ${new Date(expiresAt).toISOString()}):\n${link}`);
  process.exit(0);
} catch (error) {
  console.error(error instanceof StaffRecoveryError ? error.message : `Failed: ${(error as Error)?.message}`);
  process.exit(1);
}
