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
  wedding?: {
    verifyOK: boolean;
    verifyError?: string;
    env: {
      host: string | undefined;
      port: number | undefined;
      userSet: boolean;
      passSet: boolean;
      from: string | undefined;
      separateCredentials: boolean;
    };
  };
};

let transport: nodemailer.Transporter | null = null;
let initError: string | null = null;

// Wedding-specific transport (separate email account for invitations)
let weddingTransport: nodemailer.Transporter | null = null;
let weddingInitError: string | null = null;

// Create transport once (for verification emails)
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
  console.log("✅ Mailer: verification transport created");
} catch (e: any) {
  initError = e?.message || String(e);
  console.error("❌ Mailer: failed to create verification transport:", initError);
}

// Create wedding transport (separate credentials for wedding invitations)
try {
  // Only create if separate credentials are provided, otherwise fall back to main transport
  if (process.env.WEDDING_MAIL_USER && process.env.WEDDING_MAIL_PASS) {
    weddingTransport = nodemailer.createTransport({
      host: process.env.WEDDING_MAIL_HOST || process.env.MAIL_HOST || "smtp.ionos.com",
      port: Number(process.env.WEDDING_MAIL_PORT || process.env.MAIL_PORT || 587),
      secure: false, // STARTTLS on 587
      auth: {
        user: process.env.WEDDING_MAIL_USER,
        pass: process.env.WEDDING_MAIL_PASS,
      },
      tls: {
        rejectUnauthorized: true,
      },
      debug: process.env.NODE_ENV !== "production",
      logger: process.env.NODE_ENV !== "production",
    });
    console.log("✅ Mailer: wedding transport created with separate credentials");
  } else {
    // Fall back to main transport if no separate wedding credentials
    weddingTransport = transport;
    console.log("ℹ️  Mailer: using main transport for wedding emails (no separate credentials)");
  }
} catch (e: any) {
  weddingInitError = e?.message || String(e);
  console.error("❌ Mailer: failed to create wedding transport:", weddingInitError);
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
  partnerName?: string, // Partner/Plus-one name
  eventDetails?: {
    partner1Name?: string;
    partner2Name?: string;
    coupleName?: string;
    eventDate?: string;
    eventLocation?: string;
    receptionDate?: string;
    receptionLocation?: string;
    useSameLocation?: boolean;
    hasReception?: boolean;
    message?: string;
    template?: string;
    coupleEmail?: string; // The couple's email for replies
  }
) {
  const from =
    process.env.WEDDING_MAIL_FROM || process.env.MAIL_FROM || "ChefSire Weddings <invitations@chefsire.com>";

  const coupleName = eventDetails?.coupleName || "Our Wedding";

  // Format event date and time
  let eventDate = "Date TBD";
  let eventTime = "";
  if (eventDetails?.eventDate) {
    const date = new Date(eventDetails.eventDate);
    eventDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Check if time is included (if not midnight UTC)
    const timeString = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    // Only include time if it's not midnight (00:00)
    if (date.getHours() !== 0 || date.getMinutes() !== 0) {
      eventTime = ` at ${timeString}`;
    }
  }

  const eventLocation = eventDetails?.eventLocation || "Location TBD";

  // Format reception date and time
  let receptionDate = "";
  let receptionTime = "";
  if (eventDetails?.receptionDate) {
    const date = new Date(eventDetails.receptionDate);
    receptionDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const timeString = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    if (date.getHours() !== 0 || date.getMinutes() !== 0) {
      receptionTime = ` at ${timeString}`;
    }
  }

  // Debug logging
  console.log('[sendWeddingRsvpEmail] eventDetails:', JSON.stringify(eventDetails, null, 2));
  console.log('[sendWeddingRsvpEmail] receptionDate:', eventDetails?.receptionDate);
  console.log('[sendWeddingRsvpEmail] receptionLocation:', eventDetails?.receptionLocation);
  console.log('[sendWeddingRsvpEmail] hasReception flag:', eventDetails?.hasReception);

  // Use explicit flag from frontend, or fallback to checking if reception info exists
  const hasReception = eventDetails?.hasReception ?? (!!(eventDetails?.receptionDate || eventDetails?.receptionLocation));
  const useSameLocation = eventDetails?.useSameLocation || false;
  const receptionLocation = eventDetails?.receptionLocation || (useSameLocation && eventDetails?.eventLocation) || "";

  console.log('[sendWeddingRsvpEmail] Computed hasReception:', hasReception);
  console.log('[sendWeddingRsvpEmail] Computed receptionLocation:', receptionLocation);

  const partner1 = eventDetails?.partner1Name || "";
  const partner2 = eventDetails?.partner2Name || "";

  const customMessage = eventDetails?.message || "";
  const template = eventDetails?.template || "elegant";

  // Template-based styling (email-safe with solid colors instead of gradients)
  // The colours and fonts here mirror the styles used in the client-side
  // invitation preview. Gradients are avoided for better email client
  // compatibility, but the base hues and typography are retained.
  const templateStyles = {
    // Elegant theme: soft pinks with serif typography
    elegant: {
      // Accent colour used for buttons and highlights
      primaryColor: "#ec4899", // Tailwind pink-500
      // Secondary colour for subtext and icons
      secondaryColor: "#6b5eb5", // Matches the preview header hue
      // Serif family to evoke classic elegance
      fontFamily: "Georgia, serif",
      // Light background for the header to reflect the preview’s airy feel
      headerBg: "#fdf2f8", // Tailwind rose-50
      // Text colour contrasting with the light header background
      headerTextColor: "#6b5eb5",
    },
    // Rustic theme: warm ambers and earthy tones
    rustic: {
      primaryColor: "#d97706", // Tailwind amber-600
      secondaryColor: "#92400e", // Tailwind amber-800
      fontFamily: "Courier New, monospace", // Rustic, typewriter-esque
      headerBg: "#fff7ed", // Tailwind orange-50
      headerTextColor: "#92400e",
    },
    // Modern theme: dark mode with bright cyan accents
    modern: {
      primaryColor: "#22d3ee", // Tailwind cyan-400
      secondaryColor: "#0f172a", // Tailwind slate-900
      fontFamily: "Arial, sans-serif", // Clean, sans-serif typography
      headerBg: "#020617", // Near black, matches the modern preview background
      headerTextColor: "#ffffff", // High contrast on dark header
    },
  };

  const style = templateStyles[template as keyof typeof templateStyles] || templateStyles.elegant;

  // Generate RSVP button links (use the base acceptLink without response param)
  const baseUrl = acceptLink.split('&response=')[0];
  const acceptBothLink = `${baseUrl}&response=accept-both`;
  const ceremonyOnlyLink = `${baseUrl}&response=ceremony-only`;
  const receptionOnlyLink = `${baseUrl}&response=reception-only`;
  const declineBothLink = `${baseUrl}&response=decline`;

  const html = `
    <div style="font-family:${style.fontFamily};line-height:1.6;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background-color:${style.headerBg};color:${style.headerTextColor};padding:40px 20px;text-align:center;border-radius:10px 10px 0 0;">
        <h1 style="margin:0;font-size:32px;color:${style.headerTextColor};">💍 You're Invited!</h1>
        ${partner1 && partner2 ? `
          <p style="margin:20px 0 10px 0;font-size:28px;font-weight:bold;color:${style.headerTextColor};">${partner1} & ${partner2}</p>
          <p style="margin:5px 0 0 0;font-size:16px;color:${style.headerTextColor};">are getting married!</p>
        ` : `
          <p style="margin:10px 0 0 0;font-size:18px;color:${style.headerTextColor};">${coupleName}</p>
        `}
      </div>

      <div style="background:#ffffff;padding:40px 30px;border:2px solid #eee;border-top:none;border-radius:0 0 10px 10px;">
        <p style="font-size:18px;color:${style.secondaryColor};">
          Dear ${partnerName ? `${guestName} & ${partnerName}` : guestName},
        </p>

        <p style="font-size:16px;color:#555;">
          ${partnerName ? 'You are both invited to' : 'We are delighted to invite you to'} celebrate our special day with us!
        </p>

        ${customMessage ? `
          <div style="background:#f9f9f9;border-left:4px solid ${style.primaryColor};padding:15px;margin:20px 0;font-style:italic;color:#555;">
            ${customMessage}
          </div>
        ` : ''}

        <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin:30px 0;">
          <h3 style="margin:0 0 15px 0;color:${style.secondaryColor};">💒 Wedding Ceremony</h3>
          <p style="margin:8px 0;"><strong>📅 Date & Time:</strong> ${eventDate}${eventTime}</p>
          <p style="margin:8px 0;"><strong>📍 Location:</strong> ${eventLocation}</p>
        </div>

        ${(!hasReception && useSameLocation) ? `
          <p style="margin:30px 0;font-size:14px;font-style:italic;color:${style.secondaryColor};text-align:center;">
            Dinner & Dancing to follow at the same venue
          </p>
        ` : hasReception ? `
          <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin:30px 0;">
            <h3 style="margin:0 0 15px 0;color:${style.secondaryColor};">🎉 Reception</h3>
            ${receptionDate ? `<p style="margin:8px 0;"><strong>📅 Date & Time:</strong> ${receptionDate}${receptionTime}</p>` : ''}
            ${receptionLocation ? `<p style="margin:8px 0;"><strong>📍 Location:</strong> ${receptionLocation}</p>` : ''}
          </div>
        ` : ''}

        <p style="font-size:16px;color:#555;margin-bottom:20px;text-align:center;">
          Please let us know if you can attend:
        </p>

        ${hasReception ? `
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:30px auto;">
            <tr>
              <td style="padding:8px;">
                <a href="${acceptBothLink}" style="display:block;background-color:${style.primaryColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;text-align:center;">
                  ✓ Accept Both
                </a>
              </td>
              <td style="padding:8px;">
                <a href="${ceremonyOnlyLink}" style="display:block;background-color:#4ecdc4;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;text-align:center;">
                  Ceremony Only
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px;">
                <a href="${receptionOnlyLink}" style="display:block;background-color:#95a5a6;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;text-align:center;">
                  Reception Only
                </a>
              </td>
              <td style="padding:8px;">
                <a href="${declineBothLink}" style="display:block;background-color:#e74c3c;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;text-align:center;">
                  ✗ Decline
                </a>
              </td>
            </tr>
          </table>
        ` : `
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:30px auto;">
            <tr>
              <td style="padding:10px;">
                <a href="${acceptLink}" style="display:block;background-color:${style.primaryColor};color:#ffffff;padding:15px 40px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;text-align:center;">
                  ✓ Accept Invitation
                </a>
              </td>
              <td style="padding:10px;">
                <a href="${declineLink}" style="display:block;background-color:#999999;color:#ffffff;padding:15px 40px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;text-align:center;">
                  ✗ Decline
                </a>
              </td>
            </tr>
          </table>
        `}

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

  if (weddingInitError || !weddingTransport) {
    const error = weddingInitError || "Wedding email transport not available";
    console.error("❌ Cannot send wedding email:", error);
    console.log("📧 Fallback — RSVP links for", to);
    console.log("   Accept:", acceptLink);
    console.log("   Decline:", declineLink);
    throw new Error(error);
  }

  // Set Reply-To address: prioritize couple's email, then fallback to generic rsvp address
  const replyTo = eventDetails?.coupleEmail || process.env.WEDDING_REPLY_TO || undefined;

  const info = await weddingTransport.sendMail({
    from,
    to,
    replyTo,
    subject: `💍 You're Invited to ${coupleName}!`,
    html,
  });

  console.log("✅ RSVP invitation sent to", to, "— messageId:", info.messageId);
  return info;
}

