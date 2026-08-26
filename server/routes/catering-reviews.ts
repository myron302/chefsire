import { Router } from "express";
import rateLimit from "express-rate-limit";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { cateringInquiries, cateringReviews, notifications, users } from "@shared/schema";
import { cateringReviewAggregate, cateringReviewCreateSchema, cateringReviewEditSchema, cateringReviewQuerySchema, cateringReviewResponseSchema } from "@shared/catering-reviews";
import { db } from "../db";
import { requireAuth } from "../middleware";
import { serializePublicCateringReview } from "../serializers/catering-review";
import { reviewEligibility, reviewVerification } from "../services/catering-review-policy";

const r = Router();
const mutationLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
const reviewId = z.string().uuid();
const providerId = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

const aggregate = async (id: string) => {
  const rows = await db.select({ rating: cateringReviews.rating, value: count() }).from(cateringReviews).where(eq(cateringReviews.providerId, id)).groupBy(cateringReviews.rating);
  return cateringReviewAggregate(rows.map((row) => ({ rating: row.rating, count: Number(row.value) })));
};

r.get("/providers/:providerId/reviews", async (req, res, next) => { try {
  const id = providerId.parse(req.params.providerId); const query = cateringReviewQuerySchema.parse(req.query);
  const [provider] = await db.select({ enabled: users.cateringEnabled }).from(users).where(eq(users.id, id)).limit(1);
  if (!provider?.enabled) return res.status(404).json({ message: "Provider not found" });
  const filters = [eq(cateringReviews.providerId, id)]; if (query.rating) filters.push(eq(cateringReviews.rating, query.rating)); if (query.verified !== undefined) filters.push(eq(cateringReviews.verifiedEvent, query.verified));
  const order = query.sort === "oldest" ? asc(cateringReviews.createdAt) : query.sort === "highest" ? desc(cateringReviews.rating) : query.sort === "lowest" ? asc(cateringReviews.rating) : desc(cateringReviews.createdAt);
  const [{ value }] = await db.select({ value: count() }).from(cateringReviews).where(and(...filters));
  const rows = await db.select({ id: cateringReviews.id, rating: cateringReviews.rating, title: cateringReviews.title, body: cateringReviews.body, verifiedEvent: cateringReviews.verifiedEvent, providerResponse: cateringReviews.providerResponse, respondedAt: cateringReviews.respondedAt, createdAt: cateringReviews.createdAt, updatedAt: cateringReviews.updatedAt, reviewerDisplayName: users.displayName, reviewerAvatar: users.avatar }).from(cateringReviews).innerJoin(users, eq(users.id, cateringReviews.reviewerId)).where(and(...filters)).orderBy(order, desc(cateringReviews.createdAt)).limit(query.limit).offset((query.page - 1) * query.limit);
  const viewerId = (req.user as { id?: string } | undefined)?.id;
  const [viewerReview] = viewerId ? await db.select({ id: cateringReviews.id, rating: cateringReviews.rating, title: cateringReviews.title, body: cateringReviews.body }).from(cateringReviews).where(and(eq(cateringReviews.providerId, id), eq(cateringReviews.reviewerId, viewerId))).limit(1) : [];
  res.json({ reviews: rows.map(serializePublicCateringReview), viewerReview: viewerReview ?? null, aggregate: await aggregate(id), pagination: { page: query.page, limit: query.limit, total: Number(value), totalPages: Math.ceil(Number(value) / query.limit) } });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });

r.post("/reviews", requireAuth, mutationLimiter, async (req, res, next) => { try {
  const reviewerId = (req.user as { id: string }).id; const input = cateringReviewCreateSchema.parse(req.body);
  const [provider] = await db.select({ enabled: users.cateringEnabled }).from(users).where(eq(users.id, input.providerId)).limit(1);
  const eligibility = reviewEligibility({ reviewerId, providerId: input.providerId, providerEnabled: Boolean(provider?.enabled) });
  if (!eligibility.allowed) return res.status(eligibility.reason.includes("yourself") ? 400 : 404).json({ message: eligibility.reason });
  let inquiry = null; if (input.inquiryId) { [inquiry] = await db.select({ customerId: cateringInquiries.customerId, chefId: cateringInquiries.chefId, status: cateringInquiries.status }).from(cateringInquiries).where(eq(cateringInquiries.id, input.inquiryId)).limit(1); if (!inquiry) return res.status(400).json({ message: "Inquiry is not valid for this review" }); }
  let verifiedEvent = false; try { verifiedEvent = reviewVerification(inquiry, reviewerId, input.providerId); } catch { return res.status(403).json({ message: "Inquiry is not valid for this review" }); }
  const [created] = await db.insert(cateringReviews).values({ providerId: input.providerId, reviewerId, inquiryId: input.inquiryId ?? null, rating: input.rating, title: input.title ?? null, body: input.body, verifiedEvent }).onConflictDoNothing().returning();
  if (!created) return res.status(409).json({ message: "You have already reviewed this catering provider." });
  await db.insert(notifications).values({ userId: input.providerId, type: "catering_review", title: "New catering review", message: `A customer left a ${input.rating}-star review.`, linkUrl: "/services/catering/provider" }).catch(() => undefined);
  res.status(201).json({ id: created.id, verifiedEvent: created.verifiedEvent });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message, errors: error.issues }); next(error); } });

