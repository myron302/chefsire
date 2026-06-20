import { Router, type Request, type Response, type NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { requireAuth, optionalAuth } from "../middleware";

const router = Router();
const SHARED_WEEK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const COMMENT_LIMIT = 1000;

let schemaReady: Promise<void> | null = null;

export async function ensureMealSocialSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_plan_likes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blueprint_id VARCHAR NOT NULL REFERENCES meal_plan_blueprints(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, blueprint_id)
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_meal_plan_likes_blueprint ON meal_plan_likes(blueprint_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_meal_plan_likes_user ON meal_plan_likes(user_id);`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_plan_saves (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blueprint_id VARCHAR NOT NULL REFERENCES meal_plan_blueprints(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, blueprint_id)
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_meal_plan_saves_blueprint ON meal_plan_saves(blueprint_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_meal_plan_saves_user ON meal_plan_saves(user_id);`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_plan_comments (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blueprint_id VARCHAR NOT NULL REFERENCES meal_plan_blueprints(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_meal_plan_comments_blueprint_created ON meal_plan_comments(blueprint_id, created_at DESC);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_meal_plan_comments_user ON meal_plan_comments(user_id);`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shared_week_likes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        public_share_token VARCHAR(80) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, public_share_token)
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shared_week_likes_token ON shared_week_likes(public_share_token);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shared_week_likes_user ON shared_week_likes(user_id);`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shared_week_saves (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        public_share_token VARCHAR(80) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, public_share_token)
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shared_week_saves_token ON shared_week_saves(public_share_token);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shared_week_saves_user ON shared_week_saves(user_id);`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shared_week_comments (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        public_share_token VARCHAR(80) NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shared_week_comments_token_created ON shared_week_comments(public_share_token, created_at DESC);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shared_week_comments_user ON shared_week_comments(user_id);`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_plan_creator_profiles (
        user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        display_title TEXT,
        bio TEXT,
        specialty TEXT,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
  })();
  return schemaReady;
}

async function ensureSchemaMiddleware(_req: Request, res: Response, next: NextFunction) {
  try {
    await ensureMealSocialSchema();
    next();
  } catch (error) {
    console.error("Error ensuring meal social schema:", error);
    res.status(500).json({ message: "Meal planner social schema is not ready" });
  }
}

router.use(ensureSchemaMiddleware);

export async function getMealPlanSocialStats(blueprintId: string, viewerId?: string | null) {
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM meal_plan_likes WHERE blueprint_id = ${blueprintId}) AS like_count,
      (SELECT COUNT(*)::int FROM meal_plan_saves WHERE blueprint_id = ${blueprintId}) AS save_count,
      (SELECT COUNT(*)::int FROM meal_plan_comments WHERE blueprint_id = ${blueprintId} AND deleted_at IS NULL) AS comment_count,
      ${viewerId ? sql`EXISTS(SELECT 1 FROM meal_plan_likes WHERE blueprint_id = ${blueprintId} AND user_id = ${viewerId})` : sql`FALSE`} AS viewer_has_liked,
      ${viewerId ? sql`EXISTS(SELECT 1 FROM meal_plan_saves WHERE blueprint_id = ${blueprintId} AND user_id = ${viewerId})` : sql`FALSE`} AS viewer_has_saved
  `);
  const row = (result as any).rows?.[0] || {};
  return normalizeSocialStats(row);
}

export async function getSharedWeekSocialStats(token: string, viewerId?: string | null) {
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM shared_week_likes WHERE public_share_token = ${token}) AS like_count,
      (SELECT COUNT(*)::int FROM shared_week_saves WHERE public_share_token = ${token}) AS save_count,
      (SELECT COUNT(*)::int FROM shared_week_comments WHERE public_share_token = ${token} AND deleted_at IS NULL) AS comment_count,
      ${viewerId ? sql`EXISTS(SELECT 1 FROM shared_week_likes WHERE public_share_token = ${token} AND user_id = ${viewerId})` : sql`FALSE`} AS viewer_has_liked,
      ${viewerId ? sql`EXISTS(SELECT 1 FROM shared_week_saves WHERE public_share_token = ${token} AND user_id = ${viewerId})` : sql`FALSE`} AS viewer_has_saved
  `);
  const row = (result as any).rows?.[0] || {};
  return normalizeSocialStats(row);
}

