export interface IngredientSubstitution {
  ingredient: string;
  amount: string;
  substitutes: Array<{
    substitute: string;
    amount: string;
    note?: string;
  }>;
}

export const ingredientSubstitutions: IngredientSubstitution[] = [
  {
    ingredient: "Allspice",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "1/2 tsp. cinnamon and 1/2 tsp. ground cloves", amount: "1/2 tsp. + 1/2 tsp." }
    ]
  },
  // ... (include all the ingredient data I provided earlier)
  // I'll keep this shortened for brevity, but use the full list from my previous response
];

// Create a searchable index for autocomplete
export const createSearchableIngredients = () => {
  const ingredients = new Set<string>();
  
  ingredientSubstitutions.forEach(item => {
    ingredients.add(item.ingredient.toLowerCase());
    item.substitutes.forEach(sub => {
      const words = sub.substitute.toLowerCase().split(/[,\s]+/);
      words.forEach(word => {
        if (word.length > 2 && !word.match(/^\d/) && !word.match(/^(tsp|tbsp|cup|oz|lb|and|plus|minus)$/)) {
          ingredients.add(word);
        }
      });
    });
  });
  
  return Array.from(ingredients).sort();
};

export const searchIngredientSubstitutions = (query: string): IngredientSubstitution[] => {
  if (!query.trim()) return [];
  
  const searchTerm = query.toLowerCase();
  return ingredientSubstitutions.filter(item => 
    item.ingredient.toLowerCase().includes(searchTerm) ||
    item.substitutes.some(sub => 
      sub.substitute.toLowerCase().includes(searchTerm)
    )
  );
};
