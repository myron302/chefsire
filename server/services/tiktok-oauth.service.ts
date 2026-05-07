// server/services/tiktok-oauth.service.ts
import passport from "passport";
import { Strategy as TikTokStrategy } from "passport-tiktok-auth";
import { storage } from "../storage";
import { randomBytes } from "crypto";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { logToFile } from "../lib/logger";

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || "";
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || "";
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const TIKTOK_CALLBACK_URL = process.env.TIKTOK_REDIRECT_URI || `${APP_URL}/api/auth/tiktok/callback`;

// Generate a random username from display name
function generateUsername(displayName: string, id: string): string {
  const base = displayName || `tiktok${id}`;
  const baseUsername = base.toLowerCase().replace(/[^a-z0-9]/g, '');
  const randomSuffix = randomBytes(3).toString('hex');
  return `${baseUsername}-${randomSuffix}`;
}

export function setupTikTokOAuth() {
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    console.warn("⚠️  TikTok OAuth not configured. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env");
    console.warn("⚠️  TikTok login will not be available.");
    return false;
  }

  try {
    passport.use(
      new TikTokStrategy(
        {
          clientID: TIKTOK_CLIENT_KEY,
          clientSecret: TIKTOK_CLIENT_SECRET,
          callbackURL: TIKTOK_CALLBACK_URL,
          scope: ['user.info.basic'],
        },
        async (accessToken: string, refreshToken: string, profile: any, done: any) => {
          try {
            logToFile("🔍 TikTok OAuth callback started", { profileId: profile.id });

            // Extract user info from TikTok profile
            const tiktokId = profile.id;
            const displayName = profile.displayName || profile.username || `tiktok_user_${tiktokId}`;
            const avatar = profile.photos?.[0]?.value || profile.profileImage || "";

            // TikTok doesn't always provide email, so we'll create a synthetic one
            // Users can add their real email later
            const email = profile.emails?.[0]?.value || `tiktok_${tiktokId}@chefsire.placeholder`;
            const isPlaceholderEmail = !profile.emails?.[0]?.value;

            logToFile("📧 Email extracted", { email, isPlaceholder: isPlaceholderEmail });

            // Check if user exists with this TikTok ID
            const existingUser = await db.query.users.findFirst({
              where: (users, { eq }) => eq(users.tiktokId, tiktokId),
            });

            if (existingUser) {
              // Update avatar if they have a new one
              if (avatar && avatar !== existingUser.avatar) {
                await db
                  .update(users)
                  .set({ avatar })
                  .where(eq(users.id, existingUser.id));
              }
              return done(null, existingUser);
            }

            // If email is real, check if email is already registered
            if (!isPlaceholderEmail) {
              const emailUser = await storage.findByEmail(email);

              if (emailUser) {
                // Email exists but no TikTok ID - link accounts
                const updated = await db
                  .update(users)
                  .set({
                    tiktokId,
                    provider: "tiktok",
                    // Preserve original avatar if user already has one
                    avatar: emailUser.avatar || avatar,
                    emailVerifiedAt: new Date(),
                  })
                  .where(eq(users.id, emailUser.id))
                  .returning();

                return done(null, updated[0]);
              }
            }

            // Create new user
            const username = generateUsername(displayName, tiktokId);

            const newUser = await storage.createUser({
              email: email.toLowerCase().trim(),
              password: null, // No password for OAuth users
              username,
              displayName,
              firstName: displayName.split(' ')[0] || displayName,
              lastName: displayName.split(' ').slice(1).join(' ') || null,
              tiktokId,
              provider: "tiktok",
              avatar,
              // Only mark as verified if they provided a real email
              emailVerifiedAt: isPlaceholderEmail ? null : new Date(),
              royalTitle: null,
              showFullName: false,
            });

            return done(null, newUser);
          } catch (error) {
            const errorDetails = {
              type: error?.constructor?.name,
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              fullError: error
            };

            logToFile("💥 ERROR in TikTok OAuth callback", errorDetails);

            console.error("💥 ERROR in TikTok OAuth callback:");
            console.error("Error type:", error?.constructor?.name);
            console.error("Error message:", error instanceof Error ? error.message : String(error));
            console.error("Full error:", error);
            if (error instanceof Error && error.stack) {
              console.error("Stack trace:", error.stack);
            }
            return done(error as Error, undefined);
          }
        }
      )
    );

    return true;
  } catch (error) {
    console.error("❌ Failed to setup TikTok OAuth:", error);
    return false;
  }
}
