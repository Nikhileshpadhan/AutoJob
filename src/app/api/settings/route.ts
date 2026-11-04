import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.execute("SELECT key, value FROM system_settings");
    const settings: Record<string, string> = {};
    for (const row of rows.rows) {
      if (row.key) {
        settings[row.key as string] = (row.value as string) || "";
      }
    }

    // Mask sensitive keys for the client display
    return NextResponse.json({
      settings: {
        daily_cap: settings.daily_cap || "10",
        linkedin_daily_cap: settings.linkedin_daily_cap || "5",
        internshala_daily_cap: settings.internshala_daily_cap || "5",
        opportunity_type: settings.opportunity_type || "internship",
        workplace_type: settings.workplace_type || "remote",
        target_location: settings.target_location || "Remote",
        apply_type: settings.apply_type || "all",
        min_match_score: settings.min_match_score || "65",
        active_llm: settings.active_llm || "gemini",
        gemini_api_key: settings.gemini_api_key ? "configured" : "",
        groq_api_key: settings.groq_api_key ? "configured" : "",
        telegram_bot_token: settings.telegram_bot_token ? "configured" : "",
        telegram_chat_id: settings.telegram_chat_id || "",
        telegram_enabled: settings.telegram_enabled || "true",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = getDb();
    const todayStr = new Date().toISOString().split("T")[0];

    for (const [key, val] of Object.entries(body)) {
      if (typeof val === "string" && val !== "configured") {
        await db.execute({
          sql: `INSERT INTO system_settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
          args: [key, val],
        });

        // If platform cap was updated, update platform_daily_quota table
        if (key === "linkedin_daily_cap") {
          const capNum = parseInt(val, 10) || 5;
          await db.execute({
            sql: `INSERT INTO platform_daily_quota (date, platform, applied_count, max_cap)
                  VALUES (?, 'linkedin', 0, ?)
                  ON CONFLICT(date, platform) DO UPDATE SET max_cap = ?`,
            args: [todayStr, capNum, capNum],
          });
        }

        if (key === "internshala_daily_cap") {
          const capNum = parseInt(val, 10) || 5;
          await db.execute({
            sql: `INSERT INTO platform_daily_quota (date, platform, applied_count, max_cap)
                  VALUES (?, 'internshala', 0, ?)
                  ON CONFLICT(date, platform) DO UPDATE SET max_cap = ?`,
            args: [todayStr, capNum, capNum],
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
