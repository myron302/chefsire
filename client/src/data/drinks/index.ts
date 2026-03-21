import { classicCocktails } from "./potent-potables/cocktails";
import { cognacCocktails } from "./potent-potables/cognac-brandy";
import { daiquiris } from "./potent-potables/daiquiri";
import { ginRecipes } from "./potent-potables/gin";
import { hotDrinks } from "./potent-potables/hot-drinks";
import { liqueurCocktails } from "./potent-potables/liqueurs";
import { martinis } from "./potent-potables/martinis";
import { mocktails } from "./potent-potables/mocktails";
import { rumCocktails } from "./potent-potables/rum";
import { scotchIrishCocktails } from "./potent-potables/scotch-irish-whiskey";
import { seasonalCocktails } from "./potent-potables/seasonal";
import { spritzCocktails } from "./potent-potables/spritz";
import { tequilaMezcalCocktails } from "./potent-potables/tequila-mezcal";
import { virginDrinks } from "./potent-potables/virgin-cocktails";
import { vodkaCocktails } from "./potent-potables/vodka";
import { whiskeyCocktails } from "./potent-potables/whiskey-bourbon";

import { coldBrewDrinks } from "./caffeinated/cold-brew";
import { energyDrinks } from "./caffeinated/energy";
import { espressoDrinks } from "./caffeinated/espresso";
import { icedCoffeeDrinks } from "./caffeinated/iced";
import { latteDrinks } from "./caffeinated/lattes";
import { matchaDrinks } from "./caffeinated/matcha";
import { specialtyDrinks } from "./caffeinated/specialty";
import { teaDrinks } from "./caffeinated/tea";
import { detoxJuices } from "./detoxes/juice";
import { detoxTeas } from "./detoxes/tea";
import { infusedWaters } from "./detoxes/water";
import { beefProteinShakes } from "./protein-shakes/beef";
import { caseinShakes } from "./protein-shakes/casein";
import { collagenShakes } from "./protein-shakes/collagen";
import { eggProteinRecipes } from "./protein-shakes/egg";
import { plantBasedShakes } from "./protein-shakes/plant-based";
import { wheyProteinShakes } from "./protein-shakes/whey";
import { berrySmoothies } from "./smoothies/berry";
import { breakfastSmoothies } from "./smoothies/breakfast";
import { dessertSmoothies } from "./smoothies/dessert";
import { detoxSmoothies } from "./smoothies/detox";
import { greenSmoothies } from "./smoothies/green";
import { proteinSmoothies } from "./smoothies/protein";
import { tropicalSmoothies } from "./smoothies/tropical";
import { workoutSmoothies } from "./smoothies/workout";
import { energyBoosterDrinks } from "./workout-drinks/energy-boosters";
import { hydrationDrinks } from "./workout-drinks/hydration";
import { postWorkoutDrinks } from "./workout-drinks/post-workout";
import { preWorkoutDrinks } from "./workout-drinks/pre-workout";
import type { DrinkRecipe } from "./types";

export type DrinkRouteRegistryEntry = {
  route: string;
  title: string;
  recipes: DrinkRecipe[];
  dataModulePath: string;
  dataExportName: string;
};

function createDrinkRouteRegistryEntry(entry: DrinkRouteRegistryEntry): DrinkRouteRegistryEntry {
  return entry;
}