function normalizeSocialStats(row: any) {
  return {
    likeCount: Number(row.like_count || 0),
    saveCount: Number(row.save_count || 0),
    commentCount: Number(row.comment_count || 0),
    viewerHasLiked: Boolean(row.viewer_has_liked),
    viewerHasSaved: Boolean(row.viewer_has_saved),
  };
}

function normalizeCommentText(raw: unknown) {
  return String(raw ?? "").trim().slice(0, COMMENT_LIMIT);
}

async function mealPlanExists(planId: string) {
  const result = await db.execute(sql`SELECT id FROM meal_plan_blueprints WHERE id = ${planId} LIMIT 1`);
  return Boolean((result as any).rows?.[0]);
}

async function publicSharedWeekExists(token: string) {
  if (!SHARED_WEEK_TOKEN_PATTERN.test(token)) return false;
  const result = await db.execute(sql`
    SELECT public_share_token FROM meal_plan_week_shares
    WHERE public_share_token = ${token} AND visibility = 'public'
    LIMIT 1
  `);
  return Boolean((result as any).rows?.[0]);
}

router.post("/meal-plans/:id/like", requireAuth, async (req, res) => {
  const planId = req.params.id;
  if (!(await mealPlanExists(planId))) return res.status(404).json({ message: "Meal plan not found" });
  await db.execute(sql`
    INSERT INTO meal_plan_likes (user_id, blueprint_id)
    VALUES (${(req.user as any).id}, ${planId})
    ON CONFLICT (user_id, blueprint_id) DO NOTHING
  `);
  res.json(await getMealPlanSocialStats(planId, (req.user as any).id));
});

router.delete("/meal-plans/:id/like", requireAuth, async (req, res) => {
  const planId = req.params.id;
  await db.execute(sql`DELETE FROM meal_plan_likes WHERE user_id = ${(req.user as any).id} AND blueprint_id = ${planId}`);
  res.json(await getMealPlanSocialStats(planId, (req.user as any).id));
});

router.post("/meal-plans/:id/save", requireAuth, async (req, res) => {
  const planId = req.params.id;
  if (!(await mealPlanExists(planId))) return res.status(404).json({ message: "Meal plan not found" });
  await db.execute(sql`
    INSERT INTO meal_plan_saves (user_id, blueprint_id)
    VALUES (${(req.user as any).id}, ${planId})
    ON CONFLICT (user_id, blueprint_id) DO NOTHING
  `);
  res.json(await getMealPlanSocialStats(planId, (req.user as any).id));
});

router.delete("/meal-plans/:id/save", requireAuth, async (req, res) => {
  const planId = req.params.id;
  await db.execute(sql`DELETE FROM meal_plan_saves WHERE user_id = ${(req.user as any).id} AND blueprint_id = ${planId}`);
  res.json(await getMealPlanSocialStats(planId, (req.user as any).id));
});

router.get("/meal-plans/:id/comments", optionalAuth, async (req, res) => {
  const planId = req.params.id;
  if (!(await mealPlanExists(planId))) return res.status(404).json({ message: "Meal plan not found" });
  const commentsResult = await db.execute(sql`
    SELECT c.id, c.user_id, c.comment, c.created_at, c.updated_at,
           u.username, u.display_name, u.avatar
    FROM meal_plan_comments c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.blueprint_id = ${planId} AND c.deleted_at IS NULL
    ORDER BY c.created_at ASC
    LIMIT 100
  `);
  res.json({ comments: mapComments((commentsResult as any).rows || []), social: await getMealPlanSocialStats(planId, (req.user as any)?.id) });
});

router.post("/meal-plans/:id/comments", requireAuth, async (req, res) => {
  const planId = req.params.id;
  const comment = normalizeCommentText(req.body?.comment ?? req.body?.text);
  if (!comment) return res.status(400).json({ message: "Comment text is required" });
  if (!(await mealPlanExists(planId))) return res.status(404).json({ message: "Meal plan not found" });
  const result = await db.execute(sql`
    INSERT INTO meal_plan_comments (user_id, blueprint_id, comment)
    VALUES (${(req.user as any).id}, ${planId}, ${comment})
    RETURNING id
  `);
  res.status(201).json({ id: (result as any).rows?.[0]?.id, social: await getMealPlanSocialStats(planId, (req.user as any).id) });
});

