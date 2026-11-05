import { createClient } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  let db;

  if (rawUrl && !rawUrl.startsWith("file:")) {
    db = createClient({ url: rawUrl, authToken: authToken || undefined });
    console.log("Initializing Turso Cloud database tables at DATABASE_URL:", rawUrl);
  } else {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, "autojob.db");
    db = createClient({
      url: `file:${dbPath.replace(/\\/g, "/")}`,
    });
    console.log("Initializing local SQLite tables in:", dbPath);
  }

  // WAL and connection pragmas
  try {
    await db.execute("PRAGMA journal_mode = WAL;");
    await db.execute("PRAGMA busy_timeout = 5000;");
    await db.execute("PRAGMA foreign_keys = ON;");
  } catch (err) {
    console.warn("Pragmas setup note:", err);
  }

  // 1. users
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. profiles (multi-user)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      location TEXT DEFAULT '',
      github_url TEXT DEFAULT '',
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

  // 3. user_settings
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, key)
    );
  `);

  // 4. applications
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

  // 5. platform_daily_quota
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

  // 6. alerts
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

  // 7. runner_states
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

  // 8. runner_logs
  await db.execute(`
    CREATE TABLE IF NOT EXISTS runner_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      level TEXT DEFAULT 'info',
      message TEXT NOT NULL
    );
  `);

  // Secondary indexes
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

  console.log("Multi-user database schema initialized successfully (8 tables, zero dummy seeds).");
}

main().catch((err) => {
  console.error("Init script failed:", err);
  process.exit(1);
});
