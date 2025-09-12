import * as React from "react";

// Spoon icon (swap for your knife+spoon SVG later)
export function Spoon({ dim = 18, faded = false }: { dim?: number; faded?: boolean }) {
  return (
    <span
      style={{ fontSize: dim, lineHeight: 1 }}
      className={faded ? "opacity-30" : ""}
      aria-hidden
    >
      🥄
    </span>
  );
}

export const SPOON_SCALE = [1, 2, 3, 4, 5] as const;

// Flat lists (alphabetical)
export const CUISINES = [
  "African","Alaskan","American","Argentinian","Austrian","Baja","Basque","Belgian","Brazilian","British","Bulgarian",
  "Californian","Caribbean","Catalan","Cajun","Central Asian","Chilean","Chinese (Cantonese)","Chinese (Hunan)","Chinese (Shandong)","Chinese (Sichuan)",
  "Colombian","Creole","Cuban","Czech","Dutch","Eastern European","Egyptian","Ethiopian","Finnish","French","Fusion","German","Greek","Haitian",
  "Hawaiian","Hungarian","Indonesian","Irish","Israeli","Italian","Jamaican","Japanese","Jordanian","Kazakh","Kenyan","Korean","Kurdish","Lebanese",
  "Malaysian","Mediterranean","Mexican","Middle Eastern","Moroccan","Nepali","New Mexican","North African","Oaxacan","Pakistani","Palestinian","Peruvian","Polish",
  "Portuguese","Puerto Rican","Romanian","Russian","Scottish","Senegalese","Sicilian","Singaporean","Somali","Spanish","Sri Lankan","Swiss","Taiwanese",
  "Tex-Mex","Thai","Tunisian","Turkish","Uighur","Ukrainian","Uzbek","Vietnamese","Yemeni","Yucatecan",
].sort();

export const MEAL_TYPES = ["Breakfast","Brunch","Lunch","Dinner","Snack","Dessert"] as const;
export const DIFFICULTY = ["Easy","Medium","Hard"] as const;

export const DIETARY_WITH_RELIGIOUS = [
  "Vegetarian","Vegan","Pescatarian","Keto","Paleo","Mediterranean","Whole30","Flexitarian",
  "High-Protein","High-Fiber","Low-Carb","Low-Fat","Low-Calorie","Diabetic-Friendly","Heart-Healthy",
  "Low-Sodium","Low-Sugar","Low-FODMAP",
  "Gluten-Free","Lactose-Free","Dairy-Free","Egg-Free","Nut-Free","Soy-Free","Shellfish-Free",
  "Halal","Kosher",
].sort();

export const ALLERGENS = [
  "Dairy","Eggs","Fish","Gluten","Mustard","Peanuts","Sesame","Shellfish","Soy","Tree Nuts",
].sort();

export const STANDARDS = ["Fair Trade","Free-Range","Non-GMO","Organic"] as const;

// Grouped Ethnicities (alphabetized within group)
export const ETHNICITY_REGIONS: Record<string, { label: string; items: string[] }> = {
  "Africa": {
    label: "Africa",
    items: [
      "Algerian","Cameroonian","Egyptian","Eritrean","Ethiopian","Ghanaian","Ivorian","Kenyan",
      "Moroccan","Nigerian","Senegalese","Somali","South African","Tanzanian","Tunisian","Ugandan",
    ].sort(),
  },
  "Middle East & SW Asia": {
    label: "Middle East & SW Asia",
    items: [
      "Armenian","Georgian","Gulf (Khaleeji)","Israeli","Jordanian","Kurdish","Lebanese","Palestinian",
      "Persian (Iranian)","Syrian","Turkish","Yemeni",
    ].sort(),
  },
  "South Asia": {
    label: "South Asia",
    items: [
      "Bangladeshi","Bengali","Goan","Gujarati","Hyderabadi","Kashmiri","Maharashtrian",
      "Nepali","North Indian (Punjabi)","Pakistani","Rajasthani","South Indian (Tamil)","Sri Lankan",
    ].sort(),
  },
  "East & Southeast Asia": {
    label: "East & Southeast Asia",
    items: [
      "Chinese (Cantonese)","Chinese (Hunan)","Chinese (Shandong)","Chinese (Sichuan)","Indonesian",
      "Japanese","Korean","Malaysian","Mongolian","Philippine/Filipino","Singaporean","Taiwanese","Thai","Vietnamese",
    ].sort(),
  },
  "Central Asia": {
    label: "Central Asia",
    items: ["Kazakh","Uighur","Uzbek"].sort(),
  },
  "Europe": {
    label: "Europe",
    items: [
      "Austrian","Balkan","Basque","Belgian","British","Bulgarian","Catalan","Czech","Dutch","Eastern European","Finnish",
      "French","German","Greek","Hungarian","Irish","Italian","Polish","Portuguese","Romanian","Russian","Scandinavian",
      "Scottish","Sicilian","Spanish","Swiss","Ukrainian",
    ].sort(),
  },
  "The Americas & Caribbean": {
    label: "The Americas & Caribbean",
    items: [
      "Alaskan","American","Argentinian","Baja","Brazilian","Californian","Caribbean","Chilean","Colombian",
      "Cuban","Dominican","Haitian","Hawaiian","Jamaican","Mexican","New Mexican","Oaxacan","Pacific Northwest",
      "Peruvian","Puerto Rican","Southern / Soul Food","Tex-Mex","Venezuelan","Yucatecan",
    ].sort(),
  },
  "Broad / Fusion": {
    label: "Broad / Fusion",
    items: ["Fusion","Mediterranean","Middle Eastern","North African","Pan-Asian"].sort(),
  },
};
