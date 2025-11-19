import "./lib/load-env"
import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import {
  users,
  posts,
  recipes,
  stories,
  likes,
  follows,
  comments,
  cateringInquiries,
  products,
  orders,
  subscriptionHistory,
  mealPlans,
  mealPlanEntries,
  pantryItems,
  nutritionLogs,
  customDrinks,
  drinkPhotos,
  drinkLikes,
  drinkSaves,
  userDrinkStats,
} from "../shared/schema.js";

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`${name} is missing. In production, set it in Plesk → Custom environment variables.`);
  }
  return v;
}

const DATABASE_URL = reqEnv("DATABASE_URL");
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function seedDatabase() {
  console.log("Starting database seeding...");

  try {
    console.log("Clearing existing data...");
    
    // DELETE IN CORRECT ORDER: Children first, parents last!
    // Delete drink-related child tables first
    await db.delete(drinkSaves);
    await db.delete(drinkLikes);
    await db.delete(drinkPhotos);
    await db.delete(customDrinks);
    await db.delete(userDrinkStats);
    
    // Delete other user-related child tables
    await db.delete(nutritionLogs);
    await db.delete(pantryItems);
    await db.delete(mealPlanEntries);
    await db.delete(mealPlans);
    await db.delete(subscriptionHistory);
    await db.delete(orders);
    await db.delete(cateringInquiries);
    await db.delete(follows);
    await db.delete(comments);
    await db.delete(likes);
    
    // Delete posts and related
    await db.delete(recipes);
    await db.delete(stories);
    await db.delete(posts);
    
    // Delete products
    await db.delete(products);
    
    // Finally delete users (LAST!)
    await db.delete(users);

    console.log("Creating sample users...");
    const plainPassword = "password123";
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const sampleUsers = [
      {
        id: "user-1",
        username: "chef_alexandra",
        email: "alexandra@chefsire.com",
        password: hashedPassword,
        displayName: "Chef Alexandra",
        bio: "Passionate about Italian cuisine and fresh ingredients",
        avatar:
          "https://api.dicebear.com/7.x/avataaars/svg?seed=chef-alexandra&backgroundColor=b6e3f4,c0aede,d1d4f9",
        specialty: "Italian Cuisine",
        isChef: true,
        followersCount: 1200,
        followingCount: 150,
        postsCount: 1,
        cateringEnabled: true,
        cateringLocation: "06360",
        cateringRadius: 50,
        cateringBio:
          "Specializing in authentic Italian cuisine for weddings and special events",
        cateringAvailable: true,
        subscriptionTier: "professional",
        subscriptionStatus: "active",
        nutritionPremium: true,
      },
      {
        id: "user-2",
        username: "chef_marcus",
        email: "marcus@chefsire.com",
        password: hashedPassword,
        displayName: "Chef Marcus",
        bio: "Seafood specialist | Sustainable cooking advocate",
        avatar:
          "https://api.dicebear.com/7.x/avataaars/svg?seed=chef-marcus&backgroundColor=ffb3ba,bae1ff,ffffba",
        specialty: "Seafood",
        isChef: true,
        followersCount: 890,
        followingCount: 200,
        postsCount: 1,
        cateringEnabled: true,
        cateringLocation: "06360",
        cateringRadius: 25,
        cateringBio:
          "Fresh seafood and sustainable cooking for corporate events",
        cateringAvailable: true,
        subscriptionTier: "starter",
        subscriptionStatus: "active",
        nutritionPremium: false,
      },
      {
        id: "user-3",
        username: "chef_isabella",
        email: "isabella@chefsire.com",
        password: hashedPassword,
        displayName: "Chef Isabella",
        bio: "Dessert artisan creating sweet masterpieces",
        avatar:
          "https://api.dicebear.com/7.x/avataaars/svg?seed=chef-isabella&backgroundColor=c7cedb,ffd1dc,e6e6fa",
        specialty: "Pastry & Desserts",
        isChef: true,
        followersCount: 2100,
        followingCount: 95,
        postsCount: 1,
        cateringEnabled: false,
        subscriptionTier: "free",
        subscriptionStatus: "active",
        nutritionPremium: false,
      },
      {
        id: "user-4",
        username: "chefmaria",
        email: "maria@chefsire.com",
        password: hashedPassword,
        displayName: "Chef Maria",
        bio: "Fresh pasta and authentic Italian recipes",
        avatar:
          "https://api.dicebear.com/7.x/avataaars/svg?seed=chefmaria&backgroundColor=f7cac9,f7786b,c4e17f",
        specialty: "Italian Pasta",
        isChef: true,
        followersCount: 850,
        followingCount: 120,
        postsCount: 2,
        cateringEnabled: true,
        cateringLocation: "06360",
        cateringRadius: 30,
        cateringBio:
          "Handmade pasta catering for intimate gatherings",
        cateringAvailable: true,
        subscriptionTier: "starter",
        subscriptionStatus: "active",
        nutritionPremium: false,
      },
      {
        id: "user-5",
        username: "bakerben",
        email: "ben@chefsire.com",
        password: hashedPassword,
        displayName: "Baker Ben",
        bio: "Artisan breads and morning pastries",
        avatar:
          "https://api.dicebear.com/7.x/avataaars/svg?seed=bakerben&backgroundColor=a8e6cf,dcedc1,ffd3a5",
        specialty: "Bakery & Breads",
        isChef: true,
        followersCount: 650,
        followingCount: 80,
        postsCount: 1,
        cateringEnabled: false,
        subscriptionTier: "free",
        subscriptionStatus: "active",
        nutritionPremium: false,
      },
      {
        id: "user-6",
        username: "veggievibes",
        email: "veggie@chefsire.com",
        password: hashedPassword,
        displayName: "Veggie Vibes",
        bio: "Plant-based nutrition and colorful meals",
        avatar:
          "https://api.dicebear.com/7.x/avataaars/svg?seed=veggievibes&backgroundColor=ffb3de,c9c9ff,b5ead7",
        specialty: "Plant-Based",
        isChef: true,
        followersCount: 920,
        followingCount: 200,
        postsCount: 1,
        cateringEnabled: true,
        cateringLocation: "06360",
        cateringRadius: 40,
        cateringBio:
          "Healthy plant-based catering for events",
        cateringAvailable: true,
        subscriptionTier: "professional",
        subscriptionStatus: "active",
        nutritionPremium: true,
      },
      {
        id: "user-7",
        username: "dessertqueen",
        email: "dessert@chefsire.com",
        password: hashedPassword,
        displayName: "Dessert Queen",
        bio: "Decadent desserts and sweet creations",
        avatar:
          "https://api.dicebear.com/7.x/avataaars/svg?seed=dessertqueen&backgroundColor=d4af37,ffd700,ffb347",
        specialty: "Desserts & Sweets",
        isChef: true,
        followersCount: 1100,
        followingCount: 90,
        postsCount: 1,
        cateringEnabled: true,
        cateringLocation: "06360",
        cateringRadius: 35,
        cateringBio:
          "Custom dessert catering and wedding cakes",
        cateringAvailable: true,
        subscriptionTier: "starter",
        subscriptionStatus: "active",
        nutritionPremium: false,
      },
    ];

    await db.insert(users).values(sampleUsers);
    console.log("Sample users created");

    console.log("Creating sample marketplace products...");
    const sampleProducts = [
      // Chef Alexandra's products (Italian cuisine)
      {
        id: "prod-1",
        sellerId: "user-1",
        name: "Italian Pasta Making Kit",
        description: "Complete kit with premium Italian flour, fresh eggs, and my secret pasta recipe",
        price: "49.99",
        inventory: 25,
        category: "kits",
        imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=400&h=400&fit=crop&auto=format",
        productCategory: "physical",
        deliveryMethods: ["shipped"],
        isAvailable: true,
      },
      {
        id: "prod-2",
        sellerId: "user-1",
        name: "Aged Parmesan Cheese (1lb)",
        description: "Authentic Parmigiano-Reggiano aged 24 months, imported from Italy",
        price: "32.50",
        inventory: 15,
        category: "ingredients",
        imageUrl: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&h=400&fit=crop&auto=format",
        productCategory: "physical",
        deliveryMethods: ["shipped"],
        isAvailable: true,
      },
      // Chef Marcus's products (Seafood)
      {
        id: "prod-3",
        sellerId: "user-2",
        name: "Wild-Caught Salmon Fillet (2lbs)",
        description: "Fresh Alaskan wild-caught salmon, sustainably sourced",
        price: "45.00",
        inventory: 10,
        category: "seafood",
        imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=400&fit=crop&auto=format",
        productCategory: "physical",
        deliveryMethods: ["shipped", "local_pickup"],
        isAvailable: true,
      },
      {
        id: "prod-4",
        sellerId: "user-2",
        name: "Seafood Seasoning Blend",
        description: "My signature seafood seasoning blend with herbs and spices",
        price: "18.99",
        inventory: 50,
        category: "ingredients",
        imageUrl: "https://images.unsplash.com/photo-1596040033229-a0b76127d2b1?w=400&h=400&fit=crop&auto=format",
        productCategory: "physical",
        deliveryMethods: ["shipped"],
        isAvailable: true,
      },
      // Chef Isabella's products (Pastry & Desserts)
      {
        id: "prod-5",
        sellerId: "user-3",
        name: "Artisan Chocolate Truffles (12pc)",
        description: "Handcrafted Belgian chocolate truffles with assorted flavors",
        price: "28.00",
        inventory: 20,
        category: "desserts",
        imageUrl: "https://images.unsplash.com/photo-1548848438-d2a0aa0f7a66?w=400&h=400&fit=crop&auto=format",
        productCategory: "physical",
        deliveryMethods: ["shipped", "local_pickup"],
        isAvailable: true,
      },
      {
        id: "prod-6",
        sellerId: "user-3",
        name: "Professional Pastry Tools Set",
        description: "Complete set of professional-grade pastry tools and piping tips",
        price: "89.99",
        inventory: 12,
        category: "equipment",
        imageUrl: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=400&fit=crop&auto=format",
        productCategory: "physical",
        deliveryMethods: ["shipped"],
        isAvailable: true,
      },
      // Baker Ben's products
      {
        id: "prod-7",
        sellerId: "user-5",
        name: "Sourdough Starter Kit",
        description: "Live sourdough starter with feeding instructions and recipe book",
        price: "24.99",
        inventory: 30,
        category: "kits",
        imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop&auto=format",
        productCategory: "physical",
        deliveryMethods: ["shipped", "local_pickup"],
        isAvailable: true,
      },
      {
        id: "prod-8",
        sellerId: "user-5",
        name: "Artisan Bread Sampler",
        description: "Selection of 3 freshly baked artisan breads - sourdough, rye, and multigrain",
        price: "35.00",
        inventory: 8,
        category: "baked_goods",
        imageUrl: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400&h=400&fit=crop&auto=format",
        productCategory: "physical",
        deliveryMethods: ["local_pickup"],
        isAvailable: true,
      },
      // Veggie Vibes products
      {
        id: "prod-9",
        sellerId: "user-6",
        name: "Plant-Based Protein Power Bowl Kit",
        description: "Complete kit with quinoa, chickpeas, tahini sauce, and my special spice blend",
        price: "38.50",
        inventory: 15,
        category: "kits",
        imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop&auto=format",
        productCategory: "physical",
        deliveryMethods: ["shipped"],
        isAvailable: true,
      },
      {
        id: "prod-10",
        sellerId: "user-6",
        name: "Organic Superfood Smoothie Mix",
        description: "Blend of organic superfoods: spirulina, maca, chia, and hemp seeds",
        price: "42.00",
        inventory: 25,
        category: "ingredients",
        imageUrl: "https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&h=400&fit=crop&auto=format",
        productCategory: "physical",
        deliveryMethods: ["shipped"],
        isAvailable: true,
      },
      // Dessert Queen's products
      {
        id: "prod-11",
        sellerId: "user-7",
        name: "Gourmet Cupcake Box (6pc)",
        description: "Assorted gourmet cupcakes with premium frosting and decorations",
        price: "36.00",
        inventory: 10,
        category: "desserts",
        imageUrl: "https://images.unsplash.com/photo-1587668352745-fca4e8d6673c?w=400&h=400&fit=crop&auto=format",
        productCategory: "physical",
        deliveryMethods: ["local_pickup"],
        isAvailable: true,
      },
      {
        id: "prod-12",
        sellerId: "user-7",
        name: "Cake Decorating Masterclass (Online)",
        description: "2-hour virtual masterclass on advanced cake decorating techniques",
        price: "79.99",
        inventory: 100,
        category: "classes",
        imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&auto=format",
        productCategory: "digital",
        deliveryMethods: ["digital"],
        isAvailable: true,
      },
    ];

    await db.insert(products).values(sampleProducts);
    console.log("Sample marketplace products created");

    console.log("Creating sample posts...");
    const samplePosts = [
      {
        id: "post-1",
        userId: "user-1",
        caption:
          "Just perfected my grandmother's pasta recipe! The secret is in the fresh basil and aged parmesan. Who wants the recipe?",
        imageUrl:
          "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=800&h=600&fit=crop&auto=format",
        tags: ["pasta", "italian", "homemade"],
        likesCount: 234,
        commentsCount: 12,
        isRecipe: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        id: "post-2",
        userId: "user-2",
        caption:
          "Honey Glazed Salmon with Roasted Vegetables - perfect balance of flavors and nutrients!",
        imageUrl:
          "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop&auto=format",
        tags: ["salmon", "healthy", "seafood"],
        likesCount: 156,
        commentsCount: 23,
        isRecipe: true,
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      },
      {
        id: "post-3",
        userId: "user-3",
        caption:
          "Watch me create this decadent chocolate mousse! The technique is everything - patience pays off!",
        imageUrl:
          "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop&auto=format",
        tags: ["dessert", "chocolate", "technique"],
        likesCount: 89,
        commentsCount: 7,
        isRecipe: false,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        id: "post-4",
        userId: "user-4",
        caption:
          "Fresh handmade fettuccine with wild mushroom ragu. Nothing beats the texture of fresh pasta!",
        imageUrl:
          "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&h=600&fit=crop&auto=format",
        tags: ["pasta", "mushrooms", "handmade"],
        likesCount: 178,
        commentsCount: 15,
        isRecipe: true,
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      },
      {
        id: "post-5",
        userId: "user-5",
        caption:
          "Early morning sourdough batch fresh from the oven. The aroma fills the entire kitchen!",
        imageUrl:
          "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=600&fit=crop&auto=format",
        tags: ["bread", "sourdough", "artisan"],
        likesCount: 145,
        commentsCount: 9,
        isRecipe: false,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
    ];

    await db.insert(posts).values(samplePosts);
    console.log("Sample posts created");

    console.log("Creating sample recipes...");
    const sampleRecipes = [
      {
        id: "recipe-1",
        postId: "post-2",
        title: "Honey Glazed Salmon with Roasted Vegetables",
        ingredients: [
          "4 salmon fillets",
          "2 tbsp honey",
          "1 tbsp soy sauce",
          "2 cloves garlic, minced",
          "Mixed vegetables (broccoli, carrots, bell peppers)",
          "Olive oil",
          "Salt and pepper to taste",
        ],
        instructions: [
          "Preheat oven to 400°F (200°C)",
          "Mix honey, soy sauce, and garlic for glaze",
          "Season salmon with salt and pepper",
          "Brush salmon with glaze",
          "Roast vegetables with olive oil for 15 minutes",
          "Add salmon to pan and bake for 12-15 minutes",
          "Serve immediately",
        ],
        cookTime: 30,
        servings: 4,
        difficulty: "Easy",
        nutrition: {
          calories: 350,
          protein: "28g",
          carbs: "15g",
          fat: "18g",
        },
        calories: 350,
        protein: "28.0",
        carbs: "15.0",
        fat: "18.0",
        fiber: "3.0",
      },
      {
        id: "recipe-2",
        postId: "post-4",
        title: "Fresh Fettuccine with Wild Mushroom Ragu",
        ingredients: [
          "2 cups all-purpose flour",
          "3 large eggs",
          "1 lb mixed wild mushrooms",
          "1/2 cup white wine",
          "2 tbsp olive oil",
          "2 cloves garlic, minced",
          "Fresh thyme",
          "Parmesan cheese",
          "Salt and pepper to taste",
        ],
        instructions: [
          "Make pasta dough with flour and eggs, knead until smooth",
          "Rest dough for 30 minutes",
          "Roll out and cut into fettuccine",
          "Sauté mushrooms with garlic and thyme",
          "Add wine and simmer",
          "Cook pasta in salted water until al dente",
          "Toss pasta with mushroom ragu",
          "Serve with fresh Parmesan",
        ],
        cookTime: 45,
        servings: 4,
        difficulty: "Medium",
        nutrition: {
          calories: 420,
          protein: "18g",
          carbs: "52g",
          fat: "14g",
        },
        calories: 420,
        protein: "18.0",
        carbs: "52.0",
        fat: "14.0",
        fiber: "4.0",
      },
    ];

    await db.insert(recipes).values(sampleRecipes);
    console.log("Sample recipes created");

    console.log("Creating sample stories...");
    const sampleStories = [
      {
        id: "story-1",
        userId: "user-4",
        imageUrl:
          "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=400&h=600&fit=crop&auto=format",
        caption: "Fresh pasta making process!",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        id: "story-2",
        userId: "user-4",
        imageUrl:
          "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=600&fit=crop&auto=format",
        caption: "The final result! Nothing beats fresh pasta",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      },
      {
        id: "story-3",
        userId: "user-5",
        imageUrl:
          "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=600&fit=crop&auto=format",
        caption: "Early morning bread prep",
        expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      },
      {
        id: "story-4",
        userId: "user-6",
        imageUrl:
          "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=600&fit=crop&auto=format",
        caption: "Rainbow veggie prep for the week!",
        expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      },
      {
        id: "story-5",
        userId: "user-7",
        imageUrl:
          "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=600&fit=crop&auto=format",
        caption: "Chocolate soufflé perfection",
        expiresAt: new Date(Date.now() + 16 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      },
    ];

    await db.insert(stories).values(sampleStories);
    console.log("Sample stories created");

    console.log("Creating sample likes...");
    const sampleLikes = [
      { id: "like-1", userId: "user-2", postId: "post-1" },
      { id: "like-2", userId: "user-3", postId: "post-1" },
      { id: "like-3", userId: "user-1", postId: "post-2" },
      { id: "like-4", userId: "user-3", postId: "post-2" },
      { id: "like-5", userId: "user-1", postId: "post-3" },
      { id: "like-6", userId: "user-2", postId: "post-3" },
      { id: "like-7", userId: "user-1", postId: "post-4" },
      { id: "like-8", userId: "user-2", postId: "post-4" },
      { id: "like-9", userId: "user-3", postId: "post-5" },
      { id: "like-10", userId: "user-4", postId: "post-5" },
    ];

    await db.insert(likes).values(sampleLikes);
    console.log("Sample likes created");

    console.log("Creating sample follows...");
    const sampleFollows = [
      { id: "follow-1", followerId: "user-1", followingId: "user-2" },
      { id: "follow-2", followerId: "user-1", followingId: "user-3" },
      { id: "follow-3", followerId: "user-2", followingId: "user-1" },
      { id: "follow-4", followerId: "user-2", followingId: "user-3" },
      { id: "follow-5", followerId: "user-3", followingId: "user-1" },
      { id: "follow-6", followerId: "user-3", followingId: "user-2" },
      { id: "follow-7", followerId: "user-4", followingId: "user-1" },
      { id: "follow-8", followerId: "user-4", followingId: "user-5" },
      { id: "follow-9", followerId: "user-5", followingId: "user-4" },
      { id: "follow-10", followerId: "user-6", followingId: "user-7" },
      { id: "follow-11", followerId: "user-7", followingId: "user-6" },
      { id: "follow-12", followerId: "user-1", followingId: "user-4" },
    ];

    await db.insert(follows).values(sampleFollows);
    console.log("Sample follows created");

    console.log("Database seeding completed successfully!");
    console.log("Sample data created:");
    console.log("- 7 chef users");
    console.log("- 12 marketplace products");
    console.log("- 5 posts (2 with recipes)");
    console.log("- 2 detailed recipes");
    console.log("- 5 active stories");
    console.log("- 10 likes");
    console.log("- 12 follow relationships");
    console.log("\n✅ Test login: email=alexandra@chefsire.com, password=password123");
  } catch (error) {
    console.error("Error seeding database:", (error as Error).message);
    throw error;
  } finally {
    await pool.end();
  }
}

seedDatabase().catch((e) => {
  console.error(e);
  process.exit(1);
});