router.delete("/meal-plans/:id/comments/:commentId", requireAuth, async (req, res) => {
  const { id: planId, commentId } = req.params;
  const result = await db.execute(sql`
    UPDATE meal_plan_comments
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${commentId} AND blueprint_id = ${planId} AND user_id = ${(req.user as any).id} AND deleted_at IS NULL
    RETURNING id
  `);
  if (!(result as any).rows?.[0]) return res.status(404).json({ message: "Comment not found or not owned by viewer" });
  res.json(await getMealPlanSocialStats(planId, (req.user as any).id));
});

router.post("/meal-planner/week/shared/:token/like", requireAuth, async (req, res) => {
  const token = req.params.token;
  if (!(await publicSharedWeekExists(token))) return res.status(404).json({ message: "Shared week not found" });
  await db.execute(sql`INSERT INTO shared_week_likes (user_id, public_share_token) VALUES (${(req.user as any).id}, ${token}) ON CONFLICT (user_id, public_share_token) DO NOTHING`);
  res.json(await getSharedWeekSocialStats(token, (req.user as any).id));
});

router.delete("/meal-planner/week/shared/:token/like", requireAuth, async (req, res) => {
  const token = req.params.token;
  await db.execute(sql`DELETE FROM shared_week_likes WHERE user_id = ${(req.user as any).id} AND public_share_token = ${token}`);
  res.json(await getSharedWeekSocialStats(token, (req.user as any).id));
});

router.post("/meal-planner/week/shared/:token/save", requireAuth, async (req, res) => {
  const token = req.params.token;
  if (!(await publicSharedWeekExists(token))) return res.status(404).json({ message: "Shared week not found" });
  await db.execute(sql`INSERT INTO shared_week_saves (user_id, public_share_token) VALUES (${(req.user as any).id}, ${token}) ON CONFLICT (user_id, public_share_token) DO NOTHING`);
  res.json(await getSharedWeekSocialStats(token, (req.user as any).id));
});

router.delete("/meal-planner/week/shared/:token/save", requireAuth, async (req, res) => {
  const token = req.params.token;
  await db.execute(sql`DELETE FROM shared_week_saves WHERE user_id = ${(req.user as any).id} AND public_share_token = ${token}`);
  res.json(await getSharedWeekSocialStats(token, (req.user as any).id));
});

router.get("/meal-planner/week/shared/:token/comments", optionalAuth, async (req, res) => {
  const token = req.params.token;
  if (!(await publicSharedWeekExists(token))) return res.status(404).json({ message: "Shared week not found" });
  const commentsResult = await db.execute(sql`
    SELECT c.id, c.user_id, c.comment, c.created_at, c.updated_at,
           u.username, u.display_name, u.avatar
    FROM shared_week_comments c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.public_share_token = ${token} AND c.deleted_at IS NULL
    ORDER BY c.created_at ASC
    LIMIT 100
  `);
  res.json({ comments: mapComments((commentsResult as any).rows || []), social: await getSharedWeekSocialStats(token, (req.user as any)?.id) });
});

router.post("/meal-planner/week/shared/:token/comments", requireAuth, async (req, res) => {
  const token = req.params.token;
  const comment = normalizeCommentText(req.body?.comment ?? req.body?.text);
  if (!comment) return res.status(400).json({ message: "Comment text is required" });
  if (!(await publicSharedWeekExists(token))) return res.status(404).json({ message: "Shared week not found" });
  const result = await db.execute(sql`INSERT INTO shared_week_comments (user_id, public_share_token, comment) VALUES (${(req.user as any).id}, ${token}, ${comment}) RETURNING id`);
  res.status(201).json({ id: (result as any).rows?.[0]?.id, social: await getSharedWeekSocialStats(token, (req.user as any).id) });
});

