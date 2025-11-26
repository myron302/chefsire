// server/routes/drinks.ts
import { Router } from "express";
import { listMeta, lookupDrink, randomDrink, searchDrinks } from "../services/drinks-service";
import { storage } from "../storage";
import {
  insertCustomDrinkSchema,
  insertDrinkPhotoSchema,
  insertDrinkLikeSchema,
  insertDrinkSaveSchema
} from "@shared/schema";
import { z } from "zod";
import { notificationService } from "../services/notification.service";

const r = Router();

// Simple mock auth middleware (replace with real auth)
const authenticateUser = (req: any, _res: any, next: any) => {
  req.user = { id: "user-123" };
  next();
};

// Helper to coerce query values into strings
function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

// ========================================
// CUSTOM DRINKS API ROUTES (NEW)
// ========================================

// Get user's custom drinks
r.get("/custom-drinks/user/:userId", authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    const { category } = req.query;
    
    const drinks = await storage.getUserCustomDrinks(
      userId, 
      category as string | undefined
    );
    res.json({ ok: true, drinks });
  } catch (error: any) {
    console.error("Error fetching user drinks:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch custom drinks" });
  }
});

// Get single custom drink
r.get("/custom-drinks/:id", async (req, res) => {
  try {
    const drink = await storage.getCustomDrinkWithUser(req.params.id);
    if (!drink) {
      return res.status(404).json({ ok: false, error: "Drink not found" });
    }
    res.json({ ok: true, drink });
  } catch (error: any) {
    console.error("Error fetching drink:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch drink" });
  }
});

// Get public/community drinks
r.get("/custom-drinks/public", async (req, res) => {
  try {
    const { category, limit } = req.query;
    const drinks = await storage.getPublicCustomDrinks(
      category as string | undefined,
      limit ? parseInt(limit as string) : undefined
    );
    res.json({ ok: true, drinks });
  } catch (error: any) {
    console.error("Error fetching public drinks:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch public drinks" });
  }
});

// Create custom drink
r.post("/custom-drinks", authenticateUser, async (req, res) => {
  try {
    const drinkData = insertCustomDrinkSchema.parse({
      ...req.body,
      userId: req.user.id,
    });

    const drink = await storage.createCustomDrink(drinkData);

    // Track quest progress for drink creation
    const { trackQuestProgress } = await import("../services/quests.service");
    trackQuestProgress(req.user.id, "create_drink", {
      category: drink.category,
      drinkType: drink.drinkType,
    }).catch(err => console.error("Failed to track quest progress:", err));

    // Trigger achievement check
    const { checkAndAwardAchievements } = await import("../routes/achievements");
    checkAndAwardAchievements(req.user.id).catch(err =>
      console.error("Failed to check achievements:", err)
    );

    // Notify followers about the new custom drink
    const user = await storage.getUser(req.user.id);
    if (user) {
      notificationService.notifyFollowersOfActivity(
        req.user.id,
        "custom_drink",
        {
          title: `${user.username} created a new drink!`,
          message: `${drink.name} - ${drink.description || "Try this delicious drink"}`,
          imageUrl: drink.imageUrl || undefined,
          linkUrl: `/drinks/${drink.id}`,
          metadata: {
            drinkId: drink.id,
            category: drink.category,
            isPublic: drink.isPublic,
          },
        }
      ).catch(err => console.error("Failed to notify followers:", err));
    }

    res.status(201).json({ ok: true, drink });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        ok: false,
        error: "Invalid drink data",
        details: error.errors
      });
    }
    console.error("Error creating drink:", error);
    res.status(500).json({ ok: false, error: "Failed to create custom drink" });
  }
});

// Update custom drink
r.patch("/custom-drinks/:id", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const existing = await storage.getCustomDrink(id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Drink not found" });
    }
    if (existing.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }
    
    const updated = await storage.updateCustomDrink(id, req.body);
    res.json({ ok: true, drink: updated });
  } catch (error: any) {
    console.error("Error updating drink:", error);
    res.status(500).json({ ok: false, error: "Failed to update drink" });
  }
});

// Delete custom drink
r.delete("/custom-drinks/:id", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const existing = await storage.getCustomDrink(id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Drink not found" });
    }
    if (existing.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }
    
    const success = await storage.deleteCustomDrink(id);
    if (success) {
      res.json({ ok: true, message: "Drink deleted successfully" });
    } else {
      res.status(500).json({ ok: false, error: "Failed to delete drink" });
    }
  } catch (error: any) {
    console.error("Error deleting drink:", error);
    res.status(500).json({ ok: false, error: "Failed to delete drink" });
  }
});

// ========================================
// DRINK PHOTOS
// ========================================