r.patch("/reviews/:reviewId", requireAuth, mutationLimiter, async (req, res, next) => { try { const id = reviewId.parse(req.params.reviewId); const input = cateringReviewEditSchema.parse(req.body); const [updated] = await db.update(cateringReviews).set({ ...input, updatedAt: new Date() }).where(and(eq(cateringReviews.id, id), eq(cateringReviews.reviewerId, (req.user as { id: string }).id))).returning({ id: cateringReviews.id }); if (!updated) return res.status(404).json({ message: "Review not found" }); res.json({ id: updated.id }); } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });
r.delete("/reviews/:reviewId", requireAuth, mutationLimiter, async (req, res, next) => { try { const id = reviewId.parse(req.params.reviewId); const [deleted] = await db.delete(cateringReviews).where(and(eq(cateringReviews.id, id), eq(cateringReviews.reviewerId, (req.user as { id: string }).id))).returning({ id: cateringReviews.id }); if (!deleted) return res.status(404).json({ message: "Review not found" }); res.status(204).end(); } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });

r.put("/reviews/:reviewId/response", requireAuth, mutationLimiter, async (req, res, next) => { try { const id = reviewId.parse(req.params.reviewId); const { response } = cateringReviewResponseSchema.parse(req.body); const userId = (req.user as { id: string }).id; const [updated] = await db.update(cateringReviews).set({ providerResponse: response, respondedAt: new Date(), updatedAt: new Date() }).where(and(eq(cateringReviews.id, id), eq(cateringReviews.providerId, userId))).returning({ reviewerId: cateringReviews.reviewerId }); if (!updated) return res.status(404).json({ message: "Review not found on your provider profile" }); await db.insert(notifications).values({ userId: updated.reviewerId, type: "catering_review_response", title: "Provider responded to your review", message: "The catering provider posted a public response.", linkUrl: `/services/catering/provider/${userId}` }).catch(() => undefined); res.json({ response, respondedAt: new Date().toISOString() }); } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });
r.delete("/reviews/:reviewId/response", requireAuth, mutationLimiter, async (req, res, next) => { try { const id = reviewId.parse(req.params.reviewId); const [updated] = await db.update(cateringReviews).set({ providerResponse: null, respondedAt: null, updatedAt: new Date() }).where(and(eq(cateringReviews.id, id), eq(cateringReviews.providerId, (req.user as { id: string }).id))).returning({ id: cateringReviews.id }); if (!updated) return res.status(404).json({ message: "Review not found on your provider profile" }); res.status(204).end(); } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });
export default r;
