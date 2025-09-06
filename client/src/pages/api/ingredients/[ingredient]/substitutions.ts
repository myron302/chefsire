import { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ingredient } = req.query;

  // Mock substitution data with nutrition
  const substitutions = [
    {
      substituteIngredient: "Olive Oil",
      ratio: "1 cup butter = 3/4 cup olive oil",
      category: "oils",
      notes: "Best for sautéing and baking, adds a mild fruity flavor.",
      nutrition: {
        original: { calories: 102, fat: 12, carbs: 0, protein: 0 },
        substitute: { calories: 119, fat: 14, carbs: 0, protein: 0 }
      }
    },
    {
      substituteIngredient: "Coconut Oil",
      ratio: "1 cup butter = 1 cup coconut oil",
      category: "oils",
      notes: "Solid at room temperature, adds a light coconut flavor.",
      nutrition: {
        original: { calories: 102, fat: 12, carbs: 0, protein: 0 },
        substitute: { calories: 117, fat: 14, carbs: 0, protein: 0 }
      }
    }
  ];

  res.status(200).json({
    ingredient,
    substitutions
  });
}
