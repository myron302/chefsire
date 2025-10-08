// server/routes/competitions.ts
import { Router } from "express";
import { and, countDistinct, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";

import { db } from "../db/index"; // explicit index for esbuild resolution
import {
  competitions,
  competitionParticipants,
  competitionVotes,
} from "../db/competitions";

const router = Router();

const nowUtc = () => new Date();
function requireUserId(req: any): string {
  const uid = (req.user && req.user.id) || (req.headers["x-user-id"] as string) || "";
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

  return { competition: comp, participants: parts, voteTallies: tallies, media: [] };
}

// ---------------------------------------------------------------------------
// LIST (GET /api/competitions)
// ---------------------------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    const { q, theme, creator, status, limit = "30", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.max(1, Math.min(100, parseInt(limit || "30", 10)));
    const off = Math.max(0, parseInt(offset || "0", 10));

    const where = [];
    if (q) where.push(ilike(competitions.title, `%${q}%`));
    if (theme) where.push(eq(competitions.themeName, theme));
    if (creator) where.push(eq(competitions.creatorId, creator));
    if (status) where.push(eq(competitions.status, status));

    const items = await db
      .select()
      .from(competitions)
      .where(where.length ? (where.length === 1 ? where[0] : and(...where)) : undefined)
      .orderBy(desc(competitions.createdAt))
      .limit(lim)
      .offset(off);

    res.json({ items, limit: lim, offset: off });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// LIBRARY (GET /api/competitions/library) — define BEFORE :id
// ---------------------------------------------------------------------------
router.get("/library", async (req, res, next) => {
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

    res.json({ items, limit: lim, offset: off });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// CREATE (POST /api/competitions)
// ---------------------------------------------------------------------------
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

    if (!themeName) {
      return res.status(400).json({ error: "themeName is required" });
    }
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

    // auto-add creator as host
    await db
      .insert(competitionParticipants)
      .values({ competitionId: created.id, userId, role: "host" })
      .onConflictDoNothing();

    res.json({ id: created.id });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DETAIL (GET /api/competitions/:id)
// ---------------------------------------------------------------------------
router.get("/:id", async (req, res, next) => {
  try {
    const detail = await getCompetitionDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: "Not found" });
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// START (POST /api/competitions/:id/start)
// ---------------------------------------------------------------------------
router.post("/:id/start", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const compId = req.params.id;

    const [comp] = await db.select().from(competitions).where(eq(competitions.id, compId)).limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.creatorId !== userId) return res.status(403).json({ error: "Forbidden" });
    if (comp.status !== "upcoming") return res.status(400).json({ error: `Cannot start when status=${comp.status}` });

    const start = nowUtc();
    const end = new Date(start.getTime() + comp.timeLimitMinutes * 60_000);

    await db.update(competitions).set({
      status: "live",
      startTime: start,
      endTime: end,
      updatedAt: nowUtc(),
    }).where(eq(competitions.id, compId));

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// END → JUDGING (POST /api/competitions/:id/end)
// ---------------------------------------------------------------------------
router.post("/:id/end", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const compId = req.params.id;

    const [comp] = await db.select().from(competitions).where(eq(competitions.id, compId)).limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.creatorId !== userId) return res.status(403).json({ error: "Forbidden" });
    if (comp.status !== "live") return res.status(400).json({ error: `Cannot end when status=${comp.status}` });

    const closeAt = new Date(nowUtc().getTime() + 24 * 60 * 60_000);

    await db.update(competitions).set({
      status: "judging",
      endTime: nowUtc(),
      judgingClosesAt: closeAt,
      updatedAt: nowUtc(),
    }).where(eq(competitions.id, compId));

    res.json({ ok: true, judgingClosesAt: closeAt.toISOString() });
  } catch (err) {
    next(err);
  }
});
// ---------------------------------------------------------------------------
// SUBMIT (POST /api/competitions/:id/submit)
// ---------------------------------------------------------------------------
router.post("/:id/submit", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const compId = req.params.id;
    const { dishTitle, dishDescription, finalDishPhotoUrl } = req.body || {};

    const [comp] = await db.select().from(competitions).where(eq(competitions.id, compId)).limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.status !== "live" && comp.status !== "judging") {
      return res.status(400).json({ error: "Submissions only allowed during live or judging." });
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
        target: [competitionParticipants.competitionId, competitionParticipants.userId],
        set: {
          role: "competitor",
          dishTitle: dishTitle ?? null,
          dishDescription: dishDescription ?? null,
          finalDishPhotoUrl: finalDishPhotoUrl ?? null,
          updatedAt: nowUtc(),
        },
      });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// VOTE (POST /api/competitions/:id/votes)
