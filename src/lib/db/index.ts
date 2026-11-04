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
      max_cap INTEGER DEFAULT 10,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Independent per-platform quota tracking (e.g. 5 LinkedIn, 5 Internshala)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS platform_daily_quota (
      date TEXT NOT NULL,
      platform TEXT NOT NULL, -- 'linkedin' | 'internshala'
      applied_count INTEGER DEFAULT 0,
      max_cap INTEGER DEFAULT 5,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (date, platform)
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
    daily_cap: "10",
    linkedin_daily_cap: "5",
    internshala_daily_cap: "5",
    opportunity_type: "internship", // 'internship' | 'job' (Default to internship for students)
    workplace_type: "remote", // 'any' | 'remote' | 'hybrid' | 'on_site'
    target_location: "Remote",
    apply_type: "all", // 'all' (Easy Apply + Direct Company Apply Links) | 'easy_apply_only'
    min_match_score: "65", // Only apply to high selection chance matches (0 - 100)
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

export interface PlatformQuota {
  date: string;
  platform: "linkedin" | "internshala";
  applied_count: number;
  max_cap: number;
  remaining: number;
}

export interface CombinedQuota {
  date: string;
  applied_count: number;
  max_cap: number;
  remaining: number;
  platforms: {
    linkedin: PlatformQuota;
    internshala: PlatformQuota;
  };
}

/**
 * Retrieves the daily quota for a specific platform.
 */
export async function getTodayPlatformQuota(platform: "linkedin" | "internshala"): Promise<PlatformQuota> {
  const db = getDb();
  const todayStr = new Date().toISOString().split("T")[0];

  // Get user-configured cap for this platform
  const capKey = `${platform}_daily_cap`;
  const capSetting = await db.execute({
    sql: "SELECT value FROM system_settings WHERE key = ?",
    args: [capKey],
  });
  const maxCap = capSetting.rows[0]?.value ? parseInt(capSetting.rows[0].value as string, 10) : 5;

  const res = await db.execute({
    sql: "SELECT * FROM platform_daily_quota WHERE date = ? AND platform = ?",
    args: [todayStr, platform],
  });

  if (res.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO platform_daily_quota (date, platform, applied_count, max_cap) VALUES (?, ?, 0, ?)",
      args: [todayStr, platform, maxCap],
    });
    return { date: todayStr, platform, applied_count: 0, max_cap: maxCap, remaining: maxCap };
  }

  const row = res.rows[0];
  const count = Number(row.applied_count || 0);
  const cap = Number(row.max_cap || maxCap);

  return {
    date: todayStr,
    platform,
    applied_count: count,
    max_cap: cap,
    remaining: Math.max(0, cap - count),
  };
}

/**
 * Increments the daily quota for a specific platform and syncs the aggregate table.
 */
export async function incrementTodayPlatformQuota(platform: "linkedin" | "internshala"): Promise<PlatformQuota> {
  const db = getDb();
  const quota = await getTodayPlatformQuota(platform);
  const nextCount = quota.applied_count + 1;

  await db.execute({
    sql: "UPDATE platform_daily_quota SET applied_count = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ? AND platform = ?",
    args: [nextCount, quota.date, platform],
  });

  // Sync aggregate daily_quota table
  const totalRes = await db.execute({
    sql: "SELECT SUM(applied_count) as total_applied FROM platform_daily_quota WHERE date = ?",
    args: [quota.date],
  });
  const totalApplied = Number(totalRes.rows[0]?.total_applied || nextCount);

  const linkedinCap = await getTodayPlatformQuota("linkedin");
  const internshalaCap = await getTodayPlatformQuota("internshala");
  const totalCap = linkedinCap.max_cap + internshalaCap.max_cap;

  await db.execute({
    sql: `INSERT INTO daily_quota (date, applied_count, max_cap) 
          VALUES (?, ?, ?) 
          ON CONFLICT(date) DO UPDATE SET applied_count = ?, max_cap = ?, updated_at = CURRENT_TIMESTAMP`,
    args: [quota.date, totalApplied, totalCap, totalApplied, totalCap],
  });

  return {
    ...quota,
    applied_count: nextCount,
    remaining: Math.max(0, quota.max_cap - nextCount),
  };
}

/**
 * Helper function returning overall quota with platform breakdown.
 */
export async function getTodayQuota(): Promise<CombinedQuota> {
  const todayStr = new Date().toISOString().split("T")[0];
  const [linkedin, internshala] = await Promise.all([
    getTodayPlatformQuota("linkedin"),
    getTodayPlatformQuota("internshala"),
  ]);

  const appliedCount = linkedin.applied_count + internshala.applied_count;
  const maxCap = linkedin.max_cap + internshala.max_cap;
  const remaining = linkedin.remaining + internshala.remaining;

  return {
    date: todayStr,
    applied_count: appliedCount,
    max_cap: maxCap,
    remaining,
    platforms: {
      linkedin,
      internshala,
    },
  };
}

export async function incrementTodayQuota(platform: "linkedin" | "internshala" = "linkedin") {
  return await incrementTodayPlatformQuota(platform);
}
