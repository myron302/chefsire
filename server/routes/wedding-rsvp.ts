// server/routes/wedding-rsvp.ts
import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { weddingRsvpInvitations, users } from "../../shared/schema";
import { sendWeddingRsvpEmail } from "../utils/mailer";

const router = Router();

/**
 * Helper: Generate a random token
 */
function createToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Helper: Hash a token using SHA-256
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * POST /api/wedding/send-invitations
 * Send wedding RSVP invitations to multiple guests
 *
 * Body: {
 *   guests: Array<{ name: string; email: string; plusOne?: boolean }>,
 *   eventDetails?: {
 *     coupleName?: string;
 *     eventDate?: string;
 *     eventLocation?: string;
 *     message?: string;
 *     template?: string;
 *   }
 * }
 */
router.post("/send-invitations", async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user?.id) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const userId = req.user.id;
    const { guests, eventDetails } = req.body;

    if (!guests || !Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({ ok: false, error: "guests array is required" });
    }

    // Check if user has premium or elite subscription
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    if (user.subscriptionTier !== "premium" && user.subscriptionTier !== "elite") {
      return res.status(403).json({
        ok: false,
        error: "Premium or Elite subscription required to send wedding invitations",
      });
    }

    const appUrl = process.env.APP_URL || "http://localhost:5173";
    const sentInvitations = [];
    const errors = [];

    // Send invitation to each guest
    for (const guest of guests) {
      try {
        const { name, email, plusOne = false } = guest;

        if (!name || !email) {
          errors.push({ email, error: "Name and email are required" });
          continue;
        }

        // Generate token
        const token = createToken();
        const tokenHash = hashToken(token);

        // Create invitation record
        const [invitation] = await db
          .insert(weddingRsvpInvitations)
          .values({
            userId,
            guestName: name,
            guestEmail: email.toLowerCase().trim(),
            tokenHash,
            plusOne,
            eventDate: eventDetails?.eventDate
              ? new Date(eventDetails.eventDate)
              : null,
            eventLocation: eventDetails?.eventLocation || null,
            eventMessage: eventDetails?.message || null,
          })
          .returning();

        // Generate RSVP links
        const acceptLink = `${appUrl}/api/wedding/rsvp?token=${token}&response=accept`;
        const declineLink = `${appUrl}/api/wedding/rsvp?token=${token}&response=decline`;

        // Send email
        await sendWeddingRsvpEmail(email, name, acceptLink, declineLink, {
          coupleName: eventDetails?.coupleName || `${user.displayName}'s Wedding`,
          eventDate: eventDetails?.eventDate,
          eventLocation: eventDetails?.eventLocation,
          message: eventDetails?.message,
          template: eventDetails?.template,
        });

        sentInvitations.push({
          id: invitation.id,
          name,
          email,
        });
      } catch (error) {
        console.error(`Failed to send invitation to ${guest.email}:`, error);
        errors.push({
          email: guest.email,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return res.json({
      ok: true,
      sent: sentInvitations.length,
      total: guests.length,
      invitations: sentInvitations,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("send-invitations error:", error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Internal error",
    });
  }
});

/**
 * GET /api/wedding/rsvp?token=RAW&response=accept|decline
 * Handle RSVP response from guest
 */
router.get("/rsvp", async (req, res) => {
  try {
    const token = String(req.query.token || "");
    const response = String(req.query.response || "");

    if (!token || !response) {
      return res.status(400).send("Missing token or response parameter.");
    }

    if (response !== "accept" && response !== "decline") {
      return res.status(400).send("Invalid response. Must be 'accept' or 'decline'.");
    }

    const tokenHash = hashToken(token);
    const now = new Date();

    // Find valid invitation
    const [invitation] = await db
      .select()
      .from(weddingRsvpInvitations)
      .where(
        and(
          eq(weddingRsvpInvitations.tokenHash, tokenHash),
          isNull(weddingRsvpInvitations.respondedAt),
          gt(weddingRsvpInvitations.expiresAt, now)
        )
      )
      .limit(1);

    if (!invitation) {
      return res.status(400).send(`
        <html>
          <head>
            <title>RSVP Invalid</title>
            <style>
              body { font-family: system-ui; text-align: center; padding: 50px; }
              h1 { color: #e74c3c; }
            </style>
          </head>
          <body>
            <h1>Invalid or Expired RSVP Link</h1>
            <p>This RSVP link is either invalid, expired, or has already been used.</p>
            <p>Please contact the couple if you need a new invitation.</p>
          </body>
        </html>
      `);
    }

    // Update invitation status
    await db
      .update(weddingRsvpInvitations)
      .set({
        rsvpStatus: response === "accept" ? "accepted" : "declined",
        respondedAt: now,
      })
      .where(eq(weddingRsvpInvitations.id, invitation.id));

    // Show success page
    const statusColor = response === "accept" ? "#27ae60" : "#95a5a6";
    const statusIcon = response === "accept" ? "✓" : "✗";
    const statusText = response === "accept" ? "Accepted" : "Declined";

    return res.send(`
      <html>
        <head>
          <title>RSVP ${statusText}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              text-align: center;
              padding: 50px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .card {
              background: white;
              color: #333;
              padding: 40px;
              border-radius: 15px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              max-width: 500px;
            }
            .icon {
              font-size: 72px;
              margin-bottom: 20px;
              color: ${statusColor};
            }
            h1 { color: ${statusColor}; margin: 20px 0; }
            p { font-size: 16px; line-height: 1.6; color: #666; }
            .guest-name { font-weight: bold; color: #333; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">${statusIcon}</div>
            <h1>RSVP ${statusText}!</h1>
            <p><span class="guest-name">${invitation.guestName}</span></p>
            <p>Your response has been recorded. The couple has been notified.</p>
            <p style="margin-top: 30px; font-size: 14px; color: #999;">
              Thank you for responding!
            </p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("rsvp error:", error);
    return res.status(500).send("Internal server error.");
  }
});

/**
 * GET /api/wedding/guest-list
 * Get the RSVP guest list for the authenticated user
 */
router.get("/guest-list", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const guests = await db
      .select()
      .from(weddingRsvpInvitations)
      .where(eq(weddingRsvpInvitations.userId, req.user.id))
      .orderBy(weddingRsvpInvitations.createdAt);

    return res.json({
      ok: true,
      guests: guests.map((g) => ({
        id: g.id,
        name: g.guestName,
        email: g.guestEmail,
        rsvp: g.rsvpStatus,
        plusOne: g.plusOne,
        respondedAt: g.respondedAt,
        createdAt: g.createdAt,
      })),
    });
  } catch (error) {
    console.error("guest-list error:", error);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

export default router;
