import { getDb } from "../db";
import EventEmitter from "node:events";

export interface LogEntry {
  id?: number;
  runId?: number;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  stage?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

class TelemetryEmitter extends EventEmitter {}

export const telemetryEmitter = new TelemetryEmitter();

// Maintain an in-memory ring buffer of recent 200 logs for instant hydration
const RECENT_LOGS_LIMIT = 200;
const inMemoryLogs: LogEntry[] = [];

export async function logTelemetry(entry: {
  runId?: number;
  level: "info" | "warn" | "error" | "success";
  stage?: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const timestamp = new Date().toISOString();
  const logItem: LogEntry = {
    timestamp,
    level: entry.level,
    stage: entry.stage,
    message: entry.message,
    runId: entry.runId,
    metadata: entry.metadata,
  };

  // Keep in-memory ring buffer
  inMemoryLogs.push(logItem);
  if (inMemoryLogs.length > RECENT_LOGS_LIMIT) {
    inMemoryLogs.shift();
  }

  // Emit for live SSE streaming to client
  telemetryEmitter.emit("log", logItem);

  // Persist to SQLite
  try {
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO automation_logs (run_id, timestamp, level, stage, message, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        entry.runId || null,
        timestamp,
        entry.level,
        entry.stage || null,
        entry.message,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ],
    });
  } catch (err) {
    console.error("[Telemetry DB Log Error]:", err);
  }

  // Console output
  const prefix = `[AutoJob ${entry.stage ? `| ${entry.stage}` : ""}]`;
  if (entry.level === "error") {
    console.error(`${prefix} ❌ ${entry.message}`);
  } else if (entry.level === "warn") {
    console.warn(`${prefix} ⚠️ ${entry.message}`);
  } else if (entry.level === "success") {
    console.log(`${prefix} ✅ ${entry.message}`);
  } else {
    console.log(`${prefix} ℹ️ ${entry.message}`);
  }
}

export function getRecentLogs(): LogEntry[] {
  return [...inMemoryLogs];
}
