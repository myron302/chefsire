// server/utils/mailer.ts - SAFE VERSION
import nodemailer from "nodemailer";

let mailer: any = null;

function getMailer() {
  if (!mailer) {
    try {
      mailer = nodemailer.createTransport({
        host: process.env.MAIL_HOST || "smtp.ionos.com",
        port: Number(process.env.MAIL_PORT || 587),
        secure: false,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false,
          ciphers: 'SSLv3',
        },
        debug: process.env.NODE_ENV !== 'production',
        logger: process.env.NODE_ENV !== 'production',
      });
    } catch (error) {
      console.error('⚠️ Failed to create mailer transport:', error);
      return null;
    }
  }
  return mailer;
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
  
  try {
    const transport = getMailer();
    
    if (!transport) {
      console.log('⚠️ Email not configured - verification link:', link);
      return { messageId: 'disabled', link };
    }

    const info = await transport.sendMail({
      from: process.env.MAIL_FROM || 'ChefSire Royal Guard <verify@notify.chefsire.com>',
      to,
      subject: "👑 Verify your ChefSire account",
      html,
    });
    
    console.log('✅ Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    console.log('📧 Verification link (email failed):', link);
    // Don't throw - just log the link
    return { messageId: 'error', link };
  }
}
