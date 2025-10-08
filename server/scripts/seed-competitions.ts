// server/scripts/seed-competitions.ts
import "dotenv/config";
import crypto from "crypto";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";

// We use raw SQL for `users` so you don't need to import your giant schema file.
import {
  competitions,
  competitionParticipants,
  competitionVotes,
} from "../db/competitions";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("❌ Missing DATABASE_URL in environment");
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

// ————————————————————————————————————————————————————————
// Helpers
// ————————————————————————————————————————————————————————
async function upsertUser({
  id,
  username,
  email,
  displayName,
  isChef = false,
  avatar,
  bio,
}: {
  id: string;
  username: string;
  email: string;
  displayName: string;
  isChef?: boolean;
  avatar?: string | null;
  bio?: string | null;
}) {
  // NOTE: For demo: store a plain string. In production, hash your passwords.
  const password = "demo123";

  await db.execute(sql`
    INSERT INTO users (id, username, email, password, display_name, is_chef, avatar, bio, created_at)
    VALUES (${id}, ${username}, ${email}, ${password}, ${displayName}, ${isChef}, ${avatar ?? null}, ${bio ?? null}, now())
    ON CONFLICT (id) DO UPDATE
      SET username = EXCLUDED.username,
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          is_chef = EXCLUDED.is_chef,
          avatar = EXCLUDED.avatar,
          bio = EXCLUDED.bio;
  `);
}

async function clearCompetitionData() {
  // Order matters due to FK references
  await db.delete(competitionVotes);
  await db.delete(competitionParticipants);
  await db.delete(competitions);
}

// ————————————————————————————————————————————————————————
// Main
// ————————————————————————————————————————————————————————
async function main() {
  console.log("🌱 Seeding demo users + cooking competitions…");

  // 1) Create a couple of demo users you can log in with
  // (You can change emails/usernames, passwords are "demo123")
  const demoUsers = [
    {
      id: "user-demo-1",
      username: "pasta_queen",
      email: "pasta_queen@example.com",
      displayName: "Pasta Queen",
      isChef: true,
      avatar:
        "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=200&h=200&fit=crop",
      bio: "Homemade pasta master and carbonara purist.",
    },
    {
      id: "user-demo-2",
      username: "pizza_pro",
      email: "pizza_pro@example.com",
      displayName: "Pizza Pro",
      isChef: true,
      avatar:
        "https://images.unsplash.com/photo-1541599188778-cdc73298e8f8?w=200&h=200&fit=crop",
      bio: "Neapolitan pies with leopard spots.",
    },
    {
      id: "user-demo-3",
      username: "gelato_guru",
      email: "gelato_guru@example.com",
      displayName: "Gelato Guru",
      isChef: false,
      avatar:
        "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=200&h=200&fit=crop",
      bio: "Gelato scientist. Pistachio or bust.",
    },
    {
      id: "user-demo-4",
      username: "cake_artist",
      email: "cake_artist@example.com",
      displayName: "Cake Artist",
      isChef: false,
      avatar:
        "https://images.unsplash.com/photo-1541976076758-347942db1970?w=200&h=200&fit=crop",
      bio: "Chocolate layers, edible flowers, and perfect ganache.",
    },
  ];

  for (const u of demoUsers) {
    await upsertUser(u);
  }
  console.log(`✅ Upserted ${demoUsers.length} demo users (password: "demo123")`);

  // 2) Wipe competitions data so seeds are deterministic
  await clearCompetitionData();
  console.log("🧹 Cleared competitions/votes/participants tables.");

  // 3) Insert competitions
  const comps = await db
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
        updatedAt: sql`now()`,
        createdAt: sql`now()`,
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
        updatedAt: sql`now()`,
        createdAt: sql`now()`,
      },
      {
        id: "comp-street-tacos",
        creatorId: "user-demo-2",
        title: "Street Taco Rumble",
        themeName: "Taco Tuesday",
        status: "upcoming",
        isPrivate: false,
        timeLimitMinutes: 45,
        minOfficialVoters: 3,
        startTime: null,
        endTime: null,
        judgingClosesAt: null,
        videoRecordingUrl: null,
        isOfficial: false,
        updatedAt: sql`now()`,
        createdAt: sql`now()`,
      },
    ])
    .returning({ id: competitions.id });

  console.log(`✅ Inserted ${comps.length} competitions.`);

  // 4) Insert participants
  const participants = [
    // Completed comp
    {
      id: "pasta-queen",
      competitionId: "comp-italian-night",
      userId: "user-demo-1",
      role: "competitor",
      dishTitle: "Homemade Tagliatelle Carbonara",
      dishDescription: "Classic Roman carbonara with pancetta and pecorino.",
      finalDishPhotoUrl:
        "https://images.unsplash.com/photo-1604908177524-402b5f37d1d2?w=800&h=600&fit=crop",
      totalScore: 27,
      placement: 1,
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    },
    {
      id: "pizza-pro",
      competitionId: "comp-italian-night",
      userId: "user-demo-2",
      role: "competitor",
      dishTitle: "Neapolitan Margherita Pizza",
      dishDescription: "Charred crust, buffalo mozzarella, and fresh basil.",
      finalDishPhotoUrl:
        "https://images.unsplash.com/photo-1601924638867-3ec2b32a7fe9?w=800&h=600&fit=crop",
      totalScore: 24,
      placement: 2,
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    },

    // Judging comp
    {
      id: "gelato-guru",
      competitionId: "comp-dessert-showdown",
      userId: "user-demo-3",
      role: "competitor",
      dishTitle: "Pistachio Gelato",
      dishDescription: "Smooth and nutty, made from scratch.",
      finalDishPhotoUrl:
        "https://images.unsplash.com/photo-1599785209707-b9e08c1e7084?w=800&h=600&fit=crop",
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    },
    {
      id: "cake-artist",
      competitionId: "comp-dessert-showdown",
      userId: "user-demo-4",
      role: "competitor",
      dishTitle: "Triple Chocolate Cake",
      dishDescription: "Layers with ganache and chocolate buttercream.",
      finalDishPhotoUrl:
        "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop",
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    },

    // Upcoming comp (no scores yet)
    {
      id: "taco-one",
      competitionId: "comp-street-tacos",
      userId: "user-demo-2",
      role: "host",
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    },
  ];

  await db.insert(competitionParticipants).values(participants);
  console.log(`✅ Inserted ${participants.length} participants.`);

  // 5) Insert votes (for completed comp)
  const votes = [
    {
      competitionId: "comp-italian-night",
      voterId: "viewer-1",
      participantId: "pasta-queen",
      presentation: 9,
      creativity: 9,
      technique: 9,
      createdAt: sql`now()`,
    },
    {
      competitionId: "comp-italian-night",
      voterId: "viewer-2",
      participantId: "pizza-pro",
      presentation: 8,
      creativity: 8,
      technique: 8,
      createdAt: sql`now()`,
    },
    {
      competitionId: "comp-italian-night",
      voterId: "viewer-3",
      participantId: "pasta-queen",
      presentation: 9,
      creativity: 9,
      technique: 9,
      createdAt: sql`now()`,
    },
  ];

  await db.insert(competitionVotes).values(votes);
  console.log(`✅ Inserted ${votes.length} votes.`);

  console.log("🎉 Done seeding demo users + competitions.");
  await pool.end();
}

main()
  .then(() => {
    console.log("✅ Seed script completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
