import { Page } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { triggerHumanInTheLoopAlert } from "../telegram";
import { getDb } from "../db";

const CAPTCHA_SELECTORS = [
  ".captcha",
  "#captcha",
  "iframe[src*='recaptcha']",
  "iframe[src*='hcaptcha']",
  "iframe[src*='challenges.cloudflare.com']",
  "#cf-challenge-running",
  ".challenge-container",
  "[data-callback='recaptchaCallback']",
  "div:has-text('Security Verification')",
  "div:has-text('Let\\'s do a quick security check')",
  "div:has-text('Enter the code we sent')",
  "input[name='pin']",
  "input[name='otp']",
  // Exclude postal/zip/promo codes to prevent false positives (AUTO-008)
  "input[placeholder*='verification code' i]",
  "input[placeholder*='security code' i]",
  "input[placeholder*='otp' i]",
  ".checkpoint-wrapper",
  "#arkose",
];

export interface CaptchaCheckResult {
  blocked: boolean;
  alertId?: number;
}

export async function detectCaptchaOrSecurityCheck(
  page: Page,
  platform: "linkedin" | "internshala",
  jobDetails?: { company: string; position: string; url?: string }
): Promise<CaptchaCheckResult> {
  for (const selector of CAPTCHA_SELECTORS) {
    try {
      const el = await page.$(selector);
      if (el && (await el.isVisible())) {
        console.warn(`[Security Checkpoint Detected] Selector matched: ${selector} on ${platform}`);

        // Capture screenshot
        const screenshotsDir = path.join(process.cwd(), "data", "screenshots");
        if (!fs.existsSync(screenshotsDir)) {
          fs.mkdirSync(screenshotsDir, { recursive: true });
        }
        const screenshotPath = path.join(
          screenshotsDir,
          `checkpoint-${platform}-${Date.now()}.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

        // Trigger human-in-the-loop exception
        const { alertId } = await triggerHumanInTheLoopAlert({
          platform,
          type: selector.includes("code") || selector.includes("otp") || selector.includes("pin") ? "otp" : "captcha",
          message: `Security verification / CAPTCHA triggered on ${platform}. Please intervene in the browser.`,
          screenshotPath,
          jobDetails,
        });

        return { blocked: true, alertId };
      }
    } catch {
      // Element check timed out or element detached, proceed
    }
  }

  return { blocked: false };
}

/**
 * Waits for user intervention, checking BOTH active DOM state and SQLite alert status (AUTO-008).
 */
export async function waitForUserResolution(
  page: Page,
  platform: "linkedin" | "internshala",
  alertId?: number,
  maxWaitMinutes: number = 5
): Promise<boolean> {
  console.log(`[AutoJob Paused] Waiting up to ${maxWaitMinutes} minutes for human verification on ${platform} (Alert ID: ${alertId || "none"})...`);
  const intervalMs = 2500;
  const maxIterations = (maxWaitMinutes * 60 * 1000) / intervalMs;
  const db = getDb();

  for (let i = 0; i < maxIterations; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    // 1. Check if user marked resolved / dismissed in web UI
    if (alertId) {
      try {
        const alertRes = await db.execute({
          sql: "SELECT status FROM alerts WHERE id = ?",
          args: [alertId],
        });
        const currentStatus = alertRes.rows[0]?.status as string;
        if (currentStatus === "resolved" || currentStatus === "dismissed") {
          console.log(`[Checkpoint Resolved] UI resolution recorded for Alert #${alertId} on ${platform}!`);
          return true;
        }
      } catch (dbErr) {
        console.warn("[Alert Check Error]:", dbErr);
      }
    }

    // 2. Check if user completed verification directly in browser DOM
    const stillBlocked = await isStillBlocked(page);
    if (!stillBlocked) {
      console.log(`[Checkpoint Resolved] Human verification completed in browser for ${platform}!`);
      if (alertId) {
        await db.execute({
          sql: "UPDATE alerts SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = ?",
          args: [alertId],
        }).catch(() => {});
      }
      return true;
    }
  }

  console.warn(`[Checkpoint Timeout] No human intervention detected within ${maxWaitMinutes} minutes.`);
  return false;
}

async function isStillBlocked(page: Page): Promise<boolean> {
  for (const selector of CAPTCHA_SELECTORS) {
    try {
      const el = await page.$(selector);
      if (el && (await el.isVisible())) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}
