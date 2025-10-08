// server/routes/competitions.ts
import { Router } from "express";
import { and, countDistinct, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";

import { db } from "../db"; // <-- your existing Drizzle instance (adjust path if different)
import {
  competitions,
  competitionParticipants,
  competitionVotes,
  scoreTotal,
} from "../db/competitions";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function nowUtc() {
  return new Date();
}

function requireUserId(req: any): string {
  // Your real auth likely sets req.user. For dev/local, we use X-User-Id header.
  const uid =
    (req.user && req.user.id) ||
    (req.headers["x-user-id"] as string) ||
    "";
  if (!uid) {
    const err: any = new Error("Unauthorized: missing user id");
    err.status = 401;
    throw err;
  }
  return uid;
}

// Fetch competition with participants + tally
async function getCompetitionDetail(competitionId: string) {
  const [comp] = await db.select().from(competitions).where(eq(competitions.id, competitionId)).limit(1);
  if (!comp) return null;

  const parts = await db
    .select()
    .from(competitionParticipants)
    .where(eq(competitionParticipants.competitionId, competitionId));

  const tallies = await db
    .select({
      participantId: competitionVotes.participantId,
      voters: countDistinct(competitionVotes.voterId).as("voters"),
    })
    .from(competitionVotes)
    .where(eq(competitionVotes.competitionId, competitionId))
    .groupBy(competitionVotes.participantId);

  // You could also include media rows if you add a table later.
  return {
    competition: comp,
    participants: parts,
    voteTallies: tallies,
    media: [],
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /api/competitions  (create a new room)
router.post("/competitions", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const {
      title = null,
      themeName = null,
      themeId = null, // ignored for now
      recipeId = null,
      isPrivate = false,
      timeLimitMinutes = 60,
      minOfficialVoters = 3,
    } = req.body || {};

    if (timeLimitMinutes < 15 || timeLimitMinutes > 120) {
      return res.status(400).json({ error: "timeLimitMinutes must be between 15 and 120" });
    }

    const [created] = await db
      .insert(competitions)
      .values({
        creatorId: userId,
        title,
        themeName,
        recipeId,
        isPrivate: !!isPrivate,
        timeLimitMinutes,
        minOfficialVoters,
        status: "upcoming",
      })
      .returning({ id: competitions.id });

    // auto-add creator as host participant
    await db
      .insert(competitionParticipants)
      .values({
        competitionId: created.id,
        userId,
        role: "host",
      })
      .onConflictDoNothing();

    return res.json({ id: created.id });
  } catch (err) {
    next(err);
  }
});

// GET /api/competitions/:id  (detail)
router.get("/competitions/:id", async (req, res, next) => {
  try {
    const detail = await getCompetitionDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: "Not found" });
    return res.json(detail);
  } catch (err) {
    next(err);
  }
});

