import dotenv from "dotenv";
dotenv.config();

import { initDatabase } from "../src/lib/db";
import { triggerHumanInTheLoopAlert } from "../src/lib/telegram";

async function main() {
  console.log("=== AUTOJOB CAPTCHA / TELEGRAM TEST RUNNER ===");
  await initDatabase();

  console.log("Triggering simulated security checkpoint alert...");
  const { alertId } = await triggerHumanInTheLoopAlert({
    platform: "linkedin",
    type: "captcha",
    message: "TEST ALERT: Verification puzzle triggered during Easy Apply submission.",
    jobDetails: {
      company: "Google / Alphabet",
      position: "Senior Full Stack Engineer",
      url: "https://www.linkedin.com/jobs/view/12345678",
    },
  });

  console.log(`Alert #${alertId} registered in database and sent to Telegram!`);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
