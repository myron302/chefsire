// server/services/auth.service.ts
import crypto from "node:crypto";
import { db } from "../db";
import { emailVerificationTokens, users } from "../../shared/schema";
import { eq, and, isNull, gt, sql } from "drizzle-orm";
import { sendVerificationEmail } from "../utils/mailer";
import { hashPassword } from "../lib/password-hash";

/** Minimum length for a password chosen while redeeming a verification link (matches change-password). */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * AuthService - Centralized authentication utilities
 * Handles token generation, hashing, and email verification
 */
export class AuthService {
  /**
   * Generate a new random token
   */
  static createToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Hash a token using SHA-256
   */
  static hashToken(token: string): string {
    return crypto.createHash("sha256").update(token, "utf8").digest("hex");
  }

  /**
   * Create and store an email verification token for a user
   * @param userId - User ID to create token for
   * @param email - Email address to verify
   * @returns The raw token (unhashed) to send to user
   */
  static async createVerificationToken(userId: string, email: string): Promise<string> {
    // Delete old tokens for this user
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));

    // Generate new token
    const token = this.createToken();
    const tokenHash = this.hashToken(token);

    // Store hashed token in database
    await db.insert(emailVerificationTokens).values({
      userId,
      tokenHash,
      email: email.toLowerCase().trim(),
    });

    return token;
  }

  /**
   * Redeem an email verification token, establishing the account's password in the same step.
   *
   * SECURITY (P2-1): an unverified account's password hash was chosen by whoever called
   * `POST /auth/signup`, who has not proven they own the address. Activating the account while
   * keeping that hash would hand the signup caller a working credential for an account the real
   * owner has just verified. So the stored hash is never activated: the person redeeming the
   * emailed link (the only party who has proven ownership) supplies the password, and it replaces
   * whatever was stored. A legitimate signup user simply re-enters the password they chose.
   *
   * Token consumption and activation happen in one transaction, and both are conditional
   * (`consumed_at IS NULL`, `email_verified_at IS NULL`), so a replayed or concurrent redemption,
   * or an OAuth link that verified the account first, cannot overwrite a trusted state.
   *
   * @param token - Raw token from verification link
   * @param password - Plaintext password chosen by the person redeeming the link
   */
  static async verifyEmailToken(token: string, password: string): Promise<{
    success: boolean;
    error?: string;
    userId?: string;
  }> {
    if (!token) {
      return { success: false, error: "Missing token" };
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
    }

    const tokenHash = this.hashToken(token);
    const now = new Date();
    const passwordHash = await hashPassword(password);

    return db.transaction(async (tx: any) => {
      // Claim the token atomically: exactly one redemption can win.
      const [claimed] = await tx
        .update(emailVerificationTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(emailVerificationTokens.tokenHash, tokenHash),
            isNull(emailVerificationTokens.consumedAt),
            gt(emailVerificationTokens.expiresAt, now)
          )
        )
        .returning();

      if (!claimed) {
        return { success: false, error: "Invalid or expired verification link" };
      }

      // Activate only a still-unverified account whose current address is the one the token proves.
      const [activated] = await tx
        .update(users)
        .set({ emailVerifiedAt: now, password: passwordHash })
        .where(
          and(
            eq(users.id, claimed.userId),
            isNull(users.emailVerifiedAt),
            sql`lower(${users.email}) = ${claimed.email.toLowerCase()}`
          )
        )
        .returning({ id: users.id });

      if (!activated) {
        return { success: false, error: "Invalid or expired verification link" };
      }

      return { success: true, userId: activated.id };
    });
  }

  /**
   * Send a verification email to a user
   * @param email - Email address to send to
   * @param token - Raw verification token
   * @param appUrl - Base URL of application
   */
  static async sendVerificationEmail(
    email: string,
    token: string,
    appUrl: string = process.env.APP_URL || "https://chefsire.com"
  ): Promise<void> {
    const verificationLink = `${appUrl}/api/auth/verify-email?token=${token}`;
    await sendVerificationEmail(email, verificationLink);
  }

  /**
   * Create verification token and send email in one operation
   * @param userId - User ID
   * @param email - Email address
   * @param appUrl - Base URL of application
   * @returns Object with success status and optional error
   */
  static async createAndSendVerification(
    userId: string,
    email: string,
    appUrl: string = process.env.APP_URL || "https://chefsire.com"
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.createVerificationToken(userId, email);
      await this.sendVerificationEmail(email, token, appUrl);
      return { success: true };
    } catch (error) {
      console.error("Failed to create and send verification:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export default AuthService;
