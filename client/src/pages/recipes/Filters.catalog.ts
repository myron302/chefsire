// client/src/pages/recipes/filters.catalog.ts

/** Core simple pickers */
export const CUISINES = [
  "American", "BBQ", "Breakfast", "Burgers", "Californian", "Desserts", "Healthy",
  "Italian", "Mediterranean", "Mexican", "Salads", "Seafood", "Sicilian",
  "Tex-Mex", "Asian", "Thai", "Vietnamese", "Filipino", "Japanese", "Korean",
  "Chinese", "Indian", "Pakistani", "Bangladeshi", "Sri Lankan",
  "Greek", "French", "Spanish", "Portuguese",
  "Caribbean", "Jamaican", "Cuban", "Puerto Rican", "Dominican",
  "Peruvian", "Brazilian", "Argentinian", "Chilean", "Colombian", "Venezuelan",
  "Hawaiian", "Pacific Northwest", "Alaskan",
].sort();

export const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"] as const;

export const DIETARY = [
  // Popular
  "Vegetarian", "Vegan", "Pescatarian", "Keto", "Paleo", "Mediterranean", "Whole30",
  "Flexitarian", "High-Protein", "High-Fiber", "Low-Carb", "Low-Fat", "Low-Calorie",
  // Health-focused
  "Diabetic-Friendly", "Heart-Healthy", "Low-Sodium", "Low-Sugar", "Low-FODMAP",
  // Allergens / restrictions
  "Gluten-Free", "Lactose-Free", "Dairy-Free", "Egg-Free", "Nut-Free", "Soy-Free", "Shellfish-Free",
  // Religious
  "Halal", "Kosher",
];

export const DIFFICULTY = ["Easy", "Medium", "Hard"] as const;

export const ALLERGENS = [
  "Gluten", "Dairy", "Eggs", "Peanuts", "Tree Nuts", "Soy", "Fish", "Shellfish", "Sesame", "Mustard",
];

/** Ethnicities by region (grouped + alphabetized within each group) */
export const ETHNICITY_REGIONS: Record<string, string[]> = {
  "Africa": [
    "Cameroonian","Egyptian","Eritrean","Ethiopian","Ghanaian","Ivorian","Kenyan","Moroccan",
    "Nigerian","Senegalese","Somali","South African","Tanzanian","Tunisian","Ugandan",
    "West African","East African","Central African","Southern African","North African",
  ].sort(),
  "Middle East & SW Asia": [
    "Armenian","Georgian","Gulf (Khaleeji)","Iranian (Persian)","Israeli","Jordanian","Kurdish",
    "Lebanese","Levantine","Palestinian","Syrian","Turkish","Yemeni",
  ].sort(),
  "South Asia": [
    "Bangladeshi","Goan","Gujarati","Hyderabadi","Kashmiri","Maharashtrian","Nepali",
    "North Indian (Punjabi)","Pakistani","Rajasthani","South Indian (Tamil)","Sri Lankan",
  ].sort(),
  "East & Southeast Asia": [
    "Burmese/Myanmar","Cambodian (Khmer)","Chinese (Cantonese)","Chinese (Hunan)","Chinese (Shandong)",
    "Chinese (Sichuan)","Filipino","Indonesian","Japanese","Korean","Lao","Malaysian","Mongolian",
    "Singaporean","Taiwanese","Thai","Vietnamese",
  ].sort(),
  "Central Asia": ["Kazakh","Uighur","Uzbek"].sort(),
  "Europe": [
    "Austrian","Basque","Belgian","Balkan","British","Bulgarian","Catalan","Czech","Dutch","Finnish",
    "French","German","Greek","Hungarian","Irish","Italian","Polish","Portuguese","Romanian",
    "Russian","Scottish","Scandinavian","Sicilian","Slovak","Spanish","Swiss","Ukrainian",
  ].sort(),
  "Americas": [
    "American","Alaskan","Californian","Cajun","Creole","Hawaiian","Pacific Northwest","Southern / Soul Food",
    "Argentinian","Brazilian","Chilean","Colombian","Mexican","New Mexican","Oaxacan","Peruvian",
    "Puerto Rican","Dominican","Cuban","Jamaican","Yucatecan","Baja","Tex-Mex","Caribbean","Pacific Islander",
  ].sort(),
  "Indigenous & Jewish": [
    "Indigenous / First Nations / Native American",
    "Ashkenazi Jewish","Sephardi Jewish","Mizrahi Jewish",
  ].sort(),
  "Other / Fusion": ["Fusion/Contemporary","Pan-Asian","Mediterranean"].sort(),
};

/** Flattened ethnicity list for components that need one array */
export const ETHNICITIES = Object.values(ETHNICITY_REGIONS)
  .flat()
  .filter((v, i, a) => a.indexOf(v) === i)
  .sort();
