// server/utils/mailer.ts
import nodemailer from "nodemailer";

type Health = {
  verifyOK: boolean;
  verifyError?: string;
  env: {
    host: string | undefined;
    port: number | undefined;
    userSet: boolean;
    passSet: boolean;
    from: string | undefined;
    appUrl: string | undefined;
    nodeEnv: string | undefined;
  };
};

let transport: nodemailer.Transporter | null = null;
let initError: string | null = null;

// Create transport once
try {
  transport = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.ionos.com",
    port: Number(process.env.MAIL_PORT || 587),
    secure: false, // STARTTLS on 587
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      // ensure valid TLS in prod; loosen only if your provider requires it
      rejectUnauthorized: true,
    },
    debug: process.env.NODE_ENV !== "production",
    logger: process.env.NODE_ENV !== "production",
  });
  console.log("✅ Mailer: transport created");
} catch (e: any) {
  initError = e?.message || String(e);
  console.error("❌ Mailer: failed to create transport:", initError);
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(to: string, link: string) {
  const from =
    process.env.MAIL_FROM || "ChefSire Royal Guard <verify@notify.chefsire.com>";

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55">
      <h2>👑 Welcome to ChefSire!</h2>
      <p>Click the button below to verify your email address.</p>
      <p>
        <a href="${link}" style="display:inline-block;background:#facc15;color:#111;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">
          Verify Email
        </a>
      </p>
      <p>This link expires in 24 hours. If you didn't sign up, ignore this message.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
      <p style="font-size:12px;color:#666">ChefSire • Royal Guard</p>
    </div>
  `;

  if (initError || !transport) {
    console.error("❌ Cannot send email:", initError || "No transport");
    console.log("📧 Fallback — verification link for", to, ":", link);
    throw new Error(initError || "Email transport not available");
  }

  const info = await transport.sendMail({
    from,
    to,
    subject: "👑 Verify your ChefSire account",
    html,
  });

  console.log("✅ Email sent to", to, "— messageId:", info.messageId);
  return info;
}

/**
 * Send wedding RSVP invitation email
 */
export async function sendWeddingRsvpEmail(
  to: string,
  guestName: string,
  acceptLink: string,
  declineLink: string,
  eventDetails?: {
    coupleName?: string;
    eventDate?: string;
    eventLocation?: string;
    message?: string;
    template?: string;
  }
) {
  const from =
    process.env.MAIL_FROM || "ChefSire Weddings <weddings@notify.chefsire.com>";

  const coupleName = eventDetails?.coupleName || "Our Wedding";
  const eventDate = eventDetails?.eventDate
    ? new Date(eventDetails.eventDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : "Date TBD";
  const eventLocation = eventDetails?.eventLocation || "Location TBD";
  const customMessage = eventDetails?.message || "";
  const template = eventDetails?.template || "elegant";

  // Template-based styling
  const templateStyles = {
    elegant: {
      primaryColor: "#d4af37",
      secondaryColor: "#2c3e50",
      fontFamily: "Georgia, serif",
      headerBg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    rustic: {
      primaryColor: "#8b4513",
      secondaryColor: "#654321",
      fontFamily: "Courier New, monospace",
      headerBg: "linear-gradient(135deg, #c79081 0%, #dfa579 100%)",
    },
    modern: {
      primaryColor: "#ff6b6b",
      secondaryColor: "#4ecdc4",
      fontFamily: "Arial, sans-serif",
      headerBg: "linear-gradient(135deg, #667eea 0%, #f093fb 100%)",
    },
  };

  const style = templateStyles[template as keyof typeof templateStyles] || templateStyles.elegant;

  const html = `
    <div style="font-family:${style.fontFamily};line-height:1.6;max-width:600px;margin:0 auto;">
      <div style="background:${style.headerBg};color:white;padding:40px 20px;text-align:center;border-radius:10px 10px 0 0;">
        <h1 style="margin:0;font-size:32px;">💍 You're Invited!</h1>
        <p style="margin:10px 0 0 0;font-size:18px;">${coupleName}</p>
      </div>

      <div style="background:#ffffff;padding:40px 30px;border:2px solid #eee;border-top:none;border-radius:0 0 10px 10px;">
        <p style="font-size:18px;color:${style.secondaryColor};">Dear ${guestName},</p>

        <p style="font-size:16px;color:#555;">
          We are delighted to invite you to celebrate our special day with us!
        </p>

        ${customMessage ? `
          <div style="background:#f9f9f9;border-left:4px solid ${style.primaryColor};padding:15px;margin:20px 0;font-style:italic;color:#555;">
            ${customMessage}
          </div>
        ` : ''}

        <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin:30px 0;">
          <h3 style="margin:0 0 15px 0;color:${style.secondaryColor};">Event Details</h3>
          <p style="margin:8px 0;"><strong>📅 Date:</strong> ${eventDate}</p>
          <p style="margin:8px 0;"><strong>📍 Location:</strong> ${eventLocation}</p>
        </div>

        <p style="font-size:16px;color:#555;margin-bottom:30px;">
          Please let us know if you can attend:
        </p>

        <div style="text-align:center;margin:30px 0;">
          <a href="${acceptLink}" style="display:inline-block;background:${style.primaryColor};color:white;padding:15px 40px;border-radius:8px;text-decoration:none;font-weight:bold;margin:10px;font-size:16px;">
            ✓ Accept Invitation
          </a>
          <a href="${declineLink}" style="display:inline-block;background:#999;color:white;padding:15px 40px;border-radius:8px;text-decoration:none;font-weight:bold;margin:10px;font-size:16px;">
            ✗ Decline
          </a>
        </div>

        <p style="font-size:14px;color:#888;margin-top:40px;text-align:center;">
          We hope you can join us on this special day!<br/>
          This invitation expires in 30 days.
        </p>
      </div>

      <div style="text-align:center;padding:20px;color:#999;font-size:12px;">
        <p>Sent via ChefSire Wedding Planning</p>
        <p>If you received this email by mistake, please ignore it.</p>
      </div>
    </div>
  `;

  if (initError || !transport) {
    console.error("❌ Cannot send email:", initError || "No transport");
    console.log("📧 Fallback — RSVP links for", to);
    console.log("   Accept:", acceptLink);
    console.log("   Decline:", declineLink);
    throw new Error(initError || "Email transport not available");
  }

  const info = await transport.sendMail({
    from,
    to,
    subject: `💍 You're Invited to ${coupleName}!`,
    html,
  });

  console.log("✅ RSVP invitation sent to", to, "— messageId:", info.messageId);
  return info;
}

/**
 * Mail health check — verifies SMTP credentials with the provider
 * Used by GET /api/auth/_mail-verify
 */
export async function mailHealth(): Promise<Health> {
  const env = {
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT ? Number(process.env.MAIL_PORT) : undefined,
    userSet: !!process.env.MAIL_USER,
    passSet: !!process.env.MAIL_PASS,
    from: process.env.MAIL_FROM,
    appUrl: process.env.APP_URL,
    nodeEnv: process.env.NODE_ENV,
  };

  if (initError || !transport) {
    return {
      verifyOK: false,
      verifyError: initError || "Transport not initialized",
      env,
    };
  }

  try {
    await transport.verify(); // real SMTP handshake + auth check
    return { verifyOK: true, env };
  } catch (e: any) {
    return {
      verifyOK: false,
      verifyError: e?.message || String(e),
      env,
    };
  }
}
