import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  decimal,
  index,
  uniqueIndex,
  date,
  check,
} from "drizzle-orm/pg-core";
import { users } from "./users-auth";

type RecipeNutrition = Record<string, unknown> & {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
};

export const posts = pgTable(
  "posts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    caption: text("caption"),
    imageUrl: text("image_url").notNull(),
    additionalImages: jsonb("additional_images")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    tags: jsonb("tags")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`),
    likesCount: integer("likes_count").default(0),
    commentsCount: integer("comments_count").default(0),
    isRecipe: boolean("is_recipe").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    createdAtIdx: index("posts_created_at_idx").on(t.createdAt),
    userIdIdx: index("posts_user_id_idx").on(t.userId),
  }),
);

export const recipes = pgTable("recipes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  postId: varchar("post_id")
    .references(() => posts.id)
    .unique(),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  ingredients: jsonb("ingredients").$type<string[]>().notNull(),
  instructions: jsonb("instructions").$type<string[]>().notNull(),
  cookTime: integer("cook_time"),
  servings: integer("servings"),
  difficulty: text("difficulty"),
  nutrition: jsonb("nutrition").$type<RecipeNutrition>(),
  calories: integer("calories"),
  protein: decimal("protein", { precision: 5, scale: 2 }),
  carbs: decimal("carbs", { precision: 5, scale: 2 }),
  fat: decimal("fat", { precision: 5, scale: 2 }),
  fiber: decimal("fiber", { precision: 5, scale: 2 }),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default(
    "0",
  ),
  reviewCount: integer("review_count").default(0),
  externalSource: text("external_source"),
  externalId: text("external_id"),
  cuisine: text("cuisine"),
  mealType: text("meal_type"),
  sourceUrl: text("source_url"),
});

export const recipeReviews = pgTable("recipe_reviews", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  recipeId: varchar("recipe_id")
    .references(() => recipes.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  rating: integer("rating").notNull(),
  reviewText: text("review_text"),
  helpfulCount: integer("helpful_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const recipeReviewPhotos = pgTable("recipe_review_photos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id")
    .references(() => recipeReviews.id)
    .notNull(),
  photoUrl: text("photo_url").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviewHelpful = pgTable("review_helpful", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id")
    .references(() => recipeReviews.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stories = pgTable("stories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  imageUrl: text("image_url").notNull(),
  mediaType: text("media_type", { enum: ["image", "video"] })
    .notNull()
    .default("image"),
  caption: text("caption"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const likes = pgTable(
  "likes",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    postId: varchar("post_id")
      .references(() => posts.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    postIdIdx: index("likes_post_id_idx").on(t.postId),
    userPostIdx: uniqueIndex("likes_user_post_idx").on(t.userId, t.postId),
  }),
);

export const comments = pgTable(
  "comments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    postId: varchar("post_id")
      .references(() => posts.id)
      .notNull(),
    parentId: varchar("parent_id").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    postIdIdx: index("comments_post_id_idx").on(t.postId),
    userIdIdx: index("comments_user_id_idx").on(t.userId),
    parentIdIdx: index("comments_parent_id_idx").on(t.parentId),
  }),
);

export const commentLikes = pgTable(
  "comment_likes",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    commentId: varchar("comment_id")
      .references(() => comments.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userCommentIdx: uniqueIndex("comment_likes_user_comment_idx").on(
      table.userId,
      table.commentId,
    ),
  }),
);

export const follows = pgTable(
  "follows",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    followerId: varchar("follower_id")
      .references(() => users.id)
      .notNull(),
    followingId: varchar("following_id")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    followerIdx: index("follows_follower_id_idx").on(table.followerId),
    followingIdx: index("follows_following_id_idx").on(table.followingId),
    followerCreatedAtIdx: index("follows_follower_created_at_idx").on(
      table.followerId,
      table.createdAt,
    ),
    followingCreatedAtIdx: index("follows_following_created_at_idx").on(
      table.followingId,
      table.createdAt,
    ),
  }),
);

export const followRequests = pgTable("follow_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id")
    .references(() => users.id)
    .notNull(),
  targetId: varchar("target_id")
    .references(() => users.id)
    .notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
});

export const cateringPackages = pgTable(
  "catering_packages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`), providerId: varchar("provider_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    title: varchar("title", { length: 120 }).notNull(), description: text("description").notNull(), category: varchar("category", { length: 40 }).notNull(), coverImage: text("cover_image"), galleryImages: jsonb("gallery_images").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    pricingModel: varchar("pricing_model", { length: 30 }).notNull(), startingPrice: decimal("starting_price", { precision: 12, scale: 2 }).notNull(), currency: varchar("currency", { length: 3 }).default("USD").notNull(), minimumGuests: integer("minimum_guests").notNull(), maximumGuests: integer("maximum_guests"),
    preparationStyle: varchar("preparation_style", { length: 100 }), serviceStyle: varchar("service_style", { length: 100 }), cuisines: jsonb("cuisines").$type<string[]>().default(sql`'[]'::jsonb`).notNull(), dietaryAccommodations: jsonb("dietary_accommodations").$type<string[]>().default(sql`'[]'::jsonb`).notNull(), includedServices: jsonb("included_services").$type<string[]>().default(sql`'[]'::jsonb`).notNull(), optionalAddOns: jsonb("optional_add_ons").$type<string[]>().default(sql`'[]'::jsonb`).notNull(), estimatedDuration: integer("estimated_duration"),
    active: boolean("active").default(false).notNull(), featured: boolean("featured").default(false).notNull(), displayOrder: integer("display_order").default(0).notNull(), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }, (table) => ({ providerOrderIdx: index("catering_packages_provider_order_idx").on(table.providerId, table.displayOrder, table.createdAt) }),
);

