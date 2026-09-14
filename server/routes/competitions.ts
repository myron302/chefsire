// server/routes/competitions.ts
import { Router, type Request } from "express";
import { and, countDistinct, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/index";
import { ApiError } from "../middleware/error-handler";
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

/**
 * The acting user, and the ONLY source of one in this router.
 *
 * Every mutation here runs behind `requireAuth`, so `req.user` carries a verified token claim
 * rather than anything the caller typed. `x-user-id`, `req.body.userId` and `/:userId` path
 * segments name a target at most; they are never an identity.
 *
 * The guard is belt-and-braces: unreachable behind the middleware, but a route added later that
 * forgets it fails closed here instead of acting as whoever the request said it was.
 */
function actorId(req: Request): string {
  const id = (req.user as { id?: string } | undefined)?.id;
  if (typeof id !== "string" || id.length === 0) {
    // `ApiError` is what the global handler reads a status off; a bare Error would surface as a 500.
    throw new ApiError(401, "Unauthorized");
  }
  return id;
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
  } catch (err: any) {
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
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const userId = actorId(req);
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
  } catch (err: any) {
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
  } catch (err: any) {
    if (isMissingTable(err)) {
      return res
        .status(404)
        .json({ error: "Not found (tables not initialized yet)" });
    }
    next(err);
  }
});

// --- start (upcoming -> live) ---
router.post("/:id/start", requireAuth, async (req, res, next) => {
  try {
    const userId = actorId(req);
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
  } catch (err: any) {
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
router.post("/:id/end", requireAuth, async (req, res, next) => {
  try {
    const userId = actorId(req);
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
  } catch (err: any) {
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
router.post("/:id/submit", requireAuth, async (req, res, next) => {
  try {
    const userId = actorId(req);
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
  } catch (err: any) {
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
router.post("/:id/votes", requireAuth, async (req, res, next) => {
  try {
    const voterId = actorId(req);
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

    // `participantId` is a caller-supplied row id, and it is the id `/complete` later writes
    // placements back onto. Unchecked, a vote cast here could name a participant row belonging to
    // some other competition and have that competition's scoring overwritten when this one closes.
    // A vote is only ever for an entrant in the competition being voted on.
    const [target] = await db
      .select({ id: competitionParticipants.id })
      .from(competitionParticipants)
      .where(
        and(
          eq(competitionParticipants.id, String(participantId ?? "")),
          eq(competitionParticipants.competitionId, compId)
        )
      )
      .limit(1);
    if (!target)
      return res
        .status(400)
        .json({ error: "participantId is not an entrant in this competition." });

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
  } catch (err: any) {
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
router.post("/:id/complete", requireAuth, async (req, res, next) => {
  try {
    const userId = actorId(req);
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
  } catch (err: any) {
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
  } catch (err: any) {
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
