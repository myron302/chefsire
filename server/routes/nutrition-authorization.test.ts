/** Runtime coverage for CS-CL-01: private nutrition data is always scoped to the authenticated account. */
import "../test-support/auth-test-env";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import express from "express";
import { testAuthHeader } from "../test-support/auth-test-env";
import { storage } from "../storage";
import nutritionRouter from "./nutrition";
import usersRouter from "./users";

type Call = { method: string; args: any[] };

function freshWorld() {
  return {
    calls: [] as Call[],
    users: {
      A: { id: "A", dailyCalorieGoal: 2000, macroGoals: { protein: 120, carbs: 220, fat: 60 }, dietaryRestrictions: [] },
      B: { id: "B", dailyCalorieGoal: 1800, macroGoals: { protein: 100, carbs: 180, fat: 55 }, dietaryRestrictions: ["private"] },
    } as Record<string, any>,
    logs: [] as any[],
  };
}

let world = freshWorld();
const record = (method: string, ...args: any[]) => world.calls.push({ method, args });
const callsTo = (method: string) => world.calls.filter((call) => call.method === method);

Object.assign(storage as any, {
  updateNutritionGoals: async (userId: string, goals: any) => {
    record("updateNutritionGoals", userId, goals);
    const user = world.users[userId];
    if (!user) return undefined;
    Object.assign(user, goals);
    return user;
  },
  logNutrition: async (userId: string, log: any) => {
    record("logNutrition", userId, log);
    const entry = { id: `log-${world.logs.length + 1}`, userId, ...log };
    world.logs.push(entry);
    return entry;
  },
  getDailyNutritionSummary: async (userId: string, date: Date) => {
    record("getDailyNutritionSummary", userId, date);
    return { totalCalories: world.logs.filter((log) => log.userId === userId).reduce((sum, log) => sum + log.calories, 0) };
  },
  getNutritionLogs: async (userId: string, startDate: Date, endDate: Date) => {
    record("getNutritionLogs", userId, startDate, endDate);
    return world.logs.filter((log) => log.userId === userId);
  },
  getUser: async (userId: string) => {
    record("getUser", userId);
    return world.users[userId];
  },
});