// POST /api/competitions/:id/start  (start live phase)
router.post("/competitions/:id/start", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const compId = req.params.id;

    // ensure creator/host only (simple check: created by user or user is host)
    const [comp] = await db.select().from(competitions).where(eq(competitions.id, compId)).limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.creatorId !== userId) return res.status(403).json({ error: "Forbidden" });

    if (comp.status !== "upcoming") return res.status(400).json({ error: `Cannot start when status=${comp.status}` });

    const start = nowUtc();
    const end = new Date(start.getTime() + comp.timeLimitMinutes * 60_000);

    await db
      .update(competitions)
      .set({ status: "live", startTime: start, endTime: end, updatedAt: nowUtc() })
      .where(eq(competitions.id, compId));

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/competitions/:id/end  (end live → open judging for 24h)
router.post("/competitions/:id/end", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const compId = req.params.id;

    const [comp] = await db.select().from(competitions).where(eq(competitions.id, compId)).limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.creatorId !== userId) return res.status(403).json({ error: "Forbidden" });

    if (comp.status !== "live") return res.status(400).json({ error: `Cannot end when status=${comp.status}` });

    const closeAt = new Date(nowUtc().getTime() + 24 * 60 * 60_000);

    await db
      .update(competitions)
      .set({
        status: "judging",
        endTime: nowUtc(),
        judgingClosesAt: closeAt,
        updatedAt: nowUtc(),
      })
      .where(eq(competitions.id, compId));

    return res.json({ ok: true, judgingClosesAt: closeAt.toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/competitions/:id/submit  (competitor submits final dish)
router.post("/competitions/:id/submit", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const compId = req.params.id;
    const { dishTitle, dishDescription, finalDishPhotoUrl } = req.body || {};

    const [comp] = await db.select().from(competitions).where(eq(competitions.id, compId)).limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.status !== "live" && comp.status !== "judging") {
      return res.status(400).json({ error: "Submissions only allowed during live or judging." });
    }

    // Upsert participant row (competitor role)
    await db
      .insert(competitionParticipants)
      .values({
        competitionId: compId,
        userId,
        role: "competitor",
        dishTitle: dishTitle ?? null,
        dishDescription: dishDescription ?? null,
        finalDishPhotoUrl: finalDishPhotoUrl ?? null,
      })
      .onConflictDoUpdate({
        target: [competitionParticipants.competitionId, competitionParticipants.userId],
        set: {
          role: "competitor",
          dishTitle: dishTitle ?? null,
          dishDescription: dishDescription ?? null,
          finalDishPhotoUrl: finalDishPhotoUrl ?? null,
          updatedAt: nowUtc(),
        },
      });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/competitions/:id/votes  (viewer votes; participants cannot vote)
router.post("/competitions/:id/votes", async (req, res, next) => {
  try {
    const voterId = requireUserId(req);
    const compId = req.params.id;
    const { participantId, presentation, creativity, technique } = req.body || {};

    const [comp] = await db.select().from(competitions).where(eq(competitions.id, compId)).limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.status !== "judging" && comp.status !== "live") {
      return res.status(400).json({ error: "Voting only allowed during live or judging." });
    }

    // ensure voter is NOT a participant in this competition
    const [maybeParticipant] = await db
      .select()
      .from(competitionParticipants)
      .where(and(eq(competitionParticipants.competitionId, compId), eq(competitionParticipants.userId, voterId)))
      .limit(1);

    if (maybeParticipant) return res.status(403).json({ error: "Participants cannot vote." });

    // Simple bounds check
    const pv = clamp1to10(presentation);
    const cv = clamp1to10(creativity);
    const tv = clamp1to10(technique);

    // Save / upsert the vote (unique by competition+voter+participant)
    await db
      .insert(competitionVotes)
      .values({
        competitionId: compId,
        voterId,
        participantId,
        presentation: pv,
        creativity: cv,
        technique: tv,
      })
      .onConflictDoUpdate({
        target: [competitionVotes.competitionId, competitionVotes.voterId, competitionVotes.participantId],
        set: {
          presentation: pv,
          creativity: cv,
          technique: tv,
        },
      });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/competitions/:id/complete  (finalize results, set winner & official flag)
// This can be called by the creator after the 24h judging window, or by a scheduler.
router.post("/competitions/:id/complete", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const compId = req.params.id;

    const [comp] = await db.select().from(competitions).where(eq(competitions.id, compId)).limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.creatorId !== userId) return res.status(403).json({ error: "Forbidden" });
    if (comp.status !== "judging") return res.status(400).json({ error: `Cannot complete when status=${comp.status}` });

    // Aggregate total scores per participant (sum of each ballot's total)
    const perParticipant = await db
      .select({
        participantId: competitionVotes.participantId,
        // total score across all ballots
        total: sql<number>`SUM(${competitionVotes.presentation} + ${competitionVotes.creativity} + ${competitionVotes.technique})`,
        voters: countDistinct(competitionVotes.voterId).as("voters"),
      })
      .from(competitionVotes)
      .where(eq(competitionVotes.competitionId, compId))
      .groupBy(competitionVotes.participantId)
      .orderBy(desc(sql`SUM(${competitionVotes.presentation} + ${competitionVotes.creativity} + ${competitionVotes.technique})`));

    const winnerParticipantId = perParticipant[0]?.participantId ?? null;
    const uniqueVoters = perParticipant.reduce((acc, r) => acc + (r.voters ?? 0), 0); // rough proxy
    const isOfficial = (perParticipant[0]?.voters ?? 0) >= (comp.minOfficialVoters ?? 3);

    // Update placements & totals on participants
    for (let i = 0; i < perParticipant.length; i++) {
      const r = perParticipant[i];
      await db
        .update(competitionParticipants)
        .set({ totalScore: r.total ?? null, placement: i + 1, updatedAt: nowUtc() })
        .where(eq(competitionParticipants.id, r.participantId));
    }

    await db
      .update(competitions)
      .set({
        status: "completed",
        winnerParticipantId,
        isOfficial,
        updatedAt: nowUtc(),
      })
      .where(eq(competitions.id, compId));

    const detail = await getCompetitionDetail(compId);
    return res.json({ ok: true, winnerParticipantId, isOfficial, detail });
  } catch (err) {
    next(err);
  }
});

// GET /api/competitions/library  (archive & search)
router.get("/competitions/library", async (req, res, next) => {
  try {
    const { q, theme, creator, dateFrom, dateTo, limit = "30", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.max(1, Math.min(100, parseInt(limit || "30", 10)));
    const off = Math.max(0, parseInt(offset || "0", 10));

    const where = [];
    if (q) where.push(ilike(competitions.title, `%${q}%`));
    if (theme) where.push(eq(competitions.themeName, theme));
    if (creator) where.push(eq(competitions.creatorId, creator));
    if (dateFrom) where.push(gte(competitions.createdAt, new Date(dateFrom)));
    if (dateTo) where.push(lte(competitions.createdAt, new Date(dateTo)));

    const items = await db
      .select()
      .from(competitions)
      .where(where.length ? (where.length === 1 ? where[0] : and(...where)) : undefined)
      .orderBy(desc(competitions.createdAt))
      .limit(lim)
      .offset(off);

    return res.json({ items, limit: lim, offset: off });
  } catch (err) {
    next(err);
  }
});

function clamp1to10(n: any) {
  const x = Number(n);
  if (!isFinite(x)) return 1;
  return Math.max(1, Math.min(10, Math.round(x)));
}

export default router;
