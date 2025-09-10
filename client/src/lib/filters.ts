export const CUISINES = [
  // Africa
  "Ethiopian", "Eritrean", "Somali", "Kenyan", "Tanzanian", "Ugandan",
  "Nigerian", "Ghanaian", "Ivorian", "Senegalese", "Cameroonian",
  "Moroccan", "Algerian", "Tunisian", "Egyptian", "South African",
  // Middle East / SW Asia
  "Levantine", "Palestinian", "Lebanese", "Syrian", "Jordanian",
  "Israeli", "Turkish", "Kurdish", "Armenian", "Georgian", "Persian (Iranian)",
  "Gulf (Khaleeji)", "Yemeni",
  // South Asia
  "North Indian (Punjabi)", "South Indian (Tamil)", "Gujarati", "Rajasthani",
  "Bengali", "Hyderabadi", "Goan", "Maharashtrian", "Kashmiri", "Sri Lankan",
  "Pakistani", "Bangladeshi", "Nepali",
  // East / SE Asia
  "Chinese (Cantonese)", "Chinese (Sichuan)", "Chinese (Hunan)", "Chinese (Shandong)",
  "Taiwanese", "Japanese", "Korean", "Mongolian",
  "Thai", "Vietnamese", "Filipino", "Malaysian", "Indonesian", "Singaporean",
  // Central Asia
  "Uzbek", "Kazakh", "Uighur",
  // Europe
  "Italian", "Sicilian", "French", "Spanish", "Basque", "Catalan", "Portuguese",
  "Greek", "Balkan", "Romanian", "Bulgarian", "Hungarian", "Polish", "Czech", "Slovak",
  "German", "Austrian", "Swiss", "Dutch", "Belgian", "British", "Scottish", "Irish",
  "Scandinavian", "Finnish", "Russian", "Ukrainian",
  // Americas
  "American", "Southern / Soul Food", "Cajun", "Creole", "Tex-Mex", "New Mexican",
  "Pacific Northwest", "Californian", "Hawaiian", "Alaskan",
  "Mexican", "Yucatecan", "Oaxacan", "Baja",
  "Caribbean", "Jamaican", "Cuban", "Puerto Rican", "Dominican",
  "Peruvian", "Brazilian", "Argentinian", "Chilean", "Colombian", "Venezuelan",
  // Broad
  "Mediterranean", "North African", "Middle Eastern", "Pan-Asian", "Fusion",
]
  .sort() // Sort alphabetically
  .map((c) => ({ label: c, value: c }));

export const DIETS = [
  // Popular
  "Vegetarian", "Vegan", "Pescatarian", "Keto", "Paleo", "Mediterranean", "Whole30", "Flexitarian",
  "High-Protein", "High-Fiber", "Low-Carb", "Low-Fat", "Low-Calorie",
  // Health-focused
  "Diabetic-Friendly", "Heart-Healthy", "Low-Sodium", "Low-Sugar", "Low-FODMAP",
  // Allergens / restrictions
  "Gluten-Free", "Lactose-Free", "Dairy-Free", "Egg-Free", "Nut-Free", "Soy-Free", "Shellfish-Free",
  // Religious
  "Halal", "Kosher",
].map((d) => ({ label: d, value: d }));

export const POPULAR_DIET_CHIPS = [
  "Keto", "Vegetarian", "Vegan", "High-Protein", "High-Fiber", "Diabetic-Friendly", "Gluten-Free",
] as const;

export const COURSES = [
  "Breakfast", "Brunch", "Lunch", "Dinner", "Snack", "Dessert", "Baking", "Drink",
  "Appetizer", "Side", "Soup", "Salad", "Main", "Sauce", "Marinade", "Condiment",
].map((c) => ({ label: c, value: c }));

export const DIFFICULTIES = ["Easy", "Medium", "Hard"].map((x) => ({ label: x, value: x }));

export const ALLERGENS = [
  "Gluten", "Dairy", "Eggs", "Peanuts", "Tree Nuts", "Soy", "Fish", "Shellfish", "Sesame", "Mustard",
].map((a) => ({ label: a, value: a }));
