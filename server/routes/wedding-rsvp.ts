// server/routes/wedding-rsvp.ts
import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { weddingRsvpInvitations, users } from "../../shared/schema";
import { sendWeddingRsvpEmail, sendRsvpNotificationEmail } from "../utils/mailer";
import { sendWeddingRSVPNotification } from "../services/notification-service";
import { requireAuth } from "../middleware/auth";

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
router.post("/send-invitations", requireAuth, async (req, res) => {
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
        const { name, email, plusOne = false, partnerName } = guest;

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

        // Send email with all event details including reception info
        await sendWeddingRsvpEmail(email, name, acceptLink, declineLink, partnerName, {
          partner1Name: eventDetails?.partner1Name,
          partner2Name: eventDetails?.partner2Name,
          coupleName: eventDetails?.coupleName || `${user.displayName}'s Wedding`,
          eventDate: eventDetails?.eventDate,
          eventLocation: eventDetails?.eventLocation,
          receptionDate: eventDetails?.receptionDate,
          receptionLocation: eventDetails?.receptionLocation,
          useSameLocation: eventDetails?.useSameLocation,
          hasReception: eventDetails?.hasReception,
          message: eventDetails?.message,
          template: eventDetails?.template,
          coupleEmail: user.email, // Replies go to the couple's email
          plusOneAllowed: plusOne,
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
// GET handler: Render RSVP page or record RSVP directly
router.get("/rsvp", async (req, res) => {
  try {
    const token = String(req.query.token || "");
    const response = String(req.query.response || "");

    if (!token || !response) {
      return res.status(400).send("Missing token or response parameter.");
    }

    const validResponses = ["accept", "decline", "accept-both", "ceremony-only", "reception-only"];
    if (!validResponses.includes(response)) {
      return res.status(400).send("Invalid response.");
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

    // If the guest is accepting the invitation (any positive response) and the
    // invitation allows a plus-one, show a form to collect an optional
    // companion name. When the user submits the form, a POST request will
    // handle persisting the RSVP and plus-one details. If the user has
    // already submitted the RSVP (indicated by the query parameter
    // `submitted=yes`), skip the form and render the success page below.
    const acceptingResponses = ["accept", "accept-both", "ceremony-only", "reception-only"];
    const isAccepting = acceptingResponses.includes(response);
    const alreadySubmitted = req.query.submitted === "yes";
    if (isAccepting && invitation.plusOne && !alreadySubmitted) {
      return res.send(`
        <html>
          <head>
            <title>RSVP for ${invitation.guestName}</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                padding: 40px;
                text-align: center;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
              }
              .card {
                background: white;
                color: #333;
                padding: 30px;
                border-radius: 10px;
                max-width: 500px;
                margin: 0 auto;
              }
              label {
                display: block;
                margin-bottom: 10px;
                text-align: left;
                color: #333;
              }
              input[type="text"] {
                width: 100%;
                padding: 10px;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 16px;
              }
              button {
                margin-top: 20px;
                padding: 12px 24px;
                background-color: #27ae60;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                cursor: pointer;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>RSVP for ${invitation.guestName}</h2>
              <p>You may bring a guest. Tell us below so the couple can plan accurately.</p>
              <form method="post" action="/api/wedding/rsvp" onsubmit="return window.__weddingRsvpValidate?.() ?? true;">
                <input type="hidden" name="token" value="${token}" />
                <input type="hidden" name="response" value="${response}" />
                <label style="display:flex;align-items:center;gap:10px;margin:16px 0 10px 0;">
                  <input type="checkbox" id="bringingGuest" name="bringingGuest" />
                  <span style="color:#333;">I’m bringing a guest</span>
                </label>
                <label for="plusOneName">Guest’s Name</label>
                <input type="text" id="plusOneName" name="plusOneName" placeholder="Enter your guest's full name" disabled />
                <button type="submit">Submit RSVP</button>
              </form>
              <script>
                (function(){
                  var cb = document.getElementById('bringingGuest');
                  var inp = document.getElementById('plusOneName');
                  function sync(){
                    var on = !!cb && cb.checked;
                    if (inp) {
                      inp.disabled = !on;
                      if (!on) inp.value = '';
                    }
                  }
                  if (cb) cb.addEventListener('change', sync);
                  sync();
                  window.__weddingRsvpValidate = function(){
                    if (cb && cb.checked && inp && !String(inp.value||'').trim()) {
                      alert('Please enter your guest\'s name, or uncheck “I\'m bringing a guest”.');
                      return false;
                    }
                    return true;
                  };
                })();
              </script>
            </div>
          </body>
        </html>
      `);
    }

    // For all other cases (decline or no plus-one allowed), record the RSVP immediately
    // and show the success page. This mirrors the original behaviour for users
    // who either cannot bring a guest or choose not to.

    // Map response to status
    let rsvpStatus = "declined";
    if (response === "accept" || response === "accept-both") {
      rsvpStatus = "accepted";
    } else if (response === "ceremony-only") {
      rsvpStatus = "ceremony-only";
    } else if (response === "reception-only") {
      rsvpStatus = "reception-only";
    }

    await db
      .update(weddingRsvpInvitations)
      .set({
        rsvpStatus,
        respondedAt: now,
      })
      .where(eq(weddingRsvpInvitations.id, invitation.id));

    // Send notification email to the couple
    try {
      const [coupleUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, invitation.userId))
        .limit(1);

      if (coupleUser?.email) {
        const notificationStatus = response === "decline" ? "declined" : "accepted";
        await sendRsvpNotificationEmail(
          coupleUser.email,
          invitation.guestName,
          notificationStatus as any,
          {
            coupleName: coupleUser.displayName ? `${coupleUser.displayName}'s Wedding` : undefined,
            eventDate: invitation.eventDate ? invitation.eventDate.toLocaleDateString() : undefined,
          }
        );
      }

      if (coupleUser?.id) {
        await sendWeddingRSVPNotification(
          coupleUser.id,
          invitation.guestName,
          rsvpStatus,
          1
        );
      }
    } catch (notificationError) {
      // Don't fail the RSVP if notification fails
      console.error("Failed to send RSVP notification:", notificationError);
    }

    // Show success page with appropriate styling
    const responseMap: Record<string, {color: string; icon: string; text: string; message: string}> = {
      "accept": { color: "#27ae60", icon: "✓", text: "Accepted", message: "We're thrilled you can join us!" },
      "accept-both": { color: "#27ae60", icon: "✓", text: "Accepted Both Events", message: "We're thrilled you can join us for both the ceremony and reception!" },
      "ceremony-only": { color: "#4ecdc4", icon: "✓", text: "Ceremony Only", message: "We're happy you can join us for the ceremony!" },
      "reception-only": { color: "#95a5a6", icon: "✓", text: "Reception Only", message: "We're happy you can join us for the reception!" },
      "decline": { color: "#e74c3c", icon: "✗", text: "Declined", message: "Thank you for letting us know. You'll be missed!" }
    };

    const status = responseMap[response] || responseMap["decline"];
    const statusColor = status.color;
    const statusIcon = status.icon;
    const statusText = status.text;
    const statusMessage = status.message;

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
            <p>${statusMessage}</p>
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
 * POST /api/wedding/rsvp
 * Handle RSVP submission from guests who may provide a plus-one name.
 * The form is served when a guest accepts an invitation that allows
 * a plus-one. Guests can optionally supply a plus-one name, which will
 * be recorded in the weddingRsvpInvitations table. The response body
 * should include the token, the original response (accept, ceremony-only,
 * reception-only, etc.), and an optional plusOneName. The server
 * validates the token and records the RSVP status, respondedAt, and
 * plusOneName if provided.
 */
router.post("/rsvp", async (req, res) => {
  try {
    const token = String(req.body.token || "");
    const response = String(req.body.response || "");
    const bringingGuest = req.body.bringingGuest === "on" || req.body.bringingGuest === "true";
    const plusOneName = bringingGuest && typeof req.body.plusOneName === "string" && req.body.plusOneName.trim() !== ""
      ? req.body.plusOneName.trim()
      : null;

    if (!token || !response) {
      return res.status(400).send("Missing token or response parameter.");
    }

    const validResponses = ["accept", "decline", "accept-both", "ceremony-only", "reception-only"];
    if (!validResponses.includes(response)) {
      return res.status(400).send("Invalid response.");
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

    // Map response to status
    let rsvpStatus: string = "declined";
    if (response === "accept" || response === "accept-both") {
      rsvpStatus = "accepted";
    } else if (response === "ceremony-only") {
      rsvpStatus = "ceremony-only";
    } else if (response === "reception-only") {
      rsvpStatus = "reception-only";
    }

    // Update invitation status and optional plusOneName
    await db
      .update(weddingRsvpInvitations)
      .set({
        rsvpStatus,
        respondedAt: now,
        plusOneName: plusOneName || null,
      })
      .where(eq(weddingRsvpInvitations.id, invitation.id));

    // Send notification email to the couple
    try {
      const [coupleUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, invitation.userId))
        .limit(1);

      if (coupleUser?.email) {
        const notificationStatus = response === "decline" ? "declined" : "accepted";
        await sendRsvpNotificationEmail(
          coupleUser.email,
          invitation.guestName,
          notificationStatus as any,
          {
            coupleName: coupleUser.displayName ? `${coupleUser.displayName}'s Wedding` : undefined,
            eventDate: invitation.eventDate ? invitation.eventDate.toLocaleDateString() : undefined,
          }
        );
      }

      if (coupleUser?.id) {
        const guestCount = plusOneName ? 2 : 1;
        await sendWeddingRSVPNotification(
          coupleUser.id,
          invitation.guestName,
          rsvpStatus,
          guestCount
        );
      }
    } catch (notificationError) {
      // Don't fail the RSVP if notification fails
      console.error("Failed to send RSVP notification:", notificationError);
    }

    // After recording the RSVP, redirect to the GET handler with a submitted flag
    // This allows the GET handler to display the success page without showing the form again
    return res.redirect(`/api/wedding/rsvp?token=${token}&response=${response}&submitted=yes`);
  } catch (error) {
    console.error("rsvp submission error:", error);
    return res.status(500).send("Internal server error.");
  }
});

/**
 * GET /api/wedding/guest-list
 * Get the RSVP guest list for the authenticated user
 */
router.get("/guest-list", requireAuth, async (req, res) => {
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
        plusOneName: g.plusOneName || null,
        respondedAt: g.respondedAt,
        createdAt: g.createdAt,
      })),
    });
  } catch (error) {
    console.error("guest-list error:", error);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

/**
 * DELETE /api/wedding/guest/:id
 * Delete a guest from the wedding invitation list
 */
router.delete("/guest/:id", requireAuth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const guestId = req.params.id;

    // Verify the guest belongs to this user before deleting
    const [guest] = await db
      .select()
      .from(weddingRsvpInvitations)
      .where(
        and(
          eq(weddingRsvpInvitations.id, guestId),
          eq(weddingRsvpInvitations.userId, req.user.id)
        )
      )
      .limit(1);

    if (!guest) {
      return res.status(404).json({ ok: false, error: "Guest not found or unauthorized" });
    }

    // Delete the guest
    await db
      .delete(weddingRsvpInvitations)
      .where(eq(weddingRsvpInvitations.id, guestId));

    return res.json({ ok: true, message: "Guest deleted successfully" });
  } catch (error) {
    console.error("delete-guest error:", error);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

export default router;
