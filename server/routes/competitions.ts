// server/routes/competitions.ts
import { Router } from "express";
import { and, countDistinct, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  competitions,
  competitionParticipants,
  competitionVotes,
} from "../db/competitions";

const router = Router();

// --- helpers ---
const nowUtc = () => new Date();
const isMissingTable = (e: any) =>
  e && (e.code === "42P01" || /relation .* does not exist/i.test(e?.message || ""));

function requireUserId(req: any): string {
  const uid =
    (req.user && req.user.id) || (req.headers["x-user-id"] as string) || "";
  if (!uid) {
    const err: any = new Error("Unauthorized: missing user id");
    err.status = 401;
    throw err;
  }
  return uid;
}
function clamp1to10(n: any) {
  const x = Number(n);
  if (!isFinite(x)) return 1;
  return Math.max(1, Math.min(10, Math.round(x)));
}

async function getCompetitionDetail(competitionId: string) {
  try {
    const [comp] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .limit(1);

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

    return {
      competition: comp,
      participants: parts,
      voteTallies: tallies,
      media: [],
    };
  } catch (error) {
    if (isMissingTable(err)) {
      return null;
    }
    throw err;
  }
}

// --- health ---
router.get("/health", (_req, res) => {
  res.json({ ok: true, scope: "competitions" });
});

// --- create ---
router.post("/", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const {
      title = null,
      themeName = null,
      recipeId = null,
      isPrivate = false,
      timeLimitMinutes = 60,
      minOfficialVoters = 3,
    } = req.body || {};

    if (timeLimitMinutes < 15 || timeLimitMinutes > 120) {
      return res
        .status(400)
        .json({ error: "timeLimitMinutes must be between 15 and 120" });
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

    await db
      .insert(competitionParticipants)
      .values({ competitionId: created.id, userId, role: "host" })
      .onConflictDoNothing();

    res.json({ id: created.id });
  } catch (error) {
    if (isMissingTable(err)) {
      return res.status(409).json({
        error:
          "Competitions tables are not initialized. Run `npm run db:push` and restart the server.",
      });
    }
    next(err);
  }
});

// --- detail ---
router.get("/:id", async (req, res, next) => {
  try {
    const detail = await getCompetitionDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: "Not found" });
    res.json(detail);
  } catch (error) {
    if (isMissingTable(err)) {
      return res
        .status(404)
        .json({ error: "Not found (tables not initialized yet)" });
    }
    next(err);
  }
});

// --- start (upcoming -> live) ---
router.post("/:id/start", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const compId = req.params.id;

    const [comp] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, compId))
      .limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.creatorId !== userId)
      return res.status(403).json({ error: "Forbidden" });
    if (comp.status !== "upcoming")
      return res
        .status(400)
        .json({ error: `Cannot start when status=${comp.status}` });

    const start = nowUtc();
    const end = new Date(start.getTime() + comp.timeLimitMinutes * 60_000);

    await db
      .update(competitions)
      .set({
        status: "live",
        startTime: start,
        endTime: end,
        updatedAt: nowUtc(),
      })
      .where(eq(competitions.id, compId));

    res.json({ ok: true });
  } catch (error) {
    if (isMissingTable(err)) {
      return res.status(409).json({
        error:
          "Competitions tables are not initialized. Run `npm run db:push`.",
      });
    }
    next(err);
  }
});

// --- end (live -> judging for 24h) ---
router.post("/:id/end", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const compId = req.params.id;

    const [comp] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, compId))
      .limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.creatorId !== userId)
      return res.status(403).json({ error: "Forbidden" });
    if (comp.status !== "live")
      return res
        .status(400)
        .json({ error: `Cannot end when status=${comp.status}` });

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

    res.json({ ok: true, judgingClosesAt: closeAt.toISOString() });
  } catch (error) {
    if (isMissingTable(err)) {
      return res.status(409).json({
        error:
          "Competitions tables are not initialized. Run `npm run db:push`.",
      });
    }
    next(err);
  }
});

// --- competitor submission ---
router.post("/:id/submit", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const compId = req.params.id;
    const { dishTitle, dishDescription, finalDishPhotoUrl } = req.body || {};

    const [comp] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, compId))
      .limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.status !== "live" && comp.status !== "judging") {
      return res
        .status(400)
        .json({ error: "Submissions only allowed during live or judging." });
    }

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
        target: [
          competitionParticipants.competitionId,
          competitionParticipants.userId,
        ],
        set: {
          role: "competitor",
          dishTitle: dishTitle ?? null,
          dishDescription: dishDescription ?? null,
          finalDishPhotoUrl: finalDishPhotoUrl ?? null,
          updatedAt: nowUtc(),
        },
      });

    res.json({ ok: true });
  } catch (error) {
    if (isMissingTable(err)) {
      return res.status(409).json({
        error:
          "Competitions tables are not initialized. Run `npm run db:push`.",
      });
    }
    next(err);
  }
});

