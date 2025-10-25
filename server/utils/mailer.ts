// server/utils/mailer.ts
import nodemailer from "nodemailer";

export const mailer = nodemailer.createTransport({
  host: process.env.MAIL_HOST || "smtp.ionos.com",
  port: Number(process.env.MAIL_PORT || 587),
  secure: false, // false for port 587 (TLS), true for port 465 (SSL)
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    // Do not fail on invalid certs (for development)
    rejectUnauthorized: false,
    // Force TLS
    ciphers: 'SSLv3',
  },
  // Add debug logging
  debug: process.env.NODE_ENV !== 'production',
  logger: process.env.NODE_ENV !== 'production',
});

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
  
  try {
    const info = await mailer.sendMail({
      from: process.env.MAIL_FROM || 'ChefSire Royal Guard <verify@notify.chefsire.com>',
      to,
      subject: "👑 Verify your ChefSire account",
      html,
    });
    
    console.log('✅ Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
}
