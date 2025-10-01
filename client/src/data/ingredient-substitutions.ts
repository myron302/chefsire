// Comprehensive database based on FoodSubs.com
export interface Substitute {
  id: string;
  name: string;
  ratio: string;
  notes: string;
  category: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  description: string;
  substitutes: Substitute[];
}

export const ingredientDatabase: Ingredient[] = [
  // Baking Ingredients
  {
    id: "bak-1",
    name: "All-Purpose Flour",
    category: "Baking Ingredients",
    description: "Standard wheat flour used in most baking recipes",
    substitutes: [
      {
        id: "sub-1-1",
        name: "Bread Flour",
        ratio: "1:1",
        notes: "Higher protein content, creates chewier texture",
        category: "Flours"
      },
      {
        id: "sub-1-2",
        name: "Cake Flour",
        ratio: "1 cup cake flour + 2 tbsp cornstarch = 1 cup AP flour",
        notes: "Lower protein, creates tender baked goods",
        category: "Flours"
      },
      {
        id: "sub-1-3",
        name: "Pastry Flour",
        ratio: "1:1",
        notes: "Medium protein content, good for pie crusts and pastries",
        category: "Flours"
      }
    ]
  },
  {
    id: "bak-2",
    name: "Butter",
    category: "Baking Ingredients",
    description: "Dairy fat used for baking and cooking",
    substitutes: [
      {
        id: "sub-2-1",
        name: "Margarine",
        ratio: "1:1",
        notes: "Best for baking, may alter flavor slightly",
        category: "Dairy Substitutes"
      },
      {
        id: "sub-2-2",
        name: "Coconut Oil",
        ratio: "1:1",
        notes: "Solid at room temp, good for vegan options",
        category: "Plant-Based Fats"
      },
      {
        id: "sub-2-3",
        name: "Applesauce",
        ratio: "1:1",
        notes: "Reduces calories, works well in cakes and muffins",
        category: "Fruit-Based Substitutes"
      }
    ]
  },
  {
    id: "bak-3",
    name: "Sugar",
    category: "Baking Ingredients",
    description: "Common sweetener used in baking and cooking",
    substitutes: [
      {
        id: "sub-3-1",
        name: "Honey",
        ratio: "3/4 cup = 1 cup sugar",
        notes: "Reduce liquid in recipe by 1/4 cup",
        category: "Natural Sweeteners"
      },
      {
        id: "sub-3-2",
        name: "Maple Syrup",
        ratio: "3/4 cup = 1 cup sugar",
        notes: "Reduce liquid by 3 tbsp per cup",
        category: "Natural Sweeteners"
      },
      {
        id: "sub-3-3",
        name: "Stevia",
        ratio: "1 tsp = 1 cup sugar",
        notes: "Highly concentrated, adjust to taste",
        category: "Artificial Sweeteners"
      }
    ]
  },
  {
    id: "bak-4",
    name: "Eggs",
    category: "Baking Ingredients",
    description: "Binding and leavening agent in baking",
    substitutes: [
      {
        id: "sub-4-1",
        name: "Flaxseed Meal",
        ratio: "1 tbsp + 3 tbsp water = 1 egg",
        notes: "Best for binding in baked goods",
        category: "Plant-Based Binders"
      },
      {
        id: "sub-4-2",
        name: "Applesauce",
        ratio: "1/4 cup = 1 egg",
        notes: "Adds moisture, works well in cakes",
        category: "Fruit-Based Substitutes"
      },
      {
        id: "sub-4-3",
        name: "Commercial Egg Replacer",
        ratio: "Follow package instructions",
        notes: "Designed specifically for egg replacement",
        category: "Commercial Substitutes"
      }
    ]
  },

  // Dairy Products
  {
    id: "dai-1",
    name: "Milk",
    category: "Dairy Products",
    description: "Cow's milk used in cooking and drinking",
    substitutes: [
      {
        id: "sub-5-1",
        name: "Almond Milk",
        ratio: "1:1",
        notes: "Unsweetened works best for savory dishes",
        category: "Nut Milks"
      },
      {
        id: "sub-5-2",
        name: "Oat Milk",
        ratio: "1:1",
        notes: "Creamy texture, good for coffee and baking",
        category: "Grain Milks"
      },
      {
        id: "sub-5-3",
        name: "Soy Milk",
        ratio: "1:1",
        notes: "High protein content, closest to dairy milk",
        category: "Legume Milks"
      }
    ]
  },
  {
    id: "dai-2",
    name: "Heavy Cream",
    category: "Dairy Products",
    description: "High-fat dairy product used for whipping and cooking",
    substitutes: [
      {
        id: "sub-6-1",
        name: "Coconut Cream",
        ratio: "1:1",
        notes: "Chill can overnight and use thick layer on top",
        category: "Plant-Based Creams"
      },
      {
        id: "sub-6-2",
        name: "Greek Yogurt",
        ratio: "1:1",
        notes: "Best for cooking, not whipping",
        category: "Dairy Alternatives"
      },
      {
        id: "sub-6-3",
        name: "Evaporated Milk",
        ratio: "1:1",
        notes: "Dairy-based, good for cooking but won't whip",
        category: "Concentrated Dairy"
      }
    ]
  },

  // Grains & Starches
  {
    id: "gra-1",
    name: "Rice",
    category: "Grains & Starches",
    description: "Staple grain used worldwide",
    substitutes: [
      {
        id: "sub-7-1",
        name: "Quinoa",
        ratio: "1:1",
        notes: "Higher protein content, cooks faster",
        category: "Pseudo-Grains"
      },
      {
        id: "sub-7-2",
        name: "Couscous",
        ratio: "1:1",
        notes: "Wheat-based, cooks in 5 minutes",
        category: "Wheat Products"
      },
      {
        id: "sub-7-3",
        name: "Bulgur Wheat",
        ratio: "1:1",
        notes: "Pre-cooked wheat, nuttier flavor",
        category: "Wheat Products"
      }
    ]
  },
  {
    id: "gra-2",
    name: "Pasta",
    category: "Grains & Starches",
    description: "Italian noodles made from wheat",
    substitutes: [
      {
        id: "sub-8-1",
        name: "Zucchini Noodles",
        ratio: "1:1 by volume",
        notes: "Low-carb alternative, best when raw or lightly cooked",
        category: "Vegetable Noodles"
      },
      {
        id: "sub-8-2",
        name: "Spaghetti Squash",
        ratio: "1:1 by volume",
        notes: "Roast squash and scrape out strands",
        category: "Vegetable Noodles"
      },
      {
        id: "sub-8-3",
        name: "Shirataki Noodles",
        ratio: "1:1",
        notes: "Zero-carb, made from konjac root",
        category: "Specialty Noodles"
      }
    ]
  },

  // Herbs & Spices
  {
    id: "her-1",
    name: "Fresh Basil",
    category: "Herbs & Spices",
    description: "Aromatic herb used in Italian and Thai cooking",
    substitutes: [
      {
        id: "sub-9-1",
        name: "Dried Basil",
        ratio: "1 tbsp fresh = 1 tsp dried",
        notes: "More concentrated flavor, add early in cooking",
        category: "Dried Herbs"
      },
      {
        id: "sub-9-2",
        name: "Oregano",
        ratio: "1:1",
        notes: "Mediterranean flavor, stronger than basil",
        category: "Mediterranean Herbs"
      },
      {
        id: "sub-9-3",
        name: "Parsley",
        ratio: "1:1",
        notes: "Milder flavor, good for garnish",
        category: "Fresh Herbs"
      }
    ]
  },

  // Oils & Fats
  {
    id: "oil-1",
    name: "Olive Oil",
    category: "Oils & Fats",
    description: "Mediterranean oil used for cooking and dressings",
    substitutes: [
      {
        id: "sub-10-1",
        name: "Avocado Oil",
        ratio: "1:1",
        notes: "High smoke point, neutral flavor",
        category: "Fruit Oils"
      },
      {
        id: "sub-10-2",
        name: "Grapeseed Oil",
        ratio: "1:1",
        notes: "Neutral flavor, high smoke point",
        category: "Seed Oils"
      },
      {
        id: "sub-10-3",
        name: "Coconut Oil",
        ratio: "1:1",
        notes: "Solid at room temp, adds coconut flavor",
        category: "Tropical Oils"
      }
    ]
  },

  // Condiments & Sauces
  {
    id: "con-1",
    name: "Soy Sauce",
    category: "Condiments & Sauces",
    description: "Salty fermented sauce used in Asian cooking",
    substitutes: [
      {
        id: "sub-11-1",
        name: "Tamari",
        ratio: "1:1",
        notes: "Gluten-free soy sauce, similar flavor",
        category: "Gluten-Free Sauces"
      },
      {
        id: "sub-11-2",
        name: "Coconut Aminos",
        ratio: "1:1",
        notes: "Sweeter, lower sodium alternative",
        category: "Plant-Based Sauces"
      },
      {
        id: "sub-11-3",
        name: "Worcestershire Sauce",
        ratio: "1:1",
        notes: "Similar umami flavor, contains anchovies",
        category: "British Condiments"
      }
    ]
  },

  // Special Dietary Needs
  {
    id: "spe-1",
    name: "Gluten",
    category: "Special Dietary Needs",
    description: "Protein found in wheat, barley, and rye",
    substitutes: [
      {
        id: "sub-12-1",
        name: "Xanthan Gum",
        ratio: "1 tsp per cup of flour",
        notes: "Improves texture in gluten-free baking",
        category: "Gluten-Free Binders"
      },
      {
        id: "sub-12-2",
        name: "Psyllium Husk",
        ratio: "1/2 tsp per cup of flour",
        notes: "Adds fiber and binding properties",
        category: "Fiber Supplements"
      },
      {
        id: "sub-12-3",
        name: "Guar Gum",
        ratio: "1/4 tsp per cup of flour",
        notes: "Thickening agent, use less than xanthan gum",
        category: "Gluten-Free Binders"
      }
    ]
  }
];

// Improved search function
export const searchIngredients = (query: string): Ingredient[] => {
  if (!query.trim()) return [];
  
  const lowerQuery = query.toLowerCase().trim();
  
  return ingredientDatabase.filter(ingredient => {
    // Check ingredient name, category, and description
    if (
      ingredient.name.toLowerCase().includes(lowerQuery) ||
      ingredient.category.toLowerCase().includes(lowerQuery) ||
      ingredient.description.toLowerCase().includes(lowerQuery)
    ) {
      return true;
    }
    
    // Check substitutes
    return ingredient.substitutes.some(sub => 
      sub.name.toLowerCase().includes(lowerQuery) ||
      sub.notes.toLowerCase().includes(lowerQuery) ||
      sub.category.toLowerCase().includes(lowerQuery)
    );
  });
};
