import { drizzle } from "drizzle-orm/neon-serverless";
import { and, desc, eq } from "drizzle-orm";
import { pool as sharedPool } from "./db/index";
import {
  adaptivePlannerProfiles,
  adaptivePlannerSnapshots,
  nutritionPersonalityProfiles,
  plannerObjectiveHistory,
  plannerRelationshipLearning,
} from "@shared/schema";

const db = drizzle(sharedPool);

export const getAdaptivePlannerHistory = async (userId: string) => db
  .select()
  .from(adaptivePlannerSnapshots)
  .where(eq(adaptivePlannerSnapshots.userId, userId))
  .orderBy(desc(adaptivePlannerSnapshots.createdAt));

export const saveAdaptivePlannerSnapshot = async (userId: string, payload: Omit<typeof adaptivePlannerSnapshots.$inferInsert, "userId">) => db
  .insert(adaptivePlannerSnapshots)
  .values({ ...payload, userId })
  .returning();

export const getAdaptivePlannerProfile = async (userId: string) => db
  .select()
  .from(adaptivePlannerProfiles)
  .where(eq(adaptivePlannerProfiles.userId, userId))
  .orderBy(desc(adaptivePlannerProfiles.updatedAt))
  .limit(1);

export const saveAdaptivePlannerProfile = async (userId: string, payload: Omit<typeof adaptivePlannerProfiles.$inferInsert, "userId">) => db
  .insert(adaptivePlannerProfiles)
  .values({ ...payload, userId })
  .returning();

export const getNutritionPersonalityProfile = async (userId: string) => db
  .select()
  .from(nutritionPersonalityProfiles)
  .where(eq(nutritionPersonalityProfiles.userId, userId))
  .orderBy(desc(nutritionPersonalityProfiles.updatedAt))
  .limit(1);

export const saveNutritionPersonalityProfile = async (userId: string, payload: Omit<typeof nutritionPersonalityProfiles.$inferInsert, "userId">) => db
  .insert(nutritionPersonalityProfiles)
  .values({ ...payload, userId })
  .returning();

export const getPlannerObjectives = async (userId: string) => db
  .select()
  .from(plannerObjectiveHistory)
  .where(eq(plannerObjectiveHistory.userId, userId))
  .orderBy(desc(plannerObjectiveHistory.observedAt));

export const savePlannerObjective = async (userId: string, payload: Omit<typeof plannerObjectiveHistory.$inferInsert, "userId">) => db
  .insert(plannerObjectiveHistory)
  .values({ ...payload, userId })
  .returning();

export const getRelationshipLearning = async (userId: string) => db
  .select()
  .from(plannerRelationshipLearning)
  .where(eq(plannerRelationshipLearning.userId, userId))
  .orderBy(desc(plannerRelationshipLearning.updatedAt));

export const saveRelationshipLearning = async (userId: string, payload: Omit<typeof plannerRelationshipLearning.$inferInsert, "userId">) => db
  .insert(plannerRelationshipLearning)
  .values({ ...payload, userId })
  .returning();

export const getObjectiveHistoryByKey = async (userId: string, objectiveKey: string) => db
  .select()
  .from(plannerObjectiveHistory)
  .where(and(eq(plannerObjectiveHistory.userId, userId), eq(plannerObjectiveHistory.objectiveKey, objectiveKey)))
  .orderBy(desc(plannerObjectiveHistory.observedAt));
