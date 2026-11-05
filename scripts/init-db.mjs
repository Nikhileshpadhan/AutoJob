import { createClient } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  let db;
  let dbPath;

  if (rawUrl && !rawUrl.startsWith("file:")) {
    db = createClient({ url: rawUrl });
    console.log("Initializing SQLite tables at DATABASE_URL:", rawUrl);
  } else {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    dbPath = path.join(dataDir, "autojob.db");
    db = createClient({
      url: `file:${dbPath.replace(/\\/g, "/")}`,
    });
    console.log("Initializing SQLite tables in:", dbPath);
  }

  // WAL and connection pragmas
  await db.execute("PRAGMA journal_mode = WAL;");
  await db.execute("PRAGMA busy_timeout = 5000;");
  await db.execute("PRAGMA foreign_keys = ON;");

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
  `);

  // Migrate columns
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
      platform TEXT NOT NULL,
      company TEXT NOT NULL,
      position TEXT NOT NULL,
      job_url TEXT,
      status TEXT NOT NULL,
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

  // Indexes
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

  // 3. Quota tables
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
      platform TEXT NOT NULL,
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
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      screenshot_path TEXT,
      status TEXT DEFAULT 'pending',
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

  // 6. Automation runs & logs
  await db.execute(`
    CREATE TABLE IF NOT EXISTS automation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS automation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      level TEXT NOT NULL,
      stage TEXT,
      message TEXT NOT NULL,
      metadata_json TEXT
    );
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_automation_logs_run_id 
    ON automation_logs(run_id);
  `);

  // Seed profile row id = 1
  await db.execute(`
    INSERT INTO profile (id, full_name, email, skills_json, target_roles_json, screening_defaults_json)
    VALUES (1, '', '', '[]', '["Full Stack Developer", "Software Engineer", "Frontend Developer", "Backend Developer"]', '{}')
    ON CONFLICT(id) DO NOTHING;
  `);

  // Default settings
  const defaultSettings = {
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
      sql: "INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)",
      args: [k, v],
    });
  }

  console.log("Database schema initialized and updated successfully! Profile seeded.");
}

main().catch((err) => {
  console.error("Failed to init database:", err);
  process.exit(1);
});
