// server/services/auth.service.ts
import crypto from "node:crypto";
import { db } from "../db";
import { emailVerificationTokens, users } from "../../shared/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { sendVerificationEmail } from "../utils/mailer";

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
   * Verify an email verification token and mark user as verified
   * @param token - Raw token from verification link
   * @returns Object with success status and optional error message
   */
  static async verifyEmailToken(token: string): Promise<{
    success: boolean;
    error?: string;
    userId?: string;
  }> {
    if (!token) {
      return { success: false, error: "Missing token" };
    }

    const tokenHash = this.hashToken(token);
    const now = new Date();

    // Find valid token
    const [tokenRecord] = await db
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          isNull(emailVerificationTokens.consumedAt),
          gt(emailVerificationTokens.expiresAt, now)
        )
      )
      .limit(1);

    if (!tokenRecord) {
      return { success: false, error: "Invalid or expired verification link" };
    }

    // Mark user as verified
    await db
      .update(users)
      .set({ emailVerifiedAt: now })
      .where(eq(users.id, tokenRecord.userId));

    // Mark token as consumed
    await db
      .update(emailVerificationTokens)
      .set({ consumedAt: now })
      .where(eq(emailVerificationTokens.id, tokenRecord.id));

    return { success: true, userId: tokenRecord.userId };
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