router.delete("/meal-planner/week/shared/:token/comments/:commentId", requireAuth, async (req, res) => {
  const { token, commentId } = req.params;
  const result = await db.execute(sql`
    UPDATE shared_week_comments
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${commentId} AND public_share_token = ${token} AND user_id = ${(req.user as any).id} AND deleted_at IS NULL
    RETURNING id
  `);
  if (!(result as any).rows?.[0]) return res.status(404).json({ message: "Comment not found or not owned by viewer" });
  res.json(await getSharedWeekSocialStats(token, (req.user as any).id));
});


router.get("/meal-plan-creators", optionalAuth, async (req, res) => {
  const viewerId = (req.user as any)?.id || "";
  const search = String(req.query.search || "").trim().toLowerCase();
  const result = await db.execute(sql`
    WITH creator_ids AS (
      SELECT creator_id AS id FROM meal_plan_blueprints WHERE status = 'published'
      UNION
      SELECT user_id AS id FROM meal_plan_week_shares WHERE visibility = 'public' AND public_share_token IS NOT NULL
      UNION
      SELECT user_id AS id FROM meal_plan_creator_profiles
    )
    SELECT u.id, u.username, u.display_name, u.avatar, u.bio, u.specialty, u.followers_count,
           p.display_title, p.bio AS profile_bio, p.specialty AS profile_specialty, p.avatar_url,
           (SELECT COUNT(*)::int FROM meal_plan_blueprints b WHERE b.creator_id = u.id AND b.status = 'published') AS plan_count,
           (SELECT COUNT(*)::int FROM meal_plan_week_shares sh WHERE sh.user_id = u.id AND sh.visibility = 'public' AND sh.public_share_token IS NOT NULL) AS shared_week_count,
           (SELECT COALESCE(SUM((SELECT COUNT(*) FROM meal_plan_likes l WHERE l.blueprint_id = b.id)), 0)::int FROM meal_plan_blueprints b WHERE b.creator_id = u.id AND b.status = 'published') AS plan_likes,
           (SELECT COALESCE(SUM((SELECT COUNT(*) FROM meal_plan_saves sv WHERE sv.blueprint_id = b.id)), 0)::int FROM meal_plan_blueprints b WHERE b.creator_id = u.id AND b.status = 'published') AS plan_saves,
           (SELECT COALESCE(SUM((SELECT COUNT(*) FROM meal_plan_comments c WHERE c.blueprint_id = b.id AND c.deleted_at IS NULL)), 0)::int FROM meal_plan_blueprints b WHERE b.creator_id = u.id AND b.status = 'published') AS plan_comments,
           (SELECT COALESCE(SUM((SELECT COUNT(*) FROM shared_week_likes l WHERE l.public_share_token = sh.public_share_token)), 0)::int FROM meal_plan_week_shares sh WHERE sh.user_id = u.id AND sh.visibility = 'public') AS week_likes,
           (SELECT COALESCE(SUM((SELECT COUNT(*) FROM shared_week_saves sv WHERE sv.public_share_token = sh.public_share_token)), 0)::int FROM meal_plan_week_shares sh WHERE sh.user_id = u.id AND sh.visibility = 'public') AS week_saves,
           (SELECT COALESCE(SUM((SELECT COUNT(*) FROM shared_week_comments c WHERE c.public_share_token = sh.public_share_token AND c.deleted_at IS NULL)), 0)::int FROM meal_plan_week_shares sh WHERE sh.user_id = u.id AND sh.visibility = 'public') AS week_comments,
           (SELECT COALESCE(SUM(b.sales_count), 0)::int FROM meal_plan_blueprints b WHERE b.creator_id = u.id AND b.status = 'published') AS total_sales,
           EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ${viewerId} AND f.following_id = u.id) AS viewer_is_following
    FROM creator_ids ci
    INNER JOIN users u ON u.id = ci.id
    LEFT JOIN meal_plan_creator_profiles p ON p.user_id = u.id
    ORDER BY (COALESCE(u.followers_count, 0) + (SELECT COUNT(*) FROM meal_plan_blueprints b WHERE b.creator_id = u.id AND b.status = 'published') * 3) DESC, u.display_name ASC
    LIMIT 100
  `);
  let creators = ((result as any).rows || []).map((row: any) => {
    const totalLikes = Number(row.plan_likes || 0) + Number(row.week_likes || 0);
    const totalSaves = Number(row.plan_saves || 0) + Number(row.week_saves || 0);
    const totalComments = Number(row.plan_comments || 0) + Number(row.week_comments || 0);
    return {
      creatorId: row.id,
      displayName: row.display_title || row.display_name,
      username: row.username,
      avatarUrl: row.avatar_url || row.avatar,
      bio: row.profile_bio || row.bio,
      specialty: row.profile_specialty || row.specialty,
      followerCount: Number(row.followers_count || 0),
      planCount: Number(row.plan_count || 0),
      sharedWeekCount: Number(row.shared_week_count || 0),
      totalLikes,
      totalSaves,
      totalComments,
      totalSales: Number(row.total_sales || 0),
      viewerIsFollowing: Boolean(row.viewer_is_following),
    };
  });
  if (search) {
    creators = creators.filter((creator: any) => [creator.displayName, creator.username, creator.bio, creator.specialty].some((value) => String(value || "").toLowerCase().includes(search)));
  }
  res.json({ creators });
});