const app = express();
app.use(express.json());
app.use("/api/nutrition", nutritionRouter);
app.use("/api/users", usersRouter);
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as any).port}`;

test.after(() => server.close());
test.beforeEach(() => {
  world = freshWorld();
});

async function call(method: string, path: string, options: { as?: string; body?: unknown } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(options.as ? testAuthHeader(options.as) : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })() : null };
}

const validLog = {
  date: "2026-09-30T12:00:00.000Z",
  mealType: "lunch",
  customFoodName: "Soup",
  servings: 1,
  calories: 250,
  protein: 10,
};

test("the production router mounts nutrition under /nutrition", () => {
  const routeIndex = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  assert.match(routeIndex, /r\.use\("\/nutrition", nutritionRouter\)/);
});

test("anonymous callers cannot read or mutate nutrition data", async () => {
  const attempts = [
    await call("PUT", "/api/nutrition/users/A/goals", { body: { dailyCalorieGoal: 2100 } }),
    await call("POST", "/api/nutrition/log", { body: validLog }),
    await call("GET", "/api/nutrition/users/A/daily/2026-09-30"),
    await call("GET", "/api/nutrition/users/A/logs?startDate=2026-09-01&endDate=2026-10-01"),
  ];

  assert.deepEqual(attempts.map((attempt) => attempt.status), [401, 401, 401, 401]);
  assert.equal(world.calls.length, 0);
  assert.equal(world.logs.length, 0);
});

test("User A cannot read or update User B through path identity", async () => {
  const attempts = [
    await call("PUT", "/api/nutrition/users/B/goals", { as: "A", body: { dailyCalorieGoal: 9999 } }),
    await call("GET", "/api/nutrition/users/B/daily/2026-09-30", { as: "A" }),
    await call("GET", "/api/nutrition/users/B/logs?startDate=2026-09-01&endDate=2026-10-01", { as: "A" }),
  ];

  assert.deepEqual(attempts.map((attempt) => attempt.status), [403, 403, 403]);
  assert.equal(world.calls.length, 0);
  assert.equal(world.users.B.dailyCalorieGoal, 1800);
});

test("POST log rejects body ownership spoofing without writing for either user", async () => {
  const response = await call("POST", "/api/nutrition/log", {
    as: "A",
    body: { ...validLog, userId: "B" },
  });

  assert.equal(response.status, 400);
  assert.equal(callsTo("logNutrition").length, 0);
  assert.equal(world.logs.length, 0);
});

test("strict mutation contracts reject server-controlled and unknown fields", async () => {
  const goalResponse = await call("PUT", "/api/nutrition/users/A/goals", {
    as: "A",
    body: { dailyCalorieGoal: 2100, id: "forged", updatedAt: "2026-09-30" },
  });
  const logResponse = await call("POST", "/api/nutrition/log", {
    as: "A",
    body: { ...validLog, id: "forged", createdAt: "2026-09-30", recognitionConfidence: 1 },
  });

  assert.equal(goalResponse.status, 400);
  assert.equal(logResponse.status, 400);
  assert.equal(callsTo("updateNutritionGoals").length, 0);
  assert.equal(callsTo("logNutrition").length, 0);
});

test("User A can update only User A's goals", async () => {
  const response = await call("PUT", "/api/nutrition/users/A/goals", {
    as: "A",
    body: { dailyCalorieGoal: 2200, macroGoals: { protein: 140, carbs: 230, fat: 70 } },
  });

  assert.equal(response.status, 200);
  assert.equal(world.users.A.dailyCalorieGoal, 2200);
  assert.deepEqual(callsTo("updateNutritionGoals")[0].args, ["A", {
    dailyCalorieGoal: 2200,
    macroGoals: { protein: 140, carbs: 230, fat: 70 },
  }]);
});

test("User A can log nutrition and storage receives only authenticated identity", async () => {
  const response = await call("POST", "/api/nutrition/log", { as: "A", body: validLog });

  assert.equal(response.status, 201);
  assert.equal(world.logs.length, 1);
  assert.equal(world.logs[0].userId, "A");
  assert.equal(callsTo("logNutrition")[0].args[0], "A");
  assert.ok(callsTo("logNutrition")[0].args[1].date instanceof Date);
  assert.equal("userId" in callsTo("logNutrition")[0].args[1], false);
});

test("User A can read User A's daily summary and logs with authenticated storage scope", async () => {
  world.logs.push({ id: "existing", userId: "A", calories: 350, date: new Date("2026-09-30T12:00:00Z") });

  const daily = await call("GET", "/api/nutrition/users/A/daily/2026-09-30", { as: "A" });
  const logs = await call("GET", "/api/nutrition/users/A/logs?startDate=2026-09-01&endDate=2026-10-01", { as: "A" });

  assert.equal(daily.status, 200);
  assert.equal(daily.body.summary.totalCalories, 350);
  assert.equal(logs.status, 200);
  assert.equal(logs.body.total, 1);
  assert.equal(callsTo("getDailyNutritionSummary")[0].args[0], "A");
  assert.equal(callsTo("getNutritionLogs")[0].args[0], "A");
  assert.deepEqual(callsTo("getUser").map((entry) => entry.args[0]), ["A"]);
});

test("null, empty, numeric, malformed, and impossible calendar log dates are rejected without inserting", async () => {
  const bad = [
    null, "", 0, "not-a-date", undefined,
    "2026-02-29", "2026-02-30", "2026-04-31", "2026-09-31", "2026-13-01", "2026-00-10", "2026-01-00", "2026-13-45",
    "2026-02-30T12:00:00Z", "2026-09-30T25:00:00Z", "2026-09-30T12:60:00Z",
    "2026-09-30T12:00", "2026-09-30T12:00:00", "2026-09-30 12:00", "2026-09-30 12:00:00",
  ];
  for (const date of bad) {
    const response = await call("POST", "/api/nutrition/log", { as: "A", body: { ...validLog, date } });
    assert.equal(response.status, 400, `date ${String(date)}`);
  }
  assert.equal(callsTo("logNutrition").length, 0);
  assert.equal(world.logs.length, 0);
});

test("valid date-only and explicit-timezone log dates reach storage as the intended instant", async () => {
  const cases: Array<[string, string]> = [
    ["2026-09-30", "2026-09-30T00:00:00.000Z"],
    ["2024-02-29", "2024-02-29T00:00:00.000Z"],
    ["2026-09-30T12:00:00.000Z", "2026-09-30T12:00:00.000Z"],
    ["2026-09-30T12:00:00Z", "2026-09-30T12:00:00.000Z"],
    ["2026-09-30T12:00:00-04:00", "2026-09-30T16:00:00.000Z"],
    ["2026-09-30T12:00:00+00:00", "2026-09-30T12:00:00.000Z"],
  ];
  for (const [input] of cases) {
    const response = await call("POST", "/api/nutrition/log", { as: "A", body: { ...validLog, date: input } });
    assert.equal(response.status, 201, input);
  }
  const logged = callsTo("logNutrition");
  assert.equal(logged.length, cases.length);
  cases.forEach(([, expected], index) => {
    assert.equal(logged[index].args[0], "A");
    assert.equal(logged[index].args[1].date.toISOString(), expected);
  });
});

test("sodium and sugar are accepted; invalid values and recognitionConfidence are rejected", async () => {
  for (const extra of [{ sodium: 400 }, { sugar: 12.5 }, { sodium: 400, sugar: 12.5 }]) {
    const response = await call("POST", "/api/nutrition/log", { as: "A", body: { ...validLog, ...extra } });
    assert.equal(response.status, 201);
    assert.deepEqual(
      Object.fromEntries(Object.entries(callsTo("logNutrition").at(-1)!.args[1]).filter(([k]) => k === "sodium" || k === "sugar")),
      extra,
    );
  }
  const before = callsTo("logNutrition").length;
  for (const extra of [{ sodium: -1 }, { sugar: -0.1 }, { sodium: "400" }, { sugar: null }, { recognitionConfidence: 0.9 }]) {
    const response = await call("POST", "/api/nutrition/log", { as: "A", body: { ...validLog, ...extra } });
    assert.equal(response.status, 400);
  }
  assert.equal(callsTo("logNutrition").length, before);
});

test("goal update response never includes credential-bearing user fields", async () => {
  Object.assign(world.users.A, {
    password: "hash", passwordHash: "hash", verificationToken: "tok", googleAccessToken: "oauth", email: "a@example.com",
  });
  const response = await call("PUT", "/api/nutrition/users/A/goals", { as: "A", body: { dailyCalorieGoal: 2100 } });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body.goals).sort(), ["dailyCalorieGoal", "dietaryRestrictions", "macroGoals"]);
  assert.doesNotMatch(JSON.stringify(response.body), /password|hash|verification|oauth|googleAccessToken|a@example/i);
});

test("duplicate /api/users nutrition aliases were removed and are not functioning endpoints", async () => {
  const usersSource = readFileSync(new URL("./users.ts", import.meta.url), "utf8");
  assert.doesNotMatch(usersSource, /nutrition\/(goals|daily|logs)/);
  const attempts = [
    ["PUT", "/api/users/A/nutrition/goals", { dailyCalorieGoal: 2100 }],
    ["GET", "/api/users/A/nutrition/daily/2026-09-30", undefined],
    ["GET", "/api/users/A/nutrition/logs?startDate=2026-09-01&endDate=2026-10-01", undefined],
  ] as const;
  for (const [method, path, body] of attempts) {
    for (const as of [undefined, "A", "B"]) {
      const response = await call(method, path, { as, body });
      assert.ok(response.status === 401 || response.status === 404, `${method} ${path} as ${as}: ${response.status}`);
      assert.equal(JSON.stringify(response.body ?? {}).includes("Nutrition goals updated"), false);
    }
  }
  assert.equal(world.calls.length, 0);
  assert.equal(world.users.A.dailyCalorieGoal, 2000);
  // Canonical authenticated route still works.
  const canonical = await call("PUT", "/api/nutrition/users/A/goals", { as: "A", body: { dailyCalorieGoal: 2100 } });
  assert.equal(canonical.status, 200);
});
