import { sql } from "drizzle-orm";
import { AnyPgColumn, pgTable, text, varchar, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  CreatorCampaignStartsWithAudience,
  CreatorCampaignPlaybookProfileStartsWithAudience,
  CreatorCampaignPlaybookPreferredAudienceFit,
  CreatorCampaignRolloutTimelineAudience,
  CreatorCampaignRolloutTimelineMetadata,
  CreatorCampaignEventMetadata,
} from "./creator-constants";

export const defineCreatorCampaignSchema = ({ users }: { users: any }) => {
  const creatorCampaigns = pgTable(
    "creator_campaigns",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      slug: varchar("slug", { length: 200 }).notNull(),
      name: varchar("name", { length: 160 }).notNull(),
      description: text("description"),
      visibility: text("visibility").default("public").notNull(),
      startsAt: timestamp("starts_at"),
      endsAt: timestamp("ends_at"),
      isActive: boolean("is_active").default(true).notNull(),
      rolloutMode: text("rollout_mode").default("public_first").notNull(),
      startsWithAudience: text("starts_with_audience").$type<CreatorCampaignStartsWithAudience | null>(),
      unlockFollowersAt: timestamp("unlock_followers_at"),
      unlockPublicAt: timestamp("unlock_public_at"),
      rolloutNotes: text("rollout_notes"),
      isRolloutActive: boolean("is_rollout_active").default(false).notNull(),
      isRolloutPaused: boolean("is_rollout_paused").default(false).notNull(),
      rolloutPausedAt: timestamp("rollout_paused_at"),
      isPinned: boolean("is_pinned").default(false).notNull(),
      appliedPlaybookProfileId: varchar("applied_playbook_profile_id"),
      playbookAppliedAt: timestamp("playbook_applied_at"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      creatorIdx: index("creator_campaigns_creator_idx").on(table.creatorUserId),
      slugIdx: uniqueIndex("creator_campaigns_slug_idx").on(table.slug),
      creatorSlugIdx: uniqueIndex("creator_campaigns_creator_slug_idx").on(table.creatorUserId, table.slug),
      visibilityIdx: index("creator_campaigns_visibility_idx").on(table.visibility),
      activeIdx: index("creator_campaigns_active_idx").on(table.isActive, table.startsAt, table.endsAt),
      creatorUpdatedIdx: index("creator_campaigns_creator_updated_at_idx").on(table.creatorUserId, table.updatedAt),
      creatorPinnedIdx: uniqueIndex("creator_campaigns_single_pinned_idx").on(table.creatorUserId).where(sql`${table.isPinned} = true`),
    })
  );

  const creatorCampaignRolloutTimelineEvents = pgTable(
    "creator_campaign_rollout_timeline_events",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
      actorUserId: varchar("actor_user_id").references(() => users.id, { onDelete: "set null" }),
      eventType: text("event_type").notNull(),
      title: varchar("title", { length: 160 }).notNull(),
      message: text("message").notNull(),
      audienceStage: text("audience_stage").$type<CreatorCampaignRolloutTimelineAudience | null>(),
      metadata: jsonb("metadata").$type<CreatorCampaignRolloutTimelineMetadata>().default(sql`'{}'::jsonb`).notNull(),
      occurredAt: timestamp("occurred_at").defaultNow().notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
      campaignIdx: index("creator_campaign_rollout_timeline_events_campaign_idx").on(table.campaignId),
      eventTypeIdx: index("creator_campaign_rollout_timeline_events_event_type_idx").on(table.eventType),
      campaignOccurredIdx: index("creator_campaign_rollout_timeline_events_campaign_occurred_at_idx").on(table.campaignId, table.occurredAt),
      actorIdx: index("creator_campaign_rollout_timeline_events_actor_idx").on(table.actorUserId),
    })
  );

  const creatorCampaignTemplates = pgTable(
    "creator_campaign_templates",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      sourceCampaignId: varchar("source_campaign_id").references(() => creatorCampaigns.id, { onDelete: "set null" }),
      name: varchar("name", { length: 160 }).notNull(),
      description: text("description"),
      blueprint: jsonb("blueprint").$type<{
        campaign: {
          name: string;
          description: string | null;
          visibility: string;
          startsAt: string | null;
          endsAt: string | null;
          isActive: boolean;
        };
        links: Array<{ targetType: string; targetId: string; sortOrder: number }>;
        variants: Array<{
          label: string;
          headline: string | null;
          subheadline: string | null;
          ctaText: string;
          ctaTargetType: string;
          isActive: boolean;
        }>;
        linkedDrafts: {
          drops: Array<Record<string, unknown>>;
          posts: Array<Record<string, unknown>>;
          roadmap: Array<Record<string, unknown>>;
        };
        defaults: {
          resetDates: boolean;
          copyLinkedDrafts: boolean;
          copyCtaVariants: boolean;
        };
      }>().notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      creatorIdx: index("creator_campaign_templates_creator_idx").on(table.creatorUserId),
      sourceIdx: index("creator_campaign_templates_source_idx").on(table.sourceCampaignId),
      creatorUpdatedIdx: index("creator_campaign_templates_creator_updated_at_idx").on(table.creatorUserId, table.updatedAt),
      creatorNameIdx: uniqueIndex("creator_campaign_templates_creator_name_idx").on(table.creatorUserId, table.name),
    })
  );

  const creatorCampaignPlaybookProfiles = pgTable(
    "creator_campaign_playbook_profiles",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      parentPlaybookProfileId: varchar("parent_playbook_profile_id").references((): AnyPgColumn => creatorCampaignPlaybookProfiles.id, { onDelete: "set null" }),
      sourceCampaignId: varchar("source_campaign_id").references(() => creatorCampaigns.id, { onDelete: "set null" }),
      derivedFromType: text("derived_from_type"),
      versionLabel: varchar("version_label", { length: 80 }),
      name: varchar("name", { length: 160 }).notNull(),
      description: text("description"),
      visibilityStrategy: text("visibility_strategy"),
      rolloutMode: text("rollout_mode").default("public_first").notNull(),
      startsWithAudience: text("starts_with_audience").$type<CreatorCampaignPlaybookProfileStartsWithAudience | null>(),
      recommendedFollowerUnlockDelayHours: integer("recommended_follower_unlock_delay_hours"),
      recommendedPublicUnlockDelayHours: integer("recommended_public_unlock_delay_hours"),
      preferredCtaDirection: text("preferred_cta_direction"),
      preferredExperimentTypes: jsonb("preferred_experiment_types").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
      preferredAudienceFit: text("preferred_audience_fit").$type<CreatorCampaignPlaybookPreferredAudienceFit | null>(),
      notes: text("notes"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      creatorIdx: index("creator_campaign_playbook_profiles_creator_idx").on(table.creatorUserId),
      creatorUpdatedIdx: index("creator_campaign_playbook_profiles_creator_updated_at_idx").on(table.creatorUserId, table.updatedAt),
      parentIdx: index("creator_campaign_playbook_profiles_parent_idx").on(table.parentPlaybookProfileId),
      sourceIdx: index("creator_campaign_playbook_profiles_source_campaign_idx").on(table.sourceCampaignId),
      creatorNameIdx: uniqueIndex("creator_campaign_playbook_profiles_creator_name_idx").on(table.creatorUserId, table.name),
    })
  );

  const creatorCampaignLinks = pgTable(
    "creator_campaign_links",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
      targetType: text("target_type").notNull(),
      targetId: varchar("target_id", { length: 200 }).notNull(),
      sortOrder: integer("sort_order").default(0).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
      campaignIdx: index("creator_campaign_links_campaign_idx").on(table.campaignId),
      targetIdx: index("creator_campaign_links_target_idx").on(table.targetType, table.targetId),
      campaignSortIdx: index("creator_campaign_links_campaign_sort_idx").on(table.campaignId, table.sortOrder, table.createdAt),
      campaignTargetIdx: uniqueIndex("creator_campaign_links_campaign_target_idx").on(table.campaignId, table.targetType, table.targetId),
    })
  );

  const creatorCampaignFollows = pgTable(
    "creator_campaign_follows",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
      userIdx: index("creator_campaign_follows_user_idx").on(table.userId),
      campaignIdx: index("creator_campaign_follows_campaign_idx").on(table.campaignId),
      userCampaignIdx: uniqueIndex("creator_campaign_follows_user_campaign_idx").on(table.userId, table.campaignId),
      campaignCreatedIdx: index("creator_campaign_follows_campaign_created_at_idx").on(table.campaignId, table.createdAt),
    })
  );

  const creatorCampaignGoals = pgTable(
    "creator_campaign_goals",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
      goalType: text("goal_type").notNull(),
      targetValue: integer("target_value").notNull(),
      label: varchar("label", { length: 160 }),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      campaignIdx: index("creator_campaign_goals_campaign_idx").on(table.campaignId),
      campaignTypeIdx: index("creator_campaign_goals_campaign_type_idx").on(table.campaignId, table.goalType),
      campaignUpdatedIdx: index("creator_campaign_goals_campaign_updated_at_idx").on(table.campaignId, table.updatedAt),
    })
  );

  const creatorCampaignActionStates = pgTable(
    "creator_campaign_action_states",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
      actionType: text("action_type").notNull(),
      actionKey: varchar("action_key", { length: 240 }).notNull(),
      sourceKey: text("source_key"),
      sourceSignature: text("source_signature"),
      state: text("state").default("open").notNull(),
      snoozedUntil: timestamp("snoozed_until"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      userIdx: index("creator_campaign_action_states_user_idx").on(table.userId),
      campaignIdx: index("creator_campaign_action_states_campaign_idx").on(table.campaignId),
      stateIdx: index("creator_campaign_action_states_state_idx").on(table.userId, table.state, table.updatedAt),
      snoozedIdx: index("creator_campaign_action_states_snoozed_idx").on(table.userId, table.snoozedUntil),
      userActionIdx: uniqueIndex("creator_campaign_action_states_user_action_idx").on(table.userId, table.actionKey),
    })
  );

  const creatorCampaignExperiments = pgTable(
    "creator_campaign_experiments",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
      experimentType: text("experiment_type").notNull(),
      label: varchar("label", { length: 160 }),
      hypothesis: text("hypothesis"),
      startedAt: timestamp("started_at"),
      endedAt: timestamp("ended_at"),
      status: text("status").default("active").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      campaignIdx: index("creator_campaign_experiments_campaign_idx").on(table.campaignId),
      statusIdx: index("creator_campaign_experiments_status_idx").on(table.status),
      campaignStatusIdx: index("creator_campaign_experiments_campaign_status_updated_at_idx").on(table.campaignId, table.status, table.updatedAt),
      campaignStartedIdx: index("creator_campaign_experiments_campaign_started_at_idx").on(table.campaignId, table.startedAt),
    })
  );

  const creatorCampaignCtaVariants = pgTable(
    "creator_campaign_cta_variants",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
      label: varchar("label", { length: 120 }).notNull(),
      headline: varchar("headline", { length: 160 }),
      subheadline: text("subheadline"),
      ctaText: varchar("cta_text", { length: 120 }).notNull(),
      ctaTargetType: text("cta_target_type").notNull().default("follow"),
      isActive: boolean("is_active").default(false).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      campaignIdx: index("creator_campaign_cta_variants_campaign_idx").on(table.campaignId),
      campaignActiveIdx: index("creator_campaign_cta_variants_campaign_active_idx").on(table.campaignId, table.isActive, table.updatedAt),
    })
  );

  const creatorCampaignVariantEvents = pgTable(
    "creator_campaign_variant_events",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
      variantId: varchar("variant_id").references(() => creatorCampaignCtaVariants.id, { onDelete: "cascade" }).notNull(),
      eventType: text("event_type").notNull(),
      userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
      sessionKey: varchar("session_key", { length: 160 }),
      metadata: jsonb("metadata").$type<CreatorCampaignEventMetadata | null>(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
      campaignIdx: index("creator_campaign_variant_events_campaign_idx").on(table.campaignId),
      variantIdx: index("creator_campaign_variant_events_variant_idx").on(table.variantId),
      eventTypeIdx: index("creator_campaign_variant_events_event_type_idx").on(table.eventType),
      variantEventCreatedIdx: index("creator_campaign_variant_events_variant_event_created_at_idx").on(table.variantId, table.eventType, table.createdAt),
      userIdx: index("creator_campaign_variant_events_user_idx").on(table.userId),
      sessionIdx: index("creator_campaign_variant_events_session_idx").on(table.sessionKey),
    })
  );

  const creatorCampaignSpotlightEvents = pgTable(
    "creator_campaign_spotlight_events",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
      eventType: text("event_type").notNull(),
      surface: text("surface").notNull(),
      userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
      sessionKey: varchar("session_key", { length: 160 }),
      metadata: jsonb("metadata").$type<CreatorCampaignEventMetadata | null>(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
      campaignIdx: index("creator_campaign_spotlight_events_campaign_idx").on(table.campaignId),
      eventTypeIdx: index("creator_campaign_spotlight_events_event_type_idx").on(table.eventType),
      surfaceIdx: index("creator_campaign_spotlight_events_surface_idx").on(table.surface),
      campaignEventCreatedIdx: index("creator_campaign_spotlight_events_campaign_event_created_at_idx").on(table.campaignId, table.eventType, table.createdAt),
      userIdx: index("creator_campaign_spotlight_events_user_idx").on(table.userId),
      sessionIdx: index("creator_campaign_spotlight_events_session_idx").on(table.sessionKey),
    })
  );

  const creatorCampaignSurfaceEvents = pgTable(
    "creator_campaign_surface_events",
    {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
      eventType: text("event_type").notNull(),
      surface: text("surface").notNull(),
      userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
      sessionKey: varchar("session_key", { length: 160 }),
      metadata: jsonb("metadata").$type<CreatorCampaignEventMetadata | null>(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
      campaignIdx: index("creator_campaign_surface_events_campaign_idx").on(table.campaignId),
      eventTypeIdx: index("creator_campaign_surface_events_event_type_idx").on(table.eventType),
      surfaceIdx: index("creator_campaign_surface_events_surface_idx").on(table.surface),
      campaignSurfaceEventCreatedIdx: index("creator_campaign_surface_events_campaign_surface_event_created_at_idx").on(table.campaignId, table.surface, table.eventType, table.createdAt),
      userIdx: index("creator_campaign_surface_events_user_idx").on(table.userId),
      sessionIdx: index("creator_campaign_surface_events_session_idx").on(table.sessionKey),
    })
  );

  return {
    creatorCampaigns,
    creatorCampaignRolloutTimelineEvents,
    creatorCampaignTemplates,
    creatorCampaignPlaybookProfiles,
    creatorCampaignLinks,
    creatorCampaignFollows,
    creatorCampaignGoals,
    creatorCampaignActionStates,
    creatorCampaignExperiments,
    creatorCampaignCtaVariants,
    creatorCampaignVariantEvents,
    creatorCampaignSpotlightEvents,
    creatorCampaignSurfaceEvents,
  };
};
