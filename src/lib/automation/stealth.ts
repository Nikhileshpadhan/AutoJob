import { Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

/**
 * Resolves the Google Chrome browser binary path directly without fallbacks.
 */
export function resolveBrowserExecutablePath(): { path: string; name: string } {
  if (process.env.BROWSER_EXECUTABLE_PATH && fs.existsSync(process.env.BROWSER_EXECUTABLE_PATH)) {
    return { path: process.env.BROWSER_EXECUTABLE_PATH, name: "Google Chrome" };
  }

  const localAppData = process.env.LOCALAPPDATA || "";
  const chromeCandidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
  ];

  for (const c of chromeCandidates) {
    if (fs.existsSync(c)) {
      return { path: c, name: "Google Chrome" };
    }
  }

  return { path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", name: "Google Chrome" };
}

export function randomDelay(minMs: number = 800, maxMs: number = 2200): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function humanType(page: Page, selector: string, text: string) {
  await page.click(selector);
  await randomDelay(100, 300);
  for (const char of text) {
    await page.keyboard.type(char, {
      delay: Math.floor(Math.random() * 80) + 40,
    });
    // Occasional pause like a real human typing
    if (Math.random() < 0.08) {
      await randomDelay(150, 400);
    }
  }
}

export async function humanMouseMove(page: Page) {
  const viewport = page.viewportSize() || { width: 1280, height: 800 };
  const targetX = Math.floor(Math.random() * (viewport.width - 200)) + 100;
  const targetY = Math.floor(Math.random() * (viewport.height - 200)) + 100;

  await page.mouse.move(targetX, targetY, {
    steps: Math.floor(Math.random() * 15) + 10,
  });
}

/**
 * Chromium launch flags. Only enables --no-sandbox if explicitly opted in via CHROMIUM_NO_SANDBOX=true (SEC-003).
 */
export function getStealthChromiumArgs(): string[] {
  const args = [
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--start-maximized",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-default-browser-check",
  ];

  if (process.env.CHROMIUM_NO_SANDBOX === "true") {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  return args;
}

export const STEALTH_CHROMIUM_ARGS = getStealthChromiumArgs();