export const drinkRouteRegistry: DrinkRouteRegistryEntry[] = [

  createDrinkRouteRegistryEntry({ route: "/drinks/caffeinated/cold-brew", title: "Cold Brew", recipes: coldBrewDrinks, dataModulePath: "./caffeinated/cold-brew", dataExportName: "coldBrewDrinks" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/caffeinated/energy", title: "Energy Drinks", recipes: energyDrinks, dataModulePath: "./caffeinated/energy", dataExportName: "energyDrinks" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/caffeinated/espresso", title: "Espresso Drinks", recipes: espressoDrinks, dataModulePath: "./caffeinated/espresso", dataExportName: "espressoDrinks" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/caffeinated/iced", title: "Iced Coffee", recipes: icedCoffeeDrinks, dataModulePath: "./caffeinated/iced", dataExportName: "icedCoffeeDrinks" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/caffeinated/lattes", title: "Lattes", recipes: latteDrinks, dataModulePath: "./caffeinated/lattes", dataExportName: "latteDrinks" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/caffeinated/matcha", title: "Matcha", recipes: matchaDrinks, dataModulePath: "./caffeinated/matcha", dataExportName: "matchaDrinks" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/caffeinated/specialty", title: "Specialty Coffee", recipes: specialtyDrinks, dataModulePath: "./caffeinated/specialty", dataExportName: "specialtyDrinks" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/caffeinated/tea", title: "Caffeinated Tea", recipes: teaDrinks, dataModulePath: "./caffeinated/tea", dataExportName: "teaDrinks" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/detoxes/juice", title: "Detox Juices", recipes: detoxJuices, dataModulePath: "./detoxes/juice", dataExportName: "detoxJuices" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/detoxes/tea", title: "Detox Teas", recipes: detoxTeas, dataModulePath: "./detoxes/tea", dataExportName: "detoxTeas" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/detoxes/water", title: "Detox Infused Waters", recipes: infusedWaters, dataModulePath: "./detoxes/water", dataExportName: "infusedWaters" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/protein-shakes/beef", title: "Beef Protein Shakes", recipes: beefProteinShakes, dataModulePath: "./protein-shakes/beef", dataExportName: "beefProteinShakes" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/protein-shakes/casein", title: "Casein Protein Shakes", recipes: caseinShakes, dataModulePath: "./protein-shakes/casein", dataExportName: "caseinShakes" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/protein-shakes/collagen", title: "Collagen Protein Shakes", recipes: collagenShakes, dataModulePath: "./protein-shakes/collagen", dataExportName: "collagenShakes" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/protein-shakes/egg", title: "Egg Protein Shakes", recipes: eggProteinRecipes, dataModulePath: "./protein-shakes/egg", dataExportName: "eggProteinRecipes" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/protein-shakes/plant-based", title: "Plant-Based Protein Shakes", recipes: plantBasedShakes, dataModulePath: "./protein-shakes/plant-based", dataExportName: "plantBasedShakes" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/protein-shakes/whey", title: "Whey Protein Shakes", recipes: wheyProteinShakes, dataModulePath: "./protein-shakes/whey", dataExportName: "wheyProteinShakes" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/smoothies/berry", title: "Berry Smoothies", recipes: berrySmoothies, dataModulePath: "./smoothies/berry", dataExportName: "berrySmoothies" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/smoothies/breakfast", title: "Breakfast Smoothies", recipes: breakfastSmoothies, dataModulePath: "./smoothies/breakfast", dataExportName: "breakfastSmoothies" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/smoothies/dessert", title: "Dessert Smoothies", recipes: dessertSmoothies, dataModulePath: "./smoothies/dessert", dataExportName: "dessertSmoothies" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/smoothies/detox", title: "Detox Smoothies", recipes: detoxSmoothies, dataModulePath: "./smoothies/detox", dataExportName: "detoxSmoothies" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/smoothies/green", title: "Green Smoothies", recipes: greenSmoothies, dataModulePath: "./smoothies/green", dataExportName: "greenSmoothies" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/smoothies/protein", title: "Protein Smoothies", recipes: proteinSmoothies, dataModulePath: "./smoothies/protein", dataExportName: "proteinSmoothies" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/smoothies/tropical", title: "Tropical Smoothies", recipes: tropicalSmoothies, dataModulePath: "./smoothies/tropical", dataExportName: "tropicalSmoothies" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/smoothies/workout", title: "Workout Smoothies", recipes: workoutSmoothies, dataModulePath: "./smoothies/workout", dataExportName: "workoutSmoothies" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/workout-drinks/pre-workout", title: "Pre-Workout Drinks", recipes: preWorkoutDrinks, dataModulePath: "./workout-drinks/pre-workout", dataExportName: "preWorkoutDrinks" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/workout-drinks/post-workout", title: "Post-Workout Drinks", recipes: postWorkoutDrinks, dataModulePath: "./workout-drinks/post-workout", dataExportName: "postWorkoutDrinks" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/workout-drinks/hydration", title: "Hydration Drinks", recipes: hydrationDrinks, dataModulePath: "./workout-drinks/hydration", dataExportName: "hydrationDrinks" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/workout-drinks/energy-boosters", title: "Energy Booster Drinks", recipes: energyBoosterDrinks, dataModulePath: "./workout-drinks/energy-boosters", dataExportName: "energyBoosterDrinks" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/cocktails", title: "Classic Cocktails", recipes: classicCocktails, dataModulePath: "./potent-potables/cocktails", dataExportName: "classicCocktails" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/cognac-brandy", title: "Cognac & Brandy", recipes: cognacCocktails, dataModulePath: "./potent-potables/cognac-brandy", dataExportName: "cognacCocktails" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/daiquiri", title: "Daiquiri", recipes: daiquiris, dataModulePath: "./potent-potables/daiquiri", dataExportName: "daiquiris" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/gin", title: "Gin", recipes: ginRecipes, dataModulePath: "./potent-potables/gin", dataExportName: "ginRecipes" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/hot-drinks", title: "Hot Drinks", recipes: hotDrinks, dataModulePath: "./potent-potables/hot-drinks", dataExportName: "hotDrinks" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/liqueurs", title: "Liqueurs", recipes: liqueurCocktails, dataModulePath: "./potent-potables/liqueurs", dataExportName: "liqueurCocktails" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/martinis", title: "Martinis", recipes: martinis, dataModulePath: "./potent-potables/martinis", dataExportName: "martinis" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/mocktails", title: "Mocktails", recipes: mocktails, dataModulePath: "./potent-potables/mocktails", dataExportName: "mocktails" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/rum", title: "Rum", recipes: rumCocktails, dataModulePath: "./potent-potables/rum", dataExportName: "rumCocktails" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/scotch-irish-whiskey", title: "Scotch & Irish Whiskey", recipes: scotchIrishCocktails, dataModulePath: "./potent-potables/scotch-irish-whiskey", dataExportName: "scotchIrishCocktails" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/seasonal", title: "Seasonal", recipes: seasonalCocktails, dataModulePath: "./potent-potables/seasonal", dataExportName: "seasonalCocktails" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/spritz", title: "Spritz & Mimosas", recipes: spritzCocktails, dataModulePath: "./potent-potables/spritz", dataExportName: "spritzCocktails" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/tequila-mezcal", title: "Tequila & Mezcal", recipes: tequilaMezcalCocktails, dataModulePath: "./potent-potables/tequila-mezcal", dataExportName: "tequilaMezcalCocktails" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/virgin-cocktails", title: "Virgin Cocktails", recipes: virginDrinks, dataModulePath: "./potent-potables/virgin-cocktails", dataExportName: "virginDrinks" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/vodka", title: "Vodka", recipes: vodkaCocktails, dataModulePath: "./potent-potables/vodka", dataExportName: "vodkaCocktails" }),
  createDrinkRouteRegistryEntry({ route: "/drinks/potent-potables/whiskey-bourbon", title: "Whiskey & Bourbon", recipes: whiskeyCocktails, dataModulePath: "./potent-potables/whiskey-bourbon", dataExportName: "whiskeyCocktails" })
];
