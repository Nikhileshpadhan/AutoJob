import { Page } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { triggerHumanInTheLoopAlert } from "../telegram";

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
  "input[placeholder*='code' i]",
  ".checkpoint-wrapper",
  "#arkose",
];

export async function detectCaptchaOrSecurityCheck(
  page: Page,
  platform: "linkedin" | "internshala",
  jobDetails?: { company: string; position: string; url?: string }
): Promise<boolean> {
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
        await page.screenshot({ path: screenshotPath, fullPage: true });

        // Trigger human-in-the-loop exception
        await triggerHumanInTheLoopAlert({
          platform,
          type: selector.includes("code") || selector.includes("otp") || selector.includes("pin") ? "otp" : "captcha",
          message: `Security verification / CAPTCHA triggered on ${platform}. Please intervene in the browser.`,
          screenshotPath,
          jobDetails,
        });

        return true;
      }
    } catch {
      // Element check timed out or element detached, proceed
    }
  }

  return false;
}

export async function waitForUserResolution(
  page: Page,
  platform: "linkedin" | "internshala",
  maxWaitMinutes: number = 5
): Promise<boolean> {
  console.log(`[AutoJob Paused] Waiting up to ${maxWaitMinutes} minutes for human verification on ${platform}...`);
  const intervalMs = 3000;
  const maxIterations = (maxWaitMinutes * 60 * 1000) / intervalMs;

  for (let i = 0; i < maxIterations; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const stillBlocked = await isStillBlocked(page);
    if (!stillBlocked) {
      console.log(`[Checkpoint Resolved] Human verification completed successfully on ${platform}!`);
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
      // Ignore
    }
  }
  return false;
}
