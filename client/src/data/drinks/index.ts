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

export const drinkRouteRegistry = [
  { route: "/drinks/potent-potables/cocktails", title: "Classic Cocktails", recipes: classicCocktails },
  { route: "/drinks/potent-potables/cognac-brandy", title: "Cognac & Brandy", recipes: cognacCocktails },
  { route: "/drinks/potent-potables/daiquiri", title: "Daiquiri", recipes: daiquiris },
  { route: "/drinks/potent-potables/gin", title: "Gin", recipes: ginRecipes },
  { route: "/drinks/potent-potables/hot-drinks", title: "Hot Drinks", recipes: hotDrinks },
  { route: "/drinks/potent-potables/liqueurs", title: "Liqueurs", recipes: liqueurCocktails },
  { route: "/drinks/potent-potables/martinis", title: "Martinis", recipes: martinis },
  { route: "/drinks/potent-potables/mocktails", title: "Mocktails", recipes: mocktails },
  { route: "/drinks/potent-potables/rum", title: "Rum", recipes: rumCocktails },
  { route: "/drinks/potent-potables/scotch-irish-whiskey", title: "Scotch & Irish Whiskey", recipes: scotchIrishCocktails },
  { route: "/drinks/potent-potables/seasonal", title: "Seasonal", recipes: seasonalCocktails },
  { route: "/drinks/potent-potables/spritz", title: "Spritz & Mimosas", recipes: spritzCocktails },
  { route: "/drinks/potent-potables/tequila-mezcal", title: "Tequila & Mezcal", recipes: tequilaMezcalCocktails },
  { route: "/drinks/potent-potables/virgin-cocktails", title: "Virgin Cocktails", recipes: virginDrinks },
  { route: "/drinks/potent-potables/vodka", title: "Vodka", recipes: vodkaCocktails },
  { route: "/drinks/potent-potables/whiskey-bourbon", title: "Whiskey & Bourbon", recipes: whiskeyCocktails }
];
