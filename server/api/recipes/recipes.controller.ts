import { Request, Response } from "express";
import { fetchRecipes } from "../../features/recipes/recipes.service";

export async function POST(req: Request, res: Response) {
  try {
    console.log("Starting recipe fetch…");
    const result = await fetchRecipes();

    res.status(200).json({
      message: "Recipes fetched successfully",
      ...result
    });

  } catch (error) {
    console.error("Error in fetch recipes API:", error);
    res.status(500).json({
      error: "Failed to fetch recipes",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// If your framework uses different export patterns, also export as default:
export default async function handler(req: Request, res: Response) {
  if (req.method === "POST") {
    return POST(req, res);
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
