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
      { substitute: "1/2 tsp. cinnamon and 1/2 tsp. ground cloves", amount: "1/2 + 1/2 tsp." }
    ]
  },
  {
    ingredient: "Apple pie spice",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "1/2 tsp. cinnamon, 1/4 tsp. nutmeg, and 1/8 tsp. cardamom", amount: "1/2 + 1/4 + 1/8 tsp." }
    ]
  },
  {
    ingredient: "Arrowroot starch",
    amount: "1 1/2 tsp.",
    substitutes: [
      { substitute: "flour", amount: "1 tbsp." },
      { substitute: "cornstarch", amount: "1 1/2 tsp." }
    ]
  },
  {
    ingredient: "Baking powder",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "1/3 tsp. baking soda and 1/2 tsp. cream of tartar", amount: "1/3 + 1/2 tsp." },
      { substitute: "1/4 tsp. baking soda and 1/2 cup sour milk or buttermilk", amount: "1/4 tsp. + 1/2 cup", note: "Decrease liquid called for in recipe by 1/2 cup" },
      { substitute: "1/4 tsp. baking soda and 1/2 tbsp. vinegar or lemon juice used with sweet milk to make 1/2 cup", amount: "1/4 tsp. + 1/2 tbsp. + sweet milk", note: "Decrease liquid called for in recipe by 1/2 cup" },
      { substitute: "1/4 tsp. baking soda and 1/4 to 1/2 cup molasses", amount: "1/4 tsp. + 1/4-1/2 cup", note: "Decrease liquid in recipe by 1-2 tbsp." }
    ]
  },
  {
    ingredient: "Baking powder, double-acting",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "1/4 tsp. baking soda and 5/8 tsp. cream of tartar", amount: "1/4 + 5/8 tsp." }
    ]
  },
  {
    ingredient: "Bay leaf",
    amount: "1 whole",
    substitutes: [
      { substitute: "crushed bay leaves", amount: "1/4 tsp." }
    ]
  },
  {
    ingredient: "Beau Monde seasoning",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "seasoning salt", amount: "1 tsp." },
      { substitute: "table salt", amount: "1/2 tsp." },
      { substitute: "Mei Yen seasoning", amount: "1/2 tsp." },
      { substitute: "1/2 tsp. table salt plus dash of garlic, onion and celery salts or powders", amount: "1/2 tsp. + seasonings" }
    ]
  },
  {
    ingredient: "Beef stock base, instant",
    amount: "2 tsp.",
    substitutes: [
      { substitute: "beef bouillon cube", amount: "1 cube" }
    ]
  },
  {
    ingredient: "Brandy",
    amount: "1/4 cup",
    substitutes: [
      { substitute: "1 tsp. brandy extract plus enough water or liquid called for in recipe", amount: "1 tsp. + liquid to make 1/4 cup" }
    ]
  },
  {
    ingredient: "Bread crumbs, dry",
    amount: "1/3 cup",
    substitutes: [
      { substitute: "dry bread slice", amount: "1 slice" }
    ]
  },
  {
    ingredient: "Bread crumbs, soft",
    amount: "3/4 cup",
    substitutes: [
      { substitute: "soft bread slice", amount: "1 slice" }
    ]
  },
  {
    ingredient: "Broth, beef or chicken",
    amount: "1 cup",
    substitutes: [
      { substitute: "bouillon cube dissolved in boiling water", amount: "1 cube + 1 cup water" },
      { substitute: "powdered broth base dissolved in boiling water", amount: "1 envelope + 1 cup water" },
      { substitute: "powdered broth base dissolved in boiling water", amount: "1 tsp. + 1 cup water" }
    ]
  },
  {
    ingredient: "Butter",
    amount: "1 cup",
    substitutes: [
      { substitute: "margarine", amount: "1 cup" },
      { substitute: "vegetable shortening", amount: "1 cup", note: "for baking" },
      { substitute: "hydrogenated fat and salt", amount: "7/8-1 cup + 1/2 tsp." },
      { substitute: "lard plus salt", amount: "7/8 cup + 1/2 tsp." },
      { substitute: "oil", amount: "7/8 cup", note: "can substitute for melted butter if recipe specifies melted butter" }
    ]
  },
  {
    ingredient: "Buttermilk",
    amount: "1 cup",
    substitutes: [
      { substitute: "plain yogurt", amount: "1 cup" },
      { substitute: "lemon juice or vinegar plus regular milk", amount: "1 tbsp. + milk to make 1 cup", note: "Allow to stand 5 minutes" },
      { substitute: "milk plus cream of tartar", amount: "1 cup + 1 3/4 tsp." }
    ]
  },
  {
    ingredient: "Carob powder",
    amount: "3 tbsp. + 2 tbsp. water",
    substitutes: [
      { substitute: "unsweetened chocolate", amount: "1 oz." }
    ]
  },
  {
    ingredient: "Catsup",
    amount: "1 cup",
    substitutes: [
      { substitute: "tomato sauce, brown sugar, and vinegar", amount: "1 cup + 1/4 cup + 2 tbsp.", note: "for use in cooking" }
    ]
  },
  {
    ingredient: "Chicken",
    amount: "1 1/2 lb. boned",
    substitutes: [
      { substitute: "cooked, diced chicken", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Chicken stock base, instant",
    amount: "1 1/2 tsp.",
    substitutes: [
      { substitute: "chicken bouillon cube", amount: "1 cube" }
    ]
  },
  {
    ingredient: "Chili sauce",
    amount: "1 cup",
    substitutes: [
      { substitute: "tomato sauce, brown sugar, vinegar, cinnamon, ground cloves, and allspice", amount: "1 cup + 1/4 cup + 2 tbsp. + spices" },
      { substitute: "catsup, cinnamon, ground cloves and allspice", amount: "1 cup + spices" }
    ]
  },
  {
    ingredient: "Chives, finely chopped",
    amount: "2 tsp.",
    substitutes: [
      { substitute: "green onion tops, finely chopped", amount: "2 tsp." }
    ]
  },
  {
    ingredient: "Chocolate chips, semisweet",
    amount: "1 oz.",
    substitutes: [
      { substitute: "sweet cooking chocolate", amount: "1 oz." }
    ]
  },
  {
    ingredient: "Chocolate, semisweet",
    amount: "1 2/3 oz.",
    substitutes: [
      { substitute: "unsweetened chocolate plus sugar", amount: "1 oz. + 4 tsp." }
    ]
  },
  {
    ingredient: "Chocolate, semisweet pieces, melted",
    amount: "6 oz. package",
    substitutes: [
      { substitute: "unsweetened chocolate plus shortening and sugar", amount: "2 squares + 2 tbsp. + 1/2 cup" }
    ]
  },
  {
    ingredient: "Chocolate, unsweetened",
    amount: "1 oz. or 1 square",
    substitutes: [
      { substitute: "cocoa and butter, margarine or vegetable oil", amount: "3 tbsp. + 1 tbsp." },
      { substitute: "carob powder plus water", amount: "3 tbsp. + 2 tbsp." }
    ]
  },
  {
    ingredient: "Cocoa",
    amount: "1/4 cup or 4 tbsp.",
    substitutes: [
      { substitute: "unsweetened chocolate", amount: "1 oz. (1 square)", note: "decrease fat called for in recipe by 1/2 tbsp." }
    ]
  },
  {
    ingredient: "Coconut, grated dry",
    amount: "1 tbsp.",
    substitutes: [
      { substitute: "fresh coconut, grated", amount: "1 1/2 tbsp." }
    ]
  },
  {
    ingredient: "Coconut cream",
    amount: "1 cup",
    substitutes: [
      { substitute: "whipping cream", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Coconut milk",
    amount: "1 cup",
    substitutes: [
      { substitute: "whole or 2% milk", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Corn syrup",
    amount: "1 cup",
    substitutes: [
      { substitute: "sugar and water", amount: "7/8 cup + 2 tbsp." },
      { substitute: "honey", amount: "7/8 cup", note: "baked goods will brown more" },
      { substitute: "sugar and liquid", amount: "1 cup + 1/4 cup", note: "use whatever liquid is called for in the recipe" }
    ]
  },
  {
    ingredient: "Corn syrup, dark",
    amount: "1 cup",
    substitutes: [
      { substitute: "light corn syrup and light molasses", amount: "3/4 cup + 1/4 cup" }
    ]
  },
  {
    ingredient: "Cornmeal, self-rising",
    amount: "1 cup",
    substitutes: [
      { substitute: "cornmeal, baking powder, and salt", amount: "7/8 cup + 1 1/2 tbsp. + 1/2 tsp." }
    ]
  },
  {
    ingredient: "Cornstarch",
    amount: "1 tbsp.",
    substitutes: [
      { substitute: "all-purpose flour", amount: "2 tbsp." },
      { substitute: "granular tapioca", amount: "2 tbsp." },
      { substitute: "arrowroot", amount: "1 tbsp." }
    ]
  },
  {
    ingredient: "Cracker crumbs",
    amount: "3/4 cup",
    substitutes: [
      { substitute: "dry bread crumbs", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Cream cheese",
    amount: "1 cup",
    substitutes: [
      { substitute: "part skim milk ricotta cheese or lowfat cottage cheese beaten until smooth", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Cream, half-and-half",
    amount: "1 cup",
    substitutes: [
      { substitute: "milk plus butter or margarine", amount: "7/8 cup + 1/2 tbsp.", note: "for use in cooking and baking" },
      { substitute: "oil plus milk", amount: "3 tbsp. + milk to equal 1 cup" },
      { substitute: "evaporated milk", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Cream, heavy (36-40% fat)",
    amount: "1 cup",
    substitutes: [
      { substitute: "milk and butter or margarine", amount: "3/4 cup + 1/3 cup", note: "for use in cooking and baking" },
      { substitute: "buttermilk plus oil", amount: "2/3 cup + 1/3 cup" },
      { substitute: "evaporated skim milk or equal parts of part-skim milk ricotta cheese and nonfat yogurt beaten until smooth", amount: "1 cup", note: "this mixture cannot be heated because of separation" }
    ]
  },
  {
    ingredient: "Cream, light (18-20% fat)",
    amount: "1 cup",
    substitutes: [
      { substitute: "evaporated milk, undiluted", amount: "1 cup" },
      { substitute: "milk plus butter or margarine", amount: "3/4 cup + 3 tbsp.", note: "for use in cooking and baking" }
    ]
  },
  {
    ingredient: "Cream, sour",
    amount: "1 cup",
    substitutes: [
      { substitute: "buttermilk or sour milk", amount: "7/8 cup" },
      { substitute: "plain yogurt", amount: "1 cup" },
      { substitute: "powdered nonfat dry milk, warm water, and vinegar", amount: "1 1/8 cup + 1/2 cup + 1 tbsp.", note: "mixture will thicken in refrigerator in a few hours" },
      { substitute: "evaporated milk plus vinegar", amount: "1 cup + 1 tbsp.", note: "allow to stand 5 minutes before using" },
      { substitute: "buttermilk, lemon juice, and smooth cottage cheese blended together", amount: "1/3 cup + 1 tbsp. + 1 cup" },
      { substitute: "milk, lemon juice, and butter or margarine", amount: "7/8 cup + 1 tbsp. + 2 tbsp." },
      { substitute: "sour milk or buttermilk and butter or margarine", amount: "3/4 cup + 1/3 cup" }
    ]
  },
  {
    ingredient: "Cream, whipped",
    amount: "1 cup",
    substitutes: [
      { substitute: "chilled evaporated milk until ice crystals form. Add lemon juice. Whip until stiff", amount: "13 oz. can + 1 tsp." },
      { substitute: "ice-cold water and nonfat dry milk. Add sugar slowly while beating. Then add lemon juice", amount: "1/2 cup + 1/2 cup + 1/2 cup + 2 tbsp." }
    ]
  },
  {
    ingredient: "Cream, whipping",
    amount: "1 cup",
    substitutes: [
      { substitute: "lemon juice, sugar, evaporated milk", amount: "2 tbsp. + 2 tbsp. + 1 cup" },
      { substitute: "milk plus butter", amount: "3/4 cup + 1/3 cup", note: "for cooking only" }
    ]
  },
  {
    ingredient: "Cream of tartar",
    amount: "1/2 tsp.",
    substitutes: [
      { substitute: "lemon juice or vinegar", amount: "1 1/2 tsp." }
    ]
  },
  {
    ingredient: "Dill plant, fresh or dried",
    amount: "3 heads",
    substitutes: [
      { substitute: "dill seed", amount: "1 tbsp." }
    ]
  },
  {
    ingredient: "Egg, whole",
    amount: "1 large (3 tbsp.)",
    substitutes: [
      { substitute: "egg substitute", amount: "1/4 cup" },
      { substitute: "thawed frozen egg", amount: "3 tbsp. + 1 tsp." },
      { substitute: "sifted, dry whole egg powder and lukewarm water", amount: "2 1/2 tbsp. + 2 1/2 tbsp." },
      { substitute: "egg yolks and water", amount: "2 yolks + 1 tbsp.", note: "for cookies" },
      { substitute: "egg yolks", amount: "2 yolks", note: "in custards, cream fillings, and similar mixtures" },
      { substitute: "egg whites as a thickening agent", amount: "2 whites" }
    ]
  },
  {
    ingredient: "Eggs, uncooked",
    amount: "1 cup",
    substitutes: [
      { substitute: "large eggs", amount: "5" },
      { substitute: "medium eggs", amount: "6" }
    ]
  },
  {
    ingredient: "Egg substitute",
    amount: "1 egg",
    substitutes: [
      { substitute: "egg whites. May add vegetable oil for each yolk omitted", amount: "2 whites + 1-3 tsp. oil" },
      { substitute: "egg white, nonfat dry milk powder, and vegetable oil", amount: "1 white + 2 1/4 tsp. + 2 tsp.", note: "may store 1 week in refrigerator or freezer" },
      { substitute: "water plus baking powder", amount: "2 tbsp. + 1/2 tsp.", note: "in cookies and cakes only" },
      { substitute: "flour, shortening, baking powder, liquid", amount: "2 tbsp. + 1/2 tbsp. + 1/2 tsp. + 2 tbsp.", note: "for each egg in recipes that call for 2 or 3 eggs" }
    ]
  },
  {
    ingredient: "Egg white",
    amount: "1 large (2 tbsp.)",
    substitutes: [
      { substitute: "thawed frozen egg white", amount: "2 tbsp." },
      { substitute: "sifted, dry egg white powder and lukewarm water", amount: "2 tsp. + 2 tbsp." }
    ]
  },
  {
    ingredient: "Egg white",
    amount: "1 cup",
    substitutes: [
      { substitute: "large egg whites", amount: "8" }
    ]
  },
  {
    ingredient: "Egg yolk",
    amount: "1 yolk (1 1/2 tbsp.)",
    substitutes: [
      { substitute: "sifted dry egg yolk powder and water", amount: "2 tbsp. + 2 tsp." },
      { substitute: "thawed frozen egg yolk", amount: "1 1/3 tbsp." }
    ]
  },
  {
    ingredient: "Extracts",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "oil of similar flavor", amount: "1/4 tsp." }
    ]
  },
  {
    ingredient: "Extracts",
    amount: "1/4 tsp.",
    substitutes: [
      { substitute: "oil of similar flavor", amount: "2 drops", note: "oils won't evaporate at high temperatures" }
    ]
  },
  {
    ingredient: "Flavor-based oil",
    amount: "1/4 tsp.",
    substitutes: [
      { substitute: "extract of same flavor", amount: "1 tsp." }
    ]
  },
  {
    ingredient: "Flavor-based oil",
    amount: "2 drops",
    substitutes: [
      { substitute: "extract of same flavor", amount: "1/4 tsp." }
    ]
  },
  {
    ingredient: "Flour, all-purpose (for thickening)",
    amount: "1 tbsp.",
    substitutes: [
      { substitute: "cornstarch, arrowroot starch, potato starch, or rice starch", amount: "1 1/2 tsp." },
      { substitute: "granular tapioca", amount: "1 tbsp." },
      { substitute: "quick-cooking tapioca", amount: "2-3 tsp." },
      { substitute: "waxy rice flour", amount: "1 tbsp." },
      { substitute: "waxy corn flour", amount: "1 tbsp." },
      { substitute: "browned flour", amount: "2 tbsp." },
      { substitute: "whole wheat flour", amount: "1 1/2 tbsp." },
      { substitute: "whole wheat flour and all-purpose flour", amount: "1/2 tbsp. + 1/2 tbsp." }
    ]
  },
  {
    ingredient: "Flour, all-purpose",
    amount: "1 cup sifted",
    substitutes: [
      { substitute: "cake flour", amount: "1 cup + 2 tbsp." },
      { substitute: "unsifted all-purpose flour", amount: "1 cup - 2 tbsp." },
      { substitute: "bread crumbs", amount: "1 1/2 cup" },
      { substitute: "rolled oats", amount: "1 cup" },
      { substitute: "rye flour", amount: "1 1/4 cup" },
      { substitute: "rice flour", amount: "3/4 cup" },
      { substitute: "oat flour", amount: "1 1/2 cup" },
      { substitute: "corn flour", amount: "1 cup" },
      { substitute: "coarse cornmeal", amount: "3/4 cup" },
      { substitute: "fine cornmeal", amount: "1 cup" },
      { substitute: "potato starch flour", amount: "7/8 cup" },
      { substitute: "barley flour", amount: "1 1/2 cup" },
      { substitute: "cornmeal or soybean flour plus all-purpose flour", amount: "1/3 cup + 2/3 cup" },
      { substitute: "cornmeal, bran, rice flour, rye flour or whole wheat flour plus all-purpose flour", amount: "1/2 cup + 1/2 cup" },
      { substitute: "whole wheat flour or bran flour and all-purpose flour", amount: "3/4 cup + 1/4 cup" },
      { substitute: "soybean flour and all-purpose flour", amount: "1/4 cup + 3/4 cup" },
      { substitute: "wheat germ plus all-purpose flour", amount: "1/3 cup + 2/3 cup" }
    ]
  },
  {
    ingredient: "Flour, cake",
    amount: "1 cup sifted",
    substitutes: [
      { substitute: "sifted all-purpose flour", amount: "1 cup - 2 tbsp. (7/8 cup)" }
    ]
  },
  {
    ingredient: "Flour, pastry",
    amount: "1 cup",
    substitutes: [
      { substitute: "all-purpose flour", amount: "7/8 cup" }
    ]
  },
  {
    ingredient: "Flour, self-rising",
    amount: "1 cup",
    substitutes: [
      { substitute: "all-purpose flour, baking powder, and salt", amount: "1 cup - 2 tsp. + 1 1/2 tsp. + 1/2 tsp." }
    ]
  },
  {
    ingredient: "Flour, whole wheat",
    amount: "1 cup",
    substitutes: [
      { substitute: "white wheat flour", amount: "1 cup" },
      { substitute: "graham flour", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Garlic",
    amount: "1 clove, small",
    substitutes: [
      { substitute: "garlic powder", amount: "1/8 tsp." },
      { substitute: "instant minced garlic", amount: "1/4 tsp." }
    ]
  },
  {
    ingredient: "Garlic salt",
    amount: "3/4 tsp.",
    substitutes: [
      { substitute: "medium size clove or minced fresh", amount: "1 clove or 1/2 tsp." }
    ]
  },
  {
    ingredient: "Garlic salt",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "garlic powder plus salt", amount: "1/8 tsp. + 7/8 tsp." }
    ]
  },
  {
    ingredient: "Gelatin, flavored",
    amount: "3-oz. package",
    substitutes: [
      { substitute: "plain gelatin and fruit juice", amount: "1 tbsp. + 2 cups" }
    ]
  },
  {
    ingredient: "Ginger, powdered",
    amount: "1/8 tsp.",
    substitutes: [
      { substitute: "candied ginger rinsed in water to remove sugar, finely cut", amount: "1 tbsp." },
      { substitute: "raw ginger", amount: "1 tbsp." }
    ]
  },
  {
    ingredient: "Herbs, dried",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "fresh, finely cut", amount: "1 tbsp." }
    ]
  },
  {
    ingredient: "Herbs, fresh",
    amount: "1 tbsp., finely cut",
    substitutes: [
      { substitute: "dried herbs", amount: "1 tsp." },
      { substitute: "ground herbs", amount: "1/2 tsp." }
    ]
  },
  {
    ingredient: "Honey",
    amount: "1 cup",
    substitutes: [
      { substitute: "sugar and liquid", amount: "1 1/4 cup + 1/4 cup", note: "use liquid called for in recipe" }
    ]
  },
  {
    ingredient: "Horseradish",
    amount: "1 tbsp., fresh",
    substitutes: [
      { substitute: "bottled", amount: "2 tbsp." }
    ]
  },
  {
    ingredient: "Lemon",
    amount: "1 medium",
    substitutes: [
      { substitute: "lemon juice and rind", amount: "2-3 tbsp. + 1-2 tsp." }
    ]
  },
  {
    ingredient: "Lemon juice",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "vinegar", amount: "1/2 tsp." }
    ]
  },
  {
    ingredient: "Lemon peel, dried",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "grated fresh lemon peel", amount: "1-2 tsp." },
      { substitute: "grated peel of 1 medium lemon", amount: "1 medium lemon" },
      { substitute: "lemon extract", amount: "1/2 tsp." }
    ]
  },
  {
    ingredient: "Lime",
    amount: "1 medium",
    substitutes: [
      { substitute: "lime juice", amount: "1 1/2-2 tbsp." }
    ]
  },
  {
    ingredient: "Macaroni (4 cups cooked)",
    amount: "2 cups, uncooked",
    substitutes: [
      { substitute: "spaghetti, uncooked", amount: "2 cups" },
      { substitute: "noodles, uncooked", amount: "4 cups" }
    ]
  },
  {
    ingredient: "Maple sugar",
    amount: "1/2 cup",
    substitutes: [
      { substitute: "maple syrup", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Maple sugar (grated and packed)",
    amount: "1 tbsp.",
    substitutes: [
      { substitute: "white, granulated sugar", amount: "1 tbsp." }
    ]
  },
  {
    ingredient: "Marshmallows, miniature",
    amount: "1 cup",
    substitutes: [
      { substitute: "large marshmallows", amount: "10" }
    ]
  },
  {
    ingredient: "Mayonnaise (for salads and salad dressings)",
    amount: "1 cup",
    substitutes: [
      { substitute: "yogurt and mayonnaise", amount: "1/2 cup + 1/2 cup" },
      { substitute: "salad dressing", amount: "1 cup" },
      { substitute: "sour cream", amount: "1 cup" },
      { substitute: "plain yogurt", amount: "1 cup" },
      { substitute: "cottage cheese pureed in a blender", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Mei Yen seasoning",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "Beau Monde seasoning", amount: "1 tsp." },
      { substitute: "table salt", amount: "1/2 tsp." }
    ]
  },
  {
    ingredient: "Milk, buttermilk",
    amount: "1 cup",
    substitutes: [
      { substitute: "plain yogurt", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Milk, buttermilk or sour",
    amount: "1 cup",
    substitutes: [
      { substitute: "sweet milk plus lemon juice or vinegar", amount: "1 cup - 1 tbsp. + 1 tbsp.", note: "allow to stand 5-10 minutes" },
      { substitute: "sweet milk and cream of tartar", amount: "1 cup + 1 3/4 tsp." }
    ]
  },
  {
    ingredient: "Milk, evaporated (whole or skim)",
    amount: "1/2 cup plus 1/2 cup water",
    substitutes: [
      { substitute: "liquid whole milk", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Milk, evaporated",
    amount: "1 can (about 12 oz.)",
    substitutes: [
      { substitute: "nonfat dry milk and warm water", amount: "1 cup + 1 3/4 cups", note: "whip until smooth, keep refrigerated" }
    ]
  },
  {
    ingredient: "Milk, skim",
    amount: "1 cup",
    substitutes: [
      { substitute: "non-fat dry milk powder and water", amount: "4-5 tbsp. + water to make 1 cup", note: "or follow manufacturer's directions" },
      { substitute: "evaporated milk and water", amount: "1/2 cup + 1/2 cup" }
    ]
  },
  {
    ingredient: "Milk, skim",
    amount: "1/4 cup",
    substitutes: [
      { substitute: "non-fat dry milk powder plus water", amount: "4 tsp. + water to make 1/4 cup", note: "or follow manufacturer's directions" },
      { substitute: "evaporated skim milk and water", amount: "2 tbsp. + 2 tbsp." }
    ]
  },
  {
    ingredient: "Milk, sweetened condensed",
    amount: "1 can (about 1 1/3 cup)",
    substitutes: [
      { substitute: "Heat until sugar and butter are dissolved: evaporated milk, sugar, butter or margarine", amount: "1/3 cup + 2 tbsp. + 1 cup + 3 tbsp." },
      { substitute: "Add dry milk to warm water. Mix well. Add sugar and stir until smooth", amount: "1 cup + 2 tbsp. + 1/2 cup + 3/4 cup" }
    ]
  },
  {
    ingredient: "Milk, sweetened condensed",
    amount: "1 cup",
    substitutes: [
      { substitute: "Heat until sugar and butter are dissolved: evaporated milk, sugar, butter or margarine", amount: "1/3 cup + 3/4 cup + 2 tbsp." }
    ]
  },
  {
    ingredient: "Milk, sweetened condensed (to make about 1 1/4 cups in blender)",
    amount: "blender recipe",
    substitutes: [
      { substitute: "Combine instant nonfat dry milk, sugar, boiling water and margarine. Blend until smooth", amount: "1 cup + 2/3 cup + 1/3 cup + 3 tbsp.", note: "To thicken, let set in refrigerator for 24 hours" }
    ]
  },
  {
    ingredient: "Milk, whole",
    amount: "1 cup",
    substitutes: [
      { substitute: "reconstituted non-fat dry milk plus butter or margarine", amount: "1 cup + 2 tsp." },
      { substitute: "evaporated milk and water", amount: "1/2 cup + 1/2 cup" },
      { substitute: "buttermilk plus baking soda", amount: "1 cup + 1/2 tsp.", note: "for use in baking, decrease baking powder by 2 tsp." },
      { substitute: "whole dry milk and water", amount: "4 tbsp. + 1 cup", note: "or follow manufacturer's directions" },
      { substitute: "fruit juice or potato water", amount: "1 cup", note: "in baking" },
      { substitute: "non-fat dry milk, water and butter or margarine", amount: "1/4 cup + 7/8 cup + 2 tsp." },
      { substitute: "water plus butter", amount: "1 cup + 1 1/2 tsp.", note: "in baking" }
    ]
  },
  {
    ingredient: "Molasses",
    amount: "1 cup",
    substitutes: [
      { substitute: "sugar plus baking powder", amount: "3/4 cup + 2 tsp.", note: "increase liquid called for in recipe by 5 tbsp. and decrease baking soda by 1/2 tsp." },
      { substitute: "sugar plus cream of tartar", amount: "3/4 cup + 1 1/4 tsp.", note: "increase liquid called for in recipe by 5 tbsp." }
    ]
  },
  {
    ingredient: "Mushrooms",
    amount: "1 lb. fresh",
    substitutes: [
      { substitute: "dried mushrooms", amount: "3 oz." },
      { substitute: "canned mushrooms", amount: "6-8 oz. can" }
    ]
  },
  {
    ingredient: "Mushrooms, powdered",
    amount: "1 tbsp.",
    substitutes: [
      { substitute: "whole dried mushrooms", amount: "3 tbsp." },
      { substitute: "fresh mushrooms", amount: "4 oz." },
      { substitute: "canned mushrooms", amount: "2 oz." }
    ]
  },
  {
    ingredient: "Mustard, dry",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "prepared mustard", amount: "1 tbsp." },
      { substitute: "mustard seeds", amount: "1/2 tsp." }
    ]
  },
  {
    ingredient: "Onion, fresh",
    amount: "1 small",
    substitutes: [
      { substitute: "chopped, fresh onion", amount: "1/4 cup" },
      { substitute: "onion salt", amount: "1 1/3 tsp." },
      { substitute: "onion powder", amount: "1 tsp." },
      { substitute: "instant minced onions, rehydrated", amount: "1 tbsp." }
    ]
  },
  {
    ingredient: "Onion powder",
    amount: "1 tbsp.",
    substitutes: [
      { substitute: "medium onion, chopped", amount: "1" },
      { substitute: "fresh chopped onion", amount: "4 tbsp." }
    ]
  },
  {
    ingredient: "Orange",
    amount: "1 medium",
    substitutes: [
      { substitute: "orange juice", amount: "6-8 tbsp." }
    ]
  },
  {
    ingredient: "Orange peel, dried",
    amount: "1 tbsp.",
    substitutes: [
      { substitute: "grated fresh orange peel", amount: "2-3 tbsp." },
      { substitute: "grated peel of 1 medium orange", amount: "1 medium orange" }
    ]
  },
  {
    ingredient: "Orange peel, dried",
    amount: "2 tsp.",
    substitutes: [
      { substitute: "orange extract", amount: "1 tsp." }
    ]
  },
  {
    ingredient: "Orange peel, fresh",
    amount: "1 medium",
    substitutes: [
      { substitute: "grated fresh orange peel", amount: "2-3 tbsp." }
    ]
  },
  {
    ingredient: "Parsley, dried",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "fresh parsley, chopped", amount: "3 tsp." }
    ]
  },
  {
    ingredient: "Parsley, fresh",
    amount: "1 tbsp. chopped",
    substitutes: [
      { substitute: "dried leafy parsley", amount: "1 tsp." }
    ]
  },
  {
    ingredient: "Peppers, green bell",
    amount: "1 tbsp. dried",
    substitutes: [
      { substitute: "fresh green pepper, chopped", amount: "3 tbsp." }
    ]
  },
  {
    ingredient: "Peppers, red bell",
    amount: "1 tbsp. dried",
    substitutes: [
      { substitute: "fresh red pepper, chopped", amount: "3 tbsp." },
      { substitute: "chopped pimiento", amount: "2 tbsp." }
    ]
  },
  {
    ingredient: "Peppermint, dried",
    amount: "1 tbsp.",
    substitutes: [
      { substitute: "fresh mint, chopped", amount: "1/4 cup" }
    ]
  },
  {
    ingredient: "Peppermint extract",
    amount: "1 tbsp.",
    substitutes: [
      { substitute: "fresh mint, chopped", amount: "1/4 cup" }
    ]
  },
  {
    ingredient: "Pimiento",
    amount: "2 tbsp.",
    substitutes: [
      { substitute: "dried red bell peppers, rehydrated", amount: "1 tbsp." },
      { substitute: "fresh red bell pepper, chopped", amount: "3 tbsp." }
    ]
  },
  {
    ingredient: "Pumpkin pie spice",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "cinnamon, ginger, allspice, and nutmeg", amount: "1/2 tsp. + 1/4 tsp. + 1/8 tsp. + 1/8 tsp." }
    ]
  },
  {
    ingredient: "Rennet",
    amount: "1 tablet",
    substitutes: [
      { substitute: "liquid rennet", amount: "1 tbsp." }
    ]
  },
  {
    ingredient: "Rice (3 cups cooked)",
    amount: "1 cup regular, uncooked",
    substitutes: [
      { substitute: "uncooked converted rice", amount: "1 cup" },
      { substitute: "uncooked brown rice", amount: "1 cup" },
      { substitute: "uncooked wild rice", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Rice",
    amount: "1 cup cooked",
    substitutes: [
      { substitute: "cooked bulgur wheat", amount: "1 cup" },
      { substitute: "cooked pearl barley", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Rum",
    amount: "1/4 cup",
    substitutes: [
      { substitute: "rum extract plus liquid", amount: "1 tbsp. + 3 tbsp.", note: "use liquid called for in recipe or water" }
    ]
  },
  {
    ingredient: "Shortening, melted",
    amount: "1 cup",
    substitutes: [
      { substitute: "cooking oil", amount: "1 cup", note: "only for recipes that call for melted shortening" }
    ]
  },
  {
    ingredient: "Shortening, solid (used in baking)",
    amount: "1 cup",
    substitutes: [
      { substitute: "lard", amount: "1 cup - 2 tbsp." },
      { substitute: "unsalted butter", amount: "1 1/8 cups" },
      { substitute: "butter or margarine", amount: "1 1/8 cups", note: "decrease salt called for in recipe by 1/2 tsp." },
      { substitute: "shortening + applesauce, pureed prunes", amount: "1/4 cup + 3/4 cup", note: "add with liquid ingredients; reducing fat will give baked goods a denser texture" },
      { substitute: "shortening + ricotta cheese", amount: "1/4 cup + 3/4 cup", note: "in yeast breads; reducing fat will give baked goods a denser texture" }
    ]
  },
  {
    ingredient: "Shrimp, fresh",
    amount: "1 cup cleaned, cooked",
    substitutes: [
      { substitute: "raw in shell, clean and cook", amount: "3/4 lb." },
      { substitute: "frozen, peeled shrimp, cooked", amount: "7-oz. package" },
      { substitute: "canned shrimp", amount: "4 1/2-5 oz. can" }
    ]
  },
  {
    ingredient: "Sour cream, cultured",
    amount: "1 cup",
    substitutes: [
      { substitute: "sour milk or buttermilk and butter or margarine", amount: "3/4 cup + 1/3 cup" },
      { substitute: "buttermilk, lemon juice, and cottage cheese blended until smooth", amount: "1/3 cup + 1 tbsp. + 1 cup" },
      { substitute: "powdered nonfat dry milk, warm water, and vinegar", amount: "1 1/3 cups + 1/2 cup + 1 tbsp.", note: "mixture will thicken in refrigerator in a few hours" },
      { substitute: "evaporated milk plus vinegar", amount: "1 cup + 1 tbsp.", note: "allow to stand until it clabbers" },
      { substitute: "plain yogurt", amount: "1 cup", note: "in cooking add 1 tbsp. of cornstarch to each cup to prevent separating" },
      { substitute: "milk, lemon juice, and butter or margarine", amount: "3/4 cup + 3/4 tsp. + 1/3 cup" },
      { substitute: "buttermilk plus oil", amount: "3/4 cup + 1/4 cup" },
      { substitute: "cottage cheese and lemon juice, pureed in blender", amount: "1 cup + 2-3 tsp." }
    ]
  },
  {
    ingredient: "Spearmint, dried",
    amount: "1 tbsp.",
    substitutes: [
      { substitute: "fresh mint, chopped", amount: "1/4 cup" }
    ]
  },
  {
    ingredient: "Spearmint extract",
    amount: "1 tbsp.",
    substitutes: [
      { substitute: "fresh mint, chopped", amount: "1/4 cup" }
    ]
  },
  {
    ingredient: "Sugar, brown",
    amount: "1 cup firmly packed",
    substitutes: [
      { substitute: "granulated sugar", amount: "1 cup" },
      { substitute: "granulated sugar plus molasses", amount: "1 cup + 1/4 cup", note: "decrease liquid in the recipe by 3 tbsp." }
    ]
  },
  {
    ingredient: "Sugar, confectioners' or powdered",
    amount: "1 cup",
    substitutes: [
      { substitute: "granulated sugar", amount: "3/4 cup" }
    ]
  },
  {
    ingredient: "Sugar, white",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "honey or molasses", amount: "1/2-3/4 tsp." },
      { substitute: "noncaloric sweetener solution", amount: "1/8 tsp.", note: "or follow manufacturer's directions" }
    ]
  },
  {
    ingredient: "Sugar, white",
    amount: "1 cup",
    substitutes: [
      { substitute: "corn syrup", amount: "2 cups", note: "reduce liquid called for in recipe by 1/4 cup. Never replace more than 1/2 of sugar called for in recipe with corn syrup" },
      { substitute: "brown sugar, firmly packed", amount: "1 cup" },
      { substitute: "confectioners' sugar", amount: "1 3/4 cups", note: "for uses other than baking" },
      { substitute: "molasses plus soda", amount: "1 cup + 1/2 tsp.", note: "omit baking powder or use very little. Substitute molasses for no more than half the sugar. Reduce liquid in recipe by 1/4 cup per cup of molasses" },
      { substitute: "maple syrup", amount: "3/4 cup", note: "reduce liquid called for in recipe by 3 tbsp." },
      { substitute: "honey", amount: "3/4 cup", note: "decrease liquid called for in recipe by 1/4 cup. In baked goods, add 1/2 tsp. of baking soda for each cup of honey substituted and lower baking temperature 25 degrees" },
      { substitute: "corn syrup", amount: "1 1/2 cups", note: "decrease liquid called for in recipe by 1/4 cup" },
      { substitute: "molasses", amount: "1 1/3 cups", note: "decrease liquid called for in recipe by 1/3 cup" },
      { substitute: "powdered sugar", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Tapioca, granular",
    amount: "1 tbsp.",
    substitutes: [
      { substitute: "pearl tapioca", amount: "2 tbsp." },
      { substitute: "flour", amount: "1 tbsp." }
    ]
  },
  {
    ingredient: "Tomato juice",
    amount: "1 cup",
    substitutes: [
      { substitute: "tomato sauce and water", amount: "1/2 cup + 1/2 cup" }
    ]
  },
  {
    ingredient: "Tomatoes, fresh",
    amount: "2 cups chopped",
    substitutes: [
      { substitute: "canned tomatoes", amount: "16-oz. can", note: "may need to drain" }
    ]
  },
  {
    ingredient: "Tomatoes, chopped",
    amount: "16-oz. can",
    substitutes: [
      { substitute: "fresh medium tomatoes", amount: "3" },
      { substitute: "stewed tomatoes", amount: "16-oz. can" }
    ]
  },
  {
    ingredient: "Tomato sauce",
    amount: "15-oz. can",
    substitutes: [
      { substitute: "tomato paste and water", amount: "6-oz. can + 1 cup" }
    ]
  },
  {
    ingredient: "Tomato sauce",
    amount: "2 cups",
    substitutes: [
      { substitute: "tomato paste and water", amount: "3/4 cup + 1 cup" }
    ]
  },
  {
    ingredient: "Tomato soup",
    amount: "10 3/4-oz. can",
    substitutes: [
      { substitute: "tomato sauce and water", amount: "1 cup + 1/4 cup" }
    ]
  },
  {
    ingredient: "Wine, red",
    amount: "1 cup",
    substitutes: [
      { substitute: "grape juice or cranberry juice", amount: "1 cup" },
      { substitute: "water, lemon juice and sugar", amount: "13 tbsp. + 3 tbsp. + 1 tbsp." }
    ]
  },
  {
    ingredient: "Wine, white",
    amount: "1 cup",
    substitutes: [
      { substitute: "apple juice or white grape juice", amount: "1 cup" }
    ]
  },
  {
    ingredient: "Worcestershire sauce",
    amount: "1 tsp.",
    substitutes: [
      { substitute: "bottled steak sauce", amount: "1 tsp." }
    ]
  },
  {
    ingredient: "Yeast, active dry",
    amount: "1 tbsp. (1/4 oz.)",
    substitutes: [
      { substitute: "dry yeast", amount: "2 1/2 tsp." },
      { substitute: "compressed yeast cake", amount: "1 cake (3/5 oz.)" },
      { substitute: "active dry yeast", amount: "1 package (1/4 oz.)" }
    ]
  },
  {
    ingredient: "Yogurt, plain",
    amount: "1 cup",
    substitutes: [
      { substitute: "buttermilk", amount: "1 cup" },
      { substitute: "cottage cheese blended until smooth", amount: "1 cup" },
      { substitute: "sour cream", amount: "1 cup" }
    ]
  }
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
