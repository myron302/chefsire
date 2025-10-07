// server/routes/competitions.ts
import "dotenv/config";
import { Router, Request, Response } from "express";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { and, countDistinct, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";

import {
  users,
  recipes,
  competitionThemes,
  competitions,
  competitionParticipants,
  competitionVotes,
  competitionViewers,
  competitionMedia,
  insertCompetitionSchema,
  insertCompetitionParticipantSchema,
  insertCompetitionVoteSchema,
} from "../../shared/schema.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Set it in server/.env");
}
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

// Simple auth shim; replace with your real auth middleware
function requireUser(req: Request, _res: Response, next: any) {
  // Expect req.user to be set by your auth in production.
  // For dev, accept x-user-id header (ONLY for development!)
  const uid = (req as any).user?.id || req.header("x-user-id");
  if (!uid) return next(new Error("Unauthorized"));
  (req as any).authUserId = String(uid);
  next();
}

const router = Router();

/**
 * POST /api/competitions
 * Create a competition room (public or private).
 * Body: { title?, themeId?, themeName?, recipeId?, isPrivate, timeLimitMinutes (30-120), minOfficialVoters? }
 */
router.post("/", requireUser, async (req, res, next) => {
  try {
    const creatorId = (req as any).authUserId as string;
    const parsed = insertCompetitionSchema.pick({
      title: true,
      themeId: true,
      themeName: true,
      recipeId: true,
      isPrivate: true,
      timeLimitMinutes: true,
      minOfficialVoters: true,
    }).parse(req.body);

    // guard range
    const tl = Number(parsed.timeLimitMinutes);
    if (isNaN(tl) || tl < 30 || tl > 120) {
      return res.status(400).json({ error: "timeLimitMinutes must be between 30 and 120" });
    }

    const [created] = await db
      .insert(competitions)
      .values({
        creatorId,
        title: parsed.title ?? null,
        themeId: parsed.themeId ?? null,
        themeName: parsed.themeName ?? null,
        recipeId: parsed.recipeId ?? null,
        isPrivate: !!parsed.isPrivate,
        timeLimitMinutes: tl,
        minOfficialVoters: parsed.minOfficialVoters ?? 3,
        status: "upcoming",
        videoProvider: "daily",
      })
      .returning();

    // auto-enroll creator as host
    await db.insert(competitionParticipants).values({
      competitionId: created.id,
      userId: creatorId,
      role: "host",
    });

    res.json(created);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/competitions
 * Query params: status?, theme?, q? (title search), limit?, offset?
 */
router.get("/", async (req, res, next) => {
  try {
    const { status, theme, q } = req.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);
    const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;

    const where = [
      status ? eq(competitions.status, status) : undefined,
      theme ? (ilike(competitions.themeName, `%${theme}%`)) : undefined,
      q ? ilike(competitions.title, `%${q}%`) : undefined,
    ].filter(Boolean) as any[];

    const rows = await db
      .select()
      .from(competitions)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(competitions.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ items: rows, limit, offset });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/competitions/:id
 * Returns competition + participants + basic tallies.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;

    const [comp] = await db.select().from(competitions).where(eq(competitions.id, id));
    if (!comp) return res.status(404).json({ error: "Not found" });

    const parts = await db
      .select()
      .from(competitionParticipants)
      .where(eq(competitionParticipants.competitionId, id));

    const votesByParticipant = await db
      .select({
        participantId: competitionVotes.participantId,
        voters: countDistinct(competitionVotes.voterId).as("voters"),
      })
      .from(competitionVotes)
      .where(eq(competitionVotes.competitionId, id))
      .groupBy(competitionVotes.participantId);

    const media = await db
      .select()
      .from(competitionMedia)
      .where(eq(competitionMedia.competitionId, id));

    res.json({ competition: comp, participants: parts, voteTallies: votesByParticipant, media });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/competitions/:id/join
 * Body: { role?: "competitor" | "spectator" }
 */
router.post("/:id/join", requireUser, async (req, res, next) => {
  try {
    const id = req.params.id;
    const userId = (req as any).authUserId as string;
    const role = (req.body?.role === "competitor") ? "competitor" : "spectator";

    const [comp] = await db.select().from(competitions).where(eq(competitions.id, id));
    if (!comp) return res.status(404).json({ error: "Competition not found" });

    if (comp.isPrivate) {
      // you can add invite-link verification here
      // for now, allow if creator or already participant; spectators allowed with link verification (todo)
    }

    if (role === "competitor") {
      // Add as participant if not exists
      const existing = await db
        .select()
        .from(competitionParticipants)
        .where(and(eq(competitionParticipants.competitionId, id), eq(competitionParticipants.userId, userId)));

      if (existing.length === 0) {
        await db.insert(competitionParticipants).values({
          competitionId: id,
          userId,
          role: "competitor",
        });
      }
    } else {
      // Spectator: ensure viewer record
      const existingViewer = await db
        .select()
        .from(competitionViewers)
        .where(and(eq(competitionViewers.competitionId, id), eq(competitionViewers.userId, userId)));

      if (existingViewer.length === 0) {
        await db.insert(competitionViewers).values({
          competitionId: id,
          userId,
          watchSeconds: 0,
        });
      }
    }

    res.json({ ok: true, role });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/competitions/:id/start
 * Sets status=live, startTime=now, and calculates expected end.
 */
router.post("/:id/start", requireUser, async (req, res, next) => {
  try {
    const id = req.params.id;
    const userId = (req as any).authUserId as string;

    const [comp] = await db.select().from(competitions).where(eq(competitions.id, id));
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.creatorId !== userId) return res.status(403).json({ error: "Only creator can start" });
    if (comp.status !== "upcoming") return res.status(400).json({ error: "Already started or closed" });

    const now = new Date();
    const end = new Date(now.getTime() + comp.timeLimitMinutes * 60_000);

    const [updated] = await db
      .update(competitions)
      .set({ status: "live", startTime: now, endTime: end })
      .where(eq(competitions.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/competitions/:id/end
 * Moves to judging for 24 hours (voting window).
 */
router.post("/:id/end", requireUser, async (req, res, next) => {
  try {
    const id = req.params.id;
    const userId = (req as any).authUserId as string;

    const [comp] = await db.select().from(competitions).where(eq(competitions.id, id));
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.creatorId !== userId) return res.status(403).json({ error: "Only creator can end" });

    const now = new Date();
    const judgingClosesAt = new Date(now.getTime() + 24 * 60 * 60_000);

    const [updated] = await db
      .update(competitions)
      .set({
        status: "judging",
        endTime: comp.endTime ?? now,
        judgingClosesAt,
      })
      .where(eq(competitions.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/competitions/:id/submit
 * Competitor final dish submission.
 * Body: { dishTitle?, dishDescription?, finalDishPhotoUrl? }
 */
router.post("/:id/submit", requireUser, async (req, res, next) => {
  try {
    const id = req.params.id;
    const userId = (req as any).authUserId as string;

    const part = await db
      .select()
      .from(competitionParticipants)
      .where(and(eq(competitionParticipants.competitionId, id), eq(competitionParticipants.userId, userId)));

    if (part.length === 0 || (part[0].role !== "competitor" && part[0].role !== "host")) {
      return res.status(403).json({ error: "Only competitors can submit" });
    }

    const { dishTitle, dishDescription, finalDishPhotoUrl } = req.body ?? {};

    const [updated] = await db
      .update(competitionParticipants)
      .set({
        dishTitle: dishTitle ?? null,
        dishDescription: dishDescription ?? null,
        finalDishPhotoUrl: finalDishPhotoUrl ?? null,
      })
      .where(eq(competitionParticipants.id, part[0].id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/competitions/:id/votes
 * Spectators only. Body: { participantId, presentation (1-10), creativity (1-10), technique (1-10) }
 */
router.post("/:id/votes", requireUser, async (req, res, next) => {
  try {
    const id = req.params.id;
    const voterId = (req as any).authUserId as string;
    const { participantId, presentation, creativity, technique } = insertCompetitionVoteSchema
      .pick({ participantId: true, presentation: true, creativity: true, technique: true })
      .parse(req.body);

    // Check phase
    const [comp] = await db.select().from(competitions).where(eq(competitions.id, id));
    if (!comp) return res.status(404).json({ error: "Competition not found" });
    const now = new Date();
    if (comp.status !== "judging" || (comp.judgingClosesAt && now > comp.judgingClosesAt)) {
      return res.status(400).json({ error: "Voting is closed" });
    }

    // Ensure voter is NOT a participant
    const p = await db
      .select()
      .from(competitionParticipants)
      .where(and(eq(competitionParticipants.competitionId, id), eq(competitionParticipants.userId, voterId)));
    if (p.length > 0) {
      return res.status(403).json({ error: "Participants cannot vote" });
    }

    // Validate participant belongs to this competition
    const target = await db
      .select({ competitionId: competitionParticipants.competitionId })
      .from(competitionParticipants)
      .where(eq(competitionParticipants.id, participantId));
    if (target.length === 0 || target[0].competitionId !== id) {
      return res.status(400).json({ error: "Invalid participant" });
    }

    // Upsert-ish: unique on (voterId, participantId)
    const [created] = await db
      .insert(competitionVotes)
      .values({
        competitionId: id,
        voterId,
        participantId,
        presentation,
        creativity,
        technique,
      })
      .onConflictDoUpdate({
        target: [competitionVotes.voterId, competitionVotes.participantId],
        set: { presentation, creativity, technique },
      })
      .returning();

    res.json(created);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/library
 * Search archive & completed events (status in ['judging','completed'])
 * Query: theme?, creator?, winner?, dateFrom?, dateTo?, q?, limit?, offset?
 */
router.get("/../library", async (req, res, next) => {
  try {
    const theme = req.query.theme as string | undefined;
    const creator = req.query.creator as string | undefined;
    const winner = req.query.winner as string | undefined;
    const q = req.query.q as string | undefined;

    const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : undefined;
    const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : undefined;

    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);
    const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;

    const where = [
      // judging or completed (to allow 24h window)
      sql`${competitions.status} IN ('judging','completed')`,
      theme ? ilike(competitions.themeName, `%${theme}%`) : undefined,
      creator ? eq(competitions.creatorId, creator) : undefined,
      winner ? eq(competitions.winnerParticipantId, winner) : undefined,
      q ? ilike(competitions.title, `%${q}%`) : undefined,
      dateFrom ? gte(competitions.startTime, dateFrom) : undefined,
      dateTo ? lte(competitions.endTime, dateTo) : undefined,
    ].filter(Boolean) as any[];

    const rows = await db
      .select()
      .from(competitions)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(competitions.endTime))
      .limit(limit)
      .offset(offset);

    res.json({ items: rows, limit, offset });
  } catch (err) {
    next(err);
  }
});

export default router;
