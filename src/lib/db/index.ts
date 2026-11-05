import { createClient, type Client } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

let dbInstance: Client | null = null;
let initPromise: Promise<void> | null = null;
let pragmasConfigured = false;

/**
 * Returns the singleton LibSQL / SQLite client.
 * Connects to Turso Cloud when DATABASE_URL is set (and DATABASE_AUTH_TOKEN),
 * falling back to local file:./data/autojob.db for local dev.
 */
export function getDb(): Client {
  if (dbInstance) {
    if (!initPromise && !pragmasConfigured) {
      initPromise = ensureDbInitialized().catch((err) => {
        console.error("[Database] Auto initialization failed:", err);
      });
    }
    return dbInstance;
  }

  const rawUrl = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  if (rawUrl && !rawUrl.startsWith("file:")) {
    dbInstance = createClient({
      url: rawUrl,
      authToken: authToken || undefined,
    });
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

  if (!initPromise) {
    initPromise = ensureDbInitialized().catch((err) => {
      console.error("[Database] Auto initialization failed:", err);
    });
  }

  return dbInstance;
}

async function configurePragmas(db: Client) {
  if (pragmasConfigured) return;
  try {
    await db.execute("PRAGMA journal_mode = WAL;");
    await db.execute("PRAGMA busy_timeout = 5000;");
    await db.execute("PRAGMA foreign_keys = ON;");
    pragmasConfigured = true;
  } catch (err) {
    // Some cloud LibSQL providers ignore certain local SQLite pragmas
    console.warn("[Database] SQLite pragmas note:", err);
  }
}

/**
 * Initializes the multi-user database schema with all 8 core tables and indexes.
 * Cached via module-level initPromise so it executes safely and idempotently.
 */
export async function ensureDbInitialized(): Promise<void> {
  const db = dbInstance || getDb();
  await configurePragmas(db);

  // 1. users table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. profiles table (Scoped by user_id)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      location TEXT DEFAULT '',
      github_url TEXT DEFAULT '' ,
      linkedin_url TEXT DEFAULT '',
      portfolio_url TEXT DEFAULT '',
      raw_resume_text TEXT DEFAULT '',
      resume_pdf_base64 TEXT DEFAULT '',
      resume_filename TEXT DEFAULT '',
      skills_json TEXT DEFAULT '[]',
      experience_json TEXT DEFAULT '[]',
      education_json TEXT DEFAULT '[]',
      target_roles_json TEXT DEFAULT '[]',
      summary TEXT DEFAULT '',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. user_settings table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, key)
    );
  `);

  // 4. applications table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      platform TEXT NOT NULL,
      external_job_id TEXT,
      company TEXT NOT NULL,
      position TEXT NOT NULL,
      job_url TEXT,
      status TEXT NOT NULL,
      match_score INTEGER,
      tailored_letter TEXT,
      form_payload_json TEXT,
      notes TEXT
    );
  `);

  // 5. platform_daily_quota table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS platform_daily_quota (
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      platform TEXT NOT NULL,
      applied_count INTEGER DEFAULT 0,
      max_cap INTEGER DEFAULT 5,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, date, platform)
    );
  `);

  // 6. alerts table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      platform TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      screenshot_base64 TEXT,
      status TEXT DEFAULT 'pending',
      resolved_at TEXT
    );
  `);

  // 7. runner_states table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS runner_states (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      is_enabled INTEGER DEFAULT 0,
      status TEXT DEFAULT 'stopped',
      platform TEXT DEFAULT 'both',
      opportunity_type TEXT DEFAULT 'internship',
      dry_run INTEGER DEFAULT 0,
      next_run_at TEXT,
      last_run_at TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 8. runner_logs table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS runner_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      level TEXT DEFAULT 'info',
      message TEXT NOT NULL
    );
  `);

  // Performance & Integrity Indexes
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_applications_user 
    ON applications(user_id, id DESC);
  `);
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_user_platform_ext 
    ON applications(user_id, platform, external_job_id) 
    WHERE external_job_id IS NOT NULL;
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_alerts_user 
    ON alerts(user_id, status);
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_runner_logs_user 
    ON runner_logs(user_id, id DESC);
  `);

  // Legacy compatibility: check if single-user 'profile' table exists without user_id
  await db.execute(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY,
      full_name TEXT,
      email TEXT,
      phone TEXT,
      location TEXT,
      github_url TEXT,
      linkedin_url TEXT,
      portfolio_url TEXT,
      raw_resume_text TEXT,
      resume_file_path TEXT,
      skills_json TEXT,
      experience_json TEXT,
      education_json TEXT,
      projects_json TEXT,
      screening_defaults_json TEXT,
      summary TEXT,
      target_roles_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `).catch(() => {});
}

