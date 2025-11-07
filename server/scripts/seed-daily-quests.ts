import { db } from "../db";
import { dailyQuests, badges } from "../../shared/schema";
import { eq } from "drizzle-orm";

const questsData = [
  // ===== MAKE DRINK QUESTS =====
  {
    slug: "morning-boost",
    title: "Morning Energy Boost",
    description: "Make a caffeinated drink to start your day right",
    questType: "make_drink",
    category: "caffeinated",
    targetValue: 1,
    xpReward: 50,
    difficulty: "easy",
    recurringPattern: "weekday_only",
    metadata: {
      drinkCategory: "caffeinated",
      timeOfDay: "morning",
    },
  },
  {
    slug: "weekend-smoothie",
    title: "Weekend Smoothie Vibes",
    description: "Blend up a delicious smoothie this weekend",
    questType: "make_drink",
    category: "smoothies",
    targetValue: 1,
    xpReward: 50,
    difficulty: "easy",
    recurringPattern: "weekend_only",
    metadata: {
      drinkCategory: "smoothies",
    },
  },
  {
    slug: "protein-power",
    title: "Protein Power-Up",
    description: "Create a protein shake for your workout recovery",
    questType: "make_drink",
    category: "protein-shakes",
    targetValue: 1,
    xpReward: 75,
    difficulty: "medium",
    recurringPattern: "daily",
    metadata: {
      drinkCategory: "protein-shakes",
    },
  },
  {
    slug: "detox-delight",
    title: "Detox & Refresh",
    description: "Make a detox drink to cleanse and rejuvenate",
    questType: "make_drink",
    category: "detoxes",
    targetValue: 1,
    xpReward: 60,
    difficulty: "easy",
    recurringPattern: "daily",
    metadata: {
      drinkCategory: "detoxes",
    },
  },
  {
    slug: "evening-tea",
    title: "Evening Tea Time",
    description: "Brew a relaxing tea to wind down your day",
    questType: "make_drink",
    category: "caffeinated",
    targetValue: 1,
    xpReward: 50,
    difficulty: "easy",
    recurringPattern: "daily",
    metadata: {
      drinkCategory: "caffeinated",
      timeOfDay: "evening",
    },
  },

  // ===== TRY CATEGORY QUESTS =====
  {
    slug: "try-green-smoothie",
    title: "Go Green!",
    description: "Try a green smoothie packed with nutrients",
    questType: "try_category",
    category: "smoothies",
    targetValue: 1,
    xpReward: 75,
    difficulty: "medium",
    recurringPattern: "weekly",
    metadata: {
      drinkCategory: "smoothies/green",
    },
  },
  {
    slug: "explore-matcha",
    title: "Matcha Magic",
    description: "Explore the world of matcha drinks",
    questType: "try_category",
    category: "caffeinated",
    targetValue: 1,
    xpReward: 80,
    difficulty: "medium",
    recurringPattern: "weekly",
    metadata: {
      drinkCategory: "caffeinated/matcha",
    },
  },

  // ===== USE INGREDIENT QUESTS =====
  {
    slug: "banana-bonanza",
    title: "Banana Bonanza",
    description: "Create a drink using bananas",
    questType: "use_ingredient",
    targetValue: 1,
    xpReward: 60,
    difficulty: "easy",
    recurringPattern: "daily",
    metadata: {
      ingredient: "banana",
    },
  },
  {
    slug: "spinach-power",
    title: "Spinach Power",
    description: "Make a drink with spinach for iron and vitamins",
    questType: "use_ingredient",
    targetValue: 1,
    xpReward: 70,
    difficulty: "medium",
    recurringPattern: "daily",
    metadata: {
      ingredient: "spinach",
    },
  },
  {
    slug: "berry-blast",
    title: "Berry Blast",
    description: "Use berries in your drink for antioxidants",
    questType: "use_ingredient",
    targetValue: 1,
    xpReward: 65,
    difficulty: "easy",
    recurringPattern: "daily",
    metadata: {
      ingredient: "berries",
    },
  },

  // ===== SOCIAL ACTION QUESTS =====
  {
    slug: "share-creation",
    title: "Share Your Creation",
    description: "Post a photo of your drink to inspire others",
    questType: "social_action",
    targetValue: 1,
    xpReward: 100,
    difficulty: "medium",
    recurringPattern: "daily",
    metadata: {
      requiredAction: "create_post",
    },
  },
  {
    slug: "like-and-engage",
    title: "Spread the Love",
    description: "Like 5 other chefs' creations",
    questType: "social_action",
    targetValue: 5,
    xpReward: 75,
    difficulty: "easy",
    recurringPattern: "daily",
    metadata: {
      requiredAction: "like_posts",
    },
  },
  {
    slug: "comment-kindness",
    title: "Leave Some Feedback",
    description: "Comment on 3 recipes or posts",
    questType: "social_action",
    targetValue: 3,
    xpReward: 90,
    difficulty: "medium",
    recurringPattern: "daily",
    metadata: {
      requiredAction: "comment",
    },
  },

  // ===== STREAK MILESTONE QUESTS =====
  {
    slug: "three-day-streak",
    title: "3-Day Streak!",
    description: "Log in for 3 consecutive days",
    questType: "streak_milestone",
    targetValue: 3,
    xpReward: 150,
    difficulty: "medium",
    recurringPattern: "weekly",
    metadata: {},
  },
  {
    slug: "week-warrior",
    title: "Week Warrior",
    description: "Maintain a 7-day login streak",
    questType: "streak_milestone",
    targetValue: 7,
    xpReward: 300,
    difficulty: "hard",
    recurringPattern: "weekly",
    metadata: {},
  },

  // ===== SPECIAL/SEASONAL QUESTS =====
  {
    slug: "hydration-hero",
    title: "Hydration Hero",
    description: "Create 3 different drinks in one day",
    questType: "make_drink",
    targetValue: 3,
    xpReward: 200,
    difficulty: "hard",
    recurringPattern: "daily",
    metadata: {},
  },
  {
    slug: "recipe-explorer",
    title: "Recipe Explorer",
    description: "Try a recipe you've never made before",
    questType: "try_category",
    targetValue: 1,
    xpReward: 100,
    difficulty: "medium",
    recurringPattern: "daily",
    metadata: {},
  },
];

