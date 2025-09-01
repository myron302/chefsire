import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { users, posts, recipes, stories, likes, follows } from "../shared/schema.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function seedDatabase() {
  console.log("Starting database seeding...");

  try {
    console.log("Clearing existing data...");
    await db.delete(likes);
    await db.delete(follows);
    await db.delete(recipes);
    await db.delete(stories);
    await db.delete(posts);
    await db.delete(users);

    console.log("Creating sample users...");
    const sampleUsers = [
      {
        id: "user-1",
        username: "chef_alexandra",
        email: "alexandra@chefsire.com",
        password: "password123",
        displayName: "Chef Alexandra",
        bio: "Passionate about Italian cuisine and fresh ingredients",
        avatar: "https://images.unsplash.com/photo-1566554273541-37a9ca77b91f?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100",
        specialty: "Italian Cuisine",
        isChef: true,
        followersCount: 1200,
        followingCount: 150,
        postsCount: 1,
        cateringEnabled: true,
        cateringLocation: "06360",
        cateringRadius: 50,
        cateringBio: "Specializing in authentic Italian cuisine for weddings and special events",
        cateringAvailable: true,
        subscriptionTier: "professional",
        subscriptionStatus: "active",
        nutritionPremium: true
      },
      {
        id: "user-2",
        username: "chef_marcus",
        email: "marcus@chefsire.com",
        password: "password123",
        displayName: "Chef Marcus",
        bio: "Seafood specialist | Sustainable cooking advocate",
        avatar: "https://images.unsplash.com/photo-1607631568010-a87245c0daf8?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100",
        specialty: "Seafood",
        isChef: true,
        followersCount: 890,
        followingCount: 200,
        postsCount: 1,
        cateringEnabled: true,
        cateringLocation: "06360",
        cateringRadius: 25,
        cateringBio: "Fresh seafood and sustainable cooking for corporate events",
        cateringAvailable: true,
        subscriptionTier: "starter",
        subscriptionStatus: "active",
        nutritionPremium: false
      },
      {
        id: "user-3",
        username: "chef_isabella",
        email: "isabella@chefsire.com",
        password: "password123",
        displayName: "Chef Isabella",
        bio: "Dessert artisan creating sweet masterpieces",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100",
        specialty: "Pastry & Desserts",
        isChef: true,
        followersCount: 2100,
        followingCount: 95,
        postsCount: 1,
        cateringEnabled: false,
        subscriptionTier: "free",
        subscriptionStatus: "active",
        nutritionPremium: false
      }
    ];

    await db.insert(users).values(sampleUsers);
    console.log("Sample users created");

    console.log("Creating sample posts...");
    const samplePosts = [
      {
        id: "post-1",
        userId: "user-1",
        caption: "Just perfected my grandmother's pasta recipe! The secret is in the fresh basil and aged parmesan. Who wants the recipe?",
        imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc6d2c5f7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
        tags: ["pasta", "italian", "homemade"],
        likesCount: 234,
        commentsCount: 12,
        isRecipe: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
      },
      {
        id: "post-2",
        userId: "user-2",
        caption: "Honey Glazed Salmon with Roasted Vegetables - perfect balance of flavors and nutrients!",
        imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
        tags: ["salmon", "healthy", "seafood"],
        likesCount: 156,
        commentsCount: 23,
        isRecipe: true,
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000)
      },
      {
        id: "post-3",
        userId: "user-3",
        caption: "Watch me create this decadent chocolate mousse! The technique is everything - patience pays off!",
        imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
        tags: ["dessert", "chocolate", "technique"],
        likesCount: 89,
        commentsCount: 7,
        isRecipe: false,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    ];

    await db.insert(posts).values(samplePosts);
    console.log("Sample posts created");

    console.log("Creating sample recipe...");
    const sampleRecipe = {
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
        "Salt and pepper to taste"
      ],
      instructions: [
        "Preheat oven to 400°F (200°C)",
        "Mix honey, soy sauce, and garlic for glaze",
        "Season salmon with salt and pepper",
        "Brush salmon with glaze",
        "Roast vegetables with olive oil for 15 minutes",
        "Add salmon to pan and bake for 12-15 minutes",
        "Serve immediately"
      ],
      cookTime: 30,
      servings: 4,
      difficulty: "Easy",
      nutrition: {
        calories: 350,
        protein: "28g",
        carbs: "15g",
        fat: "18g"
      },
      calories: 350,
      protein: "28.0",
      carbs: "15.0",
      fat: "18.0",
      fiber: "3.0"
    };

    await db.insert(recipes).values([sampleRecipe]);
    console.log("Sample recipe created");

    console.log("Creating sample stories...");
    const sampleStories = [
      {
        id: "story-1",
        userId: "user-1",
        imageUrl: "https://images.unsplash.com/photo-1595257841889-eca2678454e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&h=200",
        caption: "Making fresh pasta from scratch!",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
      },
      {
        id: "story-2",
        userId: "user-2",
        imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&h=200",
        caption: "Fresh bread cooling down",
        expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
      }
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
      { id: "like-6", userId: "user-2", postId: "post-3" }
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
      { id: "follow-6", followerId: "user-3", followingId: "user-2" }
    ];

    await db.insert(follows).values(sampleFollows);
    console.log("Sample follows created");

    console.log("Database seeding completed successfully!");
    console.log("Sample data created:");
    console.log("- 3 chef users (with catering enabled for 2 of them)");
    console.log("- 3 posts (1 with recipe)");
    console.log("- 1 detailed recipe");
    console.log("- 2 active stories");
    console.log("- 6 likes");
    console.log("- 6 follow relationships");

  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedDatabase().catch(console.error);
