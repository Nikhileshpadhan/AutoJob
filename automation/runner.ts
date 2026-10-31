import dotenv from "dotenv";
dotenv.config();

import { initDatabase, getTodayQuota } from "../src/lib/db";
import { automationEngine } from "../src/lib/automation/playwright-runner";

async function main() {
  console.log("=== AUTOJOB BACKGROUND APPLICATION RUNNER ===");
  await initDatabase();

  const quota = await getTodayQuota();
  console.log(`[Date: ${quota.date}] Today's Quota: ${quota.applied_count}/${quota.max_cap} used (${quota.remaining} remaining)`);

  if (quota.remaining <= 0) {
    console.log("Daily cap reached. Exiting.");
    process.exit(0);
  }

  const result = await automationEngine.start({
    platform: "both",
    dryRun: process.argv.includes("--dry-run"),
  });

  console.log("Runner finished:", result);
}

main().catch((err) => {
  console.error("Runner failed:", err);
  process.exit(1);
});
