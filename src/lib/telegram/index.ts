import { getDb } from "../db";
import { decryptSecret } from "../crypto";
import fs from "node:fs";

interface TelegramConfig {
  botToken?: string;
  chatId?: string;
  apiBaseUrl?: string;
  enabled?: boolean;
}

/**
 * Resolves Telegram credentials strictly from user_settings for the specified user.
 * Never falls back to global .env keys.
 */
export async function getTelegramConfig(userId: string = "default-user"): Promise<TelegramConfig> {
  const db = getDb();
  const settingsRows = await db.execute({
    sql: "SELECT key, value FROM user_settings WHERE user_id = ? AND key LIKE 'telegram_%'",
    args: [userId],
  });
  const settings: Record<string, string> = {};
  for (const row of settingsRows.rows) {
    if (row.key && row.value) {
      settings[row.key as string] = row.value as string;
    }
  }

  const rawBaseUrl = settings.telegram_api_base_url || "https://api.telegram.org";
  const apiBaseUrl = rawBaseUrl.replace(/\/+$/, "");
  const rawBotToken = settings.telegram_bot_token || "";
  const enabled = (settings.telegram_enabled || "false") === "true";

  return {
    botToken: decryptSecret(rawBotToken),
    chatId: settings.telegram_chat_id || "",
    apiBaseUrl,
    enabled,
  };
}

export interface TelegramResult {
  success: boolean;
  error?: string;
}

export async function sendTelegramMessageDetails(
  text: string,
  userId: string = "default-user"
): Promise<TelegramResult> {
  const { botToken, chatId, apiBaseUrl = "https://api.telegram.org", enabled } = await getTelegramConfig(userId);
  if (!enabled) {
    return { success: false, error: "Telegram notifications are disabled in user settings." };
  }

  if (!botToken || !chatId) {
    return { success: false, error: "Telegram bot token or chat ID is not configured." };
  }

  try {
    const url = `${apiBaseUrl}/bot${botToken}/sendMessage`;
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
      return { success: false, error: data.description || "Telegram API rejected the request." };
    }
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to send Telegram message:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendTelegramMessage(
  text: string,
  userId: string = "default-user"
): Promise<TelegramResult> {
  return sendTelegramMessageDetails(text, userId);
}

export interface TriggerAlertParams {
  platform: string;
  type: string;
  message: string;
  screenshotPath?: string;
  screenshotBase64?: string;
  jobDetails?: { company?: string; position?: string; url?: string };
  userId?: string;
}

export async function triggerHumanInTheLoopAlert(
  params: TriggerAlertParams
): Promise<{ alertId: number }> {
  const db = getDb();
  const userId = params.userId || "default-user";

  let screenshotBase64 = params.screenshotBase64 || null;
  if (!screenshotBase64 && params.screenshotPath && fs.existsSync(params.screenshotPath)) {
    try {
      const fileBuffer = fs.readFileSync(params.screenshotPath);
      screenshotBase64 = fileBuffer.toString("base64");
    } catch (e) {
      console.warn("Failed to read screenshot for alert:", e);
    }
  }

  const result = await db.execute({
    sql: `INSERT INTO alerts (user_id, platform, type, message, screenshot_base64, status)
          VALUES (?, ?, ?, ?, ?, 'pending')`,
    args: [userId, params.platform, params.type, params.message, screenshotBase64],
  });

  const alertId = Number(result.lastInsertRowid);
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const checkpointUrl = `${baseUrl.replace(/\/+$/, "")}/alerts?id=${alertId}`;

  try {
    await sendTelegramCheckpointAlert(
      {
        platform: params.platform,
        type: params.type,
        message: params.message,
        checkpointUrl,
        screenshotPath: params.screenshotPath,
        screenshotBase64: screenshotBase64 || undefined,
      },
      userId
    );
  } catch (err) {
    console.error("Failed to dispatch Telegram checkpoint notification:", err);
  }

  return { alertId };
}

export async function sendTelegramCheckpointAlert(
  alertData: {
    platform: string;
    type: string;
    message: string;
    checkpointUrl: string;
    screenshotPath?: string;
    screenshotBase64?: string;
  },
  userId: string = "default-user"
): Promise<boolean> {
  const { botToken, chatId, apiBaseUrl = "https://api.telegram.org", enabled } = await getTelegramConfig(userId);
  if (!enabled || !botToken || !chatId) {
    return false;
  }

  const caption = `🚨 *AutoJob Security Checkpoint Triggered!*

*Platform:* ${alertData.platform.toUpperCase()}
*Type:* ${alertData.type.toUpperCase()}
*Details:* ${alertData.message}

⚠️ *Action Required:* Automation is paused awaiting verification.
[👉 Resolve Checkpoint in AutoJob](${alertData.checkpointUrl})`;

  try {
    if (alertData.screenshotPath && fs.existsSync(alertData.screenshotPath)) {
      const fileBuffer = fs.readFileSync(alertData.screenshotPath);
      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append("caption", caption);
      formData.append("parse_mode", "Markdown");
      formData.append(
        "photo",
        new Blob([fileBuffer], { type: "image/png" }),
        "checkpoint.png"
      );

      const url = `${apiBaseUrl}/bot${botToken}/sendPhoto`;
      const res = await fetch(url, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      return !!data.ok;
    } else if (alertData.screenshotBase64) {
      const cleanBase64 = alertData.screenshotBase64.replace(/^data:image\/\w+;base64,/, "");
      const fileBuffer = Buffer.from(cleanBase64, "base64");
      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append("caption", caption);
      formData.append("parse_mode", "Markdown");
      formData.append(
        "photo",
        new Blob([fileBuffer], { type: "image/png" }),
        "checkpoint.png"
      );

      const url = `${apiBaseUrl}/bot${botToken}/sendPhoto`;
      const res = await fetch(url, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      return !!data.ok;
    } else {
      const res = await sendTelegramMessageDetails(caption, userId);
      return res.success;
    }
  } catch (err) {
    console.error("Failed to send Telegram checkpoint alert:", err);
    return false;
  }
}
