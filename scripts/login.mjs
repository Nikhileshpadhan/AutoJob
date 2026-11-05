import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

async function openBrowserForLogin() {
  const userDataDir = path.resolve(process.cwd(), "data", "browser_profile");
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  // Remove stale locks
  for (const lockFile of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    const fullPath = path.join(userDataDir, lockFile);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {}
    }
  }

  console.log("==================================================");
  console.log("   AUTOJOB BROWSER SESSION LOGIN ASSISTANT        ");
  console.log("==================================================");
  console.log("Opening persistent browser profile at:");
  console.log(userDataDir);
  console.log("\nINSTRUCTIONS:");
  console.log("1. Tab 1: Log in to your LinkedIn account.");
  console.log("2. Tab 2: Log in to your Internshala account.");
  console.log("3. Once logged in, simply close the browser window.");
  console.log("Your cookies and active sessions will be preserved for AutoJob.\n");

  const localAppData = process.env.LOCALAPPDATA || "";
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
  ];
  const executablePath = candidates.find((c) => fs.existsSync(c)) || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  console.log(`Using Google Chrome browser binary: ${executablePath}\n`);

  const launchOpts = {
    headless: false,
    viewport: null,
    args: [
      "--start-maximized",
      "--new-window",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  };
  if (executablePath) {
    launchOpts.executablePath = executablePath;
  }

  const context = await chromium.launchPersistentContext(userDataDir, launchOpts);

  const page = context.pages()[0] || (await context.newPage());
  await page.goto("https://www.linkedin.com/login").catch(() => {});

  const page2 = await context.newPage();
  await page2.goto("https://internshala.com/").catch(() => {});

  await new Promise((resolve) => {
    context.on("close", resolve);
  });

  console.log("Browser window closed. Authentication session successfully saved!");
}

openBrowserForLogin().catch(console.error);
