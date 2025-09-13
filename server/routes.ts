// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertPostSchema,
  insertRecipeSchema,
  insertStorySchema,
  insertCommentSchema,
  insertLikeSchema,
  insertFollowSchema,
} from "@shared/schema";
import { z } from "zod";

// ✅ NEW service imports
import { aiSuggestSubstitutions } from "./services/ai";
import {
  fetchSpoonacularRecipes,
  fetchEdamamRecipes,
  mergeDedupRecipes,
  type NormalizedRecipe,
} from "./services/recipes-providers";

// Simple mock auth (replace later)
const authenticateUser = (req: any, _res: any, next: any) => {
  req.user = { id: "user-123" };
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // -------------------------
  // Users
  // -------------------------
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/users/username/:username", async (req, res) => {
    try {
      const user = await storage.getUserByUsername(req.params.username);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.get("/api/users/:id/suggested", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const users = await storage.getSuggestedUsers(req.params.id, limit);
      res.json(users);
    } catch {
      res.status(500).json({ message: "Failed to fetch suggested users" });
    }
  });

  // -------------------------
  // Posts
  // -------------------------
  app.get("/api/posts/feed/:userId", async (req, res) => {
    try {
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 10;
      const posts = await storage.getFeedPosts(
        req.params.userId,
        offset,
        limit
      );
      res.json(posts);
    } catch {
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });

  app.get("/api/posts/explore", async (req, res) => {
    try {
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 10;
      const posts = await storage.getExplorePosts(offset, limit);
      res.json(posts);
    } catch {
      res.status(500).json({ message: "Failed to fetch explore posts" });
    }
  });

  app.get("/api/posts/user/:userId", async (req, res) => {
    try {
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 10;
      const posts = await storage.getUserPosts(req.params.userId, offset, limit);
      res.json(posts);
    } catch {
      res.status(500).json({ message: "Failed to fetch user posts" });
    }
  });

  app.get("/api/posts/:id", async (req, res) => {
    try {
      const post = await storage.getPostWithUser(req.params.id);
      if (!post) return res.status(404).json({ message: "Post not found" });
      res.json(post);
    } catch {
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  app.post("/api/posts", async (req, res) => {
    try {
      const postData = insertPostSchema.parse(req.body);
      const post = await storage.createPost(postData);
      res.status(201).json(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid post data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.delete("/api/posts/:id", async (req, res) => {
    try {
      const success = await storage.deletePost(req.params.id);
      if (!success) return res.status(404).json({ message: "Post not found" });
      res.json({ message: "Post deleted successfully" });
    } catch {
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  // -------------------------
  // Recipes (local DB)
  // -------------------------
  app.get("/api/recipes/trending", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const recipes = await storage.getTrendingRecipes(limit);
      res.json(recipes);
    } catch {
      res.status(500).json({ message: "Failed to fetch trending recipes" });
    }
  });

  app.get("/api/recipes/post/:postId", async (req, res) => {
    try {
      const recipe = await storage.getRecipeByPostId(req.params.postId);
      if (!recipe) return res.status(404).json({ message: "Recipe not found" });
      res.json(recipe);
    } catch {
      res.status(500).json({ message: "Failed to fetch recipe" });
    }
  });

  app.post("/api/recipes", async (req, res) => {
    try {
      const recipeData = insertRecipeSchema.parse(req.body);
      const recipe = await storage.createRecipe(recipeData);
      res.status(201).json(recipe);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid recipe data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create recipe" });
    }
  });

  // -------------------------
  // ✅ NEW: External recipe aggregation (Spoonacular + Edamam)
  // -------------------------
  app.get("/api/recipes/search", async (req, res) => {
    try {
      const querySchema = z.object({
        q: z.string().optional(),
        cuisines: z.string().optional(), // csv
        diets: z.string().optional(), // csv
        mealTypes: z.string().optional(), // csv
        maxReadyMinutes: z.coerce.number().optional(),
        pageSize: z.coerce.number().min(1).max(50).default(24),
        offset: z.coerce.number().min(0).default(0),
        source: z.enum(["all", "external", "local"]).default("all"),
      });

      const parsed = querySchema.parse(req.query);
      const cuisines = parsed.cuisines
        ? parsed.cuisines.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const diets = parsed.diets
        ? parsed.diets.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const mealTypes = parsed.mealTypes
        ? parsed.mealTypes.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const rq = {
        q: parsed.q,
        cuisines,
        diets,
        mealTypes,
        maxReadyMinutes: parsed.maxReadyMinutes,
        pageSize: parsed.pageSize,
        offset: parsed.offset,
      };

      let external: NormalizedRecipe[] = [];
      if (parsed.source === "all" || parsed.source === "external") {
        const [spoon, edam] = await Promise.all([
          fetchSpoonacularRecipes(rq).catch(() => []),
          fetchEdamamRecipes(rq).catch(() => []),
        ]);
        external = mergeDedupRecipes(spoon, edam);
      }

      let local: NormalizedRecipe[] = [];
      if (parsed.source === "all" || parsed.source === "local") {
        if (typeof (storage as any).searchLocalRecipes === "function") {
          const loc = await (storage as any).searchLocalRecipes(rq);
          local = Array.isArray(loc) ? loc : [];
        }
      }

      const results = mergeDedupRecipes(local, external);
      res.json({ results, total: results.length, source: parsed.source });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid search params", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to search recipes" });
    }
  });

  // -------------------------
  // Stories
  // -------------------------
  app.get("/api/stories/active/:userId", async (req, res) => {
    try {
      const stories = await storage.getActiveStories(req.params.userId);
      res.json(stories);
    } catch {
      res.status(500).json({ message: "Failed to fetch active stories" });
    }
  });

  app.post("/api/stories", async (req, res) => {
    try {
      const storyData = insertStorySchema.parse(req.body);
      const story = await storage.createStory(storyData);
      res.status(201).json(story);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid story data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create story" });
    }
  });

  // -------------------------
  // Likes
  // -------------------------
  app.post("/api/likes", async (req, res) => {
    try {
      const likeData = insertLikeSchema.parse(req.body);
      const like = await storage.likePost(likeData.userId, likeData.postId);
      res.status(201).json(like);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid like data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to like post" });
    }
  });

  app.delete("/api/likes/:userId/:postId", async (req, res) => {
    try {
      const success = await storage.unlikePost(
        req.params.userId,
        req.params.postId
      );
      if (!success) return res.status(404).json({ message: "Like not found" });
      res.json({ message: "Post unliked successfully" });
    } catch {
      res.status(500).json({ message: "Failed to unlike post" });
    }
  });

  app.get("/api/likes/:userId/:postId", async (req, res) => {
    try {
      const isLiked = await storage.isPostLiked(
        req.params.userId,
        req.params.postId
      );
      res.json({ isLiked });
    } catch {
      res.status(500).json({ message: "Failed to check like status" });
    }
  });

  // -------------------------
  // Comments
  // -------------------------
  app.get("/api/posts/:postId/comments", async (req, res) => {
    try {
      const comments = await storage.getPostComments(req.params.postId);
      res.json(comments);
    } catch {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/comments", async (req, res) => {
    try {
      const commentData = insertCommentSchema.parse(req.body);
      const comment = await storage.createComment(commentData);
      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid comment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // -------------------------
  // Follows
  // -------------------------
  app.post("/api/follows", async (req, res) => {
    try {
      const followData = insertFollowSchema.parse(req.body);
      const follow = await storage.followUser(
        followData.followerId,
        followData.followingId
      );
      res.status(201).json(follow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid follow data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to follow user" });
    }
  });

  app.delete("/api/follows/:followerId/:followingId", async (req, res) => {
    try {
      const success = await storage.unfollowUser(
        req.params.followerId,
        req.params.followingId
      );
      if (!success)
        return res
          .status(404)
          .json({ message: "Follow relationship not found" });
      res.json({ message: "User unfollowed successfully" });
    } catch {
      res.status(500).json({ message: "Failed to unfollow user" });
    }
  });

  app.get("/api/follows/:followerId/:followingId", async (req, res) => {
    try {
      const isFollowing = await storage.isFollowing(
        req.params.followerId,
        req.params.followingId
      );
      res.json({ isFollowing });
    } catch {
      res.status(500).json({ message: "Failed to check follow status" });
    }
  });

  // -------------------------
  // Pantry (app-level)
  // -------------------------
  app.get("/api/pantry", authenticateUser, async (req, res) => {
    try {
      const pantryItems = await storage.getPantryItems(req.user.id);
      res.json(pantryItems);
    } catch (e) {
      console.error("Error fetching pantry items:", e);
      res.status(500).json({ error: "Failed to fetch pantry items" });
    }
  });

  app.post("/api/pantry", authenticateUser, async (req, res) => {
    try {
      const { name, category, quantity, unit, expirationDate, notes } = req.body;
      if (!name) return res.status(400).json({ error: "Item name is required" });

      const item = await storage.addPantryItem(req.user.id, {
        name: name.trim(),
        category: category || "other",
        quantity: quantity || 1,
        unit: unit || "piece",
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        notes,
      });

      res.status(201).json(item);
    } catch (e) {
      console.error("Error adding pantry item:", e);
      res.status(500).json({ error: "Failed to add pantry item" });
    }
  });

  app.delete("/api/pantry/:id", authenticateUser, async (req, res) => {
    try {
      const success = await storage.deletePantryItem(req.params.id);
      if (!success) return res.status(404).json({ error: "Pantry item not found" });
      res.json({ message: "Pantry item deleted successfully" });
    } catch (e) {
      console.error("Error deleting pantry item:", e);
      res.status(500).json({ error: "Failed to delete pantry item" });
    }
  });

  app.get("/api/pantry/recipe-suggestions", authenticateUser, async (req, res) => {
    try {
      const requireAllIngredients = req.query.requireAll === "true";
      const maxMissingIngredients = parseInt(req.query.maxMissing as string) || 3;
      const includeExpiringSoon = req.query.includeExpiring !== "false";
      const limit = parseInt(req.query.limit as string) || 20;

      const suggestions = await storage.getRecipesFromPantryItems(req.user.id, {
        requireAllIngredients,
        maxMissingIngredients,
        includeExpiringSoon,
        limit,
      });

      res.json(suggestions);
    } catch (e) {
      console.error("Error fetching recipe suggestions:", e);
      res.status(500).json({ error: "Failed to fetch recipe suggestions" });
    }
  });
    // -------------------------
  // Catering
  // -------------------------
  app.post("/api/users/:id/catering/enable", async (req, res) => {
    try {
      const enableCateringSchema = z.object({
        location: z.string().min(5, "Postal code required"),
        radius: z.number().min(5).max(100),
        bio: z.string().optional(),
      });
      const { location, radius, bio } = enableCateringSchema.parse(req.body);

      const updatedUser = await storage.enableCatering(
        req.params.id,
        location,
        radius,
        bio
      );
      if (!updatedUser)
        return res.status(404).json({ message: "User not found" });

      res.json({
        message: "Catering enabled successfully",
        user: updatedUser,
      });
    } catch (error) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      res.status(500).json({ message: "Failed to enable catering" });
    }
  });

  // (⚡ keep all your Catering, Marketplace, Nutrition, Meal Plan routes as before …)

  // -------------------------
  // Ingredient Substitutions
  // -------------------------
  app.get("/api/ingredients/:ingredient/substitutions", async (req, res) => {
    try {
      const ingredient = decodeURIComponent(req.params.ingredient);
      const substitutions = await storage.getIngredientSubstitutions(ingredient);
      res.json({
        ingredient,
        substitutions,
        total: substitutions.length,
        categories: [
          ...new Set(substitutions.map((sub) => sub.category).filter(Boolean)),
        ],
      });
    } catch {
      res.status(500).json({ message: "Failed to get ingredient substitutions" });
    }
  });

  app.get("/api/ingredients/substitutions/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2)
        return res
          .status(400)
          .json({ message: "Search query must be at least 2 characters long" });

      const results = await storage.searchSubstitutions(query);
      res.json({ query, results, total: results.length });
    } catch {
      res.status(500).json({ message: "Failed to search substitutions" });
    }
  });

  app.post("/api/ingredients/substitutions", async (req, res) => {
    try {
      const substitutionSchema = z.object({
        originalIngredient: z.string().min(1),
        substituteIngredient: z.string().min(1),
        ratio: z.string().min(1),
        notes: z.string().optional(),
        category: z.string().optional(),
      });

      const substitutionData = substitutionSchema.parse(req.body);
      const substitution = await storage.addIngredientSubstitution(
        substitutionData.originalIngredient,
        substitutionData.substituteIngredient,
        substitutionData.ratio,
        substitutionData.notes,
        substitutionData.category
      );
      res.status(201).json({
        message: "Ingredient substitution added successfully",
        substitution,
      });
    } catch (error) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ message: "Invalid substitution data", errors: error.errors });
      res.status(500).json({ message: "Failed to add ingredient substitution" });
    }
  });

  // ✅ NEW: AI Substitutions endpoint
  app.get("/api/ingredients/:ingredient/ai-substitutions", async (req, res) => {
    try {
      const ingredient = decodeURIComponent(req.params.ingredient);
      const { cuisine, dietaryRestrictions } = req.query;
      const subs = await aiSuggestSubstitutions(ingredient, {
        cuisine: cuisine as string | undefined,
        dietaryRestrictions: dietaryRestrictions
          ? String(dietaryRestrictions).split(",")
          : undefined,
      });
      res.json({ ingredient, aiSubstitutions: subs });
    } catch (error) {
      console.error("AI substitution error:", error);
      res.status(500).json({ message: "AI substitution failed" });
    }
  });

  // -------------------------
  // Wedding Planning
  // -------------------------
  app.get("/api/wedding/vendors", async (req, res) => {
    try {
      const filterSchema = z.object({
        category: z.enum([
          "caterer",
          "venue",
          "photographer",
          "dj",
          "florist",
          "planner",
          "all",
        ]).optional(),
        location: z.string().optional(),
        date: z.string().optional(),
        guests: z.coerce.number().optional(),
        budget: z.string().optional(),
        offset: z.coerce.number().default(0),
        limit: z.coerce.number().max(50).default(20),
      });
      const filters = filterSchema.parse(req.query);

      // 🔹 For now, return mock vendor
      const vendors = [
        {
          id: "1",
          businessName: "Bella Vista Catering",
          category: "caterer",
          rating: 4.9,
          reviewCount: 127,
          priceRange: "$$$",
          verified: true,
          featured: true,
          sponsored: true,
          availability: "available",
          description: "Award-winning catering",
          responseTime: "2 hours",
        },
      ];

      res.json({ vendors, total: vendors.length, filters });
    } catch (error) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ message: "Invalid parameters", errors: error.errors });
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  // (⚡ keep your Wedding planning routes for quotes, calendar, registry, etc.)

  // -------------------------
  // Finalize server
  // -------------------------
  const httpServer = createServer(app);
  return httpServer;
}
