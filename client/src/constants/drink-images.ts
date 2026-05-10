/**
 * Comprehensive drink image mappings.
 *
 * Potent potables use local ChefSire-owned generated artwork so category and
 * recipe-card fallbacks do not depend on third-party stock URLs that can 404.
 */

const POTENT_POTABLES_ASSET_BASE = '/images/drinks/potent-potables';
const POTENT_POTABLES_PREMIUM_ASSET_BASE = `${POTENT_POTABLES_ASSET_BASE}/premium`;

export const POTENT_POTABLES_CATEGORY_ASSET_PATHS = {
  cocktails: `${POTENT_POTABLES_ASSET_BASE}/cocktails.svg`,
  gin: `${POTENT_POTABLES_ASSET_BASE}/gin.svg`,
  rum: `${POTENT_POTABLES_ASSET_BASE}/rum.svg`,
  vodka: `${POTENT_POTABLES_ASSET_BASE}/vodka.svg`,
  whiskey: `${POTENT_POTABLES_ASSET_BASE}/whiskey-bourbon.svg`,
  whiskeyBourbon: `${POTENT_POTABLES_ASSET_BASE}/whiskey-bourbon.svg`,
  martinis: `${POTENT_POTABLES_ASSET_BASE}/martinis.svg`,
  mocktails: `${POTENT_POTABLES_ASSET_BASE}/mocktails.svg`,
  tequila: `${POTENT_POTABLES_ASSET_BASE}/tequila-mezcal.svg`,
  tequilaMezcal: `${POTENT_POTABLES_ASSET_BASE}/tequila-mezcal.svg`,
  cognac: `${POTENT_POTABLES_ASSET_BASE}/cognac-brandy.svg`,
  cognacBrandy: `${POTENT_POTABLES_ASSET_BASE}/cognac-brandy.svg`,
  daiquiri: `${POTENT_POTABLES_ASSET_BASE}/daiquiri.svg`,
  scotchIrishWhiskey: `${POTENT_POTABLES_ASSET_BASE}/scotch-irish-whiskey.svg`,
  seasonal: `${POTENT_POTABLES_ASSET_BASE}/seasonal.svg`,
  spritz: `${POTENT_POTABLES_ASSET_BASE}/spritz.svg`,
  liqueurs: `${POTENT_POTABLES_ASSET_BASE}/liqueurs.svg`,
  virginCocktails: `${POTENT_POTABLES_ASSET_BASE}/virgin-cocktails.svg`,
  hotDrinks: `${POTENT_POTABLES_ASSET_BASE}/hot-drinks.svg`,
} as const;


export const POTENT_POTABLES_RECIPE_ASSET_PATHS = {
  oldFashioned: `${POTENT_POTABLES_PREMIUM_ASSET_BASE}/old-fashioned.svg`,
  mojito: `${POTENT_POTABLES_PREMIUM_ASSET_BASE}/mojito.svg`,
  margarita: `${POTENT_POTABLES_PREMIUM_ASSET_BASE}/margarita.svg`,
  martini: `${POTENT_POTABLES_PREMIUM_ASSET_BASE}/martini.svg`,
  daiquiri: `${POTENT_POTABLES_PREMIUM_ASSET_BASE}/daiquiri.svg`,
} as const;

export const POTENT_POTABLES_RICH_CATEGORY_ASSET_PATHS = {
  rum: `${POTENT_POTABLES_PREMIUM_ASSET_BASE}/rum-rich.svg`,
  whiskeyBourbon: `${POTENT_POTABLES_PREMIUM_ASSET_BASE}/whiskey-bourbon-rich.svg`,
  mocktails: `${POTENT_POTABLES_PREMIUM_ASSET_BASE}/mocktails-rich.svg`,
} as const;

