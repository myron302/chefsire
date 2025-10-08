// server/scripts/seed-competitions.ts
import "dotenv/config";
import crypto from "crypto";
import { db } from "../db";
import { competitions, competitionParticipants } from "../db/competitions";

/**
 * This script seeds a few example cooking competitions
 * so the Library page has data to show.
 * 
 * Usage:
 *   npm run db:seed:competitions
 */

async function main() {
  console.log("🍳 Seeding demo competitions...");

  // Replace with a real user ID if you have one, or let it randomize
  const demoUserId = crypto.randomUUID();

  const demoCompetitions = [
    {
      title: "30-Minute Pasta Throwdown",
      themeName: "Italian Classics",
      timeLimitMinutes: 30,
      isPrivate: false,
    },
    {
      title: "Taco Tuesday Rumble",
      themeName: "Street Tacos",
      timeLimitMinutes: 45,
      isPrivate: false,
    },
    {
      title: "Budget Bowl Challenge",
      themeName: "Budget Cooking",
      timeLimitMinutes: 60,
      isPrivate: false,
    },
    {
      title: "Vegan Brunch Bake-Off",
      themeName: "Plant-Based Brunch",
      timeLimitMinutes: 40,
      isPrivate: false,
    },
    {
      title: "Late-Night Dessert Duel",
      themeName: "Sweet Tooth",
      timeLimitMinutes: 35,
      isPrivate: false,
    },
  ];

  for (const comp of demoCompetitions) {
    const [created] = await db
      .insert(competitions)
      .values({
        creatorId: demoUserId,
        title: comp.title,
        themeName: comp.themeName,
        timeLimitMinutes: comp.timeLimitMinutes,
        isPrivate: comp.isPrivate,
        status: "upcoming",
      })
      .returning({ id: competitions.id });

    await db.insert(competitionParticipants).values({
      competitionId: created.id,
      userId: demoUserId,
      role: "host",
    });

    console.log(`✅ Created competition: ${comp.title}`);
  }

  console.log("🎉 Done seeding demo competitions!");
}

main()
  .then(() => {
    console.log("✅ Seed script completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error during seed:", err);
    process.exit(1);
  });
