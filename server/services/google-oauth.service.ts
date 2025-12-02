// server/services/google-oauth.service.ts
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "../storage";
import { randomBytes } from "crypto";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";

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
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn("⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
    return false;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Extract user info from Google profile
          const email = profile.emails?.[0]?.value;
          const googleId = profile.id;
          const firstName = profile.name?.givenName || "";
          const lastName = profile.name?.familyName || "";
          const avatar = profile.photos?.[0]?.value || "";

          if (!email) {
            return done(new Error("No email found in Google profile"), undefined);
          }

          // Check if user exists with this Google ID
          const existingUser = await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.googleId, googleId),
          });

          if (existingUser) {
            // User exists, log them in
            return done(null, existingUser);
          }

          // Check if email is already registered
          const emailUser = await storage.findByEmail(email);
          if (emailUser) {
            // Email exists but no Google ID - link accounts
            const updated = await db
              .update(users)
              .set({
                googleId,
                provider: "google",
                avatar: avatar || emailUser.avatar,
                emailVerifiedAt: new Date(), // Google emails are pre-verified
              })
              .where(eq(users.id, emailUser.id))
              .returning();

            return done(null, updated[0]);
          }

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
          console.error("💥 Error in Google OAuth callback:", error);
          return done(error as Error, undefined);
        }
      }
    )
  );

  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, id),
      });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  console.log("✅ Google OAuth configured");
  return true;
}