export const cateringAvailabilitySettings = pgTable("catering_availability_settings", {
  providerId: varchar("provider_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  acceptingBookings: boolean("accepting_bookings").default(true).notNull(),
  minimumLeadDays: integer("minimum_lead_days").default(0).notNull(),
  maximumAdvanceDays: integer("maximum_advance_days").default(365).notNull(),
  timezone: varchar("timezone", { length: 100 }).default("UTC").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ windowCheck: check("catering_availability_window_check", sql`${t.minimumLeadDays} >= 0 AND ${t.maximumAdvanceDays} >= ${t.minimumLeadDays} AND ${t.maximumAdvanceDays} <= 1095`) }));

export const cateringAvailabilityExceptions = pgTable("catering_availability_exceptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  reason: varchar("reason", { length: 300 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ providerDatesIdx: index("catering_availability_exceptions_provider_dates_idx").on(t.providerId, t.startDate, t.endDate), duplicateUnique: uniqueIndex("catering_availability_exception_no_duplicate").on(t.providerId, t.startDate, t.endDate, t.type), rangeCheck: check("catering_availability_exception_range_check", sql`${t.endDate} >= ${t.startDate}`), typeCheck: check("catering_availability_exception_type_check", sql`${t.type} IN ('available', 'blocked')`) }));

export const cateringAvailabilityWeeklyRules = pgTable("catering_availability_weekly_rules", {
  providerId: varchar("provider_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  available: boolean("available").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ providerDayUnique: uniqueIndex("catering_availability_weekly_provider_day_uidx").on(t.providerId, t.dayOfWeek), dayCheck: check("catering_availability_weekly_day_check", sql`${t.dayOfWeek} BETWEEN 0 AND 6`) }));

export const cateringInquiries = pgTable("catering_inquiries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id")
    .references(() => users.id)
    .notNull(),
  chefId: varchar("chef_id")
    .references(() => users.id)
    .notNull(),
  packageId: varchar("package_id").references(() => cateringPackages.id, { onDelete: "set null" }),
  eventDate: timestamp("event_date").notNull(),
  guestCount: integer("guest_count"),
  eventType: text("event_type"),
  cuisinePreferences: jsonb("cuisine_preferences")
    .$type<string[]>()
    .default(sql`'[]'::jsonb`),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  message: text("message"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

/** A persisted bilateral catering agreement, distinct from the quote inquiry. */
export const cateringBookings = pgTable("catering_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inquiryId: varchar("inquiry_id").references(() => cateringInquiries.id, { onDelete: "restrict" }).notNull(),
  providerId: varchar("provider_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  customerId: varchar("customer_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  packageId: varchar("package_id").references(() => cateringPackages.id, { onDelete: "set null" }),
  eventDate: date("event_date", { mode: "string" }).notNull(),
  eventType: text("event_type"),
  guestCount: integer("guest_count"),
  agreedPrice: decimal("agreed_price", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  packageTitleSnapshot: varchar("package_title_snapshot", { length: 160 }),
  packagePricingModelSnapshot: varchar("package_pricing_model_snapshot", { length: 30 }),
  packageStartingPriceSnapshot: decimal("package_starting_price_snapshot", { precision: 12, scale: 2 }),
  status: varchar("status", { length: 24 }).default("pending_confirmation").notNull(),
  providerConfirmedAt: timestamp("provider_confirmed_at", { withTimezone: true }),
  customerConfirmedAt: timestamp("customer_confirmed_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledBy: varchar("cancelled_by", { length: 16 }),
  cancellationReason: text("cancellation_reason"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  inquiryUnique: uniqueIndex("catering_bookings_inquiry_uidx").on(t.inquiryId),
  providerEventIdx: index("catering_bookings_provider_event_idx").on(t.providerId, t.eventDate, t.id),
  customerEventIdx: index("catering_bookings_customer_event_idx").on(t.customerId, t.eventDate, t.id),
  statusCheck: check("catering_bookings_status_check", sql`${t.status} IN ('pending_confirmation', 'confirmed', 'cancelled', 'completed')`),
  cancelledByCheck: check("catering_bookings_cancelled_by_check", sql`${t.cancelledBy} IS NULL OR ${t.cancelledBy} IN ('provider', 'customer')`),
  guestCountCheck: check("catering_bookings_guest_count_check", sql`${t.guestCount} IS NULL OR ${t.guestCount} > 0`),
  agreedPriceCheck: check("catering_bookings_agreed_price_check", sql`${t.agreedPrice} IS NULL OR ${t.agreedPrice} >= 0`),
}));

/** Mutable event-planning data layered on the immutable booking agreement. */
export const cateringBookingDetails = pgTable("catering_booking_details", {
  bookingId: varchar("booking_id").primaryKey().references(() => cateringBookings.id, { onDelete: "restrict" }),
  venueName: varchar("venue_name", { length: 160 }),
  venueAddress: varchar("venue_address", { length: 240 }),
  venueCity: varchar("venue_city", { length: 120 }),
  venueState: varchar("venue_state", { length: 80 }),
  venuePostalCode: varchar("venue_postal_code", { length: 24 }),
  venueInstructions: text("venue_instructions"),
  arrivalTime: varchar("arrival_time", { length: 5 }),
  serviceStartTime: varchar("service_start_time", { length: 5 }),
  serviceEndTime: varchar("service_end_time", { length: 5 }),
  setupNotes: text("setup_notes"),
  accessNotes: text("access_notes"),
  kitchenAvailable: boolean("kitchen_available"),
  refrigerationAvailable: boolean("refrigeration_available"),
  powerAvailable: boolean("power_available"),
  waterAvailable: boolean("water_available"),
  indoorOutdoor: varchar("indoor_outdoor", { length: 16 }),
  customerNotes: text("customer_notes"),
  providerNotes: text("provider_notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  indoorOutdoorCheck: check("catering_booking_details_indoor_outdoor_check", sql`${t.indoorOutdoor} IS NULL OR ${t.indoorOutdoor} IN ('indoor', 'outdoor', 'both')`),
  arrivalTimeCheck: check("catering_booking_details_arrival_time_check", sql`${t.arrivalTime} IS NULL OR ${t.arrivalTime} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'`),
  serviceStartTimeCheck: check("catering_booking_details_service_start_time_check", sql`${t.serviceStartTime} IS NULL OR ${t.serviceStartTime} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'`),
  serviceEndTimeCheck: check("catering_booking_details_service_end_time_check", sql`${t.serviceEndTime} IS NULL OR ${t.serviceEndTime} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'`),
}));

export const cateringBookingTasks = pgTable("catering_booking_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").references(() => cateringBookings.id, { onDelete: "restrict" }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 16 }).default("pending").notNull(),
  visibility: varchar("visibility", { length: 16 }).default("provider").notNull(),
  dueDate: date("due_date", { mode: "string" }),
  dueTime: varchar("due_time", { length: 5 }),
  sortOrder: integer("sort_order").notNull(),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  bookingSortIdx: index("catering_booking_tasks_booking_sort_idx").on(t.bookingId, t.sortOrder, t.id),
  bookingTaskUnique: uniqueIndex("catering_booking_tasks_booking_id_uidx").on(t.bookingId, t.id),
  statusCheck: check("catering_booking_tasks_status_check", sql`${t.status} IN ('pending', 'completed')`),
  visibilityCheck: check("catering_booking_tasks_visibility_check", sql`${t.visibility} IN ('provider', 'shared')`),
  sortOrderCheck: check("catering_booking_tasks_sort_order_check", sql`${t.sortOrder} >= 0`),
  dueTimeCheck: check("catering_booking_tasks_due_time_check", sql`${t.dueTime} IS NULL OR ${t.dueTime} ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'`),
}));

export const cateringBookingActivity = pgTable("catering_booking_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").references(() => cateringBookings.id, { onDelete: "restrict" }).notNull(),
  actorUserId: varchar("actor_user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  visibility: varchar("visibility", { length: 16 }).default("shared").notNull(),
  metadata: jsonb("metadata").$type<Record<string, string>>().default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  bookingPageIdx: index("catering_booking_activity_booking_page_idx").on(t.bookingId, t.createdAt, t.id),
  eventTypeCheck: check("catering_booking_activity_event_type_check", sql`${t.eventType} IN ('booking_offered', 'customer_confirmed', 'booking_cancelled', 'booking_completed', 'details_updated', 'shared_requirement_added', 'shared_requirement_updated', 'shared_requirement_completed', 'shared_requirement_deleted')`),
  visibilityCheck: check("catering_booking_activity_visibility_check", sql`${t.visibility} IN ('provider', 'shared')`),
}));

export const cateringReviews = pgTable("catering_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  reviewerId: varchar("reviewer_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  inquiryId: varchar("inquiry_id").references(() => cateringInquiries.id, { onDelete: "set null" }),
  rating: integer("rating").notNull(),
  title: varchar("title", { length: 120 }),
  body: text("body").notNull(),
  verifiedEvent: boolean("verified_event").default(false).notNull(),
  providerResponse: text("provider_response"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  ratingCheck: check("catering_reviews_rating_check", sql`${t.rating} BETWEEN 1 AND 5`),
  providerDateIdx: index("catering_reviews_provider_date_idx").on(t.providerId, t.createdAt),
  providerRatingIdx: index("catering_reviews_provider_rating_idx").on(t.providerId, t.rating),
  reviewerProviderUnique: uniqueIndex("catering_reviews_reviewer_provider_uidx").on(t.reviewerId, t.providerId),
  inquiryUnique: uniqueIndex("catering_reviews_inquiry_uidx").on(t.inquiryId),
}));

export const cateringPortfolioItems = pgTable(
  "catering_portfolio_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    providerId: varchar("provider_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    image: text("image").notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 40 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => ({
    providerOrderIdx: index("catering_portfolio_provider_order_idx").on(table.providerId, table.sortOrder, table.createdAt),
  }),
);