/**
 * Send RSVP response notification to couple
 */
export async function sendRsvpNotificationEmail(
  coupleEmail: string,
  guestName: string,
  response: 'accepted' | 'declined',
  eventDetails?: {
    coupleName?: string;
    eventDate?: string;
  }
) {
  const from =
    process.env.WEDDING_MAIL_FROM || process.env.MAIL_FROM || "ChefSire Weddings <invitations@chefsire.com>";

  const coupleName = eventDetails?.coupleName || "Your Wedding";
  const responseIcon = response === 'accepted' ? '✓' : '✗';
  const responseColor = response === 'accepted' ? '#27ae60' : '#95a5a6';
  const responseText = response === 'accepted' ? 'Accepted' : 'Declined';

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;padding:30px 20px;text-align:center;border-radius:10px 10px 0 0;">
        <h1 style="margin:0;font-size:24px;">💍 RSVP Update</h1>
        <p style="margin:10px 0 0 0;font-size:16px;">${coupleName}</p>
      </div>

      <div style="background:#ffffff;padding:30px;border:2px solid #eee;border-top:none;border-radius:0 0 10px 10px;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:48px;color:${responseColor};margin-bottom:10px;">${responseIcon}</div>
          <h2 style="margin:0;color:${responseColor};">${responseText}</h2>
        </div>

        <p style="font-size:16px;color:#333;text-align:center;">
          <strong>${guestName}</strong> has ${response} your wedding invitation.
        </p>

        ${eventDetails?.eventDate ? `
          <p style="font-size:14px;color:#666;text-align:center;margin-top:20px;">
            Event Date: ${eventDetails.eventDate}
          </p>
        ` : ''}

        <div style="text-align:center;margin-top:30px;">
          <a href="${process.env.APP_URL || 'https://chefsire.com'}/wedding-planning" style="display:inline-block;background:#667eea;color:white;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;">
            View Guest List
          </a>
        </div>
      </div>

      <div style="text-align:center;padding:20px;color:#999;font-size:12px;">
        <p>ChefSire Wedding Planning</p>
      </div>
    </div>
  `;

  if (initError || !transport) {
    console.error("❌ Cannot send notification email:", initError || "No transport");
    // Don't throw - notification emails are nice-to-have
    return null;
  }

  try {
    const info = await transport.sendMail({
      from,
      to: coupleEmail,
      subject: `${responseIcon} ${guestName} ${responseText} Your Wedding Invitation`,
      html,
    });

    console.log("✅ RSVP notification sent to", coupleEmail, "— messageId:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Failed to send RSVP notification:", error);
    // Don't throw - notification emails are nice-to-have
    return null;
  }
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

  const result: Health = {
    verifyOK: false,
    env,
  };

  // Check main transport
  if (initError || !transport) {
    result.verifyError = initError || "Transport not initialized";
  } else {
    try {
      await transport.verify(); // real SMTP handshake + auth check
      result.verifyOK = true;
    } catch (e: any) {
      result.verifyError = e?.message || String(e);
    }
  }

  // Check wedding transport (if separate credentials exist)
  const hasSeparateWeddingCredentials = !!(
    process.env.WEDDING_MAIL_USER && process.env.WEDDING_MAIL_PASS
  );

  if (hasSeparateWeddingCredentials) {
    const weddingEnv = {
      host: process.env.WEDDING_MAIL_HOST || process.env.MAIL_HOST,
      port: process.env.WEDDING_MAIL_PORT
        ? Number(process.env.WEDDING_MAIL_PORT)
        : process.env.MAIL_PORT
        ? Number(process.env.MAIL_PORT)
        : undefined,
      userSet: !!process.env.WEDDING_MAIL_USER,
      passSet: !!process.env.WEDDING_MAIL_PASS,
      from: process.env.WEDDING_MAIL_FROM,
      separateCredentials: true,
    };

    if (weddingInitError || !weddingTransport) {
      result.wedding = {
        verifyOK: false,
        verifyError: weddingInitError || "Wedding transport not initialized",
        env: weddingEnv,
      };
    } else {
      try {
        await weddingTransport.verify();
        result.wedding = {
          verifyOK: true,
          env: weddingEnv,
        };
      } catch (e: any) {
        result.wedding = {
          verifyOK: false,
          verifyError: e?.message || String(e),
          env: weddingEnv,
        };
      }
    }
  } else {
    result.wedding = {
      verifyOK: result.verifyOK,
      verifyError: result.verifyError,
      env: {
        host: env.host,
        port: env.port,
        userSet: env.userSet,
        passSet: env.passSet,
        from: process.env.WEDDING_MAIL_FROM || process.env.MAIL_FROM,
        separateCredentials: false,
      },
    };
  }

  return result;
}