// Upload drink photo
r.post("/custom-drinks/:id/photo", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify drink exists and user owns it
    const drink = await storage.getCustomDrink(id);
    if (!drink) {
      return res.status(404).json({ ok: false, error: "Drink not found" });
    }
    if (drink.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }
    
    const photoData = insertDrinkPhotoSchema.parse({
      drinkId: id,
      userId: req.user.id,
      imageUrl: req.body.imageUrl,
      caption: req.body.caption,
    });
    
    const photo = await storage.createDrinkPhoto(photoData);
    
    // Also update the drink's imageUrl if it doesn't have one
    if (!drink.imageUrl) {
      await storage.updateCustomDrink(id, { imageUrl: photo.imageUrl });
    }
    
    res.status(201).json({ ok: true, photo });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        ok: false,
        error: "Invalid photo data", 
        details: error.errors 
      });
    }
    console.error("Error uploading photo:", error);
    res.status(500).json({ ok: false, error: "Failed to upload photo" });
  }
});

// Get drink photos
r.get("/custom-drinks/:id/photos", async (req, res) => {
  try {
    const photos = await storage.getDrinkPhotos(req.params.id);
    res.json({ ok: true, photos });
  } catch (error: any) {
    console.error("Error fetching photos:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch photos" });
  }
});

// Delete drink photo
r.delete("/drink-photos/:id", authenticateUser, async (req, res) => {
  try {
    const success = await storage.deleteDrinkPhoto(req.params.id);
    if (success) {
      res.json({ ok: true, message: "Photo deleted successfully" });
    } else {
      res.status(404).json({ ok: false, error: "Photo not found" });
    }
  } catch (error: any) {
    console.error("Error deleting photo:", error);
    res.status(500).json({ ok: false, error: "Failed to delete photo" });
  }
});

// ========================================
// DRINK LIKES
// ========================================

// Like a drink
r.post("/custom-drinks/:id/like", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const like = await storage.likeDrink(req.user.id, id);
    res.status(201).json({ ok: true, like });
  } catch (error: any) {
    console.error("Error liking drink:", error);
    res.status(500).json({ ok: false, error: "Failed to like drink" });
  }
});

// Unlike a drink
r.delete("/custom-drinks/:id/like", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.unlikeDrink(req.user.id, id);
    if (success) {
      res.json({ ok: true, message: "Drink unliked" });
    } else {
      res.status(404).json({ ok: false, error: "Like not found" });
    }
  } catch (error: any) {
    console.error("Error unliking drink:", error);
    res.status(500).json({ ok: false, error: "Failed to unlike drink" });
  }
});

// Check if drink is liked
r.get("/custom-drinks/:id/liked", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const isLiked = await storage.isDrinkLiked(req.user.id, id);
    res.json({ ok: true, isLiked });
  } catch (error: any) {
    console.error("Error checking like status:", error);
    res.status(500).json({ ok: false, error: "Failed to check like status" });
  }
});

// ========================================
// DRINK SAVES/FAVORITES
// ========================================

// Save a drink
r.post("/custom-drinks/:id/save", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const save = await storage.saveDrink(req.user.id, id);
    res.status(201).json({ ok: true, save });
  } catch (error: any) {
    console.error("Error saving drink:", error);
    res.status(500).json({ ok: false, error: "Failed to save drink" });
  }
});

// Unsave a drink
r.delete("/custom-drinks/:id/save", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.unsaveDrink(req.user.id, id);
    if (success) {
      res.json({ ok: true, message: "Drink unsaved" });
    } else {
      res.status(404).json({ ok: false, error: "Save not found" });
    }
  } catch (error: any) {
    console.error("Error unsaving drink:", error);
    res.status(500).json({ ok: false, error: "Failed to unsave drink" });
  }
});

// Check if drink is saved
r.get("/custom-drinks/:id/saved", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const isSaved = await storage.isDrinkSaved(req.user.id, id);
    res.json({ ok: true, isSaved });
  } catch (error: any) {
    console.error("Error checking save status:", error);
    res.status(500).json({ ok: false, error: "Failed to check save status" });
  }
});

// Get user's saved drinks
r.get("/custom-drinks/saved/:userId", authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    const { category } = req.query;
    const drinks = await storage.getUserSavedDrinks(
      userId,
      category as string | undefined
    );
    res.json({ ok: true, drinks });
  } catch (error: any) {
    console.error("Error fetching saved drinks:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch saved drinks" });
  }
});

// ========================================
// USER DRINK STATS
// ========================================

// Get user stats
r.get("/user-drink-stats/:userId", async (req, res) => {
  try {
    const stats = await storage.getUserDrinkStats(req.params.userId);
    res.json({ ok: true, stats });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch stats" });
  }
});

// Update user stats
r.patch("/user-drink-stats/:userId", authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }
    
    const updated = await storage.updateUserDrinkStats(userId, req.body);
    res.json({ ok: true, stats: updated });
  } catch (error: any) {
    console.error("Error updating stats:", error);
    res.status(500).json({ ok: false, error: "Failed to update stats" });
  }
});

// Award badge to user
r.post("/user-drink-stats/:userId/badge", authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    const { badge } = req.body;
    
    if (!badge) {
      return res.status(400).json({ ok: false, error: "Badge name required" });
    }
    
    await storage.addBadge(userId, badge);
    res.json({ ok: true, message: "Badge awarded" });
  } catch (error: any) {
    console.error("Error awarding badge:", error);
    res.status(500).json({ ok: false, error: "Failed to award badge" });
  }
});

export default r;