// --- spectator vote (participants cannot vote) ---
router.post("/:id/votes", async (req, res, next) => {
  try {
    const voterId = requireUserId(req);
    const compId = req.params.id;
    const { participantId, presentation, creativity, technique } = req.body || {};

    const [comp] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, compId))
      .limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.status !== "judging" && comp.status !== "live") {
      return res
        .status(400)
        .json({ error: "Voting only allowed during live or judging." });
    }

    const [maybeParticipant] = await db
      .select()
      .from(competitionParticipants)
      .where(
        and(
          eq(competitionParticipants.competitionId, compId),
          eq(competitionParticipants.userId, voterId)
        )
      )
      .limit(1);
    if (maybeParticipant) return res.status(403).json({ error: "Participants cannot vote." });

    const pv = clamp1to10(presentation);
    const cv = clamp1to10(creativity);
    const tv = clamp1to10(technique);

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
        target: [
          competitionVotes.competitionId,
          competitionVotes.voterId,
          competitionVotes.participantId,
        ],
        set: { presentation: pv, creativity: cv, technique: tv },
      });

    res.json({ ok: true });
  } catch (error) {
    if (isMissingTable(err)) {
      return res.status(409).json({
        error:
          "Competitions tables are not initialized. Run `npm run db:push`.",
      });
    }
    next(err);
  }
});

// --- finalize results (judging -> completed) ---
router.post("/:id/complete", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const compId = req.params.id;

    const [comp] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, compId))
      .limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.creatorId !== userId)
      return res.status(403).json({ error: "Forbidden" });
    if (comp.status !== "judging")
      return res
        .status(400)
        .json({ error: `Cannot complete when status=${comp.status}` });

    const perParticipant = await db
      .select({
        participantId: competitionVotes.participantId,
        total: sql<number>`SUM(${competitionVotes.presentation} + ${competitionVotes.creativity} + ${competitionVotes.technique})`,
        voters: countDistinct(competitionVotes.voterId).as("voters"),
      })
      .from(competitionVotes)
      .where(eq(competitionVotes.competitionId, compId))
      .groupBy(competitionVotes.participantId)
      .orderBy(
        desc(
          sql`SUM(${competitionVotes.presentation} + ${competitionVotes.creativity} + ${competitionVotes.technique})`
        )
      );

    const winnerParticipantId = perParticipant[0]?.participantId ?? null;
    const isOfficial =
      (perParticipant[0]?.voters ?? 0) >= (comp.minOfficialVoters ?? 3);

    for (let i = 0; i < perParticipant.length; i++) {
      const r = perParticipant[i];
      await db
        .update(competitionParticipants)
        .set({
          totalScore: r.total ?? null,
          placement: i + 1,
          updatedAt: nowUtc(),
        })
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
    res.json({ ok: true, winnerParticipantId, isOfficial, detail });
  } catch (error) {
    if (isMissingTable(err)) {
      return res.status(409).json({
        error:
          "Competitions tables are not initialized. Run `npm run db:push`.",
      });
    }
    next(err);
  }
});

// --- library / archive ---
router.get("/library", async (req, res, next) => {
  try {
    const {
      q,
      theme,
      creator,
      dateFrom,
      dateTo,
      limit = "30",
      offset = "0",
    } = req.query as Record<string, string>;
    const lim = Math.max(1, Math.min(100, parseInt(limit || "30", 10)));
    const off = Math.max(0, parseInt(offset || "0", 10));

    const where: any[] = [];
    if (q) where.push(ilike(competitions.title, `%${q}%`));
    if (theme) where.push(eq(competitions.themeName, theme));
    if (creator) where.push(eq(competitions.creatorId, creator));
    if (dateFrom) where.push(gte(competitions.createdAt, new Date(dateFrom)));
    if (dateTo) where.push(lte(competitions.createdAt, new Date(dateTo)));

    const whereExpr =
      where.length ? (where.length === 1 ? where[0] : and(...where)) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(competitions)
      .where(whereExpr);

    const items = await db
      .select()
      .from(competitions)
      .where(whereExpr)
      .orderBy(desc(competitions.createdAt))
      .limit(lim)
      .offset(off);

    res.json({ items, total, limit: lim, offset: off });
  } catch (error) {
    if (isMissingTable(err)) {
      return res.json({
        items: [],
        total: 0,
        limit: 30,
        offset: 0,
        note: "competitions tables not initialized yet",
      });
    }
    next(err);
  }
});

export default router;
