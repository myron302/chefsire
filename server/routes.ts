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

  const httpServer = createServer(app);
  return httpServer;
}