async function seedDailyQuests() {
  console.log("🌱 Seeding daily quests...");

  try {
    // Check if quests already exist
    const existingQuests = await db.select().from(dailyQuests).limit(1);

    if (existingQuests.length > 0) {
      console.log("⚠️  Daily quests already seeded. Skipping...");
      console.log("   To re-seed, delete existing quests first: DELETE FROM daily_quests;");
      return;
    }

    // Insert all quests
    for (const quest of questsData) {
      await db.insert(dailyQuests).values({
        slug: quest.slug,
        title: quest.title,
        description: quest.description,
        questType: quest.questType,
        category: quest.category || null,
        targetValue: quest.targetValue,
        xpReward: quest.xpReward,
        difficulty: quest.difficulty,
        isActive: true,
        recurringPattern: quest.recurringPattern || null,
        metadata: quest.metadata,
      });
      console.log(`   ✅ Created quest: ${quest.title}`);
    }

    console.log(`\n✅ Successfully seeded ${questsData.length} daily quests!`);
    console.log("\nQuest breakdown:");
    console.log(`   - Make Drink: ${questsData.filter((q) => q.questType === "make_drink").length}`);
    console.log(`   - Try Category: ${questsData.filter((q) => q.questType === "try_category").length}`);
    console.log(`   - Use Ingredient: ${questsData.filter((q) => q.questType === "use_ingredient").length}`);
    console.log(`   - Social Action: ${questsData.filter((q) => q.questType === "social_action").length}`);
    console.log(`   - Streak Milestone: ${questsData.filter((q) => q.questType === "streak_milestone").length}`);
  } catch (error) {
    console.error("❌ Error seeding daily quests:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDailyQuests()
    .then(() => {
      console.log("\n🎉 Seed complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Seed failed:", error);
      process.exit(1);
    });
}

export { seedDailyQuests };
