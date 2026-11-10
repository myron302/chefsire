import { Router } from "express";
import { createOpsAuthRouter } from "./ops-auth";
import adminStaffRouter from "./admin-staff";
import adminMembersRouter from "./admin-members";
import opsStaffUsersRouter from "./ops-staff-users";
import { requireOpsRequestOrigin, requireStaffSession } from "../lib/staff-session";

/**
 * The staff portal API, mounted at /api/ops. app.ts only lets requests for the ops host (ops.chefsire.com) reach it,
 * and the ops host serves nothing else. Member sign-in plays no part: every route below needs a staff session.
 */
export function createOpsRouter(options: { authLimit?: number } = {}) {
  const r = Router();
  r.use(requireOpsRequestOrigin);
  r.use("/auth", createOpsAuthRouter({ limit: options.authLimit }));
  r.use("/admin", requireStaffSession, adminStaffRouter, adminMembersRouter, opsStaffUsersRouter);
  r.use((_req, res) => res.status(404).json({ ok: false, error: "Not found" }));
  return r;
}