export const POTENT_POTABLES_ROUTE_ASSET_PATHS: Record<string, string> = {
  '/drinks/potent-potables': POTENT_POTABLES_CATEGORY_ASSET_PATHS.cocktails,
  '/drinks/potent-potables/cocktails': POTENT_POTABLES_CATEGORY_ASSET_PATHS.cocktails,
  '/drinks/potent-potables/gin': POTENT_POTABLES_CATEGORY_ASSET_PATHS.gin,
  '/drinks/potent-potables/rum': POTENT_POTABLES_CATEGORY_ASSET_PATHS.rum,
  '/drinks/potent-potables/vodka': POTENT_POTABLES_CATEGORY_ASSET_PATHS.vodka,
  '/drinks/potent-potables/whiskey-bourbon': POTENT_POTABLES_CATEGORY_ASSET_PATHS.whiskeyBourbon,
  '/drinks/potent-potables/scotch-irish-whiskey': POTENT_POTABLES_CATEGORY_ASSET_PATHS.scotchIrishWhiskey,
  '/drinks/potent-potables/tequila-mezcal': POTENT_POTABLES_CATEGORY_ASSET_PATHS.tequilaMezcal,
  '/drinks/potent-potables/cognac-brandy': POTENT_POTABLES_CATEGORY_ASSET_PATHS.cognacBrandy,
  '/drinks/potent-potables/daiquiri': POTENT_POTABLES_CATEGORY_ASSET_PATHS.daiquiri,
  '/drinks/potent-potables/martinis': POTENT_POTABLES_CATEGORY_ASSET_PATHS.martinis,
  '/drinks/potent-potables/mocktails': POTENT_POTABLES_CATEGORY_ASSET_PATHS.mocktails,
  '/drinks/potent-potables/liqueurs': POTENT_POTABLES_CATEGORY_ASSET_PATHS.liqueurs,
  '/drinks/potent-potables/spritz': POTENT_POTABLES_CATEGORY_ASSET_PATHS.spritz,
  '/drinks/potent-potables/virgin-cocktails': POTENT_POTABLES_CATEGORY_ASSET_PATHS.virginCocktails,
  '/drinks/potent-potables/seasonal': POTENT_POTABLES_CATEGORY_ASSET_PATHS.seasonal,
  '/drinks/potent-potables/hot-drinks': POTENT_POTABLES_CATEGORY_ASSET_PATHS.hotDrinks,
};


export const POTENT_POTABLES_RICH_ROUTE_ASSET_PATHS: Record<string, string> = {
  '/drinks/potent-potables/rum': POTENT_POTABLES_RICH_CATEGORY_ASSET_PATHS.rum,
  '/drinks/potent-potables/whiskey-bourbon': POTENT_POTABLES_RICH_CATEGORY_ASSET_PATHS.whiskeyBourbon,
  '/drinks/potent-potables/mocktails': POTENT_POTABLES_RICH_CATEGORY_ASSET_PATHS.mocktails,
};

export function getPotentPotablesRichAssetByRoute(route: string): string {
  return POTENT_POTABLES_RICH_ROUTE_ASSET_PATHS[route] ?? '';
}

export function getPotentPotablesAssetByRoute(route: string): string {
  return POTENT_POTABLES_ROUTE_ASSET_PATHS[route] ?? '';
}

// Fallback images for when specific images are not available
export const DRINK_FALLBACK_IMAGES = {
  default: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cocktails,
  smoothie: 'https://images.unsplash.com/photo-1553530979-451d0aa3ad9f?w=600&h=400&fit=crop',
  coffee: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop',
  cocktail: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cocktails,
  protein: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
  detox: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=600&h=400&fit=crop',
} as const;

// =============================================================================
// DRINK HUB IMAGES - Main category hero images
// =============================================================================
export const DRINK_HUB_IMAGES = {
  smoothies: {
    hero: 'https://images.unsplash.com/photo-1553530979-451d0aa3ad9f?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1553530979-451d0aa3ad9f?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1553530979-451d0aa3ad9f?w=600&h=400&fit=crop',
  },
  proteinShakes: {
    hero: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
  },
  detoxes: {
    hero: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=600&h=400&fit=crop',
  },
  potentPotables: {
    hero: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cocktails,
    thumbnail: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cocktails,
    card: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cocktails,
  },
  caffeinated: {
    hero: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop',
  },
} as const;