router.get("/meal-plan-creators/:creatorId", optionalAuth, async (req, res) => {
  const creatorId = req.params.creatorId;
  const creatorResult = await db.execute(sql`
    SELECT u.id, u.username, u.display_name, u.avatar, u.bio, u.specialty, u.followers_count,
           p.display_title, p.bio AS profile_bio, p.specialty AS profile_specialty, p.avatar_url,
           EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ${(req.user as any)?.id || ""} AND f.following_id = u.id) AS viewer_is_following
    FROM users u
    LEFT JOIN meal_plan_creator_profiles p ON p.user_id = u.id
    WHERE u.id = ${creatorId}
    LIMIT 1
  `);
  const row = (creatorResult as any).rows?.[0];
  if (!row) return res.status(404).json({ message: "Creator not found" });
  const sharedWeeksResult = await db.execute(sql`
    SELECT sh.public_share_token, sh.week_anchor, sh.updated_at,
      (SELECT COUNT(*)::int FROM shared_week_likes l WHERE l.public_share_token = sh.public_share_token) AS like_count,
      (SELECT COUNT(*)::int FROM shared_week_saves s WHERE s.public_share_token = sh.public_share_token) AS save_count,
      (SELECT COUNT(*)::int FROM shared_week_comments c WHERE c.public_share_token = sh.public_share_token AND c.deleted_at IS NULL) AS comment_count,
      EXISTS(SELECT 1 FROM shared_week_likes l WHERE l.public_share_token = sh.public_share_token AND l.user_id = ${(req.user as any)?.id || ""}) AS viewer_has_liked,
      EXISTS(SELECT 1 FROM shared_week_saves s WHERE s.public_share_token = sh.public_share_token AND s.user_id = ${(req.user as any)?.id || ""}) AS viewer_has_saved
    FROM meal_plan_week_shares sh
    WHERE sh.user_id = ${creatorId} AND sh.visibility = 'public' AND sh.public_share_token IS NOT NULL
    ORDER BY sh.updated_at DESC
    LIMIT 6
  `);

  const statsResult = await db.execute(sql`
    SELECT
      COUNT(DISTINCT b.id)::int AS plans_published,
      COALESCE(SUM((SELECT COUNT(*) FROM meal_plan_likes l WHERE l.blueprint_id = b.id)), 0)::int AS total_likes,
      COALESCE(SUM((SELECT COUNT(*) FROM meal_plan_saves s WHERE s.blueprint_id = b.id)), 0)::int AS total_saves,
      COALESCE(SUM((SELECT COUNT(*) FROM meal_plan_reviews r WHERE r.blueprint_id = b.id)), 0)::int AS total_reviews,
      COALESCE(SUM(b.sales_count), 0)::int AS total_sales
    FROM meal_plan_blueprints b
    WHERE b.creator_id = ${creatorId} AND b.status = 'published'
  `);
  const statsRow = (statsResult as any).rows?.[0] || {};
  res.json({
    creator: {
      id: row.id,
      username: row.username,
      displayName: row.display_title || row.display_name,
      avatarUrl: row.avatar_url || row.avatar,
      bio: row.profile_bio || row.bio,
      specialty: row.profile_specialty || row.specialty,
      followerCount: Number(row.followers_count || 0),
      viewerIsFollowing: Boolean(row.viewer_is_following),
    },
    stats: {
      plansPublished: Number(statsRow.plans_published || 0),
      totalLikes: Number(statsRow.total_likes || 0),
      totalSaves: Number(statsRow.total_saves || 0),
      totalReviews: Number(statsRow.total_reviews || 0),
      totalSales: Number(statsRow.total_sales || 0),
    },
    publicSharedWeeks: ((sharedWeeksResult as any).rows || []).map(mapSavedWeekRow),
  });
});