// ---------------------------------------------------------------------------
router.post("/:id/votes", async (req, res, next) => {
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
        target: [competitionVotes.competitionId, competitionVotes.voterId, competitionVotes.participantId],
        set: { presentation: pv, creativity: cv, technique: tv },
      });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// COMPLETE (POST /api/competitions/:id/complete)
// ---------------------------------------------------------------------------
router.post("/:id/complete", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const compId = req.params.id;

    const [comp] = await db.select().from(competitions).where(eq(competitions.id, compId)).limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.creatorId !== userId) return res.status(403).json({ error: "Forbidden" });
    if (comp.status !== "judging") return res.status(400).json({ error: `Cannot complete when status=${comp.status}` });

    const perParticipant = await db
      .select({
        participantId: competitionVotes.participantId,
        total: sql<number>`SUM(${competitionVotes.presentation} + ${competitionVotes.creativity} + ${competitionVotes.technique})`,
        voters: countDistinct(competitionVotes.voterId).as("voters"),
      })
      .from(competitionVotes)
      .where(eq(competitionVotes.competitionId, compId))
      .groupBy(competitionVotes.participantId)
      .orderBy(desc(sql`SUM(${competitionVotes.presentation} + ${competitionVotes.creativity} + ${competitionVotes.technique})`));

    const winnerParticipantId = perParticipant[0]?.participantId ?? null;
    const isOfficial = (perParticipant[0]?.voters ?? 0) >= (comp.minOfficialVoters ?? 3);

    // update placements & totals
    for (let i = 0; i < perParticipant.length; i++) {
      const r = perParticipant[i];
      await db
        .update(competitionParticipants)
        .set({ totalScore: r.total ?? null, placement: i + 1, updatedAt: nowUtc() })
        .where(eq(competitionParticipants.id, r.participantId));
    }

    await db.update(competitions).set({
      status: "completed",
      winnerParticipantId,
      isOfficial,
      updatedAt: nowUtc(),
    }).where(eq(competitions.id, compId));

    const detail = await getCompetitionDetail(compId);
    res.json({ ok: true, winnerParticipantId, isOfficial, detail });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// VIDEO ROOM (POST /api/competitions/:id/video-room)
// Creates or returns a Daily.co room URL for the competition (iframe-embeddable).
// Requires env: DAILY_API_KEY, DAILY_SUBDOMAIN
// ---------------------------------------------------------------------------
router.post("/:id/video-room", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const compId = req.params.id;

    const DAILY_API_KEY = process.env.DAILY_API_KEY;
    const DAILY_SUBDOMAIN = process.env.DAILY_SUBDOMAIN; // e.g., "chefsire" → chefsire.daily.co

    if (!DAILY_API_KEY || !DAILY_SUBDOMAIN) {
      return res.status(500).json({
        error:
          "Daily video is not configured. Set DAILY_API_KEY and DAILY_SUBDOMAIN in your environment.",
      });
    }

    // ensure competition exists and user is the creator (host creates the room)
    const [comp] = await db.select().from(competitions).where(eq(competitions.id, compId)).limit(1);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.creatorId !== userId) return res.status(403).json({ error: "Forbidden" });

    // idempotent room name derived from competition id (no DB migration needed)
    const roomName = `comp-${compId}`;

    // create-or-get room from Daily API
    const roomResp = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        privacy: req.body?.privacy === "private" ? "private" : "public",
        properties: {
          enable_screenshare: true,
          enable_chat: true,
          start_video_off: false,
          start_audio_off: true,
          eject_at_room_exp: true,
          exp: Math.floor(Date.now() / 1000) + 48 * 60 * 60, // 48h
        },
      }),
    });

    // If room already exists, Daily returns 409; try GET
    let roomOk = roomResp.ok;
    if (!roomOk && roomResp.status === 409) {
      const getResp = await fetch(`https://api.daily.co/v1/rooms/${encodeURIComponent(roomName)}`, {
        headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
      });
      roomOk = getResp.ok;
      if (!roomOk) {
        const txt = await getResp.text();
        return res.status(500).json({ error: "Failed to fetch existing room", details: txt });
      }
    } else if (!roomOk) {
      const txt = await roomResp.text();
      return res.status(500).json({ error: "Failed to create room", details: txt });
    }

    const roomUrl = `https://${DAILY_SUBDOMAIN}.daily.co/${roomName}`;
    res.json({ roomUrl });
  } catch (err) {
    next(err);
  }
});

export default router;
