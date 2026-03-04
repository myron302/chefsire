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
