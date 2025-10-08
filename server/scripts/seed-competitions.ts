// server/scripts/seed-competitions.ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";

import {
  competitions,
  competitionParticipants,
  competitionVotes,
  scoreTotal,
} from "../db/competitions.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("❌ Missing DATABASE_URL in environment");
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function seed() {
  console.log("🌱 Seeding cooking competitions...");

  // Clean old data
  await db.delete(competitionVotes);
  await db.delete(competitionParticipants);
  await db.delete(competitions);

  // --- 1️⃣ Insert competitions ---
  const inserted = await db
    .insert(competitions)
    .values([
      {
        id: "comp-italian-night",
        creatorId: "user-demo-1",
        title: "Italian Night Cookoff",
        themeName: "Italian Cuisine",
        status: "completed",
        isPrivate: false,
        timeLimitMinutes: 90,
        minOfficialVoters: 3,
        startTime: sql`now() - interval '3 days'`,
        endTime: sql`now() - interval '3 days' + interval '1 hour'`,
        judgingClosesAt: sql`now() - interval '2 days'`,
        videoRecordingUrl: "https://example.com/replays/italian-night.mp4",
        winnerParticipantId: "pasta-queen",
        isOfficial: true,
      },
      {
        id: "comp-dessert-showdown",
        creatorId: "user-demo-2",
        title: "Dessert Showdown",
        themeName: "Desserts & Baking",
        status: "judging",
        isPrivate: false,
        timeLimitMinutes: 120,
        minOfficialVoters: 3,
        startTime: sql`now() - interval '1 hour'`,
        endTime: sql`now() + interval '1 hour'`,
        judgingClosesAt: sql`now() + interval '24 hours'`,
        videoRecordingUrl: null,
        isOfficial: true,
      },
    ])
    .returning();

  console.log(`✅ Inserted ${inserted.length} competitions.`);

  // --- 2️⃣ Insert participants ---
  const participants = [
    {
      id: "pasta-queen",
      competitionId: "comp-italian-night",
      userId: "user-demo-1",
      role: "competitor",
      dishTitle: "Homemade Tagliatelle Carbonara",
      dishDescription: "Classic Roman carbonara with pancetta and pecorino.",
      finalDishPhotoUrl: "https://images.unsplash.com/photo-1604908177524-402b5f37d1d2?w=600",
      totalScore: 27,
      placement: 1,
    },
    {
      id: "pizza-pro",
      competitionId: "comp-italian-night",
      userId: "user-demo-2",
      role: "competitor",
      dishTitle: "Neapolitan Margherita Pizza",
      dishDescription: "Charred crust, buffalo mozzarella, and fresh basil.",
      finalDishPhotoUrl: "https://images.unsplash.com/photo-1601924638867-3ec2b32a7fe9?w=600",
      totalScore: 24,
      placement: 2,
    },
    {
      id: "gelato-guru",
      competitionId: "comp-dessert-showdown",
      userId: "user-demo-3",
      role: "competitor",
      dishTitle: "Pistachio Gelato",
      dishDescription: "Smooth and nutty, made from scratch.",
      finalDishPhotoUrl: "https://images.unsplash.com/photo-1599785209707-b9e08c1e7084?w=600",
    },
    {
      id: "cake-artist",
      competitionId: "comp-dessert-showdown",
      userId: "user-demo-4",
      role: "competitor",
      dishTitle: "Triple Chocolate Cake",
      dishDescription: "Layered with ganache and chocolate buttercream.",
      finalDishPhotoUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600",
    },
  ];

  await db.insert(competitionParticipants).values(participants);
  console.log(`✅ Inserted ${participants.length} participants.`);

  // --- 3️⃣ Insert votes ---
  const votes = [
    {
      competitionId: "comp-italian-night",
      voterId: "viewer-1",
      participantId: "pasta-queen",
      presentation: 9,
      creativity: 9,
      technique: 9,
    },
    {
      competitionId: "comp-italian-night",
      voterId: "viewer-2",
      participantId: "pizza-pro",
      presentation: 8,
      creativity: 8,
      technique: 8,
    },
    {
      competitionId: "comp-italian-night",
      voterId: "viewer-3",
      participantId: "pasta-queen",
      presentation: 9,
      creativity: 9,
      technique: 9,
    },
  ];

  await db.insert(competitionVotes).values(
    votes.map((v) => ({
      ...v,
      createdAt: sql`now()`,
    }))
  );

  console.log(`✅ Inserted ${votes.length} votes.`);

  // --- Done ---
  console.log("🌟 Competitions seeding complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
