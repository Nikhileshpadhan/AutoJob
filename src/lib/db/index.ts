import { createClient, type Client } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

let dbInstance: Client | null = null;
let initPromise: Promise<void> | null = null;
let pragmasConfigured = false;

export function getDb(): Client {
  if (dbInstance) {
    if (!initPromise && !pragmasConfigured) {
      initPromise = initDatabase().catch((err) => {
        console.error("[Database] Automatic initDatabase failed:", err);
      });
    }
    return dbInstance;
  }

  const rawUrl = process.env.DATABASE_URL;
  if (rawUrl && !rawUrl.startsWith("file:")) {
    dbInstance = createClient({ url: rawUrl });
  } else {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, "autojob.db");
    dbInstance = createClient({
      url: `file:${dbPath.replace(/\\/g, "/")}`,
    });
  }

  // Trigger background initialization and pragmas
  if (!initPromise) {
    initPromise = initDatabase().catch((err) => {
      console.error("[Database] Automatic initDatabase failed:", err);
    });
  }

  return dbInstance;
}

/**
 * Ensures WAL mode and connection pragmas are active on SQLite.
 */
async function configurePragmas(db: Client) {
  if (pragmasConfigured) return;
  try {
    await db.execute("PRAGMA journal_mode = WAL;");
    await db.execute("PRAGMA busy_timeout = 5000;");
    await db.execute("PRAGMA foreign_keys = ON;");
    pragmasConfigured = true;
  } catch (err) {
    console.warn("[Database] Could not configure SQLite pragmas:", err);
  }
}

export async function initDatabase(): Promise<void> {
  const db = dbInstance || getDb();
  await configurePragmas(db);

  // 1. Profile table
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
      resume_file_path TEXT,
      skills_json TEXT, -- array of strings
      experience_json TEXT, -- structured list of experiences
      education_json TEXT, -- structured list of education
      projects_json TEXT, -- structured list of projects
      screening_defaults_json TEXT, -- defaults for GPA, graduation year, stipend, etc.
      summary TEXT,
      target_roles_json TEXT, -- target job titles / keywords
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure newer columns exist if migrating existing DB
  const profileCols = await db.execute("PRAGMA table_info(profile);");
  const existingColNames = new Set(profileCols.rows.map((r) => String(r.name)));
  if (!existingColNames.has("resume_file_path")) {
    await db.execute("ALTER TABLE profile ADD COLUMN resume_file_path TEXT;").catch(() => {});
  }
  if (!existingColNames.has("projects_json")) {
    await db.execute("ALTER TABLE profile ADD COLUMN projects_json TEXT;").catch(() => {});
  }
  if (!existingColNames.has("screening_defaults_json")) {
    await db.execute("ALTER TABLE profile ADD COLUMN screening_defaults_json TEXT;").catch(() => {});
  }

  // 2. Applications table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_job_id TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      platform TEXT NOT NULL, -- 'linkedin' | 'internshala'
      company TEXT NOT NULL,
      position TEXT NOT NULL,
      job_url TEXT,
      status TEXT NOT NULL, -- 'applied' | 'awaiting_approval' | 'external_ready' | 'skipped' | 'failed' | 'captcha_blocked' | 'in_progress' | 'interviewing' | 'offered' | 'rejected'
      match_score INTEGER,
      matched_skills_json TEXT,
      missing_skills_json TEXT,
      match_reasoning TEXT,
      tailored_letter TEXT,
      form_payload_json TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate newer columns on applications
  const appCols = await db.execute("PRAGMA table_info(applications);");
  const appColNames = new Set(appCols.rows.map((r) => String(r.name)));
  if (!appColNames.has("external_job_id")) {
    await db.execute("ALTER TABLE applications ADD COLUMN external_job_id TEXT;").catch(() => {});
  }
  if (!appColNames.has("match_score")) {
    await db.execute("ALTER TABLE applications ADD COLUMN match_score INTEGER;").catch(() => {});
  }
  if (!appColNames.has("matched_skills_json")) {
    await db.execute("ALTER TABLE applications ADD COLUMN matched_skills_json TEXT;").catch(() => {});
  }
  if (!appColNames.has("missing_skills_json")) {
    await db.execute("ALTER TABLE applications ADD COLUMN missing_skills_json TEXT;").catch(() => {});
  }
  if (!appColNames.has("match_reasoning")) {
    await db.execute("ALTER TABLE applications ADD COLUMN match_reasoning TEXT;").catch(() => {});
  }

  // Secondary indexes & deduplication
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_platform_job_id 
    ON applications(platform, external_job_id) 
    WHERE external_job_id IS NOT NULL;
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_applications_status_platform 
    ON applications(status, platform);
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_applications_company_position 
    ON applications(company, position);
  `);

  // 3. Daily quota tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS daily_quota (
      date TEXT PRIMARY KEY,
      applied_count INTEGER DEFAULT 0,
      max_cap INTEGER DEFAULT 10,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

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

  // 4. Alerts table
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
    CREATE INDEX IF NOT EXISTS idx_alerts_status 
    ON alerts(status);
  `);

  // 5. System settings table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Automation runs table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS automation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL, -- 'running' | 'completed' | 'failed' | 'aborted'
      platform TEXT NOT NULL,
      opportunity_type TEXT,
      workplace_type TEXT,
      target_location TEXT,
      apply_type TEXT,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      ended_at TEXT,
      pid INTEGER,
      current_platform TEXT,
      current_role TEXT,
      stats_json TEXT,
      error_message TEXT
    );
  `);

  // 7. Automation logs table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS automation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      level TEXT NOT NULL, -- 'info' | 'warn' | 'error' | 'success'
      stage TEXT,
      message TEXT NOT NULL,
      metadata_json TEXT
    );
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_automation_logs_run_id 
    ON automation_logs(run_id);
  `);

  // Seed singleton profile row id = 1 if not exists
  const existingProfile = await db.execute("SELECT id FROM profile WHERE id = 1");
  if (existingProfile.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO profile (id, full_name, email, skills_json, target_roles_json, screening_defaults_json)
            VALUES (1, '', '', '[]', '["Full Stack Developer", "Software Engineer", "Frontend Developer", "Backend Developer"]', '{}')
            ON CONFLICT(id) DO NOTHING`,
      args: [],
    });
  }

  // Seed default settings if not exists
  const defaultSettings: Record<string, string> = {
    daily_cap: "10",
    linkedin_daily_cap: "5",
    internshala_daily_cap: "5",
    opportunity_type: "internship",
    workplace_type: "remote",
    target_location: "Remote",
    apply_type: "easy_apply_only", // Default to safe easy_apply_only so direct links do not waste slots
    min_match_score: "65",
    active_llm: "gemini",
    gemini_model: "gemini-2.5-flash",
    telegram_enabled: "true",
    auto_apply_enabled: "true",
    pacing_enabled: "true",
    active_window_start: "9",
    active_window_end: "23",
    min_rest_minutes: "20",
    max_rest_minutes: "60",
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
  await initPromise;
  const todayStr = new Date().toISOString().split("T")[0];

  const capKey = `${platform}_daily_cap`;
  const capSetting = await db.execute({
    sql: "SELECT value FROM system_settings WHERE key = ?",
    args: [capKey],
  });
  const maxCap = capSetting.rows[0]?.value ? parseInt(capSetting.rows[0].value as string, 10) : 5;

  // Reconcile with verified actual applications applied today from the applications table
  const actualRes = await db.execute({
    sql: `SELECT COUNT(*) as count 
          FROM applications 
          WHERE platform = ? 
            AND status = 'applied' 
            AND (date(created_at) = ? OR date(created_at, 'localtime') = ?)`,
    args: [platform, todayStr, todayStr],
  });
  const actualCount = Number(actualRes.rows[0]?.count || 0);

  const res = await db.execute({
    sql: "SELECT * FROM platform_daily_quota WHERE date = ? AND platform = ?",
    args: [todayStr, platform],
  });

  if (res.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO platform_daily_quota (date, platform, applied_count, max_cap) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(date, platform) DO UPDATE SET applied_count = ?`,
      args: [todayStr, platform, actualCount, maxCap, actualCount],
    });
    return { date: todayStr, platform, applied_count: actualCount, max_cap: maxCap, remaining: Math.max(0, maxCap - actualCount) };
  }

  // Ensure database row is kept strictly in sync with verified actual applications
  const row = res.rows[0];
  const cap = Number(row.max_cap || maxCap);
  if (Number(row.applied_count) !== actualCount) {
    await db.execute({
      sql: "UPDATE platform_daily_quota SET applied_count = ? WHERE date = ? AND platform = ?",
      args: [actualCount, todayStr, platform],
    });
  }

  return {
    date: todayStr,
    platform,
    applied_count: actualCount,
    max_cap: cap,
    remaining: Math.max(0, cap - actualCount),
  };
}

