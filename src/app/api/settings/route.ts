import { NextResponse } from "next/server";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";

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
  "timezone",
  "linkedin_li_at_cookie",
  "internshala_session_cookie",
]);

const SENSITIVE_KEYS = new Set([
  "gemini_api_key",
  "groq_api_key",
  "telegram_bot_token",
  "linkedin_li_at_cookie",
  "internshala_session_cookie",
]);

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    await ensureDbInitialized();
    const db = getDb();

    const rows = await db.execute({
      sql: "SELECT key, value FROM user_settings WHERE user_id = ?",
      args: [auth.userId],
    });

    const settings: Record<string, string> = {};
    for (const row of rows.rows) {
      if (row.key) {
        settings[String(row.key)] = String(row.value || "");
      }
    }

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
        gemini_api_key_configured: Boolean(settings.gemini_api_key),
        groq_api_key_configured: Boolean(settings.groq_api_key),
        telegram_bot_token_configured: Boolean(settings.telegram_bot_token),
        telegram_chat_id: settings.telegram_chat_id || "",
        telegram_api_base_url: settings.telegram_api_base_url || "",
        telegram_enabled: settings.telegram_enabled || "false",
        auto_apply_enabled: settings.auto_apply_enabled || "true",
        pacing_enabled: settings.pacing_enabled || "true",
        ignore_time_window: settings.ignore_time_window || "false",
        active_window_start: settings.active_window_start || "9",
        active_window_end: settings.active_window_end || "23",
        min_rest_minutes: settings.min_rest_minutes || "20",
        max_rest_minutes: settings.max_rest_minutes || "60",
        timezone: settings.timezone || "Asia/Kolkata",
        linkedin_cookie_configured: Boolean(settings.linkedin_li_at_cookie),
        internshala_cookie_configured: Boolean(settings.internshala_session_cookie),
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    await ensureDbInitialized();
    const body = await request.json();
    const db = getDb();
    const userId = auth.userId;

    for (const [key, rawVal] of Object.entries(body)) {
      if (!ALLOWED_SETTING_KEYS.has(key)) {
        continue;
      }

      if (rawVal === "" || rawVal === null) {
        if (SENSITIVE_KEYS.has(key)) {
          await db.execute({
            sql: "DELETE FROM user_settings WHERE user_id = ? AND key = ?",
            args: [userId, key],
          });
        } else {
          await db.execute({
            sql: `INSERT INTO user_settings (user_id, key, value, updated_at) 
                  VALUES (?, ?, '', CURRENT_TIMESTAMP)
                  ON CONFLICT(user_id, key) DO UPDATE SET value = '', updated_at = CURRENT_TIMESTAMP`,
            args: [userId, key],
          });
        }
        continue;
      }

      const valStr = String(rawVal);
      const finalVal = SENSITIVE_KEYS.has(key) ? encryptSecret(valStr) : valStr;

      await db.execute({
        sql: `INSERT INTO user_settings (user_id, key, value, updated_at) 
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        args: [userId, key, finalVal],
      });
    }

    return NextResponse.json({ success: true, message: "Settings saved successfully." });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
