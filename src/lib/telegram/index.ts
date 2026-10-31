import { getDb } from "../db";
import fs from "node:fs";

interface TelegramConfig {
  botToken?: string;
  chatId?: string;
}

export async function getTelegramConfig(): Promise<TelegramConfig> {
  const db = getDb();
  const settingsRows = await db.execute("SELECT key, value FROM system_settings WHERE key LIKE 'telegram_%'");
  const settings: Record<string, string> = {};
  for (const row of settingsRows.rows) {
    if (row.key && row.value) {
      settings[row.key as string] = row.value as string;
    }
  }

  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || settings.telegram_bot_token || "",
    chatId: process.env.TELEGRAM_CHAT_ID || settings.telegram_chat_id || "",
  };
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const { botToken, chatId } = await getTelegramConfig();
  if (!botToken || !chatId) {
    console.warn("Telegram bot token or chat ID is not configured.");
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error("Telegram API error:", data);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
    return false;
  }
}

export async function sendTelegramPhoto(params: {
  caption: string;
  photoPathOrBuffer: string | Buffer;
}): Promise<boolean> {
  const { botToken, chatId } = await getTelegramConfig();
  if (!botToken || !chatId) {
    console.warn("Telegram bot token or chat ID is not configured.");
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("caption", params.caption);
    formData.append("parse_mode", "Markdown");

    let blob: Blob;
    if (typeof params.photoPathOrBuffer === "string") {
      const fileBuffer = fs.readFileSync(params.photoPathOrBuffer);
      blob = new Blob([new Uint8Array(fileBuffer)], { type: "image/png" });
    } else {
      blob = new Blob([new Uint8Array(params.photoPathOrBuffer)], { type: "image/png" });
    }

    formData.append("photo", blob, "checkpoint.png");

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    return !!data.ok;
  } catch (err) {
    console.error("Failed to send Telegram photo:", err);
    return false;
  }
}

export async function triggerHumanInTheLoopAlert(params: {
  platform: "linkedin" | "internshala";
  type: "captcha" | "otp" | "login_checkpoint" | "error";
  message: string;
  screenshotPath?: string;
  jobDetails?: { company: string; position: string; url?: string };
}) {
  const db = getDb();

  // Log in SQLite alerts table
  const result = await db.execute({
    sql: `INSERT INTO alerts (platform, type, message, screenshot_path, status)
          VALUES (?, ?, ?, ?, 'pending')`,
    args: [params.platform, params.type, params.message, params.screenshotPath || null],
  });

  const alertId = result.lastInsertRowid;

  // Format rich Telegram message
  const icon = params.type === "captcha" ? "🛡️ [CAPTCHA DETECTED]" : params.type === "otp" ? "🔐 [OTP REQUIRED]" : "⚠️ [INTERVENTION NEEDED]";
  const text = `${icon}
*Action Required on ${params.platform.toUpperCase()}*

${params.message}

${params.jobDetails ? `🏢 *Company:* ${params.jobDetails.company}\n💼 *Role:* ${params.jobDetails.position}` : ""}

*Runner status:* Script paused. Please complete the verification in your browser window, then confirm in the AutoJob Dashboard or reply to resume.
*Alert ID:* #${alertId}`;

  if (params.screenshotPath && fs.existsSync(params.screenshotPath)) {
    await sendTelegramPhoto({
      caption: text,
      photoPathOrBuffer: params.screenshotPath,
    });
  } else {
    await sendTelegramMessage(text);
  }

  return alertId;
}
