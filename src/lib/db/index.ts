import { createClient, type Client } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

let dbInstance: Client | null = null;

export function getDb(): Client {
  if (dbInstance) return dbInstance;

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "autojob.db");
  dbInstance = createClient({
    url: `file:${dbPath.replace(/\\/g, "/")}`,
  });

  return dbInstance;
}

export async function initDatabase() {
  const db = getDb();

  // Create tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      full_name TEXT,
      email TEXT,
      phone TEXT,
      location TEXT,
      github_url TEXT,
      linkedin_url TEXT,
      portfolio_url TEXT,
      raw_resume_text TEXT,
      skills_json TEXT, -- array of strings
      experience_json TEXT, -- structured list of experiences
      education_json TEXT, -- structured list of education
      summary TEXT,
      target_roles_json TEXT, -- target job titles / keywords
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      platform TEXT NOT NULL, -- 'linkedin' | 'internshala'
      company TEXT NOT NULL,
      position TEXT NOT NULL,
      job_url TEXT,
      status TEXT NOT NULL, -- 'applied' | 'skipped' | 'failed' | 'captcha_blocked' | 'in_progress'
      tailored_letter TEXT,
      form_payload_json TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS daily_quota (
      date TEXT PRIMARY KEY, -- 'YYYY-MM-DD'
      applied_count INTEGER DEFAULT 0,
      max_cap INTEGER DEFAULT 5,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      platform TEXT NOT NULL,
      type TEXT NOT NULL, -- 'captcha' | 'otp' | 'login_checkpoint' | 'error'
      message TEXT NOT NULL,
      screenshot_path TEXT,
      status TEXT DEFAULT 'pending', -- 'pending' | 'resolved' | 'dismissed'
      resolved_at TEXT
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Initialize default profile row if not exists
  const existingProfile = await db.execute("SELECT id FROM profile WHERE id = 1");
  if (existingProfile.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO profile (id, full_name, email, skills_json, target_roles_json) VALUES (1, '', '', '[]', '["Full Stack Developer", "Software Engineer", "Frontend Developer", "Backend Developer"]')`,
      args: [],
    });
  }

  // Set default settings if not exists
  const defaultSettings: Record<string, string> = {
    daily_cap: "5",
    active_llm: "gemini", // 'gemini' | 'groq'
    telegram_enabled: "true",
    auto_apply_enabled: "true",
  };

  for (const [k, v] of Object.entries(defaultSettings)) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)`,
      args: [k, v],
    });
  }
}

// Helper functions for daily quota (Strict cap of 5/day)
export async function getTodayQuota() {
  const db = getDb();
  const todayStr = new Date().toISOString().split("T")[0];

  const res = await db.execute({
    sql: "SELECT * FROM daily_quota WHERE date = ?",
    args: [todayStr],
  });

  const capSetting = await db.execute({
    sql: "SELECT value FROM system_settings WHERE key = 'daily_cap'",
    args: [],
  });
  const maxCap = capSetting.rows[0]?.value ? parseInt(capSetting.rows[0].value as string, 10) : 5;

  if (res.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO daily_quota (date, applied_count, max_cap) VALUES (?, 0, ?)",
      args: [todayStr, maxCap],
    });
    return { date: todayStr, applied_count: 0, max_cap: maxCap, remaining: maxCap };
  }

  const row = res.rows[0];
  const count = Number(row.applied_count || 0);
  const cap = Number(row.max_cap || maxCap);
  return {
    date: todayStr,
    applied_count: count,
    max_cap: cap,
    remaining: Math.max(0, cap - count),
  };
}

export async function incrementTodayQuota() {
  const db = getDb();
  const quota = await getTodayQuota();
  const nextCount = quota.applied_count + 1;

  await db.execute({
    sql: "UPDATE daily_quota SET applied_count = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?",
    args: [nextCount, quota.date],
  });

  return {
    ...quota,
    applied_count: nextCount,
    remaining: Math.max(0, quota.max_cap - nextCount),
  };
}
