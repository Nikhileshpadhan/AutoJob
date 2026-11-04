import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Load .env
dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const baseUrl = (process.env.TELEGRAM_API_BASE_URL || "https://api.telegram.org").replace(/\/+$/, "");

console.log("\n=======================================================");
console.log("  🤖 AutoJob Telegram Integration Verification Test");
console.log("=======================================================\n");

console.log(`• Target Endpoint: ${baseUrl}`);
console.log(`• Bot Token:       ${botToken ? `${botToken.slice(0, 10)}...` : "NOT FOUND"}`);
console.log(`• Chat ID:         ${chatId || "NOT FOUND"}`);

if (!botToken || !chatId) {
  console.error("\n❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env!");
  process.exit(1);
}

const testMessage = `🤖 *AutoJob Verification Alert*
Timestamp: ${new Date().toLocaleString()}

Hello! This is a test message from your AutoJob system to confirm that Telegram notifications are working properly.

No database records or runner state were affected during this test.`;

async function testTelegram() {
  console.log("\nSending test message to Telegram...");
  try {
    const url = `${baseUrl}/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: testMessage,
        parse_mode: "Markdown",
      }),
    });

    const data = await response.json();
    if (data.ok) {
      console.log("\n✅ SUCCESS: Test message successfully delivered to Telegram!");
      console.log(`   Message ID: ${data.result.message_id}`);
      console.log(`   Chat: ${data.result.chat.first_name || ""} (ID: ${data.result.chat.id})`);
    } else {
      console.log("\n❌ TELEGRAM REJECTED THE REQUEST:");
      console.log(`   Code: ${data.error_code}`);
      console.log(`   Description: ${data.description}`);
    }
  } catch (err) {
    console.error("\n❌ CONNECTION ERROR:", err.message);
    if (err.message.includes("ECONNRESET") || err.message.includes("fetch failed")) {
      console.log("\n⚠️  DIAGNOSIS: The connection to api.telegram.org was reset by your network / ISP.");
      console.log("   (Common with Indian ISPs blocking api.telegram.org at the SNI level).");
      console.log("\n💡 SOLUTIONS:");
      console.log("   1. Turn on a VPN or Cloudflare WARP (1.1.1.1) on your system.");
      console.log("   2. OR set up a free Cloudflare Worker reverse proxy and set:");
      console.log("      TELEGRAM_API_BASE_URL=https://your-worker.workers.dev in .env");
    }
  }
}

testTelegram();

