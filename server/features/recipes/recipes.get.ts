import { Request, Response } from "express";
import { storage } from "../../storage";

export async function getRecipes(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Cap the limit at 50 to avoid performance issues
    const cappedLimit = Math.min(limit, 50);
    
    const recipes = await storage.getRecipes(cappedLimit, offset);
    
    res.json({
      recipes,
      total: recipes.length,
      limit: cappedLimit,
      offset
    });
  } catch (error) {
    console.error("Error fetching recipes:", error);
    res.status(500).json({ 
      message: "Failed to fetch recipes",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}