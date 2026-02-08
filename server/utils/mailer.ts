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
    plusOneAllowed?: boolean; // Whether this invitation allows a plus-one
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
      primaryColor: "#ec4899", // pink
      secondaryColor: "#6b5eb5", // soft purple
      fontFamily: "Georgia, 'Times New Roman', serif",
      pageBg: "#fff7fb",
      cardBg: "#ffffff",
      cardBorder: "#f3e8ff",
      headerBg: "#fdf2f8",
      headerTextColor: "#6b5eb5",
      textColor: "#334155",
      mutedTextColor: "#64748b",
      sectionBg: "#fff1f2",
      sectionBorder: "1px solid #fce7f3",
      buttonAlt1: "#a855f7", // purple
      buttonAlt2: "#64748b", // slate
      declineColor: "#ef4444", // red
    },
    // Rustic theme: warm ambers and earthy tones
    rustic: {
      primaryColor: "#d97706", // amber
      secondaryColor: "#92400e",
      fontFamily: "'Trebuchet MS', Arial, sans-serif",
      pageBg: "#fffbeb",
      cardBg: "#ffffff",
      cardBorder: "#fde68a",
      headerBg: "#fff7ed",
      headerTextColor: "#92400e",
      textColor: "#3f2d1f",
      mutedTextColor: "#6b4f3a",
      sectionBg: "#ffedd5",
      sectionBorder: "2px dashed #d97706",
      buttonAlt1: "#b45309", // darker amber
      buttonAlt2: "#78716c", // stone
      declineColor: "#b91c1c",
    },
    // Modern theme: dark mode with bright cyan accents
    modern: {
      primaryColor: "#22d3ee", // cyan
      secondaryColor: "#0f172a", // slate-900
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
      pageBg: "#020617",
      cardBg: "#0b1220",
      cardBorder: "#1e293b",
      headerBg: "#020617",
      headerTextColor: "#ffffff",
      textColor: "#e2e8f0",
      mutedTextColor: "#94a3b8",
      sectionBg: "#0f172a",
      sectionBorder: "1px solid #1e293b",
      buttonAlt1: "#38bdf8", // sky
      buttonAlt2: "#64748b", // slate
      declineColor: "#f87171", // soft red
    },
  };

  const style = templateStyles[template as keyof typeof templateStyles] || templateStyles.elegant;

  // Generate RSVP button links (use the base acceptLink without response param)
  const baseUrl = acceptLink.split('&response=')[0];
  const acceptBothLink = `${baseUrl}&response=accept-both`;
  const ceremonyOnlyLink = `${baseUrl}&response=ceremony-only`;
  const receptionOnlyLink = `${baseUrl}&response=reception-only`;
  const declineBothLink = `${baseUrl}&response=decline`;

  const plusOneAllowed = !!eventDetails?.plusOneAllowed;

  
  const buildGoogleCalendarLink = (args: { title: string; startISO?: string; durationMinutes?: number; location?: string; details?: string }) => {
    if (!args.startISO) return "https://calendar.google.com/calendar/u/0/r";
    const start = new Date(args.startISO);
    const hasTime = !(start.getHours() === 0 && start.getMinutes() === 0);

    const pad2 = (n: number) => String(n).padStart(2, "0");
    const fmtDT = (d: Date) =>
      d.getFullYear().toString() +
      pad2(d.getMonth() + 1) +
      pad2(d.getDate()) +
      "T" +
      pad2(d.getHours()) +
      pad2(d.getMinutes()) +
      "00";
    const fmtD = (d: Date) => d.getFullYear().toString() + pad2(d.getMonth() + 1) + pad2(d.getDate());

    const params = new URLSearchParams();
    params.set("action", "TEMPLATE");
    params.set("text", args.title);

    if (hasTime) {
      const dur = Math.max(15, Number(args.durationMinutes || 60));
      const end = new Date(start.getTime() + dur * 60_000);
      params.set("dates", `${fmtDT(start)}/${fmtDT(end)}`);
    } else {
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      params.set("dates", `${fmtD(start)}/${fmtD(end)}`);
    }

    if (args.location) params.set("location", args.location);
    if (args.details) params.set("details", args.details);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const ceremonyCalendarLink = buildGoogleCalendarLink({
    title: `${coupleName} - Wedding Ceremony`,
    startISO: eventDetails?.eventDate,
    durationMinutes: 60,
    location: eventLocation,
    details: eventDetails?.message || undefined,
  });

  const receptionCalendarLink = hasReception
    ? buildGoogleCalendarLink({
        title: `${coupleName} - Reception`,
        startISO: eventDetails?.receptionDate || eventDetails?.eventDate,
        durationMinutes: 180,
        location: receptionLocation || eventLocation,
        details: eventDetails?.message || undefined,
      })
    : null;

const html = `
    <div style="font-family:${style.fontFamily};line-height:1.6;background:${style.pageBg};padding:24px 12px;">
      <div style="max-width:600px;margin:0 auto;background:${style.cardBg};border:1px solid ${style.cardBorder};border-radius:14px;overflow:hidden;">
      <div style="background-color:${style.headerBg};color:${style.headerTextColor};padding:40px 20px;text-align:center;">
        <h1 style="margin:0;font-size:32px;color:${style.headerTextColor};">💍 You're Invited!</h1>
        ${partner1 && partner2 ? `
          <p style="margin:20px 0 10px 0;font-size:28px;font-weight:bold;color:${style.headerTextColor};">${partner1} & ${partner2}</p>
          <p style="margin:5px 0 0 0;font-size:16px;color:${style.headerTextColor};">are getting married!</p>
        ` : `
          <p style="margin:10px 0 0 0;font-size:18px;color:${style.headerTextColor};">${coupleName}</p>
        `}
      </div>

      <div style="background:${style.cardBg};padding:36px 28px;color:${style.textColor};">
        <p style="font-size:18px;color:${style.secondaryColor};margin:0 0 16px 0;">
          Dear ${partnerName ? `${guestName} & ${partnerName}` : guestName},
        </p>

        <p style="font-size:16px;color:${style.mutedTextColor};margin:0 0 18px 0;">
          ${partnerName ? 'You are both invited to' : 'We are delighted to invite you to'} celebrate our special day with us!
        </p>

        ${customMessage ? `
          <div style="background:${style.sectionBg};${style.sectionBorder ? `border:${style.sectionBorder};` : ''}border-left:4px solid ${style.primaryColor};padding:15px;margin:20px 0;border-radius:10px;font-style:italic;color:${style.textColor};">
            ${customMessage}
          </div>
        ` : ''}

        <div style="background:${style.sectionBg};${style.sectionBorder ? `border:${style.sectionBorder};` : ''}padding:20px;border-radius:12px;margin:24px 0;">
          <h3 style="margin:0 0 15px 0;color:${style.secondaryColor};">💒 Wedding Ceremony</h3>
          <p style="margin:8px 0;color:${style.textColor};"><strong>📅 Date & Time:</strong> ${eventDate}${eventTime}</p>
          <p style="margin:8px 0;color:${style.textColor};"><strong>📍 Location:</strong> ${eventLocation}</p>
          <div style="margin-top:14px;">
            <a href="${ceremonyCalendarLink}" target="_blank" rel="noopener noreferrer"
              style="display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none;background:#111827;color:white;font-weight:600;font-size:14px;">📅 Add Ceremony to Google Calendar</a>
          </div>
        </div>

        ${(!hasReception && useSameLocation) ? `
          <p style="margin:30px 0;font-size:14px;font-style:italic;color:${style.secondaryColor};text-align:center;">
            Dinner & Dancing to follow at the same venue
          </p>
        ` : hasReception ? `
          <div style="background:${style.sectionBg};${style.sectionBorder ? `border:${style.sectionBorder};` : ''}padding:20px;border-radius:12px;margin:24px 0;">
            <h3 style="margin:0 0 15px 0;color:${style.secondaryColor};">🎉 Reception</h3>
            ${receptionDate ? `<p style="margin:8px 0;color:${style.textColor};"><strong>📅 Date & Time:</strong> ${receptionDate}${receptionTime}</p>` : ''}
            ${receptionLocation ? `<p style="margin:8px 0;color:${style.textColor};"><strong>📍 Location:</strong> ${receptionLocation}</p>` : ''}
          </div>
        ` : ''}

        ${plusOneAllowed && !partnerName ? `
          <div style="margin:14px 0 8px 0;padding:12px 14px;border-radius:12px;border:1px solid ${style.cardBorder};background:${style.cardBg};color:${style.mutedTextColor};font-size:14px;text-align:center;">
            ✨ You may bring a guest. When you RSVP, you’ll be asked for their name (optional).
          </div>
        ` : ''}

        <p style="font-size:16px;color:${style.mutedTextColor};margin-bottom:20px;text-align:center;">
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
                <a href="${ceremonyOnlyLink}" style="display:block;background-color:${style.buttonAlt1};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;text-align:center;">
                  Ceremony Only
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px;">
                <a href="${receptionOnlyLink}" style="display:block;background-color:${style.buttonAlt2};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;text-align:center;">
                  Reception Only
                </a>
              </td>
              <td style="padding:8px;">
                <a href="${declineBothLink}" style="display:block;background-color:${style.declineColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;text-align:center;">
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

      <div style="text-align:center;padding:20px;color:${style.mutedTextColor};font-size:12px;">
        <p>Sent via ChefSire Wedding Planning</p>
        <p>If you received this email by mistake, please ignore it.</p>
      </div>
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