// =============================================================================
// SMOOTHIE SUBCATEGORY IMAGES
// =============================================================================
export const SMOOTHIE_IMAGES = {
  berry: {
    hero: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=600&h=400&fit=crop',
    recipes: {
      tripleBerry: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&h=300&fit=crop',
      strawberryFields: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop',
      blueberryBliss: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&h=300&fit=crop',
      acaiBowl: 'https://images.unsplash.com/photo-1590301157284-4e08f48b611c?w=400&h=300&fit=crop',
    },
  },
  breakfast: {
    hero: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=600&h=400&fit=crop',
    recipes: {
      morningFuel: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=300&fit=crop',
      oatmealSmoothie: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop',
      coffeeMocha: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop',
    },
  },
  dessert: {
    hero: 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=600&h=400&fit=crop',
    recipes: {
      chocolateBrownie: 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=400&h=300&fit=crop',
      strawberryCheesecake: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop',
      peanutButterCup: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&h=300&fit=crop',
    },
  },
  detox: {
    hero: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=600&h=400&fit=crop',
    recipes: {
      greenCleanse: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=300&fit=crop',
      lemonGinger: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&h=300&fit=crop',
      beetPower: 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=400&h=300&fit=crop',
    },
  },
  green: {
    hero: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600&h=400&fit=crop',
    recipes: {
      greenGoddess: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=300&fit=crop',
      spinachKale: 'https://images.unsplash.com/photo-1638176066666-ffb2f013c7dd?w=400&h=300&fit=crop',
      avocadoMint: 'https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf?w=400&h=300&fit=crop',
    },
  },
  protein: {
    hero: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
    recipes: {
      greekGoddess: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop',
      peanutButterPower: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
      chocolateAlmond: 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=400&h=300&fit=crop',
    },
  },
  tropical: {
    hero: 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=600&h=400&fit=crop',
    recipes: {
      mangoParadise: 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=400&h=300&fit=crop',
      pinaColada: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=400&h=300&fit=crop',
      passionFruit: 'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?w=400&h=300&fit=crop',
    },
  },
  workout: {
    hero: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
    recipes: {
      preWorkout: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
      postWorkout: 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?w=400&h=300&fit=crop',
      enduranceFuel: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=300&fit=crop',
    },
  },
} as const;

// =============================================================================
// CAFFEINATED DRINK TYPE IMAGES
// =============================================================================
export const CAFFEINATED_IMAGES = {
  coldBrew: {
    hero: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&h=400&fit=crop',
    recipes: {
      classic: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop',
      nitro: 'https://images.unsplash.com/photo-1592663527359-cf6642f54cff?w=400&h=300&fit=crop',
      vanilla: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=400&h=300&fit=crop',
    },
  },
  espresso: {
    hero: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=600&h=400&fit=crop',
    recipes: {
      single: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&h=300&fit=crop',
      double: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&h=300&fit=crop',
      ristretto: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400&h=300&fit=crop',
    },
  },
  icedCoffee: {
    hero: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&h=400&fit=crop',
    recipes: {
      classic: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=400&h=300&fit=crop',
      mocha: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=400&h=300&fit=crop',
      caramel: 'https://images.unsplash.com/photo-1592663527359-cf6642f54cff?w=400&h=300&fit=crop',
    },
  },
  lattes: {
    hero: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&h=400&fit=crop',
    recipes: {
      vanilla: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop',
      caramel: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400&h=300&fit=crop',
      pumpkinSpice: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop',
    },
  },
  matcha: {
    hero: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&h=400&fit=crop',
    recipes: {
      traditional: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=400&h=300&fit=crop',
      latte: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=400&h=300&fit=crop',
      iced: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=400&h=300&fit=crop',
    },
  },
  energy: {
    hero: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=600&h=400&fit=crop',
    recipes: {
      greenTea: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop',
      yerba: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=300&fit=crop',
      guarana: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&h=300&fit=crop',
    },
  },
  specialty: {
    hero: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=400&fit=crop',
    recipes: {
      affogato: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop',
      flatWhite: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400&h=300&fit=crop',
      cortado: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&h=300&fit=crop',
    },
  },
  tea: {
    hero: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&h=400&fit=crop',
    recipes: {
      chai: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&h=300&fit=crop',
      blackTea: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop',
      herbal: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=400&h=300&fit=crop',
    },
  },
} as const;

// =============================================================================
// PROTEIN SHAKE TYPE IMAGES
// =============================================================================
export const PROTEIN_SHAKE_IMAGES = {
  whey: {
    hero: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
    recipes: {
      vanilla: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=300&fit=crop',
      chocolate: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&h=300&fit=crop',
      strawberry: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop',
    },
  },
  plantBased: {
    hero: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600&h=400&fit=crop',
    recipes: {
      pea: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=300&fit=crop',
      hemp: 'https://images.unsplash.com/photo-1638176066666-ffb2f013c7dd?w=400&h=300&fit=crop',
      soy: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&h=300&fit=crop',
    },
  },
  beef: {
    hero: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
    recipes: {
      classic: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
      chocolate: 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=400&h=300&fit=crop',
    },
  },
  casein: {
    hero: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
    recipes: {
      nighttime: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
      vanilla: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=300&fit=crop',
    },
  },
  collagen: {
    hero: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=600&h=400&fit=crop',
    recipes: {
      berry: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=400&h=300&fit=crop',
      tropical: 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=400&h=300&fit=crop',
    },
  },
  egg: {
    hero: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=600&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop',
    card: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
    recipes: {
      classic: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
      chocolate: 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=400&h=300&fit=crop',
    },
  },
} as const;

