// Test email configuration
import "dotenv/config";

console.log("\n🔍 Checking Email Configuration:\n");
console.log("MAIL_HOST:", process.env.MAIL_HOST || "❌ NOT SET");
console.log("MAIL_PORT:", process.env.MAIL_PORT || "❌ NOT SET");
console.log("MAIL_USER:", process.env.MAIL_USER || "❌ NOT SET");
console.log("MAIL_PASS:", process.env.MAIL_PASS ? "✅ SET (hidden)" : "❌ NOT SET");
console.log("MAIL_FROM:", process.env.MAIL_FROM || "❌ NOT SET");
console.log("APP_URL:", process.env.APP_URL || "❌ NOT SET");

console.log("\n🧪 Testing Email Send:\n");

async function testEmail() {
  try {
    // Import mailer
    const { sendVerificationEmail } = await import("../utils/mailer.js");

    const testLink = "https://chefsire.com/api/auth/verify-email?token=test123";
    const testEmail = process.env.MAIL_USER || "test@example.com";

    console.log(`Attempting to send test email to: ${testEmail}`);

    await sendVerificationEmail(testEmail, testLink);

    console.log("\n✅ EMAIL SENT SUCCESSFULLY!");
    console.log("Check your inbox for the verification email.\n");
  } catch (error: any) {
    console.error("\n❌ EMAIL FAILED:", error.message);
    console.error("\nFull error:", error);
  }
}

testEmail();
