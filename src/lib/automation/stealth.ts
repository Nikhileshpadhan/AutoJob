import { Page } from "playwright";

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
    // Occasional tiny pause like a real human typing
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

export const STEALTH_CHROMIUM_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-infobars",
  "--window-size=1280,800",
  "--start-maximized",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-default-browser-check",
];
