import { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { q } = req.query;

  // Mock AI-generated substitution data
  const aiSubstitutions = [
    {
      substituteIngredient: "Greek Yogurt",
      ratio: "1 cup sour cream = 1 cup Greek yogurt",
      category: "dairy",
      notes: "Adds tangy flavor with higher protein, lower fat.",
      nutrition: {
        original: { calories: 193, fat: 20, carbs: 5, protein: 2 },
        substitute: { calories: 100, fat: 0, carbs: 6, protein: 17 }
      }
    }
  ];

  res.status(200).json({
    query: q,
    substitutions: aiSubstitutions
  });
}
