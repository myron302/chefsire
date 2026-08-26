import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { optionalAuth } from "./auth";

const secret = (process.env.JWT_SECRET || process.env.SESSION_SECRET || "").trim() || "CHEFSIRE_DEV_FALLBACK_SECRET";
const response = {} as Response;
const run = async (request: Partial<Request>) => {
  let continued = false;
  await optionalAuth(request as Request, response, (() => { continued = true; }) as NextFunction);
  return { request, continued };
};

test("optional auth leaves an anonymous public request readable", async () => {
  const result = await run({ headers: {}, cookies: {} });
  assert.equal(result.continued, true);
  assert.equal(result.request.user, undefined);
});

test("optional auth hydrates only verified token identity", async () => {
  const token = jwt.sign({ id: "customer", email: "private@example.com" }, secret, { expiresIn: "5m" });
  const result = await run({ headers: { authorization: `Bearer ${token}` }, cookies: {} });
  assert.equal(result.continued, true);
  assert.equal(result.request.user?.id, "customer");
});

test("optional auth follows public-route policy for invalid and expired credentials", async () => {
  const expired = jwt.sign({ id: "customer" }, secret, { expiresIn: -1 });
  for (const token of ["invalid", expired]) {
    const result = await run({ headers: { authorization: `Bearer ${token}` }, cookies: {} });
    assert.equal(result.continued, true);
    assert.equal(result.request.user, undefined);
  }
});
