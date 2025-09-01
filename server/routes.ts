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
  insertFollowSchema
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // User routes
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/users/username/:username", async (req, res) => {
    try {
      const user = await storage.getUserByUsername(req.params.username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
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
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.get("/api/users/:id/suggested", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const users = await storage.getSuggestedUsers(req.params.id, limit);
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch suggested users" });
    }
  });

  // Post routes
  app.get("/api/posts/feed/:userId", async (req, res) => {
    try {
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 10;
      const posts = await storage.getFeedPosts(req.params.userId, offset, limit);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });

  app.get("/api/posts/explore", async (req, res) => {
    try {
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 10;
      const posts = await storage.getExplorePosts(offset, limit);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch explore posts" });
    }
  });

  app.get("/api/posts/user/:userId", async (req, res) => {
    try {
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 10;
      const posts = await storage.getUserPosts(req.params.userId, offset, limit);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user posts" });
    }
  });

  app.get("/api/posts/:id", async (req, res) => {
    try {
      const post = await storage.getPostWithUser(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.json(post);
    } catch (error) {
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
        return res.status(400).json({ message: "Invalid post data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.delete("/api/posts/:id", async (req, res) => {
    try {
      const success = await storage.deletePost(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  // Recipe routes
  app.get("/api/recipes/trending", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const recipes = await storage.getTrendingRecipes(limit);
      res.json(recipes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trending recipes" });
    }
  });

  app.get("/api/recipes/post/:postId", async (req, res) => {
    try {
      const recipe = await storage.getRecipeByPostId(req.params.postId);
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
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
        return res.status(400).json({ message: "Invalid recipe data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create recipe" });
    }
  });

  // Story routes
  app.get("/api/stories/active/:userId", async (req, res) => {
    try {
      const stories = await storage.getActiveStories(req.params.userId);
      res.json(stories);
    } catch (error) {
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
        return res.status(400).json({ message: "Invalid story data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create story" });
    }
  });

  // Like routes
  app.post("/api/likes", async (req, res) => {
    try {
      const likeData = insertLikeSchema.parse(req.body);
      const like = await storage.likePost(likeData.userId, likeData.postId);
      res.status(201).json(like);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid like data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to like post" });
    }
  });

  app.delete("/api/likes/:userId/:postId", async (req, res) => {
    try {
      const success = await storage.unlikePost(req.params.userId, req.params.postId);
      if (!success) {
        return res.status(404).json({ message: "Like not found" });
      }
      res.json({ message: "Post unliked successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to unlike post" });
    }
  });

  app.get("/api/likes/:userId/:postId", async (req, res) => {
    try {
      const isLiked = await storage.isPostLiked(req.params.userId, req.params.postId);
      res.json({ isLiked });
    } catch (error) {
      res.status(500).json({ message: "Failed to check like status" });
    }
  });

  // Comment routes
  app.get("/api/posts/:postId/comments", async (req, res) => {
    try {
      const comments = await storage.getPostComments(req.params.postId);
      res.json(comments);
    } catch (error) {
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
        return res.status(400).json({ message: "Invalid comment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Follow routes
  app.post("/api/follows", async (req, res) => {
    try {
      const followData = insertFollowSchema.parse(req.body);
      const follow = await storage.followUser(followData.followerId, followData.followingId);
      res.status(201).json(follow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid follow data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to follow user" });
    }
  });

  app.delete("/api/follows/:followerId/:followingId", async (req, res) => {
    try {
      const success = await storage.unfollowUser(req.params.followerId, req.params.followingId);
      if (!success) {
        return res.status(404).json({ message: "Follow relationship not found" });
      }
      res.json({ message: "User unfollowed successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to unfollow user" });
    }
  });

  app.get("/api/follows/:followerId/:followingId", async (req, res) => {
    try {
      const isFollowing = await storage.isFollowing(req.params.followerId, req.params.followingId);
      res.json({ isFollowing });
    } catch (error) {
      res.status(500).json({ message: "Failed to check follow status" });
    }
  });

  // ===== CATERING API ROUTES =====

  app.post("/api/users/:id/catering/enable", async (req, res) => {
    try {
      const userId = req.params.id;
      const enableCateringSchema = z.object({
        location: z.string().min(5, "Postal code required"),
        radius: z.number().min(5).max(100),
        bio: z.string().optional()
      });
      
      const { location, radius, bio } = enableCateringSchema.parse(req.body);
      
      const updatedUser = await storage.enableCatering(userId, location, radius, bio);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        message: "Catering enabled successfully",
        user: updatedUser 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to enable catering" });
    }
  });

  app.post("/api/users/:id/catering/disable", async (req, res) => {
    try {
      const userId = req.params.id;
      
      const updatedUser = await storage.disableCatering(userId);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        message: "Catering disabled successfully",
        user: updatedUser 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to disable catering" });
    }
  });

  app.put("/api/users/:id/catering/settings", async (req, res) => {
    try {
      const userId = req.params.id;
      const updateSchema = z.object({
        location: z.string().min(5).optional(),
        radius: z.number().min(5).max(100).optional(),
        bio: z.string().optional(),
        available: z.boolean().optional()
      });
      
      const settings = updateSchema.parse(req.body);
      
      const updatedUser = await storage.updateCateringSettings(userId, settings);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        message: "Catering settings updated",
        user: updatedUser 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update catering settings" });
    }
  });

  app.get("/api/catering/chefs/search", async (req, res) => {
    try {
      const searchSchema = z.object({
        location: z.string().min(5, "Postal code required"),
        radius: z.coerce.number().min(5).max(100).default(25),
        limit: z.coerce.number().max(50).default(20)
      });
      
      const { location, radius, limit } = searchSchema.parse(req.query);
      
      const chefs = await storage.findChefsInRadius(location, radius, limit);
      
      res.json({
        chefs,
        searchParams: { location, radius },
        total: chefs.length
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid search parameters", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to search for chefs" });
    }
  });

  app.post("/api/catering/inquiries", async (req, res) => {
    try {
      const inquirySchema = z.object({
        customerId: z.string(),
        chefId: z.string(),
        eventDate: z.string().transform(str => new Date(str)),
        guestCount: z.number().min(1).optional(),
        eventType: z.string().optional(),
        cuisinePreferences: z.array(z.string()).default([]),
        budget: z.string().optional(),
        message: z.string().min(10, "Please provide more details about your event")
      });
      
      const inquiryData = inquirySchema.parse(req.body);
      
      const inquiry = await storage.createCateringInquiry(inquiryData);
      
      res.status(201).json({
        message: "Catering inquiry sent successfully",
        inquiry
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid inquiry data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create catering inquiry" });
    }
  });

  app.get("/api/users/:id/catering/inquiries", async (req, res) => {
    try {
      const chefId = req.params.id;
      
      const inquiries = await storage.getCateringInquiries(chefId);
      
      res.json({
        inquiries,
        total: inquiries.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch catering inquiries" });
    }
  });

  app.put("/api/catering/inquiries/:id", async (req, res) => {
    try {
      const inquiryId = req.params.id;
      const updateSchema = z.object({
        status: z.enum(["pending", "accepted", "declined", "completed"]).optional(),
        message: z.string().optional()
      });
      
      const updates = updateSchema.parse(req.body);
      
      const inquiry = await storage.updateCateringInquiry(inquiryId, updates);
      
      if (!inquiry) {
        return res.status(404).json({ message: "Inquiry not found" });
      }
      
      res.json({
        message: "Inquiry updated successfully",
        inquiry
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update inquiry" });
    }
  });

  app.get("/api/users/:id/catering/status", async (req, res) => {
    try {
      const userId = req.params.id;
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        cateringEnabled: user.cateringEnabled || false,
        cateringAvailable: user.cateringAvailable || false,
        cateringLocation: user.cateringLocation,
        cateringRadius: user.cateringRadius,
        cateringBio: user.cateringBio,
        isChef: user.isChef
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch catering status" });
    }
  });

  // ===== MARKETPLACE API ROUTES =====

  app.post("/api/marketplace/products", async (req, res) => {
    try {
      const productSchema = z.object({
        sellerId: z.string(),
        name: z.string().min(1, "Product name required"),
        description: z.string().optional(),
        price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
        category: z.enum(["spices", "ingredients", "cookware", "cookbooks", "sauces", "other"]),
        images: z.array(z.string().url()).default([]),
        inventory: z.number().min(0).default(0),
        shippingEnabled: z.boolean().default(true),
        localPickupEnabled: z.boolean().default(false),
        pickupLocation: z.string().optional(),
        pickupInstructions: z.string().optional(),
        shippingCost: z.string().optional(),
        isExternal: z.boolean().default(false),
        externalUrl: z.string().url().optional()
      });

      const productData = productSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      
      res.status(201).json({
        message: "Product created successfully",
        product
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.get("/api/marketplace/products/:id", async (req, res) => {
    try {
      const product = await storage.getProductWithSeller(req.params.id);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      await storage.updateProduct(req.params.id, { 
        viewsCount: (product.viewsCount || 0) + 1 
      });
      
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.get("/api/marketplace/products", async (req, res) => {
    try {
      const searchSchema = z.object({
        query: z.string().optional(),
        category: z.enum(["spices", "ingredients", "cookware", "cookbooks", "sauces", "other"]).optional(),
        location: z.string().optional(),
        localPickupOnly: z.coerce.boolean().default(false),
        offset: z.coerce.number().min(0).default(0),
        limit: z.coerce.number().min(1).max(50).default(20)
      });
      
      const filters = searchSchema.parse(req.query);
      
      const products = await storage.searchProducts(
        filters.query,
        filters.category,
        filters.location,
        filters.offset,
        filters.limit
      );
      
      res.json({
        products,
        filters,
        total: products.length
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid search parameters", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  app.get("/api/marketplace/sellers/:sellerId/products", async (req, res) => {
    try {
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const products = await storage.getUserProducts(req.params.sellerId, offset, limit);
      
      res.json({
        products,
        total: products.length,
        sellerId: req.params.sellerId
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch seller products" });
    }
  });

  app.put("/api/marketplace/products/:id", async (req, res) => {
    try {
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        inventory: z.number().min(0).optional(),
        shippingEnabled: z.boolean().optional(),
        localPickupEnabled: z.boolean().optional(),
        pickupLocation: z.string().optional(),
        pickupInstructions: z.string().optional(),
        shippingCost: z.string().optional(),
        isActive: z.boolean().optional()
      });
      
      const updates = updateSchema.parse(req.body);
      
      const product = await storage.updateProduct(req.params.id, updates);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json({
        message: "Product updated successfully",
        product
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/marketplace/products/:id", async (req, res) => {
    try {
      const success = await storage.deleteProduct(req.params.id);
      
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json({ message: "Product deactivated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  app.put("/api/users/:id/subscription", async (req, res) => {
    try {
      const userId = req.params.id;
      const subscriptionSchema = z.object({
        tier: z.enum(["free", "starter", "professional", "enterprise", "premium_plus"]),
        paymentMethod: z.string().optional()
      });
      
      const { tier, paymentMethod } = subscriptionSchema.parse(req.body);
      
      const subscriptionEndsAt = new Date();
      subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + 30);
      
      const updatedUser = await storage.updateUser(userId, {
        subscriptionTier: tier,
        subscriptionStatus: "active",
        subscriptionEndsAt: subscriptionEndsAt
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        message: "Subscription updated successfully",
        user: updatedUser
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid subscription data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  app.get("/api/users/:id/subscription/info", async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const getCommissionRate = (tier: string, monthlyRevenue: number) => {
        const rates = {
          free: { base: 10, thresholds: [] },
          starter: { base: 8, thresholds: [{ amount: 1000, rate: 7 }, { amount: 2500, rate: 6 }] },
          professional: { base: 5, thresholds: [{ amount: 2500, rate: 4 }, { amount: 5000, rate: 3 }] },
          enterprise: { base: 3, thresholds: [{ amount: 5000, rate: 2.5 }, { amount: 10000, rate: 2 }] },
          premium_plus: { base: 1, thresholds: [{ amount: 10000, rate: 0.5 }] }
        };
        
        const tierRates = rates[tier as keyof typeof rates] || rates.free;
        
        for (const threshold of tierRates.thresholds.reverse()) {
          if (monthlyRevenue >= threshold.amount) {
            return threshold.rate;
          }
        }
        
        return tierRates.base;
      };
      
      const currentRate = getCommissionRate(user.subscriptionTier || "free", parseFloat(user.monthlyRevenue || "0"));
      
      res.json({
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndsAt: user.subscriptionEndsAt,
        monthlyRevenue: user.monthlyRevenue,
        currentCommissionRate: currentRate,
        tierPricing: {
          starter: { price: 15, baseRate: 8 },
          professional: { price: 35, baseRate: 5 },
          enterprise: { price: 75, baseRate: 3 },
          premium_plus: { price: 150, baseRate: 1 }
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch subscription info" });
    }
  });

  app.get("/api/marketplace/storefront/:username", async (req, res) => {
    try {
      const user = await storage.getUserByUsername(req.params.username);
      
      if (!user) {
        return res.status(404).json({ message: "Storefront not found" });
      }
      
      const products = await storage.getUserProducts(user.id, 0, 50);
      
      res.json({
        storefront: {
          seller: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            bio: user.bio,
            avatar: user.avatar,
            specialty: user.specialty,
            isChef: user.isChef,
            followersCount: user.followersCount
          },
          products,
          subscriptionTier: user.subscriptionTier
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch storefront" });
    }
  });

  app.get("/api/marketplace/sellers/:sellerId/analytics", async (req, res) => {
    try {
      const sellerId = req.params.sellerId;
      const user = await storage.getUser(sellerId);
      
      if (!user) {
        return res.status(404).json({ message: "Seller not found" });
      }
      
      const products = await storage.getUserProducts(sellerId, 0, 100);
      
      const analytics = {
        totalProducts: products.length,
        activeProducts: products.filter(p => p.isActive).length,
        totalViews: products.reduce((sum, p) => sum + (p.viewsCount || 0), 0),
        totalSales: products.reduce((sum, p) => sum + (p.salesCount || 0), 0),
        monthlyRevenue: parseFloat(user.monthlyRevenue || "0"),
        subscriptionTier: user.subscriptionTier,
        currentCommissionRate: user.subscriptionTier === "free" ? 10 : 
                              user.subscriptionTier === "starter" ? 8 :
                              user.subscriptionTier === "professional" ? 5 :
                              user.subscriptionTier === "enterprise" ? 3 : 1
      };
      
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get("/api/marketplace/categories", async (req, res) => {
    try {
      const allProducts = await storage.searchProducts(undefined, undefined, undefined, 0, 1000);
      
      const categories = {
        spices: allProducts.filter(p => p.category === "spices").length,
        ingredients: allProducts.filter(p => p.category === "ingredients").length,
        cookware: allProducts.filter(p => p.category === "cookware").length,
        cookbooks: allProducts.filter(p => p.category === "cookbooks").length,
        sauces: allProducts.filter(p => p.category === "sauces").length,
        other: allProducts.filter(p => p.category === "other").length
      };
      
      res.json({
        categories,
        totalProducts: allProducts.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // ===== NUTRITION TRACKING API ROUTES =====

  app.post("/api/users/:id/nutrition/trial", async (req, res) => {
    try {
      const userId = req.params.id;
      
      const updatedUser = await storage.enableNutritionPremium(userId, 30);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        message: "Nutrition premium trial activated",
        user: updatedUser,
        trialEndsAt: updatedUser.nutritionTrialEndsAt
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to start nutrition trial" });
    }
  });

  app.put("/api/users/:id/nutrition/goals", async (req, res) => {
    try {
      const userId = req.params.id;
      const goalsSchema = z.object({
        dailyCalorieGoal: z.number().min(800).max(5000).optional(),
        macroGoals: z.object({
          protein: z.number().min(0).max(100),
          carbs: z.number().min(0).max(100),
          fat: z.number().min(0).max(100)
        }).optional(),
        dietaryRestrictions: z.array(z.string()).optional()
      });
      
      const goals = goalsSchema.parse(req.body);
      
      const updatedUser = await storage.updateNutritionGoals(userId, goals);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        message: "Nutrition goals updated",
        user: updatedUser
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid goals data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update nutrition goals" });
    }
  });

  app.post("/api/nutrition/log", async (req, res) => {
    try {
      const logSchema = z.object({
        userId: z.string(),
        date: z.string().transform(str => new Date(str)),
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
        recipeId: z.string().optional(),
        customFoodName: z.string().optional(),
        servings: z.number().min(0.1).max(20).default(1),
        calories: z.number().min(0),
        protein: z.number().min(0).optional(),
        carbs: z.number().min(0).optional(),
        fat: z.number().min(0).optional(),
        fiber: z.number().min(0).optional(),
        imageUrl: z.string().url().optional()
      });
      
      const logData = logSchema.parse(req.body);
      
      const nutritionLog = await storage.logNutrition(logData.userId, logData);
      
      res.status(201).json({
        message: "Nutrition logged successfully",
        log: nutritionLog
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid nutrition data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to log nutrition" });
    }
  });

  app.get("/api/users/:id/nutrition/daily/:date", async (req, res) => {
    try {
      const userId = req.params.id;
      const date = new Date(req.params.date);
      
      if (isNaN(date.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      
      const summary = await storage.getDailyNutritionSummary(userId, date);
      const user = await storage.getUser(userId);
      
      const response = {
        date: req.params.date,
        summary,
        goals: user ? {
          dailyCalorieGoal: user.dailyCalorieGoal,
          macroGoals: user.macroGoals
        } : null,
        progress: user?.dailyCalorieGoal ? {
          calorieProgress: Math.round((summary.totalCalories / user.dailyCalorieGoal) * 100)
        } : null
      };
      
      res.json(response);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch daily nutrition" });
    }
  });

  app.get("/api/users/:id/nutrition/logs", async (req, res) => {
    try {
      const userId = req.params.id;
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      
      const logs = await storage.getNutritionLogs(userId, startDate, endDate);
      
      res.json({
        logs,
        dateRange: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        },
        total: logs.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch nutrition logs" });
    }
  });

  app.post("/api/meal-plans", async (req, res) => {
    try {
      const planSchema = z.object({
        userId: z.string(),
        name: z.string().min(1, "Meal plan name required"),
        startDate: z.string().transform(str => new Date(str)),
        endDate: z.string().transform(str => new Date(str)),
        isTemplate: z.boolean().default(false)
      });
      
      const planData = planSchema.parse(req.body);
      
      if (planData.startDate >= planData.endDate) {
        return res.status(400).json({ message: "End date must be after start date" });
      }
      
      const mealPlan = await storage.createMealPlan(planData.userId, planData);
      
      res.status(201).json({
        message: "Meal plan created successfully",
        mealPlan
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid meal plan data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create meal plan" });
    }
  });

  app.get("/api/meal-plans/:id", async (req, res) => {
    try {
      const mealPlan = await storage.getMealPlan(req.params.id);
      
      if (!mealPlan) {
        return res.status(404).json({ message: "Meal plan not found" });
      }
      
      res.json(mealPlan);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch meal plan" });
    }
  });

  app.get("/api/users/:id/meal-plans", async (req, res) => {
    try {
      const userId = req.params.id;
      const mealPlans = await storage.getUserMealPlans(userId);
      
      res.json({
        mealPlans,
        total: mealPlans.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch meal plans" });
    }
  });

  app.post("/api/meal-plans/:id/entries", async (req, res) => {
    try {
      const planId = req.params.id;
      const entrySchema = z.object({
        recipeId: z.string().optional(),
        date: z.string().transform(str => new Date(str)),
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
        servings: z.number().min(0.1).max(20).default(1),
        customName: z.string().optional(),
        customCalories: z.number().min(0).optional()
      });
      
      const entryData = entrySchema.parse(req.body);
      
      const entry = await storage.addMealPlanEntry(planId, entryData);
      
      res.status(201).json({
        message: "Meal plan entry added",
        entry
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid entry data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add meal plan entry" });
    }
  });

  app.post("/api/users/:id/pantry", async (req, res) => {
    try {
      const userId = req.params.id;
      const itemSchema = z.object({
        name: z.string().min(1, "Item name required"),
        category: z.string().optional(),
        quantity: z.number().min(0).optional(),
        unit: z.string().optional(),
        expirationDate: z.string().transform(str => new Date(str)).optional(),
        notes: z.string().optional()
      });
      
      const itemData = itemSchema.parse(req.body);
      
      const pantryItem = await storage.addPantryItem(userId, itemData);
      
      res.status(201).json({
        message: "Pantry item added",
        item: pantryItem
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid item data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add pantry item" });
    }
  });

  app.get("/api/users/:id/pantry", async (req, res) => {
    try {
      const userId = req.params.id;
      const pantryItems = await storage.getPantryItems(userId);
      
      res.json({
        pantryItems,
        total: pantryItems.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pantry items" });
    }
  });

  app.put("/api/pantry/:itemId", async (req, res) => {
    try {
      const itemId = req.params.itemId;
      const updateSchema = z.object({
        quantity: z.number().min(0).optional(),
        expirationDate: z.string().transform(str => new Date(str)).optional(),
        notes: z.string().optional()
      });
      
      const updates = updateSchema.parse(req.body);
      
      const item = await storage.updatePantryItem(itemId, updates);
      
      if (!item) {
        return res.status(404).json({ message: "Pantry item not found" });
      }
      
      res.json({
        message: "Pantry item updated",
        item
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update pantry item" });
    }
  });

  app.delete("/api/pantry/:itemId", async (req, res) => {
    try {
      const success = await storage.deletePantryItem(req.params.itemId);
      
      if (!success) {
        return res.status(404).json({ message: "Pantry item not found" });
      }
      
      res.json({ message: "Pantry item deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete pantry item" });
    }
  });

  app.get("/api/users/:id/pantry/expiring", async (req, res) => {
    try {
      const userId = req.params.id;
      const daysAhead = parseInt(req.query.days as string) || 7;
      
      const expiringItems = await storage.getExpiringItems(userId, daysAhead);
      
      res.json({
        expiringItems,
        daysAhead,
        total: expiringItems.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expiring items" });
    }
  });
// Add these routes to your server/routes.ts file
// Paste them right before: const httpServer = createServer(app);

// ===== NUTRITION TRACKING API ROUTES =====

app.post(”/api/users/:id/nutrition/trial”, async (req, res) => {
try {
const userId = req.params.id;
const updatedUser = await storage.enableNutritionPremium(userId, 30);

```
if (!updatedUser) {
  return res.status(404).json({ message: "User not found" });
}

res.json({
  message: "Nutrition premium trial activated",
  user: updatedUser,
  trialEndsAt: updatedUser.nutritionTrialEndsAt
});
```

} catch (error) {
res.status(500).json({ message: “Failed to start nutrition trial” });
}
});

app.put(”/api/users/:id/nutrition/goals”, async (req, res) => {
try {
const userId = req.params.id;
const goalsSchema = z.object({
dailyCalorieGoal: z.number().min(800).max(5000).optional(),
macroGoals: z.object({
protein: z.number().min(0).max(100),
carbs: z.number().min(0).max(100),
fat: z.number().min(0).max(100)
}).optional(),
dietaryRestrictions: z.array(z.string()).optional()
});

```
const goals = goalsSchema.parse(req.body);
const updatedUser = await storage.updateNutritionGoals(userId, goals);

if (!updatedUser) {
  return res.status(404).json({ message: "User not found" });
}

res.json({ message: "Nutrition goals updated", user: updatedUser });
```

} catch (error) {
if (error instanceof z.ZodError) {
return res.status(400).json({ message: “Invalid goals data”, errors: error.errors });
}
res.status(500).json({ message: “Failed to update nutrition goals” });
}
});

app.post(”/api/nutrition/log”, async (req, res) => {
try {
const logSchema = z.object({
userId: z.string(),
date: z.string().transform(str => new Date(str)),
mealType: z.enum([“breakfast”, “lunch”, “dinner”, “snack”]),
recipeId: z.string().optional(),
customFoodName: z.string().optional(),
servings: z.number().min(0.1).max(20).default(1),
calories: z.number().min(0),
protein: z.number().min(0).optional(),
carbs: z.number().min(0).optional(),
fat: z.number().min(0).optional(),
fiber: z.number().min(0).optional(),
imageUrl: z.string().url().optional()
});

```
const logData = logSchema.parse(req.body);
const nutritionLog = await storage.logNutrition(logData.userId, logData);

res.status(201).json({
  message: "Nutrition logged successfully",
  log: nutritionLog
});
```

} catch (error) {
if (error instanceof z.ZodError) {
return res.status(400).json({ message: “Invalid nutrition data”, errors: error.errors });
}
res.status(500).json({ message: “Failed to log nutrition” });
}
});

app.get(”/api/users/:id/nutrition/daily/:date”, async (req, res) => {
try {
const userId = req.params.id;
const date = new Date(req.params.date);

```
if (isNaN(date.getTime())) {
  return res.status(400).json({ message: "Invalid date format" });
}

const summary = await storage.getDailyNutritionSummary(userId, date);
const user = await storage.getUser(userId);

const response = {
  date: req.params.date,
  summary,
  goals: user ? {
    dailyCalorieGoal: user.dailyCalorieGoal,
    macroGoals: user.macroGoals
  } : null,
  progress: user?.dailyCalorieGoal ? {
    calorieProgress: Math.round((summary.totalCalories / user.dailyCalorieGoal) * 100)
  } : null
};

res.json(response);
```

} catch (error) {
res.status(500).json({ message: “Failed to fetch daily nutrition” });
}
});

app.get(”/api/users/:id/nutrition/logs”, async (req, res) => {
try {
const userId = req.params.id;
const startDate = new Date(req.query.startDate as string);
const endDate = new Date(req.query.endDate as string);

```
if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
  return res.status(400).json({ message: "Invalid date format" });
}

const logs = await storage.getNutritionLogs(userId, startDate, endDate);

res.json({
  logs,
  dateRange: {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  },
  total: logs.length
});
```

} catch (error) {
res.status(500).json({ message: “Failed to fetch nutrition logs” });
}
});

app.post(”/api/meal-plans”, async (req, res) => {
try {
const planSchema = z.object({
userId: z.string(),
name: z.string().min(1, “Meal plan name required”),
startDate: z.string().transform(str => new Date(str)),
endDate: z.string().transform(str => new Date(str)),
isTemplate: z.boolean().default(false)
});

```
const planData = planSchema.parse(req.body);

if (planData.startDate >= planData.endDate) {
  return res.status(400).json({ message: "End date must be after start date" });
}

const mealPlan = await storage.createMealPlan(planData.userId, planData);

res.status(201).json({
  message: "Meal plan created successfully",
  mealPlan
});
```

} catch (error) {
if (error instanceof z.ZodError) {
return res.status(400).json({ message: “Invalid meal plan data”, errors: error.errors });
}
res.status(500).json({ message: “Failed to create meal plan” });
}
});

app.get(”/api/meal-plans/:id”, async (req, res) => {
try {
const mealPlan = await storage.getMealPlan(req.params.id);

```
if (!mealPlan) {
  return res.status(404).json({ message: "Meal plan not found" });
}

res.json(mealPlan);
```

} catch (error) {
res.status(500).json({ message: “Failed to fetch meal plan” });
}
});

app.get(”/api/users/:id/meal-plans”, async (req, res) => {
try {
const userId = req.params.id;
const mealPlans = await storage.getUserMealPlans(userId);

```
res.json({
  mealPlans,
  total: mealPlans.length
});
```

} catch (error) {
res.status(500).json({ message: “Failed to fetch meal plans” });
}
});

app.post(”/api/meal-plans/:id/entries”, async (req, res) => {
try {
const planId = req.params.id;
const entrySchema = z.object({
recipeId: z.string().optional(),
date: z.string().transform(str => new Date(str)),
mealType: z.enum([“breakfast”, “lunch”, “dinner”, “snack”]),
servings: z.number().min(0.1).max(20).default(1),
customName: z.string().optional(),
customCalories: z.number().min(0).optional()
});

```
const entryData = entrySchema.parse(req.body);
const entry = await storage.addMealPlanEntry(planId, entryData);

res.status(201).json({
  message: "Meal plan entry added",
  entry
});
```

} catch (error) {
if (error instanceof z.ZodError) {
return res.status(400).json({ message: “Invalid entry data”, errors: error.errors });
}
res.status(500).json({ message: “Failed to add meal plan entry” });
}
});

// ===== PANTRY RECIPE SUGGESTIONS API ROUTES =====

app.get(”/api/users/:id/pantry/recipe-suggestions”, async (req, res) => {
try {
const userId = req.params.id;
const optionsSchema = z.object({
requireAllIngredients: z.coerce.boolean().default(false),
maxMissingIngredients: z.coerce.number().min(0).max(10).default(3),
includeExpiringSoon: z.coerce.boolean().default(true),
limit: z.coerce.number().min(1).max(50).default(20)
});

```
const options = optionsSchema.parse(req.query);
const suggestions = await storage.getRecipesFromPantryItems(userId, options);

res.json({
  suggestions,
  options,
  total: suggestions.length,
  message: suggestions.length === 0 ? "No recipes found. Try adding more ingredients to your pantry." : undefined
});
```

} catch (error) {
if (error instanceof z.ZodError) {
return res.status(400).json({ message: “Invalid parameters”, errors: error.errors });
}
res.status(500).json({ message: “Failed to get recipe suggestions” });
}
});

app.get(”/api/recipes/:id/shopping-analysis/:userId”, async (req, res) => {
try {
const recipeId = req.params.id;
const userId = req.params.userId;

```
const analysis = await storage.getSuggestedIngredientsForRecipe(recipeId, userId);

res.json({
  ...analysis,
  summary: {
    totalIngredients: analysis.recipe.ingredients?.length || 0,
    missingCount: analysis.missingIngredients.length,
    canMakeWithSubstitutions: analysis.suggestedSubstitutions.length > 0,
    availableInMarketplace: analysis.availableInMarketplace.length > 0
  }
});
```

} catch (error) {
res.status(500).json({ message: “Failed to analyze recipe requirements” });
}
});

app.get(”/api/ingredients/:ingredient/substitutions”, async (req, res) => {
try {
const ingredient = decodeURIComponent(req.params.ingredient);
const substitutions = await storage.getIngredientSubstitutions(ingredient);

```
res.json({
  ingredient,
  substitutions,
  total: substitutions.length,
  categories: [...new Set(substitutions.map(sub => sub.category).filter(Boolean))]
});
```

} catch (error) {
res.status(500).json({ message: “Failed to get ingredient substitutions” });
}
});

app.get(”/api/ingredients/substitutions/search”, async (req, res) => {
try {
const query = req.query.q as string;

```
if (!query || query.length < 2) {
  return res.status(400).json({ message: "Search query must be at least 2 characters long" });
}

const results = await storage.searchSubstitutions(query);

res.json({
  query,
  results,
  total: results.length
});
```

} catch (error) {
res.status(500).json({ message: “Failed to search substitutions” });
}
});

app.post(”/api/ingredients/substitutions”, async (req, res) => {
try {
const substitutionSchema = z.object({
originalIngredient: z.string().min(1, “Original ingredient required”),
substituteIngredient: z.string().min(1, “Substitute ingredient required”),
ratio: z.string().min(1, “Ratio required”),
notes: z.string().optional(),
category: z.string().optional()
});

```
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
  substitution
});
```

} catch (error) {
if (error instanceof z.ZodError) {
return res.status(400).json({ message: “Invalid substitution data”, errors: error.errors });
}
res.status(500).json({ message: “Failed to add ingredient substitution” });
}
});
  const httpServer = createServer(app);
  return httpServer;
}