// Alias for compatibility with older scripts & tests
export const initDatabase = ensureDbInitialized;

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

export interface RunnerState {
  userId: string;
  isEnabled: boolean;
  status: "stopped" | "running" | "resting" | "waiting_for_window" | "quota_reached_sleeping";
  platform: "linkedin" | "internshala" | "both";
  opportunityType: "internship" | "job";
  dryRun: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  updatedAt: string;
}

/**
 * Retrieves user settings as key-value pairs.
 */
export async function getUserSettings(userId: string): Promise<Record<string, string>> {
  const db = getDb();
  await (initPromise || ensureDbInitialized());

  const rows = await db.execute({
    sql: "SELECT key, value FROM user_settings WHERE user_id = ?",
    args: [userId],
  });

  const settings: Record<string, string> = {
    daily_cap: "10",
    linkedin_daily_cap: "5",
    internshala_daily_cap: "5",
    opportunity_type: "internship",
    workplace_type: "remote",
    target_location: "Remote",
    apply_type: "easy_apply_only",
    min_match_score: "65",
    active_llm: "gemini",
    gemini_model: "gemini-2.5-flash",
    telegram_enabled: "false",
    auto_apply_enabled: "true",
    pacing_enabled: "true",
    active_window_start: "9",
    active_window_end: "23",
    min_rest_minutes: "20",
    max_rest_minutes: "60",
    timezone: "Asia/Kolkata",
  };

  for (const r of rows.rows) {
    if (r.key && r.value !== null && r.value !== undefined) {
      settings[String(r.key)] = String(r.value);
    }
  }

  return settings;
}

/**
 * Saves multiple settings for a user.
 */
