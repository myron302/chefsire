// server/utils/mailer.ts - WITH ERROR HANDLING
let nodemailer: any;
let mailerTransport: any = null;
let mailerError: string | null = null;

// Try to load nodemailer
try {
  nodemailer = require("nodemailer");
} catch (error) {
  mailerError = "nodemailer not installed - run: npm install nodemailer";
  console.error("⚠️", mailerError);
}

// Try to create transport
if (nodemailer) {
  try {
    mailerTransport = nodemailer.createTransport({
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
    console.log("✅ Mailer transport created successfully");
  } catch (error: any) {
    mailerError = `Failed to create mailer: ${error.message}`;
    console.error("⚠️", mailerError);
  }
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
  
  // If mailer isn't set up, log error and link
  if (mailerError || !mailerTransport) {
    console.error("❌ Cannot send email:", mailerError || "Transport not initialized");
    console.log("📧 Verification link for", to, ":", link);
    throw new Error(mailerError || "Email transport not available");
  }

  try {
    const info = await mailerTransport.sendMail({
      from: process.env.MAIL_FROM || 'ChefSire Royal Guard <verify@notify.chefsire.com>',
      to,
      subject: "👑 Verify your ChefSire account",
      html,
    });
    
    console.log('✅ Email sent successfully to', to, '- Message ID:', info.messageId);
    return info;
  } catch (error: any) {
    console.error('❌ Failed to send email to', to, ':', error.message);
    console.log('📧 Verification link:', link);
    throw error;
  }
}