// =============================================================================
// POTENT POTABLES (COCKTAILS/SPIRITS) IMAGES
// =============================================================================
export const POTENT_POTABLES_IMAGES = {
  cocktails: {
    hero: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cocktails,
    thumbnail: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cocktails,
    card: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cocktails,
    recipes: {
      margarita: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cocktails,
      mojito: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cocktails,
      cosmopolitan: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cocktails,
    },
  },
  gin: {
    hero: POTENT_POTABLES_CATEGORY_ASSET_PATHS.gin,
    thumbnail: POTENT_POTABLES_CATEGORY_ASSET_PATHS.gin,
    card: POTENT_POTABLES_CATEGORY_ASSET_PATHS.gin,
    recipes: {
      ginTonic: POTENT_POTABLES_CATEGORY_ASSET_PATHS.gin,
      negroni: POTENT_POTABLES_CATEGORY_ASSET_PATHS.gin,
      gimlet: POTENT_POTABLES_CATEGORY_ASSET_PATHS.gin,
    },
  },
  rum: {
    hero: POTENT_POTABLES_CATEGORY_ASSET_PATHS.rum,
    thumbnail: POTENT_POTABLES_CATEGORY_ASSET_PATHS.rum,
    card: POTENT_POTABLES_CATEGORY_ASSET_PATHS.rum,
    recipes: {
      daiquiri: POTENT_POTABLES_CATEGORY_ASSET_PATHS.rum,
      pinaColada: POTENT_POTABLES_CATEGORY_ASSET_PATHS.rum,
      darkNStormy: POTENT_POTABLES_CATEGORY_ASSET_PATHS.rum,
    },
  },
  vodka: {
    hero: POTENT_POTABLES_CATEGORY_ASSET_PATHS.vodka,
    thumbnail: POTENT_POTABLES_CATEGORY_ASSET_PATHS.vodka,
    card: POTENT_POTABLES_CATEGORY_ASSET_PATHS.vodka,
    recipes: {
      vodkaMartini: POTENT_POTABLES_CATEGORY_ASSET_PATHS.vodka,
      espressoMartini: POTENT_POTABLES_CATEGORY_ASSET_PATHS.vodka,
      bloodyMary: POTENT_POTABLES_CATEGORY_ASSET_PATHS.vodka,
    },
  },
  whiskey: {
    hero: POTENT_POTABLES_CATEGORY_ASSET_PATHS.whiskeyBourbon,
    thumbnail: POTENT_POTABLES_CATEGORY_ASSET_PATHS.whiskeyBourbon,
    card: POTENT_POTABLES_CATEGORY_ASSET_PATHS.whiskeyBourbon,
    recipes: {
      oldFashioned: POTENT_POTABLES_CATEGORY_ASSET_PATHS.whiskeyBourbon,
      manhattan: POTENT_POTABLES_CATEGORY_ASSET_PATHS.whiskeyBourbon,
      whiskeySour: POTENT_POTABLES_CATEGORY_ASSET_PATHS.whiskeyBourbon,
    },
  },
  martinis: {
    hero: POTENT_POTABLES_CATEGORY_ASSET_PATHS.martinis,
    thumbnail: POTENT_POTABLES_CATEGORY_ASSET_PATHS.martinis,
    card: POTENT_POTABLES_CATEGORY_ASSET_PATHS.martinis,
    recipes: {
      classic: POTENT_POTABLES_CATEGORY_ASSET_PATHS.martinis,
      dirty: POTENT_POTABLES_CATEGORY_ASSET_PATHS.martinis,
      lemon: POTENT_POTABLES_CATEGORY_ASSET_PATHS.martinis,
    },
  },
  mocktails: {
    hero: POTENT_POTABLES_CATEGORY_ASSET_PATHS.mocktails,
    thumbnail: POTENT_POTABLES_CATEGORY_ASSET_PATHS.mocktails,
    card: POTENT_POTABLES_CATEGORY_ASSET_PATHS.mocktails,
    recipes: {
      virginMojito: POTENT_POTABLES_CATEGORY_ASSET_PATHS.mocktails,
      shirleyTemple: POTENT_POTABLES_CATEGORY_ASSET_PATHS.mocktails,
      sparklingLemonade: POTENT_POTABLES_CATEGORY_ASSET_PATHS.mocktails,
    },
  },
  tequila: {
    hero: POTENT_POTABLES_CATEGORY_ASSET_PATHS.tequilaMezcal,
    thumbnail: POTENT_POTABLES_CATEGORY_ASSET_PATHS.tequilaMezcal,
    card: POTENT_POTABLES_CATEGORY_ASSET_PATHS.tequilaMezcal,
    recipes: {
      margarita: POTENT_POTABLES_CATEGORY_ASSET_PATHS.tequilaMezcal,
      paloma: POTENT_POTABLES_CATEGORY_ASSET_PATHS.tequilaMezcal,
      sunrise: POTENT_POTABLES_CATEGORY_ASSET_PATHS.tequilaMezcal,
    },
  },
  cognac: {
    hero: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cognacBrandy,
    thumbnail: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cognacBrandy,
    card: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cognacBrandy,
    recipes: {
      sidecar: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cognacBrandy,
      frenchConnection: POTENT_POTABLES_CATEGORY_ASSET_PATHS.cognacBrandy,
    },
  },
  seasonal: {
    hero: POTENT_POTABLES_CATEGORY_ASSET_PATHS.seasonal,
    thumbnail: POTENT_POTABLES_CATEGORY_ASSET_PATHS.seasonal,
    card: POTENT_POTABLES_CATEGORY_ASSET_PATHS.seasonal,
    recipes: {
      eggnog: POTENT_POTABLES_CATEGORY_ASSET_PATHS.seasonal,
      hotToddy: POTENT_POTABLES_CATEGORY_ASSET_PATHS.seasonal,
      mulledWine: POTENT_POTABLES_CATEGORY_ASSET_PATHS.seasonal,
    },
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get image by drink type and size
 */
export function getDrinkImage(
  category: keyof typeof DRINK_HUB_IMAGES,
  size: 'hero' | 'thumbnail' | 'card' = 'card'
): string {
  return DRINK_HUB_IMAGES[category]?.[size] ?? DRINK_FALLBACK_IMAGES.default;
}

/**
 * Get smoothie subcategory image
 */
export function getSmoothieImage(
  subcategory: keyof typeof SMOOTHIE_IMAGES,
  size: 'hero' | 'thumbnail' | 'card' = 'card'
): string {
  return SMOOTHIE_IMAGES[subcategory]?.[size] ?? DRINK_FALLBACK_IMAGES.smoothie;
}

/**
 * Get caffeinated drink image
 */
export function getCaffeinatedImage(
  type: keyof typeof CAFFEINATED_IMAGES,
  size: 'hero' | 'thumbnail' | 'card' = 'card'
): string {
  return CAFFEINATED_IMAGES[type]?.[size] ?? DRINK_FALLBACK_IMAGES.coffee;
}

/**
 * Get protein shake image
 */
export function getProteinShakeImage(
  type: keyof typeof PROTEIN_SHAKE_IMAGES,
  size: 'hero' | 'thumbnail' | 'card' = 'card'
): string {
  return PROTEIN_SHAKE_IMAGES[type]?.[size] ?? DRINK_FALLBACK_IMAGES.protein;
}

/**
 * Get potent potables image
 */
export function getPotentPotablesImage(
  type: keyof typeof POTENT_POTABLES_IMAGES,
  size: 'hero' | 'thumbnail' | 'card' = 'card'
): string {
  return POTENT_POTABLES_IMAGES[type]?.[size] ?? DRINK_FALLBACK_IMAGES.cocktail;
}

// Type exports for TypeScript users
export type DrinkHubCategory = keyof typeof DRINK_HUB_IMAGES;
export type SmoothieCategory = keyof typeof SMOOTHIE_IMAGES;
export type CaffeinatedCategory = keyof typeof CAFFEINATED_IMAGES;
export type ProteinShakeCategory = keyof typeof PROTEIN_SHAKE_IMAGES;
export type PotentPotablesCategory = keyof typeof POTENT_POTABLES_IMAGES;
