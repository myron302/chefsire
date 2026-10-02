// server/services/facebook-oauth.service.ts
import passport from "passport";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { storage } from "../storage";
import { randomBytes } from "crypto";
import { db } from "../db";
import { users } from "@shared/schema";
import { logToFile } from "../lib/logger";

const FACEBOOK_CLIENT_ID = process.env.FACEBOOK_CLIENT_ID || "";
const FACEBOOK_CLIENT_SECRET = process.env.FACEBOOK_CLIENT_SECRET || "";
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const FACEBOOK_CALLBACK_URL = process.env.FACEBOOK_REDIRECT_URI || `${APP_URL}/api/auth/facebook/callback`;

// Generate a random username from email or name
function generateUsername(email: string, name: string): string {
  const base = email ? email.split('@')[0] : name.toLowerCase().replace(/\s+/g, '');
  const baseUsername = base.toLowerCase().replace(/[^a-z0-9]/g, '');
  const randomSuffix = randomBytes(3).toString('hex');
  return `${baseUsername}-${randomSuffix}`;
}

export async function verifyFacebookProfile(
  _accessToken: string,
  _refreshToken: string,
  profile: any,
  done: (error: any, user?: any) => void,
) {
  try {
    logToFile("🔍 Facebook OAuth callback started", { profileId: profile.id });

    // Extract user info from Facebook profile
    const email = profile.emails?.[0]?.value;
    const facebookId = profile.id;
    const firstName = profile.name?.givenName || "";
    const lastName = profile.name?.familyName || "";
    const avatar = profile.photos?.[0]?.value || "";
    const displayName = profile.displayName || `${firstName} ${lastName}`.trim();

    logToFile("📧 Email extracted", { email });

    if (!email) {
      console.error("❌ No email in Facebook profile");
      return done(new Error("No email found in Facebook profile. Please grant email permission."), undefined);
    }

    // Check if user exists with this Facebook ID
    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.facebookId, facebookId),
    });

    if (existingUser) {
      return done(null, existingUser);
    }

    // Facebook does not vouch that the address it returns is verified, so it cannot prove the
    // person owns an existing ChefSire account (P2-1): never link or take over by email.
    const emailUser = await storage.findByEmail(email.toLowerCase().trim());

    if (emailUser) {
      return done(new Error("Facebook cannot link to an existing account by email"), undefined);
    }

    // Create new user
    const username = generateUsername(email, displayName);

    const newUser = await storage.createUser({
      email: email.toLowerCase().trim(),
      password: null, // No password for OAuth users
      username,
      displayName,
      firstName,
      lastName,
      facebookId,
      provider: "facebook",
      avatar,
      emailVerifiedAt: null, // Facebook does not vouch for the email; it must be verified separately
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

    logToFile("💥 ERROR in Facebook OAuth callback", errorDetails);

    console.error("💥 ERROR in Facebook OAuth callback:");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Full error:", error);
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }
    return done(error as Error, undefined);
  }
}

export function setupFacebookOAuth() {
  if (!FACEBOOK_CLIENT_ID || !FACEBOOK_CLIENT_SECRET) {
    console.warn("⚠️  Facebook OAuth not configured. Set FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET in .env");
    console.warn("⚠️  Facebook login will not be available.");
    return false;
  }

  try {
    passport.use(
      new FacebookStrategy(
        {
          clientID: FACEBOOK_CLIENT_ID,
          clientSecret: FACEBOOK_CLIENT_SECRET,
          callbackURL: FACEBOOK_CALLBACK_URL,
          profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
        },
        verifyFacebookProfile
      )
    );

    return true;
  } catch (error) {
    console.error("❌ Failed to setup Facebook OAuth:", error);
    return false;
  }
}
