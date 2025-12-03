// server/services/google-oauth.service.ts
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "../storage";
import { randomBytes } from "crypto";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { logToFile } from "../lib/logger";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_REDIRECT_URI || `${APP_URL}/api/auth/google/callback`;

// Generate a random username from email
function generateUsername(email: string): string {
  const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const randomSuffix = randomBytes(3).toString('hex');
  return `${baseUsername}-${randomSuffix}`;
}

export function setupGoogleOAuth() {
  console.log("🔧 Setting up Google OAuth...");
  console.log("📋 GOOGLE_CLIENT_ID:", GOOGLE_CLIENT_ID ? `${GOOGLE_CLIENT_ID.substring(0, 20)}...` : "MISSING");
  console.log("📋 GOOGLE_CLIENT_SECRET:", GOOGLE_CLIENT_SECRET ? "SET" : "MISSING");
  console.log("📋 GOOGLE_CALLBACK_URL:", GOOGLE_CALLBACK_URL);

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error("❌ Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
    return false;
  }

  try {
    passport.use(
      new GoogleStrategy(
        {
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL: GOOGLE_CALLBACK_URL,
        },
      async (accessToken, refreshToken, profile, done) => {
        try {
          logToFile("🔍 OAuth callback started", { profileId: profile.id });
          console.log("🔍 OAuth callback started for profile:", profile.id);

          // Extract user info from Google profile
          const email = profile.emails?.[0]?.value;
          const googleId = profile.id;
          const firstName = profile.name?.givenName || "";
          const lastName = profile.name?.familyName || "";
          const avatar = profile.photos?.[0]?.value || "";

          logToFile("📧 Email extracted", { email });
          console.log("📧 Email extracted:", email);

          if (!email) {
            console.error("❌ No email in profile");
            return done(new Error("No email found in Google profile"), undefined);
          }

          console.log("🔍 Checking for existing user with Google ID:", googleId);
          // Check if user exists with this Google ID
          const existingUser = await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.googleId, googleId),
          });

          console.log("✅ Existing user query completed:", existingUser ? "found" : "not found");

          if (existingUser) {
            console.log("✅ Existing user found, logging in");
            return done(null, existingUser);
          }

          console.log("🔍 Checking for existing email:", email);
          // Check if email is already registered
          const emailUser = await storage.findByEmail(email);

          if (emailUser) {
            console.log("🔗 Email exists, linking Google account");
            // Email exists but no Google ID - link accounts
            const updated = await db
              .update(users)
              .set({
                googleId,
                provider: "google",
                // Preserve original avatar if user already has one
                avatar: emailUser.avatar || avatar,
                emailVerifiedAt: new Date(), // Google emails are pre-verified
              })
              .where(eq(users.id, emailUser.id))
              .returning();

            console.log("✅ Account linked successfully");
            return done(null, updated[0]);
          }

          console.log("🆕 Creating new user");
          // Create new user
          const username = generateUsername(email);
          const displayName = `${firstName} ${lastName}`.trim() || username;

          const newUser = await storage.createUser({
            email: email.toLowerCase().trim(),
            password: null, // No password for OAuth users
            username,
            displayName,
            firstName,
            lastName,
            googleId,
            provider: "google",
            avatar,
            emailVerifiedAt: new Date(), // Google emails are pre-verified
            royalTitle: null,
            showFullName: false,
          });

          console.log("✅ New Google user created:", newUser.id);
          return done(null, newUser);
        } catch (error) {
          const errorDetails = {
            type: error?.constructor?.name,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            fullError: error
          };

          logToFile("💥 ERROR in Google OAuth callback", errorDetails);

          console.error("💥 ERROR in Google OAuth callback:");
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

    console.log("✅ Google OAuth configured successfully");
    return true;
  } catch (error) {
    console.error("❌ Failed to setup Google OAuth:", error);
    return false;
  }
}
