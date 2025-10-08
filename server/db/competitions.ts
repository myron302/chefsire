// server/db/competitions.ts
import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// If you already have a users table defined elsewhere, you can import its type/id here.
// For FK references by string, we'll keep it simple with varchar user ids.

export const competitions = pgTable(
  "competitions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorId: varchar("creator_id").notNull(),
    title: text("title"),
    themeName: text("theme_name"),
    recipeId: varchar("recipe_id"),

    // lifecycle
    status: text("status").notNull().default("upcoming"), // upcoming | live | judging | completed | canceled
    isPrivate: boolean("is_private").notNull().default(false),

    // timing
    timeLimitMinutes: integer("time_limit_minutes").notNull().default(60),
    minOfficialVoters: integer("min_official_voters").notNull().default(3),
    startTime: timestamp("start_time"),
    endTime: timestamp("end_time"),
    judgingClosesAt: timestamp("judging_closes_at"),

    // media
    videoRecordingUrl: text("video_recording_url"),

    // results
    isOfficial: boolean("is_official").notNull().default(false),
    winnerParticipantId: varchar("winner_participant_id"),

    // meta
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    creatorIdx: index("competitions_creator_idx").on(t.creatorId),
    statusIdx: index("competitions_status_idx").on(t.status),
    createdIdx: index("competitions_created_idx").on(t.createdAt),
  })
);

export const competitionParticipants = pgTable(
  "competition_participants",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    competitionId: varchar("competition_id").notNull(),
    userId: varchar("user_id").notNull(),
    role: text("role").notNull().default("competitor"), // competitor | host | judge

    // submission
    dishTitle: text("dish_title"),
    dishDescription: text("dish_description"),
    finalDishPhotoUrl: text("final_dish_photo_url"),

    // results
    totalScore: integer("total_score"),
    placement: integer("placement"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    uniqCompUser: uniqueIndex("uniq_competition_user").on(t.competitionId, t.userId),
    compIdx: index("participants_comp_idx").on(t.competitionId),
    userIdx: index("participants_user_idx").on(t.userId),
  })
);

export const competitionVotes = pgTable(
  "competition_votes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    competitionId: varchar("competition_id").notNull(),
    voterId: varchar("voter_id").notNull(), // must NOT be a participant in the same competition
    participantId: varchar("participant_id").notNull(),

    // scoring 1..10 each
    presentation: integer("presentation").notNull(),
    creativity: integer("creativity").notNull(),
    technique: integer("technique").notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    uniqBallot: uniqueIndex("uniq_vote_per_voter_participant").on(
      t.competitionId,
      t.voterId,
      t.participantId
    ),
    compIdx: index("votes_comp_idx").on(t.competitionId),
    voterIdx: index("votes_voter_idx").on(t.voterId),
    participantIdx: index("votes_participant_idx").on(t.participantId),
  })
);

// A tiny helper to compute total from 3 criteria (server-side use)
export function scoreTotal(presentation: number, creativity: number, technique: number) {
  return presentation + creativity + technique;
}