export async function setUserSettings(
  userId: string,
  settings: Record<string, string>
): Promise<void> {
  const db = getDb();
  await (initPromise || ensureDbInitialized());

  for (const [key, value] of Object.entries(settings)) {
    await db.execute({
      sql: `INSERT INTO user_settings (user_id, key, value, updated_at) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      args: [userId, key, value],
    });
  }
}

/**
 * Retrieves daily quota for a user and platform.
 */
export async function getTodayPlatformQuota(
  userIdOrPlatform: string,
  platformArg?: "linkedin" | "internshala"
): Promise<PlatformQuota> {
  const db = getDb();
  await (initPromise || ensureDbInitialized());

  const isLegacy = !platformArg && (userIdOrPlatform === "linkedin" || userIdOrPlatform === "internshala");
  const userId = isLegacy ? "default-user" : userIdOrPlatform;
  const platform = isLegacy ? (userIdOrPlatform as "linkedin" | "internshala") : platformArg!;

  const todayStr = new Date().toISOString().split("T")[0];
  const settings = await getUserSettings(userId);
  const capKey = `${platform}_daily_cap`;
  const maxCap = settings[capKey] ? parseInt(settings[capKey], 10) : 5;

  // Reconcile with verified actual applications applied today
  const actualRes = await db.execute({
    sql: `SELECT COUNT(*) as count 
          FROM applications 
          WHERE user_id = ? 
            AND platform = ? 
            AND status = 'applied' 
            AND (date(timestamp) = ? OR date(timestamp, 'localtime') = ?)`,
    args: [userId, platform, todayStr, todayStr],
  });
  const actualCount = Number(actualRes.rows[0]?.count || 0);

  const res = await db.execute({
    sql: "SELECT * FROM platform_daily_quota WHERE user_id = ? AND date = ? AND platform = ?",
    args: [userId, todayStr, platform],
  });

  if (res.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO platform_daily_quota (user_id, date, platform, applied_count, max_cap) 
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, date, platform) DO UPDATE SET applied_count = excluded.applied_count`,
      args: [userId, todayStr, platform, actualCount, maxCap],
    });
    return {
      date: todayStr,
      platform,
      applied_count: actualCount,
      max_cap: maxCap,
      remaining: Math.max(0, maxCap - actualCount),
    };
  }

  const row = res.rows[0];
  const cap = Number(row.max_cap || maxCap);
  if (Number(row.applied_count) !== actualCount) {
    await db.execute({
      sql: "UPDATE platform_daily_quota SET applied_count = ? WHERE user_id = ? AND date = ? AND platform = ?",
      args: [actualCount, userId, todayStr, platform],
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
 * Atomically increments the daily quota for a specific user and platform.
 */
export async function incrementTodayPlatformQuota(
  userIdOrPlatform: string,
  platformArg?: "linkedin" | "internshala"
): Promise<PlatformQuota> {
  const db = getDb();
  await (initPromise || ensureDbInitialized());

  const isLegacy = !platformArg && (userIdOrPlatform === "linkedin" || userIdOrPlatform === "internshala");
  const userId = isLegacy ? "default-user" : userIdOrPlatform;
  const platform = isLegacy ? (userIdOrPlatform as "linkedin" | "internshala") : platformArg!;

  const todayStr = new Date().toISOString().split("T")[0];
  const settings = await getUserSettings(userId);
  const capKey = `${platform}_daily_cap`;
  const maxCap = settings[capKey] ? parseInt(settings[capKey], 10) : 5;

  await db.execute({
    sql: `INSERT INTO platform_daily_quota (user_id, date, platform, applied_count, max_cap)
          VALUES (?, ?, ?, 1, ?)
          ON CONFLICT(user_id, date, platform) DO UPDATE SET 
            applied_count = platform_daily_quota.applied_count + 1,
            max_cap = excluded.max_cap,
            updated_at = CURRENT_TIMESTAMP`,
    args: [userId, todayStr, platform, maxCap],
  });

  const res = await db.execute({
    sql: "SELECT * FROM platform_daily_quota WHERE user_id = ? AND date = ? AND platform = ?",
    args: [userId, todayStr, platform],
  });

  const row = res.rows[0];
  const count = Number(row?.applied_count || 1);
  const cap = Number(row?.max_cap || maxCap);

  return {
    date: todayStr,
    platform,
    applied_count: count,
    max_cap: cap,
    remaining: Math.max(0, cap - count),
  };
}

/**
 * Returns combined quota for a user.
 */
export async function getTodayQuota(userId: string = "default-user"): Promise<CombinedQuota> {
  await (initPromise || ensureDbInitialized());
  const todayStr = new Date().toISOString().split("T")[0];
  const [linkedin, internshala] = await Promise.all([
    getTodayPlatformQuota(userId, "linkedin"),
    getTodayPlatformQuota(userId, "internshala"),
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

export async function incrementTodayQuota(
  userId: string = "default-user",
  platform: "linkedin" | "internshala" = "linkedin"
) {
  return await incrementTodayPlatformQuota(userId, platform);
}

/**
 * Runner state management for multi-user daemon / cloud worker.
 */
export async function getRunnerState(userId: string): Promise<RunnerState> {
  const db = getDb();
  await (initPromise || ensureDbInitialized());

  const res = await db.execute({
    sql: "SELECT * FROM runner_states WHERE user_id = ?",
    args: [userId],
  });

  if (res.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO runner_states (user_id, is_enabled, status) VALUES (?, 0, 'stopped')`,
      args: [userId],
    });
    return {
      userId,
      isEnabled: false,
      status: "stopped",
      platform: "both",
      opportunityType: "internship",
      dryRun: false,
      nextRunAt: null,
      lastRunAt: null,
      updatedAt: new Date().toISOString(),
    };
  }

  const r = res.rows[0];
  return {
    userId: String(r.user_id),
    isEnabled: Number(r.is_enabled) === 1,
    status: (r.status as RunnerState["status"]) || "stopped",
    platform: (r.platform as RunnerState["platform"]) || "both",
    opportunityType: (r.opportunity_type as RunnerState["opportunityType"]) || "internship",
    dryRun: Number(r.dry_run) === 1,
    nextRunAt: r.next_run_at ? String(r.next_run_at) : null,
    lastRunAt: r.last_run_at ? String(r.last_run_at) : null,
    updatedAt: String(r.updated_at || new Date().toISOString()),
  };
}

export async function updateRunnerState(
  userId: string,
  state: Partial<Omit<RunnerState, "userId">>
): Promise<void> {
  const db = getDb();
  await (initPromise || ensureDbInitialized());

  const current = await getRunnerState(userId);
  const isEnabled = state.isEnabled !== undefined ? (state.isEnabled ? 1 : 0) : current.isEnabled ? 1 : 0;
  const status = state.status !== undefined ? state.status : current.status;
  const platform = state.platform !== undefined ? state.platform : current.platform;
  const opportunityType = state.opportunityType !== undefined ? state.opportunityType : current.opportunityType;
  const dryRun = state.dryRun !== undefined ? (state.dryRun ? 1 : 0) : current.dryRun ? 1 : 0;
  const nextRunAt = state.nextRunAt !== undefined ? state.nextRunAt : current.nextRunAt;
  const lastRunAt = state.lastRunAt !== undefined ? state.lastRunAt : current.lastRunAt;

  await db.execute({
    sql: `INSERT INTO runner_states (user_id, is_enabled, status, platform, opportunity_type, dry_run, next_run_at, last_run_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id) DO UPDATE SET
            is_enabled = excluded.is_enabled,
            status = excluded.status,
            platform = excluded.platform,
            opportunity_type = excluded.opportunity_type,
            dry_run = excluded.dry_run,
            next_run_at = excluded.next_run_at,
            last_run_at = excluded.last_run_at,
            updated_at = CURRENT_TIMESTAMP`,
    args: [userId, isEnabled, status, platform, opportunityType, dryRun, nextRunAt, lastRunAt],
  });
}

/**
 * Appends a log entry into runner_logs.
 */
export async function addRunnerLog(
  userId: string,
  message: string,
  level: "info" | "warn" | "error" | "success" = "info"
): Promise<void> {
  try {
    const db = getDb();
    await db.execute({
      sql: "INSERT INTO runner_logs (user_id, level, message) VALUES (?, ?, ?)",
      args: [userId, level, message],
    });
  } catch (err) {
    console.error("[Database] Failed to write runner log:", err);
  }
}

/**
 * Fetches recent runner logs for a user.
 */
export async function getRunnerLogs(
  userId: string,
  limit: number = 200
): Promise<Array<{ id: number; timestamp: string; level: string; message: string }>> {
  const db = getDb();
  await (initPromise || ensureDbInitialized());

  const res = await db.execute({
    sql: "SELECT id, timestamp, level, message FROM runner_logs WHERE user_id = ? ORDER BY id DESC LIMIT ?",
    args: [userId, limit],
  });

  return res.rows.map((r) => ({
    id: Number(r.id),
    timestamp: String(r.timestamp),
    level: String(r.level),
    message: String(r.message),
  })).reverse();
}
