// server/routes/competitions.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { and, countDistinct, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/index";
import { ApiError } from "../middleware/error-handler";
import {
  castCompetitionVoteBody,
  competitionLibraryQuery,
  createCompetitionBody,
  firstIssueMessage,
  submitCompetitionEntryBody,
} from "../lib/competition-requests";
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
/**
 * Parse a request against a schema, or answer 400 and stop.
 *
 * Returns the PARSED value and nothing else, so a handler has no un-narrowed copy of the request
 * left to reach for. Client input is only ever used through what comes back from here.
 */
function parsed<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
  res: Response
): z.infer<T> | null {
  const result = schema.safeParse(input);
  if (!result.success) {
    res.status(400).json({ error: firstIssueMessage(result.error) });
    return null;
  }
  return result.data;
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
    // The bounds check used to coerce (`"60" < 15`) while the RAW field was what got stored, so the
    // checked value and the stored value were never required to be the same value. Now the parsed
    // body is the only thing this handler can see.
    const body = parsed(createCompetitionBody, req.body ?? {}, res);
    if (!body) return;

    const [created] = await db
      .insert(competitions)
      .values({
        creatorId: userId,
        title: body.title,
        themeName: body.themeName,
        recipeId: body.recipeId,
        isPrivate: body.isPrivate,
        timeLimitMinutes: body.timeLimitMinutes,
        minOfficialVoters: body.minOfficialVoters,
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
      .where(eq(competitions.id, comp.id));

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
      .where(eq(competitions.id, comp.id));

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
    const body = parsed(submitCompetitionEntryBody, req.body ?? {}, res);
    if (!body) return;

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
        competitionId: comp.id,
        userId,
        role: "competitor",
        dishTitle: body.dishTitle,
        dishDescription: body.dishDescription,
        finalDishPhotoUrl: body.finalDishPhotoUrl,
      })
      .onConflictDoUpdate({
        target: [
          competitionParticipants.competitionId,
          competitionParticipants.userId,
        ],
        set: {
          role: "competitor",
          dishTitle: body.dishTitle,
          dishDescription: body.dishDescription,
          finalDishPhotoUrl: body.finalDishPhotoUrl,
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
    const body = parsed(castCompetitionVoteBody, req.body ?? {}, res);
    if (!body) return;

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
          eq(competitionParticipants.competitionId, comp.id),
          eq(competitionParticipants.userId, voterId)
        )
      )
      .limit(1);
    if (maybeParticipant) return res.status(403).json({ error: "Participants cannot vote." });

    // `participantId` is a caller-supplied row id, and it is the id `/complete` later writes
    // placements back onto. Two things have to be true of it, and the order matters:
    //
    //   1. It is a string. `String(participantId)` is NOT a substitute -- `["id"]` and `[["id"]]`
    //      both stringify to `id` and would pass this lookup, while the driver serialises the
    //      array itself as `{"id"}` / `{{"id"}}`. Each is a distinct stored value, so each slips
    //      past `uniq_vote_per_voter_participant` and lands a ballot pointing at no participant
    //      row at all. The schema rejects every non-string form before we get here.
    //   2. It names an entrant in THIS competition -- otherwise a ballot could steer another
    //      competition's scoring when `/complete` writes placements back by participant id.
    //
    // What is then persisted is `target.id`, read back from the row we just validated. The request
    // value is not used again; there is no path by which the checked id and the stored id differ.
    const [target] = await db
      .select({ id: competitionParticipants.id })
      .from(competitionParticipants)
      .where(
        and(
          eq(competitionParticipants.id, body.participantId),
          eq(competitionParticipants.competitionId, comp.id)
        )
      )
      .limit(1);
    if (!target)
      return res
        .status(400)
        .json({ error: "participantId is not an entrant in this competition." });

    const pv = clamp1to10(body.presentation);
    const cv = clamp1to10(body.creativity);
    const tv = clamp1to10(body.technique);

    await db
      .insert(competitionVotes)
      .values({
        competitionId: comp.id,
        voterId,
        participantId: target.id,
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
      .where(eq(competitionVotes.competitionId, comp.id))
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
      .where(eq(competitions.id, comp.id));

    const detail = await getCompetitionDetail(comp.id);
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
    // `req.query` is NOT `Record<string, string>`, whatever the old cast claimed: Express hands back
    // an array for `?theme=a&theme=b` and an object for a bracketed key. `new Date(<array>)` then
    // reached `timestamp.toISOString()` and threw a RangeError, answering an unauthenticated
    // request with a 500. The schema settles the shape, and the parsed values are what get used.
    const query = parsed(competitionLibraryQuery, req.query ?? {}, res);
    if (!query) return;
    const lim = query.limit;
    const off = query.offset;

    const where: any[] = [];
    if (query.q) where.push(ilike(competitions.title, `%${query.q}%`));
    if (query.theme) where.push(eq(competitions.themeName, query.theme));
    if (query.creator) where.push(eq(competitions.creatorId, query.creator));
    if (query.dateFrom) where.push(gte(competitions.createdAt, query.dateFrom));
    if (query.dateTo) where.push(lte(competitions.createdAt, query.dateTo));

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
