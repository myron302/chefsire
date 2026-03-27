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
} from "drizzle-orm/pg-core";
import { users } from "./users-auth";

type RecipeNutrition = Record<string, unknown> & {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
};

export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  caption: text("caption"),
  imageUrl: text("image_url").notNull(),
  additionalImages: jsonb("additional_images").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  isRecipe: boolean("is_recipe").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const recipes = pgTable("recipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => posts.id),
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
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: integer("review_count").default(0),
  externalSource: text("external_source"),
  externalId: text("external_id"),
  cuisine: text("cuisine"),
  mealType: text("meal_type"),
  sourceUrl: text("source_url"),
});

export const recipeReviews = pgTable("recipe_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipeId: varchar("recipe_id").references(() => recipes.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  reviewText: text("review_text"),
  helpfulCount: integer("helpful_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const recipeReviewPhotos = pgTable("recipe_review_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").references(() => recipeReviews.id).notNull(),
  photoUrl: text("photo_url").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviewHelpful = pgTable("review_helpful", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").references(() => recipeReviews.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stories = pgTable("stories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const likes = pgTable("likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  postId: varchar("post_id").references(() => posts.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const comments = pgTable(
  "comments",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    postId: varchar("post_id").references(() => posts.id).notNull(),
    parentId: varchar("parent_id").references((): AnyPgColumn => comments.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    postIdIdx: index("comments_post_id_idx").on(t.postId),
    userIdIdx: index("comments_user_id_idx").on(t.userId),
    parentIdIdx: index("comments_parent_id_idx").on(t.parentId),
  })
);

export const commentLikes = pgTable(
  "comment_likes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    commentId: varchar("comment_id").references(() => comments.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userCommentIdx: uniqueIndex("comment_likes_user_comment_idx").on(table.userId, table.commentId),
  })
);

export const follows = pgTable(
  "follows",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    followerId: varchar("follower_id").references(() => users.id).notNull(),
    followingId: varchar("following_id").references(() => users.id).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    followerIdx: index("follows_follower_id_idx").on(table.followerId),
    followingIdx: index("follows_following_id_idx").on(table.followingId),
    followerCreatedAtIdx: index("follows_follower_created_at_idx").on(table.followerId, table.createdAt),
    followingCreatedAtIdx: index("follows_following_created_at_idx").on(table.followingId, table.createdAt),
  })
);

export const followRequests = pgTable("follow_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").references(() => users.id).notNull(),
  targetId: varchar("target_id").references(() => users.id).notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
});

export const cateringInquiries = pgTable("catering_inquiries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => users.id).notNull(),
  chefId: varchar("chef_id").references(() => users.id).notNull(),
  eventDate: timestamp("event_date").notNull(),
  guestCount: integer("guest_count"),
  eventType: text("event_type"),
  cuisinePreferences: jsonb("cuisine_preferences").$type<string[]>().default(sql`'[]'::jsonb`),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  message: text("message"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});
