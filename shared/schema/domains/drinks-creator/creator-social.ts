import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { CreatorPostVisibility, CreatorDropVisibility, CreatorRoadmapVisibility } from "./creator-constants";

export const defineCreatorSocialSchema = ({
  users,
  drinkChallenges,
  drinkCollections,
  drinkCollectionPromotions,
}: {
  users: any;
  drinkChallenges: any;
  drinkCollections: any;
  drinkCollectionPromotions: any;
}) => {
  const creatorPosts = pgTable(
    "creator_posts",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      title: varchar("title", { length: 160 }).notNull(),
      body: text("body").notNull(),
      postType: text("post_type").default("update").notNull(),
      visibility: text("visibility").$type<CreatorPostVisibility>().default("public").notNull(),
      linkedCollectionId: varchar("linked_collection_id").references(() => drinkCollections.id, { onDelete: "set null" }),
      linkedChallengeId: varchar("linked_challenge_id").references(() => drinkChallenges.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      creatorIdx: index("creator_posts_creator_idx").on(table.creatorUserId),
      visibilityIdx: index("creator_posts_visibility_idx").on(table.visibility),
      creatorCreatedAtIdx: index("creator_posts_creator_created_at_idx").on(table.creatorUserId, table.createdAt),
      visibilityCreatedAtIdx: index("creator_posts_visibility_created_at_idx").on(table.visibility, table.createdAt),
      visibilityCheck: check("creator_posts_visibility_check", sql`${table.visibility} IN ('public', 'followers', 'members')`),
    })
  );

  const creatorDrops = pgTable(
    "creator_drops",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      title: varchar("title", { length: 160 }).notNull(),
      description: text("description"),
      dropType: text("drop_type").default("collection_launch").notNull(),
      visibility: text("visibility").$type<CreatorDropVisibility>().default("public").notNull(),
      scheduledFor: timestamp("scheduled_for").notNull(),
      linkedCollectionId: varchar("linked_collection_id").references(() => drinkCollections.id, { onDelete: "set null" }),
      linkedChallengeId: varchar("linked_challenge_id").references(() => drinkChallenges.id, { onDelete: "set null" }),
      linkedPromotionId: varchar("linked_promotion_id").references(() => drinkCollectionPromotions.id, { onDelete: "set null" }),
      recapNotes: text("recap_notes"),
      isPublished: boolean("is_published").default(true).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      creatorIdx: index("creator_drops_creator_idx").on(table.creatorUserId),
      visibilityIdx: index("creator_drops_visibility_idx").on(table.visibility),
      scheduledIdx: index("creator_drops_scheduled_for_idx").on(table.scheduledFor),
      publishedScheduledIdx: index("creator_drops_published_scheduled_idx").on(table.isPublished, table.scheduledFor),
      creatorScheduledIdx: index("creator_drops_creator_scheduled_idx").on(table.creatorUserId, table.scheduledFor),
      visibilityCheck: check("creator_drops_visibility_check", sql`${table.visibility} IN ('public', 'followers', 'members')`),
    })
  );

  const creatorDropRsvps = pgTable(
    "creator_drop_rsvps",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      dropId: varchar("drop_id").references(() => creatorDrops.id, { onDelete: "cascade" }).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
      userIdx: index("creator_drop_rsvps_user_idx").on(table.userId),
      dropIdx: index("creator_drop_rsvps_drop_idx").on(table.dropId),
      userDropIdx: uniqueIndex("creator_drop_rsvps_user_drop_idx").on(table.userId, table.dropId),
      dropCreatedIdx: index("creator_drop_rsvps_drop_created_at_idx").on(table.dropId, table.createdAt),
    })
  );

  const creatorRoadmapItems = pgTable(
    "creator_roadmap_items",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      title: varchar("title", { length: 160 }).notNull(),
      description: text("description"),
      itemType: text("item_type").default("roadmap").notNull(),
      visibility: text("visibility").$type<CreatorRoadmapVisibility>().default("public").notNull(),
      linkedCollectionId: varchar("linked_collection_id").references(() => drinkCollections.id, { onDelete: "set null" }),
      linkedChallengeId: varchar("linked_challenge_id").references(() => drinkChallenges.id, { onDelete: "set null" }),
      scheduledFor: timestamp("scheduled_for"),
      releasedAt: timestamp("released_at"),
      status: text("status").default("upcoming").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      creatorIdx: index("creator_roadmap_items_creator_idx").on(table.creatorUserId),
      visibilityIdx: index("creator_roadmap_items_visibility_idx").on(table.visibility),
      statusIdx: index("creator_roadmap_items_status_idx").on(table.status),
      creatorStatusIdx: index("creator_roadmap_items_creator_status_idx").on(table.creatorUserId, table.status),
      scheduledIdx: index("creator_roadmap_items_scheduled_idx").on(table.scheduledFor),
      releasedIdx: index("creator_roadmap_items_released_idx").on(table.releasedAt),
      visibilityCheck: check("creator_roadmap_items_visibility_check", sql`${table.visibility} IN ('public', 'followers', 'members')`),
    })
  );

  const creatorDropEvents = pgTable(
    "creator_drop_events",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      dropId: varchar("drop_id").references(() => creatorDrops.id, { onDelete: "cascade" }).notNull(),
      eventType: text("event_type").notNull(),
      userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
      targetType: text("target_type"),
      targetId: varchar("target_id", { length: 200 }),
      createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
      dropIdx: index("creator_drop_events_drop_idx").on(table.dropId),
      eventTypeIdx: index("creator_drop_events_event_type_idx").on(table.eventType),
      dropEventCreatedIdx: index("creator_drop_events_drop_event_created_at_idx").on(table.dropId, table.eventType, table.createdAt),
      userIdx: index("creator_drop_events_user_idx").on(table.userId),
    })
  );

  const creatorCollaborations = pgTable(
    "creator_collaborations",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      ownerCreatorUserId: varchar("owner_creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      collaboratorUserId: varchar("collaborator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      collaborationType: text("collaboration_type").notNull(),
      targetId: varchar("target_id", { length: 200 }).notNull(),
      status: text("status").default("pending").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      ownerIdx: index("creator_collaborations_owner_idx").on(table.ownerCreatorUserId),
      collaboratorIdx: index("creator_collaborations_collaborator_idx").on(table.collaboratorUserId),
      targetIdx: uniqueIndex("creator_collaborations_target_idx").on(table.collaborationType, table.targetId),
      ownerCollaboratorTargetIdx: uniqueIndex("creator_collaborations_owner_collaborator_target_idx").on(
        table.ownerCreatorUserId,
        table.collaboratorUserId,
        table.collaborationType,
        table.targetId,
      ),
      statusIdx: index("creator_collaborations_status_idx").on(table.status),
    })
  );

  return {
    creatorPosts,
    creatorDrops,
    creatorDropRsvps,
    creatorRoadmapItems,
    creatorDropEvents,
    creatorCollaborations,
  };
};