router.get("/meal-plan-creators/:creatorId/plans", optionalAuth, async (req, res) => {
  const creatorId = req.params.creatorId;
  const result = await db.execute(sql`
    SELECT b.*, u.id AS creator_id, u.username, u.display_name,
      (SELECT AVG(r.rating) FROM meal_plan_reviews r WHERE r.blueprint_id = b.id) AS avg_rating,
      (SELECT COUNT(*)::int FROM meal_plan_reviews r WHERE r.blueprint_id = b.id) AS review_count,
      (SELECT COUNT(*)::int FROM meal_plan_likes l WHERE l.blueprint_id = b.id) AS like_count,
      (SELECT COUNT(*)::int FROM meal_plan_saves s WHERE s.blueprint_id = b.id) AS save_count,
      (SELECT COUNT(*)::int FROM meal_plan_comments c WHERE c.blueprint_id = b.id AND c.deleted_at IS NULL) AS comment_count,
      EXISTS(SELECT 1 FROM meal_plan_likes l WHERE l.blueprint_id = b.id AND l.user_id = ${(req.user as any)?.id || ""}) AS viewer_has_liked,
      EXISTS(SELECT 1 FROM meal_plan_saves s WHERE s.blueprint_id = b.id AND s.user_id = ${(req.user as any)?.id || ""}) AS viewer_has_saved
    FROM meal_plan_blueprints b
    INNER JOIN users u ON u.id = b.creator_id
    WHERE b.creator_id = ${creatorId} AND b.status = 'published'
    ORDER BY b.created_at DESC
  `);
  res.json({ plans: ((result as any).rows || []).map(mapPlanRow) });
});

router.put("/meal-plan-creators/me", requireAuth, async (req, res) => {
  const displayTitle = nullableTrim(req.body?.displayTitle ?? req.body?.display_title);
  const bio = nullableTrim(req.body?.bio);
  const specialty = nullableTrim(req.body?.specialty);
  const avatarUrl = nullableTrim(req.body?.avatarUrl ?? req.body?.avatar_url);
  const result = await db.execute(sql`
    INSERT INTO meal_plan_creator_profiles (user_id, display_title, bio, specialty, avatar_url, updated_at)
    VALUES (${(req.user as any).id}, ${displayTitle}, ${bio}, ${specialty}, ${avatarUrl}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      display_title = EXCLUDED.display_title,
      bio = EXCLUDED.bio,
      specialty = EXCLUDED.specialty,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = NOW()
    RETURNING *
  `);
  res.json({ profile: (result as any).rows?.[0] });
});

