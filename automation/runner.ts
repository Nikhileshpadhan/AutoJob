import dotenv from "dotenv";
dotenv.config();

import { initDatabase, getTodayQuota } from "../src/lib/db";
import { automationEngine } from "../src/lib/automation/playwright-runner";

async function main() {
  console.log("=== AUTOJOB BACKGROUND APPLICATION RUNNER ===");
  await initDatabase();

  const quota = await getTodayQuota();
  console.log(
    `[Date: ${quota.date}] Today's Quota: ${quota.applied_count}/${quota.max_cap} used (${quota.remaining} total slots remaining)`
  );
  console.log(
    `  ├─ LinkedIn: ${quota.platforms.linkedin.applied_count}/${quota.platforms.linkedin.max_cap} (${quota.platforms.linkedin.remaining} slots)`
  );
  console.log(
    `  └─ Internshala: ${quota.platforms.internshala.applied_count}/${quota.platforms.internshala.max_cap} (${quota.platforms.internshala.remaining} slots)`
  );

  if (quota.remaining <= 0) {
    console.log("All daily quotas reached for today. Exiting.");
    process.exit(0);
  }

  // Parse CLI flags
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
