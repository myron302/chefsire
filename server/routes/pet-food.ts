import { Router } from "express";
import { desc, gt, sql } from "drizzle-orm";
import { db } from "../db";
import { petFoodEvents } from "@shared/schema";
import { getCanonicalPetFoodBySlug } from "../services/canonical-pet-food-index";
import { parseTrackedEventBody, resolveEngagementUserId } from "./engagement-events";

const r = Router();

type EventType = "view";
const TRACKABLE_PET_FOOD_EVENTS = new Set<EventType>(["view"]);

function resolvePetFoodDetailsBySlug(slug: string) {
  const canonicalRecipe = getCanonicalPetFoodBySlug(slug);
  if (!canonicalRecipe) return null;

  return {
    slug: canonicalRecipe.slug,
    name: canonicalRecipe.name,
    image: canonicalRecipe.image ?? null,
    route: canonicalRecipe.route,
    sourceCategoryRoute: canonicalRecipe.sourceRoute,
    source: "chefsire" as const,
  };
}

r.post("/events", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const parsed = parseTrackedEventBody(req.body, TRACKABLE_PET_FOOD_EVENTS);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ ok: false, error: parsed.error });
    }

    const { slug, eventType } = parsed;

    const canonicalRecipe = getCanonicalPetFoodBySlug(slug);
    if (!canonicalRecipe) {
      return res.status(404).json({ ok: false, error: "Unknown pet food slug" });
    }

    await db.insert(petFoodEvents).values({
      slug,
      eventType,
      userId: resolveEngagementUserId(req),
    });

    return res.status(201).json({ ok: true });
  } catch (error: any) {
    console.error("Error logging pet food event:", error);
    return res.status(500).json({ ok: false, error: "Failed to log pet food event" });
  }
});

r.get("/trending", async (_req, res) => {
  try {
    if (!db) {
      return res.json({
        ok: true,
        window: "7d",
        ranking: {
          formula: "views_last_24h * 3 + views_days_2_to_7 * 1",
        },
        items: [],
      });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const views24hSql = sql<number>`count(*) filter (where ${petFoodEvents.eventType} = 'view' and ${petFoodEvents.createdAt} > ${oneDayAgo})`;
    const views7dSql = sql<number>`count(*) filter (where ${petFoodEvents.eventType} = 'view' and ${petFoodEvents.createdAt} > ${sevenDaysAgo})`;
    const scoreSql = sql<number>`(
      (${views24hSql} * 3)
      + (greatest(${views7dSql} - ${views24hSql}, 0) * 1)
    )`;

    const rows = await db
      .select({
        slug: petFoodEvents.slug,
        score: scoreSql,
        views24h: views24hSql,
        views7d: views7dSql,
      })
      .from(petFoodEvents)
      .where(gt(petFoodEvents.createdAt, sevenDaysAgo))
      .groupBy(petFoodEvents.slug)
      .orderBy(desc(scoreSql), desc(views24hSql), desc(views7dSql), desc(petFoodEvents.slug))
      .limit(10);

    const items = rows
      .map((row) => {
        const item = resolvePetFoodDetailsBySlug(row.slug);
        if (!item) return null;

        const views24h = Number(row.views24h ?? 0);
        const views7d = Number(row.views7d ?? 0);
        const score = Number(row.score ?? 0);

        return {
          slug: item.slug,
          name: item.name,
          image: item.image,
          route: item.route,
          sourceCategoryRoute: item.sourceCategoryRoute,
          source: item.source,
          score,
          views24h,
          views7d,
        };
      })
      .filter(Boolean);

    return res.json({
      ok: true,
      window: "7d",
      ranking: { formula: "views_last_24h * 3 + views_days_2_to_7 * 1" },
      items,
    });
  } catch (error: any) {
    console.error("Error getting trending pet food recipes:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch trending pet food recipes" });
  }
});

export default r;
