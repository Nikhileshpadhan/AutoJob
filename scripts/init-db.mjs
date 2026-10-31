import { createClient } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "autojob.db");
  const db = createClient({
    url: `file:${dbPath.replace(/\\/g, "/")}`,
  });

  console.log("Initializing SQLite tables in:", dbPath);

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
      skills_json TEXT,
      experience_json TEXT,
      education_json TEXT,
      summary TEXT,
      target_roles_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      platform TEXT NOT NULL,
      company TEXT NOT NULL,
      position TEXT NOT NULL,
      job_url TEXT,
      status TEXT NOT NULL,
      tailored_letter TEXT,
      form_payload_json TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS daily_quota (
      date TEXT PRIMARY KEY,
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
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      screenshot_path TEXT,
      status TEXT DEFAULT 'pending',
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

  await db.execute(`
    INSERT OR IGNORE INTO profile (id, full_name, email, skills_json, target_roles_json)
    VALUES (1, 'Applicant Name', 'applicant@example.com', '["TypeScript", "React", "Next.js", "Node.js", "Python"]', '["Full Stack Developer", "Software Engineer", "Frontend Developer"]')
  `);

  console.log("Database initialized successfully!");
}

main().catch((err) => {
  console.error("Failed to init database:", err);
  process.exit(1);
});