router.get("/me/saved-meal-planner-items", requireAuth, async (req, res) => {
  const plansResult = await db.execute(sql`
    SELECT b.*, u.id AS creator_id, u.username, u.display_name, s.created_at AS saved_at,
      (SELECT AVG(r.rating) FROM meal_plan_reviews r WHERE r.blueprint_id = b.id) AS avg_rating,
      (SELECT COUNT(*)::int FROM meal_plan_reviews r WHERE r.blueprint_id = b.id) AS review_count,
      (SELECT COUNT(*)::int FROM meal_plan_likes l WHERE l.blueprint_id = b.id) AS like_count,
      (SELECT COUNT(*)::int FROM meal_plan_saves ms WHERE ms.blueprint_id = b.id) AS save_count,
      (SELECT COUNT(*)::int FROM meal_plan_comments c WHERE c.blueprint_id = b.id AND c.deleted_at IS NULL) AS comment_count,
      EXISTS(SELECT 1 FROM meal_plan_likes l WHERE l.blueprint_id = b.id AND l.user_id = ${(req.user as any).id}) AS viewer_has_liked,
      TRUE AS viewer_has_saved
    FROM meal_plan_saves s
    INNER JOIN meal_plan_blueprints b ON b.id = s.blueprint_id
    INNER JOIN users u ON u.id = b.creator_id
    WHERE s.user_id = ${(req.user as any).id}
    ORDER BY s.created_at DESC
    LIMIT 50
  `);
  const weeksResult = await db.execute(sql`
    SELECT sw.public_share_token, sw.created_at AS saved_at, sh.week_anchor, sh.updated_at AS shared_at,
           u.id AS creator_id, u.username, u.display_name,
           (SELECT COUNT(*)::int FROM shared_week_likes l WHERE l.public_share_token = sw.public_share_token) AS like_count,
           (SELECT COUNT(*)::int FROM shared_week_saves s2 WHERE s2.public_share_token = sw.public_share_token) AS save_count,
           (SELECT COUNT(*)::int FROM shared_week_comments c WHERE c.public_share_token = sw.public_share_token AND c.deleted_at IS NULL) AS comment_count,
           EXISTS(SELECT 1 FROM shared_week_likes l WHERE l.public_share_token = sw.public_share_token AND l.user_id = ${(req.user as any).id}) AS viewer_has_liked,
           TRUE AS viewer_has_saved
    FROM shared_week_saves sw
    INNER JOIN meal_plan_week_shares sh ON sh.public_share_token = sw.public_share_token AND sh.visibility = 'public'
    LEFT JOIN users u ON u.id = sh.user_id
    WHERE sw.user_id = ${(req.user as any).id}
    ORDER BY sw.created_at DESC
    LIMIT 50
  `);
  res.json({ marketplacePlans: ((plansResult as any).rows || []).map(mapPlanRow), sharedWeeks: ((weeksResult as any).rows || []).map(mapSavedWeekRow) });
});

function nullableTrim(raw: unknown) {
  const value = String(raw ?? "").trim();
  return value || null;
}

function mapComments(rows: any[]) {
  return rows.map((row) => ({
    id: row.id,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
      avatar: row.avatar,
    },
  }));
}

function mapPlanRow(row: any) {
  return {
    blueprint: {
      id: row.id,
      creatorId: row.creator_id,
      title: row.title,
      description: row.description,
      duration: Number(row.duration || 0),
      durationUnit: row.duration_unit,
      priceInCents: Number(row.price_in_cents || 0),
      category: row.category,
      dietaryLabels: row.dietary_labels || [],
      difficulty: row.difficulty,
      servings: Number(row.servings || 0),
      tags: row.tags || [],
      status: row.status,
      salesCount: Number(row.sales_count || 0),
      createdAt: row.created_at,
      savedAt: row.saved_at || null,
    },
    creator: { id: row.creator_id, username: row.username, displayName: row.display_name },
    avgRating: Number(row.avg_rating || 0),
    reviewCount: Number(row.review_count || 0),
    social: {
      likeCount: Number(row.like_count || 0),
      saveCount: Number(row.save_count || 0),
      commentCount: Number(row.comment_count || 0),
      viewerHasLiked: Boolean(row.viewer_has_liked),
      viewerHasSaved: Boolean(row.viewer_has_saved),
    },
  };
}

function mapSavedWeekRow(row: any) {
  const weekAnchor = row.week_anchor instanceof Date ? row.week_anchor.toISOString().split("T")[0] : String(row.week_anchor || "");
  return {
    token: row.public_share_token,
    weekAnchor,
    sharedAt: row.shared_at || null,
    savedAt: row.saved_at || null,
    sharer: { id: row.creator_id, username: row.username, displayName: row.display_name },
    social: {
      likeCount: Number(row.like_count || 0),
      saveCount: Number(row.save_count || 0),
      commentCount: Number(row.comment_count || 0),
      viewerHasLiked: Boolean(row.viewer_has_liked),
      viewerHasSaved: Boolean(row.viewer_has_saved),
    },
  };
}

export default router;