/**
 * Atomically increments the daily quota for a specific platform.
 */
export async function incrementTodayPlatformQuota(platform: "linkedin" | "internshala"): Promise<PlatformQuota> {
  const db = getDb();
  await initPromise;
  const todayStr = new Date().toISOString().split("T")[0];

  const capKey = `${platform}_daily_cap`;
  const capSetting = await db.execute({
    sql: "SELECT value FROM system_settings WHERE key = ?",
    args: [capKey],
  });
  const maxCap = capSetting.rows[0]?.value ? parseInt(capSetting.rows[0].value as string, 10) : 5;

  // Atomic upsert with direct SQL increment
  await db.execute({
    sql: `INSERT INTO platform_daily_quota (date, platform, applied_count, max_cap)
          VALUES (?, ?, 1, ?)
          ON CONFLICT(date, platform) DO UPDATE SET 
            applied_count = platform_daily_quota.applied_count + 1,
            max_cap = excluded.max_cap,
            updated_at = CURRENT_TIMESTAMP`,
    args: [todayStr, platform, maxCap],
  });

  // Fetch updated record
  const res = await db.execute({
    sql: "SELECT * FROM platform_daily_quota WHERE date = ? AND platform = ?",
    args: [todayStr, platform],
  });
  const row = res.rows[0];
  const count = Number(row.applied_count || 1);
  const cap = Number(row.max_cap || maxCap);

  // Sync aggregate daily_quota table
  const totalRes = await db.execute({
    sql: "SELECT SUM(applied_count) as total_applied FROM platform_daily_quota WHERE date = ?",
    args: [todayStr],
  });
  const totalApplied = Number(totalRes.rows[0]?.total_applied || count);

  const linkedinQuota = await getTodayPlatformQuota("linkedin");
  const internshalaQuota = await getTodayPlatformQuota("internshala");
  const totalCap = linkedinQuota.max_cap + internshalaQuota.max_cap;

  await db.execute({
    sql: `INSERT INTO daily_quota (date, applied_count, max_cap) 
          VALUES (?, ?, ?) 
          ON CONFLICT(date) DO UPDATE SET applied_count = ?, max_cap = ?, updated_at = CURRENT_TIMESTAMP`,
    args: [todayStr, totalApplied, totalCap, totalApplied, totalCap],
  });

  return {
    date: todayStr,
    platform,
    applied_count: count,
    max_cap: cap,
    remaining: Math.max(0, cap - count),
  };
}

/**
 * Helper function returning overall quota with platform breakdown.
 */
export async function getTodayQuota(): Promise<CombinedQuota> {
  await initPromise;
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
