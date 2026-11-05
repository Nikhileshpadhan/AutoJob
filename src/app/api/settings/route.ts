import { NextResponse } from "next/server";
import { getDb, initDatabase } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const ALLOWED_SETTING_KEYS = new Set([
  "daily_cap",
  "linkedin_daily_cap",
  "internshala_daily_cap",
  "opportunity_type",
  "workplace_type",
  "target_location",
  "apply_type",
  "min_match_score",
  "active_llm",
  "gemini_model",
  "gemini_api_key",
  "groq_api_key",
  "telegram_bot_token",
  "telegram_chat_id",
  "telegram_api_base_url",
  "telegram_enabled",
  "auto_apply_enabled",
  "pacing_enabled",
  "ignore_time_window",
  "active_window_start",
  "active_window_end",
  "min_rest_minutes",
  "max_rest_minutes",
]);

const SENSITIVE_KEYS = new Set([
  "gemini_api_key",
  "groq_api_key",
  "telegram_bot_token",
]);

export async function GET() {
  try {
    await initDatabase();
    const db = getDb();
    const rows = await db.execute("SELECT key, value FROM system_settings");
    const settings: Record<string, string> = {};
    for (const row of rows.rows) {
      if (row.key) {
        settings[row.key as string] = (row.value as string) || "";
      }
    }

    // Mask sensitive keys for client display
    return NextResponse.json({
      settings: {
        daily_cap: settings.daily_cap || "10",
        linkedin_daily_cap: settings.linkedin_daily_cap || "5",
        internshala_daily_cap: settings.internshala_daily_cap || "5",
        opportunity_type: settings.opportunity_type || "internship",
        workplace_type: settings.workplace_type || "remote",
        target_location: settings.target_location || "Remote",
        apply_type: settings.apply_type || "easy_apply_only",
        min_match_score: settings.min_match_score || "65",
        active_llm: settings.active_llm || "gemini",
        gemini_model: settings.gemini_model || "gemini-2.5-flash",
        gemini_api_key_configured: Boolean(settings.gemini_api_key || process.env.GEMINI_API_KEY),
        groq_api_key_configured: Boolean(settings.groq_api_key || process.env.GROQ_API_KEY),
        telegram_bot_token_configured: Boolean(settings.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN),
        telegram_chat_id: settings.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || "",
        telegram_api_base_url: settings.telegram_api_base_url || process.env.TELEGRAM_API_BASE_URL || "",
        telegram_enabled: settings.telegram_enabled || "true",
        auto_apply_enabled: settings.auto_apply_enabled || "true",
        pacing_enabled: settings.pacing_enabled || "true",
        ignore_time_window: settings.ignore_time_window || "false",
        active_window_start: settings.active_window_start || "9",
        active_window_end: settings.active_window_end || "23",
        min_rest_minutes: settings.min_rest_minutes || "20",
        max_rest_minutes: settings.max_rest_minutes || "60",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDatabase();
    const body = await request.json();
    const db = getDb();
    const todayStr = new Date().toISOString().split("T")[0];

    for (const [key, rawVal] of Object.entries(body)) {
      if (!ALLOWED_SETTING_KEYS.has(key)) {
        continue; // Disallow arbitrary key pollution (BE-005)
      }

      // Handle revocation / clear key
      if (rawVal === "" || rawVal === null) {
        if (SENSITIVE_KEYS.has(key)) {
          await db.execute({
            sql: "DELETE FROM system_settings WHERE key = ?",
            args: [key],
          });
        }
        continue;
      }

      if (typeof rawVal === "string") {
        if (rawVal === "configured" || rawVal.includes("••••")) {
          continue; // Unchanged masked placeholder
        }

        let storedValue = rawVal.trim();
        if (SENSITIVE_KEYS.has(key)) {
          storedValue = encryptSecret(storedValue); // Encrypt sensitive secrets at rest (SEC-002)
        }

        await db.execute({
          sql: `INSERT INTO system_settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
          args: [key, storedValue],
        });

        // Sync platform quotas if caps changed
        if (key === "linkedin_daily_cap") {
          const capNum = parseInt(rawVal, 10) || 5;
          await db.execute({
            sql: `INSERT INTO platform_daily_quota (date, platform, applied_count, max_cap)
                  VALUES (?, 'linkedin', 0, ?)
                  ON CONFLICT(date, platform) DO UPDATE SET max_cap = ?`,
            args: [todayStr, capNum, capNum],
          });
        }

        if (key === "internshala_daily_cap") {
          const capNum = parseInt(rawVal, 10) || 5;
          await db.execute({
            sql: `INSERT INTO platform_daily_quota (date, platform, applied_count, max_cap)
                  VALUES (?, 'internshala', 0, ?)
                  ON CONFLICT(date, platform) DO UPDATE SET max_cap = ?`,
            args: [todayStr, capNum, capNum],
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: "Settings saved successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
