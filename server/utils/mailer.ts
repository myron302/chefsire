// server/utils/mailer.ts
let nodemailer: any;
let transport: any = null;
let initError: string | null = null;
let lastVerifyOK: boolean | null = null;
let lastVerifyError: string | null = null;

try {
  // Use require for CJS interop in Node ESM bundle
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  nodemailer = require("nodemailer");
} catch (e) {
  initError = "nodemailer not installed";
  console.error("❌ mailer init:", initError);
}

async function createTransport() {
  if (!nodemailer) return null;

  try {
    const t = nodemailer.createTransport({
      host: process.env.MAIL_HOST || "smtp.ionos.com",
      port: Number(process.env.MAIL_PORT || 587),
      secure: false,            // STARTTLS
      requireTLS: true,         // make sure we upgrade
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      // Helpful while diagnosing; flip to false later if noisy
      logger: true,
      debug: true,
      tls: {
        // Keep strict; IONOS has valid certs
        rejectUnauthorized: true,
      },
    });

    return t;
  } catch (err: any) {
    initError = `createTransport failed: ${err?.message || String(err)}`;
    console.error("❌ mailer transport:", initError);
    return null;
  }
}

// Initialize on first import
(async () => {
  transport = await createTransport();
  if (!transport) return;
  try {
    await transport.verify();
    lastVerifyOK = true;
    lastVerifyError = null;
    console.log("✅ SMTP transport verified: ready to send");
    console.log("📧 MAIL_USER:", process.env.MAIL_USER ? "SET" : "MISSING");
    console.log("📧 MAIL_FROM:", process.env.MAIL_FROM || "ChefSire Royal Guard <verify@notify.chefsire.com>");
  } catch (err: any) {
    lastVerifyOK = false;
    lastVerifyError = err?.message || String(err);
    console.error("❌ SMTP verify failed:", lastVerifyError);
  }
})();

export async function mailHealth() {
  return {
    hasNodemailer: !!nodemailer,
    transportCreated: !!transport,
    verifyOK: lastVerifyOK,
    verifyError: lastVerifyError,
    initError,
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    userSet: !!process.env.MAIL_USER,
    fromValue: process.env.MAIL_FROM || 'ChefSire Royal Guard <verify@notify.chefsire.com>',
  };
}

export async function sendVerificationEmail(to: string, link: string) {
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

  if (!nodemailer || !transport) {
    const msg = initError || "Email transport not available";
    console.error("❌ sendVerificationEmail:", msg);
    throw new Error(msg);
  }

  // Optional: re-verify before send (helps catch mid-run password changes)
  try {
    await transport.verify();
    lastVerifyOK = true;
    lastVerifyError = null;
  } catch (err: any) {
    lastVerifyOK = false;
    lastVerifyError = err?.message || String(err);
    console.error("❌ SMTP verify (pre-send) failed:", lastVerifyError);
    // continue to attempt send — provider sometimes returns richer errors on send
  }

  const fromValue = process.env.MAIL_FROM || 'ChefSire Royal Guard <verify@notify.chefsire.com>';

  try {
    const info = await transport.sendMail({
      from: fromValue, // must be mailbox or same domain allowed by IONOS
      to,
      subject: "👑 Verify your ChefSire account",
      html,
    });
    console.log("✅ Email sent:", info.messageId);
    return info;
  } catch (err: any) {
    console.error("❌ Email send failed:", err?.message || String(err));
    throw err;
  }
}
