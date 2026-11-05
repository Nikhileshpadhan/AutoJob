import dotenv from "dotenv";
dotenv.config();

import { ensureDbInitialized, getDb } from "../src/lib/db";
import { automationEngine } from "../src/lib/automation/playwright-runner";

async function main() {
  console.log("=== AUTOJOB APPLICATION RUNNER ===");
  await ensureDbInitialized();

  const isCloudTick = process.argv.includes("--cloud-tick");

  if (isCloudTick) {
    console.log("[Cloud Tick Mode] Querying Turso Cloud for active multi-tenant runners...");
    const db = getDb();
    const usersRes = await db.execute("SELECT user_id FROM runner_states WHERE is_enabled = 1");

    console.log(`Discovered ${usersRes.rows.length} enabled runner user(s) in database.`);

    for (const row of usersRes.rows) {
      const userId = String(row.user_id);
      console.log(`\n---> [User ID: ${userId}] Evaluating application tick...`);
      try {
        const tickResult = await automationEngine.runUserTick(userId);
        console.log(`[User ID: ${userId}] Tick Complete:`, tickResult);
      } catch (userErr) {
        console.error(`[User ID: ${userId}] Tick threw error:`, userErr);
      }
    }

    console.log("\n[Cloud Tick Mode] All eligible users processed. Exiting cleanly (0).");
    process.exit(0);
  }

  // Local CLI execution fallback
  const isDryRun = process.argv.includes("--dry-run");
  const platformArg = process.argv.find((a) => a.startsWith("--platform="));
  const opportunityArg = process.argv.find((a) => a.startsWith("--opportunity="));

  const platform = platformArg
    ? (platformArg.split("=")[1] as "linkedin" | "internshala" | "both")
    : "both";

  const opportunityType = opportunityArg
    ? (opportunityArg.split("=")[1] as "internship" | "job")
    : undefined;

  const result = await automationEngine.start({
    platform,
    opportunityType,
    dryRun: isDryRun,
  });

  console.log("Runner finished successfully:", result);
}

main().catch((err) => {
  console.error("Runner failed:", err);
  process.exit(1);
});
