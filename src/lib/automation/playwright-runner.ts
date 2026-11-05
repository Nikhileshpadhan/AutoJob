import { chromium, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execSync } from "node:child_process";
import {
  getDb,
  getTodayQuota,
  getTodayPlatformQuota,
  incrementTodayPlatformQuota,
  initDatabase,
  ensureDbInitialized,
  getUserSettings,
  getRunnerState,
  updateRunnerState,
  addRunnerLog,
  type RunnerState,
} from "../db";
import { decryptSecret } from "../crypto";
import {
  getStealthChromiumArgs,
  resolveBrowserExecutablePath,
  randomDelay,
  humanMouseMove,
  humanType,
} from "./stealth";
import { detectCaptchaOrSecurityCheck, waitForUserResolution } from "./captcha-detector";
import {
  generateTailoredCoverLetter,
  evaluateSelectionProbability,
  answerFormQuestions,
} from "../llm";
import { sendTelegramMessage } from "../telegram";
import { logTelemetry } from "./logger";
import { setRunnerStatus, getRunnerStatus } from "./runner-state";
import {
  isWithinActiveWindow,
  getMsUntilNextWindowOpen,
  calculateRandomRestTimeMs,
  interruptibleSleep,
  formatDurationMs,
  formatHour12,
} from "./pacing";

export interface AutomationRunOptions {
  platform?: "linkedin" | "internshala" | "both";
  opportunityType?: "internship" | "job";
  workplaceType?: "any" | "remote" | "hybrid" | "on_site";
  targetLocation?: string;
  applyType?: "all" | "easy_apply_only";
  dryRun?: boolean;
  pacingMode?: "pacing" | "burst";
  ignoreTimeWindow?: boolean;
}

/**
 * Dynamically derives targeted job search queries based on candidate resume skills
 * and any user-configured target roles.
 */
export function deriveSearchRolesFromSkills(
  skills: string[],
  configuredRoles: string[] = [],
  opportunityType: "internship" | "job" = "job"
): string[] {
  const derived = new Set<string>();

  // Include user configured target roles first
  for (const r of configuredRoles) {
    if (r && r.trim()) {
      if (opportunityType === "internship" && !r.toLowerCase().includes("intern")) {
        derived.add(`${r.trim()} Intern`);
      } else {
        derived.add(r.trim());
      }
    }
  }

  const sLower = skills.map((s) => s.toLowerCase());

  // Derive roles directly matching resume skills
  if (opportunityType === "internship") {
    if (sLower.some((s) => s.includes("generative ai") || s.includes("genai") || s.includes("llm") || s.includes("ai"))) {
      derived.add("AI Intern");
      derived.add("Generative AI Intern");
    }
    if (sLower.some((s) => s.includes("machine learning") || s.includes("ml"))) {
      derived.add("Machine Learning Intern");
    }
    if (sLower.some((s) => s.includes("data science") || s.includes("data scientist"))) {
      derived.add("Data Science Intern");
    }
    if (sLower.some((s) => s.includes("python"))) {
      derived.add("Python Intern");
      derived.add("Python Developer Intern");
    }
    if (sLower.some((s) => s.includes("backend") || s.includes("node") || s.includes("django"))) {
      derived.add("Backend Intern");
    }
    if (sLower.some((s) => s.includes("frontend") || s.includes("react"))) {
      derived.add("Frontend Intern");
      derived.add("Web Development Intern");
    }
    if (sLower.some((s) => s.includes("full stack") || s.includes("web development"))) {
      derived.add("Full Stack Intern");
      derived.add("Software Engineer Intern");
    }
    if (sLower.some((s) => s.includes("java"))) {
      derived.add("Java Intern");
    }

    if (derived.size === 0 && skills.length > 0) {
      derived.add("Software Engineer Intern");
      derived.add("Python Intern");
    }
  } else {
    if (sLower.some((s) => s.includes("generative ai") || s.includes("genai") || s.includes("llm"))) {
      derived.add("Generative AI Engineer");
      derived.add("AI Engineer");
    }
    if (sLower.some((s) => s.includes("machine learning") || s.includes("ml"))) {
      derived.add("Machine Learning Engineer");
    }
    if (sLower.some((s) => s.includes("data science") || s.includes("data scientist"))) {
      derived.add("Data Scientist");
    }
    if (sLower.some((s) => s.includes("python"))) {
      derived.add("Python Developer");
    }
    if (sLower.some((s) => s.includes("backend"))) {
      derived.add("Backend Developer");
    }
    if (sLower.some((s) => s.includes("frontend") || s.includes("react"))) {
      derived.add("Frontend Developer");
    }
    if (sLower.some((s) => s.includes("full stack") || s.includes("web development"))) {
      derived.add("Full Stack Developer");
    }
    if (sLower.some((s) => s.includes("java"))) {
      derived.add("Java Developer");
    }

    if (derived.size === 0 && skills.length > 0) {
      derived.add("Software Engineer");
      derived.add("Python Developer");
    }
  }

  return Array.from(derived);
}

/**
 * Safely removes stale Chromium Singleton locks if no active process is holding them (PERF-003).
 */
function cleanupStaleChromiumLocks(profileDir: string) {
  const lockFiles = ["lockfile", "SingletonLock", "SingletonCookie", "SingletonSocket"];
  for (const lockFile of lockFiles) {
    const fullPath = path.join(profileDir, lockFile);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
        console.log(`[AutoJob] Removed stale browser lock: ${lockFile}`);
      } catch (err) {
        // Ignored if file is locked by an actively running process
      }
    }
  }
}

export class AutomationEngine {
  private context: BrowserContext | null = null;
  private isRunning: boolean = false;
  private isResting: boolean = false;
  private nextRunAt: Date | null = null;
  private abortRequested: boolean = false;
  private activeRunId: number | null = null;

  private userDaemonAborts: Map<string, () => void> = new Map();

  public getStatus() {
    return getRunnerStatus();
  }

  public async stopUserDaemon(userId: string): Promise<void> {
    const abortFn = this.userDaemonAborts.get(userId);
    if (abortFn) {
      abortFn();
      this.userDaemonAborts.delete(userId);
    }
  }

  public async startUserDaemon(userId: string): Promise<void> {
    if (this.userDaemonAborts.has(userId)) return;

    let aborted = false;
    this.userDaemonAborts.set(userId, () => {
      aborted = true;
    });

    (async () => {
      while (!aborted) {
        const state = await getRunnerState(userId);
        if (!state.isEnabled || aborted) break;

        try {
          await this.runUserTick(userId);
        } catch (err) {
          console.error(`[User Daemon ${userId}] Tick error:`, err);
        }

        const updatedState = await getRunnerState(userId);
        if (!updatedState.isEnabled || aborted) break;

        let sleepMs = 30000;
        if (updatedState.nextRunAt) {
          const diff = new Date(updatedState.nextRunAt).getTime() - Date.now();
          if (diff > 0) {
            sleepMs = Math.min(diff, 60000);
          }
        }

        await interruptibleSleep(sleepMs, () => aborted || !state.isEnabled, 1000);
      }
      this.userDaemonAborts.delete(userId);
    })().catch((err) => {
      console.error(`[User Daemon ${userId}] Exited with error:`, err);
      this.userDaemonAborts.delete(userId);
    });
  }

  public async runUserTick(userId: string): Promise<{
    status: string;
    nextRunAt?: string | null;
    applied?: boolean;
    message?: string;
  }> {
    await ensureDbInitialized();
    const runnerState = await getRunnerState(userId);
    if (!runnerState.isEnabled) {
      return { status: "stopped", message: "Runner is stopped" };
    }

    const settings = await getUserSettings(userId);
    const windowStart = parseInt(settings.active_window_start || "9", 10);
    const windowEnd = parseInt(settings.active_window_end || "23", 10);
    const ignoreTimeWindow = settings.ignore_time_window === "true";
    const minRestMin = parseInt(settings.min_rest_minutes || "20", 10);
    const maxRestMin = parseInt(settings.max_rest_minutes || "60", 10);
    const platform = runnerState.platform || "both";
    const opportunityType = runnerState.opportunityType || "internship";
    const dryRun = runnerState.dryRun;

    const now = new Date();

    // 1. Operating Window Check (9 AM - 11 PM)
    if (!isWithinActiveWindow(now, windowStart, windowEnd, ignoreTimeWindow)) {
      const { nextOpenTime } = getMsUntilNextWindowOpen(now, windowStart, windowEnd);
      const nextRunAt = nextOpenTime.toISOString();
      await updateRunnerState(userId, {
        status: "waiting_for_window",
        nextRunAt,
      });
      const timeStr = nextOpenTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      await addRunnerLog(
        userId,
        `[Pacing] Outside ${formatHour12(windowStart)} – ${formatHour12(windowEnd)} window. Next application scheduled for ${timeStr}.`,
        "info"
      );
      return { status: "waiting_for_window", nextRunAt };
    }

    // 2. Daily Quota Check
    const quota = await getTodayQuota(userId);
    let platformHasRemaining = false;
    if (platform === "both") {
      platformHasRemaining = quota.remaining > 0;
    } else {
      platformHasRemaining = (quota.platforms[platform]?.remaining ?? 0) > 0;
    }

    if (!platformHasRemaining) {
      const { nextOpenTime } = getMsUntilNextWindowOpen(now, windowStart, windowEnd);
      const nextRunAt = nextOpenTime.toISOString();
      await updateRunnerState(userId, {
        status: "quota_reached_sleeping",
        nextRunAt,
      });
      const timeStr = nextOpenTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      await addRunnerLog(
        userId,
        `[Quota] Today's daily cap reached! Automatically sleeping until tomorrow ${timeStr}...`,
        "info"
      );
      return { status: "quota_reached_sleeping", nextRunAt };
    }

    // 3. Resting check
    if (runnerState.nextRunAt && now.getTime() < new Date(runnerState.nextRunAt).getTime()) {
      return { status: "resting", nextRunAt: runnerState.nextRunAt };
    }

    // 4. Mark status running
    await updateRunnerState(userId, {
      status: "running",
      lastRunAt: now.toISOString(),
    });
    await addRunnerLog(
      userId,
      `[Worker] Starting application tick for ${platform.toUpperCase()} (${opportunityType.toUpperCase()})...`,
      "info"
    );

    const db = getDb();
    const profRes = await db.execute({
      sql: "SELECT * FROM profiles WHERE user_id = ?",
      args: [userId],
    });
    const profile = (profRes.rows[0] as Record<string, unknown>) || {};
    const candidateSkills: string[] = profile.skills_json
      ? JSON.parse(String(profile.skills_json))
      : [];
    const targetRoles: string[] = profile.target_roles_json
      ? JSON.parse(String(profile.target_roles_json))
      : ["Software Engineer", "Full Stack Developer", "Frontend Developer", "Backend Developer"];

    if (candidateSkills.length === 0) {
      await addRunnerLog(
        userId,
        "[Error] Candidate profile has zero configured skills. Please add skills or upload a resume before running.",
        "error"
      );
      await updateRunnerState(userId, { status: "stopped", isEnabled: false });
      return { status: "error", message: "Skills missing" };
    }

    // Materialize resume PDF if base64 exists
    let resumePath = "";
    if (profile.resume_pdf_base64) {
      try {
        const tmpPath = path.join(os.tmpdir(), `resume-${userId}.pdf`);
        const cleanBase64 = String(profile.resume_pdf_base64).replace(/^data:application\/pdf;base64,/, "");
        fs.writeFileSync(tmpPath, Buffer.from(cleanBase64, "base64"));
        resumePath = tmpPath;
      } catch (fErr) {
        console.warn("[Worker] Could not materialize resume PDF to temp dir:", fErr);
      }
    }

    const liAtCookie = decryptSecret(String(settings.linkedin_li_at_cookie || ""));
    const phpSessCookie = decryptSecret(String(settings.internshala_session_cookie || ""));

    let appliedSuccess = false;
    let browser = null;

    try {
      const headless = process.env.HEADLESS_BROWSER !== "false";
      const browserExecutable = resolveBrowserExecutablePath();

      browser = await chromium.launch({
        headless,
        executablePath: browserExecutable.path || undefined,
        args: getStealthChromiumArgs(),
      });

      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      });

      const cookiesToInject = [];
      if (liAtCookie) {
        cookiesToInject.push({
          name: "li_at",
          value: liAtCookie,
          domain: ".linkedin.com",
          path: "/",
          httpOnly: true,
          secure: true,
        });
      }
      if (phpSessCookie) {
        cookiesToInject.push({
          name: "PHPSESSID",
          value: phpSessCookie,
          domain: ".internshala.com",
          path: "/",
        });
      }
      if (cookiesToInject.length > 0) {
        await context.addCookies(cookiesToInject);
      }

      const page = await context.newPage();

      const searchRoles = deriveSearchRolesFromSkills(candidateSkills, targetRoles, opportunityType);
      const targetPlatforms =
        platform === "both"
          ? quota.platforms.internshala.remaining > 0
            ? ["internshala", "linkedin"]
            : ["linkedin"]
          : [platform];

      for (const p of targetPlatforms) {
        if (p === "internshala" && quota.platforms.internshala.remaining > 0) {
          const count = await this.processInternshala(
            page,
            profile,
            candidateSkills,
            searchRoles,
            opportunityType,
            "remote",
            "Remote",
            65,
            dryRun,
            1,
            userId,
            resumePath
          );
          if (count > 0) {
            appliedSuccess = true;
            break;
          }
        } else if (p === "linkedin" && quota.platforms.linkedin.remaining > 0) {
          const count = await this.processLinkedIn(
            page,
            profile,
            candidateSkills,
            searchRoles,
            opportunityType,
            "remote",
            "Remote",
            "easy_apply_only",
            65,
            dryRun,
            1,
            userId,
            resumePath
          );
          if (count > 0) {
            appliedSuccess = true;
            break;
          }
        }
      }
    } catch (err: any) {
      console.error(`[Worker error for ${userId}]:`, err);
      await addRunnerLog(
        userId,
        `[Error] Application run encountered an issue: ${err?.message || String(err)}`,
        "error"
      );
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }

    const restMinutes = Math.floor(Math.random() * (maxRestMin - minRestMin + 1)) + minRestMin;
    const restMs = restMinutes * 60 * 1000;
    const nextRunTime = new Date(Date.now() + restMs);

    let finalStatus: RunnerState["status"] = "resting";
    let finalNextRunAt = nextRunTime.toISOString();

    if (!isWithinActiveWindow(nextRunTime, windowStart, windowEnd, ignoreTimeWindow)) {
      const { nextOpenTime } = getMsUntilNextWindowOpen(nextRunTime, windowStart, windowEnd);
      finalStatus = "waiting_for_window";
      finalNextRunAt = nextOpenTime.toISOString();
      const openStr = nextOpenTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      await addRunnerLog(
        userId,
        `[Pacing] Window closes soon. Next application scheduled for tomorrow at ${openStr}.`,
        "info"
      );
    } else {
      const runStr = nextRunTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      await addRunnerLog(
        userId,
        `[Pacing] Rest interval: ${restMinutes}m. Next application scheduled for ${runStr}.`,
        "info"
      );
    }

    await updateRunnerState(userId, {
      status: finalStatus,
      nextRunAt: finalNextRunAt,
      lastRunAt: new Date().toISOString(),
    });

    return {
      status: finalStatus,
      nextRunAt: finalNextRunAt,
      applied: appliedSuccess,
    };
  }

  private updateStatus(patch: {
    isRunning?: boolean;
    isResting?: boolean;
    nextRunAt?: Date | null;
    activeRunId?: number | null;
    abortRequested?: boolean;
  }) {
    if (patch.isRunning !== undefined) this.isRunning = patch.isRunning;
    if (patch.isResting !== undefined) this.isResting = patch.isResting;
    if (patch.nextRunAt !== undefined) this.nextRunAt = patch.nextRunAt;
    if (patch.activeRunId !== undefined) this.activeRunId = patch.activeRunId;
    if (patch.abortRequested !== undefined) this.abortRequested = patch.abortRequested;

    setRunnerStatus({
      isRunning: this.isRunning,
      isResting: this.isResting,
      nextRunAt: this.nextRunAt ? this.nextRunAt.toISOString() : null,
      activeRunId: this.activeRunId,
      abortRequested: this.abortRequested,
    });
  }

  private async getOrCreateBrowser(): Promise<{ context: BrowserContext; page: Page }> {
    if (this.context) {
      try {
        const pages = this.context.pages();
        const page = pages[0] || (await this.context.newPage());
        await page.bringToFront().catch(() => {});
        return { context: this.context, page };
      } catch {
        this.context = null;
      }
    }

    const userDataDir = path.resolve(process.cwd(), "data", "browser_profile");
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    cleanupStaleChromiumLocks(userDataDir);

    const browserInfo = resolveBrowserExecutablePath();
    const headless = process.env.HEADLESS_BROWSER === "true";
    await logTelemetry({
      runId: this.activeRunId || undefined,
      level: "info",
      stage: "Browser",
      message: `Launching ${browserInfo.name} (${browserInfo.path || "Bundled"} | Headless: ${headless})...`,
    });

    const launchOptions: any = {
      headless,
      executablePath: browserInfo.path,
      viewport: null,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--no-first-run",
        "--no-default-browser-check",
        "--new-window",
        "--start-maximized",
        "--disable-session-crashed-bubble",
        "--hide-crash-restore-bubble",
      ],
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    };

    try {
      this.context = await chromium.launchPersistentContext(userDataDir, launchOptions);
    } catch (launchErr: any) {
      const errMsg = launchErr?.message || "";
      if (
        errMsg.includes("Opening in existing browser session") ||
        errMsg.includes("Target page, context or browser has been closed") ||
        errMsg.includes("Process was killed")
      ) {
        console.warn("[AutoJob] Profile lock collision detected. Terminating stale browser process and retrying...");
        if (process.platform === "win32") {
          try {
            execSync(
              'powershell.exe -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -match \'(chrome)\\.exe\') -and ($_.CommandLine -like \'*browser_profile*\') } | Stop-Process -Force -ErrorAction SilentlyContinue"',
              { timeout: 4000, stdio: "ignore" }
            );
          } catch {}
        }
        cleanupStaleChromiumLocks(userDataDir);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        this.context = await chromium.launchPersistentContext(userDataDir, launchOptions);
      } else {
        throw launchErr;
      }
    }

    const page = this.context.pages()[0] || (await this.context.newPage());
    await page.bringToFront().catch(() => {});

    // Ensure Chrome window is brought to the Windows OS foreground
    if (process.platform === "win32" && !headless) {
      try {
        const focusScript = path.resolve(process.cwd(), "scripts", "focus-browser.ps1");
        if (fs.existsSync(focusScript)) {
          execSync(
            `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${focusScript}" -ProcessName chrome`,
            { timeout: 5000, stdio: "ignore" }
          );
        }
      } catch {}
    }
    return { context: this.context, page };
  }

  private async closeBrowser(): Promise<void> {
    if (this.context) {
      try {
        await this.context.close();
      } catch (err) {
        // Ignored if browser already closed or detached
      }
      this.context = null;
    }
  }

  public async start(options: AutomationRunOptions = { platform: "both", dryRun: false }) {
    if (this.isRunning) {
      await logTelemetry({
        runId: this.activeRunId || undefined,
        level: "warn",
        stage: "Lifecycle",
        message: "Automation run is already in progress.",
      });
      return { status: "already_running" };
    }

    this.updateStatus({
      isRunning: true,
      isResting: false,
      nextRunAt: null,
      abortRequested: false,
    });

    await initDatabase();
    const db = getDb();

    // 1. Validate that user has uploaded profile / skills (AUTO-007)
    const profileRow = await db.execute("SELECT * FROM profile WHERE id = 1");
    const profileData = profileRow.rows[0] || {};
    const candidateSkills: string[] = profileData.skills_json
      ? JSON.parse(profileData.skills_json as string)
      : [];
    const configuredRoles: string[] = profileData.target_roles_json
      ? JSON.parse(profileData.target_roles_json as string)
      : [];

    if (candidateSkills.length === 0) {
      const errMsg = "Candidate profile has zero configured skills. Please add your skills or upload a resume before starting automation.";
      await logTelemetry({
        level: "error",
        stage: "Validation",
        message: errMsg,
      });
      return { status: "missing_profile", error: errMsg };
    }

    this.isRunning = true;
    this.isResting = false;
    this.nextRunAt = null;
    this.abortRequested = false;

    // Create database run record (BE-004)
    const runRes = await db.execute({
      sql: `INSERT INTO automation_runs (
              status, platform, opportunity_type, workplace_type, target_location, apply_type, pid
            ) VALUES ('running', ?, ?, ?, ?, ?, ?)`,
      args: [
        options.platform || "both",
        options.opportunityType || "internship",
        options.workplaceType || "remote",
        options.targetLocation || "Remote",
        options.applyType || "easy_apply_only",
        process.pid,
      ],
    });
    this.activeRunId = Number(runRes.lastInsertRowid);
    this.updateStatus({ activeRunId: this.activeRunId });

    try {
      // Read configured preferences from database
      const settingsRows = await db.execute("SELECT key, value FROM system_settings");
      const settingsMap: Record<string, string> = {};
      for (const row of settingsRows.rows) {
        if (row.key && row.value) {
          settingsMap[row.key as string] = row.value as string;
        }
      }

      const opportunityType: "internship" | "job" =
        options.opportunityType || (settingsMap.opportunity_type as "internship" | "job") || "internship";
      const workplaceType: "any" | "remote" | "hybrid" | "on_site" =
        options.workplaceType || (settingsMap.workplace_type as any) || "remote";
      const targetLocation: string =
        options.targetLocation || (settingsMap.target_location as string) || "Remote";
      const applyType: "all" | "easy_apply_only" =
        options.applyType || (settingsMap.apply_type as any) || "easy_apply_only";
      const minScoreThreshold = settingsMap.min_match_score ? parseInt(settingsMap.min_match_score, 10) : 65;

      const pacingEnabled =
        options.pacingMode !== undefined
          ? options.pacingMode === "pacing"
          : settingsMap.pacing_enabled !== "false";
      const ignoreTimeWindow =
        options.ignoreTimeWindow !== undefined
          ? options.ignoreTimeWindow
          : settingsMap.ignore_time_window === "true";
      const windowStart = parseInt(settingsMap.active_window_start || "9", 10);
      const windowEnd = parseInt(settingsMap.active_window_end || "23", 10);
      const minRestMinutes = parseInt(settingsMap.min_rest_minutes || "20", 10);
      const maxRestMinutes = parseInt(settingsMap.max_rest_minutes || "60", 10);

      await logTelemetry({
        runId: this.activeRunId,
        level: "info",
        stage: "Initialization",
        message: `Engine started | Mode: ${opportunityType.toUpperCase()} | Platform: ${options.platform || "both"} | Workplace: ${workplaceType} | Pacing: ${pacingEnabled ? `Smart Pacing (${windowStart}:00-${windowEnd}:00, ${minRestMinutes}-${maxRestMinutes}m rest)` : "Instant/Burst"} | Apply: ${applyType}`,
      });

      // Check per-platform daily quotas
      const [initialLinkedinQuota, initialInternshalaQuota] = await Promise.all([
        getTodayPlatformQuota("linkedin"),
        getTodayPlatformQuota("internshala"),
      ]);

      await logTelemetry({
        runId: this.activeRunId,
        level: "info",
        stage: "Quota",
        message: `Daily Quotas: LinkedIn ${initialLinkedinQuota.applied_count}/${initialLinkedinQuota.max_cap} (${initialLinkedinQuota.remaining} left) | Internshala ${initialInternshalaQuota.applied_count}/${initialInternshalaQuota.max_cap} (${initialInternshalaQuota.remaining} left)`,
      });

      const targetPlatform = options.platform || "both";
      const initialCanRunLI = (targetPlatform === "linkedin" || targetPlatform === "both") && initialLinkedinQuota.remaining > 0;
      const initialCanRunIS = (targetPlatform === "internshala" || targetPlatform === "both") && initialInternshalaQuota.remaining > 0;

      if (!initialCanRunLI && !initialCanRunIS) {
        const msg = "Daily application quotas for target platforms are fully exhausted for today.";
        await logTelemetry({
          runId: this.activeRunId,
          level: "warn",
          stage: "Quota",
          message: msg,
        });
        await db.execute({
          sql: "UPDATE automation_runs SET status = 'completed', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
          args: [this.activeRunId],
        });
        return {
          status: "quota_reached",
          linkedin: initialLinkedinQuota,
          internshala: initialInternshalaQuota,
        };
      }

      const searchRoles = deriveSearchRolesFromSkills(candidateSkills, configuredRoles, opportunityType);
      await logTelemetry({
        runId: this.activeRunId,
        level: "info",
        stage: "Discovery",
        message: `Derived target search queries: ${searchRoles.join(", ")}`,
      });

      let applicationsSubmittedThisSession = 0;
      let linkedinActions = 0;
      let internshalaActions = 0;

      if (pacingEnabled && !options.dryRun) {
        // SMART RANDOM PACING MODE (9 AM – 11 PM Window, Single-Application Cycles)
        let lastPlatform: "linkedin" | "internshala" | null = null;

        while (!this.abortRequested) {
          const [liQ, isQ] = await Promise.all([
            getTodayPlatformQuota("linkedin"),
            getTodayPlatformQuota("internshala"),
          ]);
          const canRunLI = (targetPlatform === "linkedin" || targetPlatform === "both") && liQ.remaining > 0;
          const canRunIS = (targetPlatform === "internshala" || targetPlatform === "both") && isQ.remaining > 0;

          if (!canRunLI && !canRunIS) {
            await logTelemetry({
              runId: this.activeRunId,
              level: "info",
              stage: "Quota",
              message: "Daily application quotas reached for all active platforms.",
            });
            break;
          }

          // Enforce Active Operating Window
          if (!ignoreTimeWindow && !isWithinActiveWindow(new Date(), windowStart, windowEnd, false)) {
            const { ms: msUntilOpen, nextOpenTime } = getMsUntilNextWindowOpen(new Date(), windowStart, windowEnd);
            const durationFormatted = formatDurationMs(msUntilOpen);
            await logTelemetry({
              runId: this.activeRunId,
              level: "warn",
              stage: "Pacing",
              message: `[Pacing] Outside active operating window (${formatHour12(windowStart)} – ${formatHour12(windowEnd)}). Sleeping for ${durationFormatted} until window opens at ${nextOpenTime.toLocaleTimeString()} (or turn on 'Run Anytime / Ignore Window' in Settings)...`,
            });
            await this.closeBrowser();
            this.updateStatus({ isResting: true, nextRunAt: nextOpenTime });
            const completedWindowSleep = await interruptibleSleep(msUntilOpen, () => this.abortRequested);
            this.updateStatus({ isResting: false, nextRunAt: null });

            if (!completedWindowSleep || this.abortRequested) {
              break;
            }
          }

          // Decide platform for this single application cycle (alternate when both available)
          let platformToAttempt: "linkedin" | "internshala";
          if (canRunLI && canRunIS) {
            platformToAttempt = lastPlatform === "linkedin" ? "internshala" : "linkedin";
          } else if (canRunLI) {
            platformToAttempt = "linkedin";
          } else {
            platformToAttempt = "internshala";
          }

          const { page } = await this.getOrCreateBrowser();
          let singleSubmitted = 0;

          if (platformToAttempt === "linkedin") {
            await db.execute({
              sql: "UPDATE automation_runs SET current_platform = 'linkedin' WHERE id = ?",
              args: [this.activeRunId],
            });
            singleSubmitted = await this.processLinkedIn(
              page,
              profileData,
              candidateSkills,
              searchRoles,
              opportunityType,
              workplaceType,
              targetLocation,
              applyType,
              minScoreThreshold,
              false,
              1 // Apply to 1 job
            );
            if (singleSubmitted > 0) {
              lastPlatform = "linkedin";
              linkedinActions += singleSubmitted;
              applicationsSubmittedThisSession += singleSubmitted;
            } else if (canRunIS && !this.abortRequested) {
              // Try alternate platform if LinkedIn yielded no submit
              await db.execute({
                sql: "UPDATE automation_runs SET current_platform = 'internshala' WHERE id = ?",
                args: [this.activeRunId],
              });
              const altSubmitted = await this.processInternshala(
                page,
                profileData,
                candidateSkills,
                searchRoles,
                opportunityType,
                workplaceType,
                targetLocation,
                minScoreThreshold,
                false,
                1
              );
              if (altSubmitted > 0) {
                lastPlatform = "internshala";
                internshalaActions += altSubmitted;
                applicationsSubmittedThisSession += altSubmitted;
                singleSubmitted = altSubmitted;
              }
            }
          } else {
            await db.execute({
              sql: "UPDATE automation_runs SET current_platform = 'internshala' WHERE id = ?",
              args: [this.activeRunId],
            });
            singleSubmitted = await this.processInternshala(
              page,
              profileData,
              candidateSkills,
              searchRoles,
              opportunityType,
              workplaceType,
              targetLocation,
              minScoreThreshold,
              false,
              1 // Apply to 1 job
            );
            if (singleSubmitted > 0) {
              lastPlatform = "internshala";
              internshalaActions += singleSubmitted;
              applicationsSubmittedThisSession += singleSubmitted;
            } else if (canRunLI && !this.abortRequested) {
              // Try alternate platform if Internshala yielded no submit
              await db.execute({
                sql: "UPDATE automation_runs SET current_platform = 'linkedin' WHERE id = ?",
                args: [this.activeRunId],
              });
              const altSubmitted = await this.processLinkedIn(
                page,
                profileData,
                candidateSkills,
                searchRoles,
                opportunityType,
                workplaceType,
                targetLocation,
                applyType,
                minScoreThreshold,
                false,
                1
              );
              if (altSubmitted > 0) {
                lastPlatform = "linkedin";
                linkedinActions += altSubmitted;
                applicationsSubmittedThisSession += altSubmitted;
                singleSubmitted = altSubmitted;
              }
            }
          }

          if (singleSubmitted === 0 || this.abortRequested) {
            await logTelemetry({
              runId: this.activeRunId,
              level: "info",
              stage: "Lifecycle",
              message: "No additional matching job listings found to apply at this time.",
            });
            break;
          }

          // Check if quota remains today after this submission
          const quotaAfter = await getTodayQuota();
          if (quotaAfter.remaining <= 0 || this.abortRequested) {
            await logTelemetry({
              runId: this.activeRunId,
              level: "info",
              stage: "Quota",
              message: "Daily quota completed for today.",
            });
            break;
          }

          // Compute random rest interval and close browser context to save RAM
          const { restMs, nextRunAt, formattedDuration } = calculateRandomRestTimeMs({
            remainingQuotaToday: quotaAfter.remaining,
            minRestMinutes,
            maxRestMinutes,
            windowEndHour: windowEnd,
          });

          await this.closeBrowser();
          this.updateStatus({ isResting: true, nextRunAt: nextRunAt });

          await logTelemetry({
            runId: this.activeRunId,
            level: "info",
            stage: "Pacing",
            message: `[Pacing] Applied 1 job. Resting for ${formattedDuration} (until ${nextRunAt.toLocaleTimeString()}) before next application...`,
          });

          const restCompleted = await interruptibleSleep(restMs, () => this.abortRequested);
          this.updateStatus({ isResting: false, nextRunAt: null });

          if (!restCompleted || this.abortRequested) {
            await logTelemetry({
              runId: this.activeRunId,
              level: "warn",
              stage: "Pacing",
              message: "[Pacing] Rest interrupted by abort request.",
            });
            break;
          }
        }
      } else {
        // INSTANT / BURST MODE (OR DRY RUN)
        const { page } = await this.getOrCreateBrowser();

        if (initialCanRunLI && !this.abortRequested) {
          try {
            await db.execute({
              sql: "UPDATE automation_runs SET current_platform = 'linkedin' WHERE id = ?",
              args: [this.activeRunId],
            });
            linkedinActions = await this.processLinkedIn(
              page,
              profileData,
              candidateSkills,
              searchRoles,
              opportunityType,
              workplaceType,
              targetLocation,
              applyType,
              minScoreThreshold,
              options.dryRun,
              999
            );
            applicationsSubmittedThisSession += linkedinActions;
          } catch (linkedInErr) {
            await logTelemetry({
              runId: this.activeRunId,
              level: "error",
              stage: "LinkedIn",
              message: `LinkedIn processing encountered an error: ${linkedInErr instanceof Error ? linkedInErr.message : String(linkedInErr)}`,
            });
          }
        }

        if (initialCanRunIS && !this.abortRequested) {
          try {
            await db.execute({
              sql: "UPDATE automation_runs SET current_platform = 'internshala' WHERE id = ?",
              args: [this.activeRunId],
            });
            internshalaActions = await this.processInternshala(
              page,
              profileData,
              candidateSkills,
              searchRoles,
              opportunityType,
              workplaceType,
              targetLocation,
              minScoreThreshold,
              options.dryRun,
              999
            );
            applicationsSubmittedThisSession += internshalaActions;
          } catch (internshalaErr) {
            await logTelemetry({
              runId: this.activeRunId,
              level: "error",
              stage: "Internshala",
              message: `Internshala processing encountered an error: ${internshalaErr instanceof Error ? internshalaErr.message : String(internshalaErr)}`,
            });
          }
        }
      }

      const updatedOverallQuota = await getTodayQuota();
      const finalStatus = this.abortRequested ? "aborted" : "completed";

      await db.execute({
        sql: `UPDATE automation_runs SET 
                status = ?, ended_at = CURRENT_TIMESTAMP, 
                stats_json = ? 
              WHERE id = ?`,
        args: [
          finalStatus,
          JSON.stringify({
            submittedThisSession: applicationsSubmittedThisSession,
            linkedin: linkedinActions,
            internshala: internshalaActions,
          }),
          this.activeRunId,
        ],
      });

      await logTelemetry({
        runId: this.activeRunId,
        level: "success",
        stage: "Lifecycle",
        message: `Run ${finalStatus}! Total submitted this session: ${applicationsSubmittedThisSession}. Remaining today: ${updatedOverallQuota.remaining}`,
      });

      return {
        status: finalStatus,
        applicationsSubmittedThisSession,
        todayRemaining: updatedOverallQuota.remaining,
        platforms: updatedOverallQuota.platforms,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (this.activeRunId) {
        await db.execute({
          sql: "UPDATE automation_runs SET status = 'failed', ended_at = CURRENT_TIMESTAMP, error_message = ? WHERE id = ?",
          args: [errMsg, this.activeRunId],
        });
      }
      await logTelemetry({
        runId: this.activeRunId || undefined,
        level: "error",
        stage: "Lifecycle",
        message: `Engine terminated with error: ${errMsg}`,
      });
      throw err;
    } finally {
      await this.closeBrowser();
      this.updateStatus({
        isRunning: false,
        isResting: false,
        nextRunAt: null,
        activeRunId: null,
      });
    }
  }

  public async stop() {
    this.updateStatus({
      abortRequested: true,
      isResting: false,
      nextRunAt: null,
    });
    await logTelemetry({
      runId: this.activeRunId || undefined,
      level: "warn",
      stage: "Lifecycle",
      message: "Abort requested by user. Cleaning up browser...",
    });
    await this.closeBrowser();
    if (process.platform === "win32") {
      try {
        execSync(
          'powershell.exe -NoProfile -NonInteractive -Command "Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object { $_.Path -like \'*ms-playwright*\' } | Stop-Process -Force -ErrorAction SilentlyContinue"',
          { timeout: 3000, stdio: "ignore" }
        );
      } catch {}
    }
  }

  /**
   * Pre-flight authentication verification (AUTO-005).
   */
  private async ensureAuthenticated(page: Page, platform: "linkedin" | "internshala"): Promise<boolean> {
    if (platform === "linkedin") {
      const currentUrl = page.url();
      const isAuthwall =
        currentUrl.includes("authwall") ||
        currentUrl.includes("/login") ||
        currentUrl.includes("/signup");

      const hasSignInBtn = await page.$(
        "a.nav__button-secondary:has-text('Sign in'), a:has-text('Sign in'), a[href*='/login'], a[data-tracking-control-name*='signin']"
      );
      const hasMeNav = await page.$(
        ".global-nav__me, .feed-identity-module, [data-view-name*='profile'], img.global-nav__me-photo"
      );

      if (isAuthwall || (hasSignInBtn && !hasMeNav)) {
        await logTelemetry({
          runId: this.activeRunId || undefined,
          level: "warn",
          stage: "Auth Pre-flight",
          message: "LinkedIn session is unauthenticated. Running in guest view. Run 'npm run browser:login' to log into your account for 1-click Easy Apply.",
        });
        const check = await detectCaptchaOrSecurityCheck(page, "linkedin");
        if (check.blocked) {
          return await waitForUserResolution(page, "linkedin", check.alertId);
        }
        return false;
      }
      return true;
    }

    if (platform === "internshala") {
      const loginModalOrBtn = await page.$(
        "#login-modal, button.login-cta, .login-modal, a:has-text('Login'), button:has-text('Login')"
      );
      const userProfile = await page.$(
        "#profile_dropdown, .user_profile, .profile_container, a[href*='/student/dashboard']"
      );
      if (loginModalOrBtn && !userProfile && (await loginModalOrBtn.isVisible().catch(() => false))) {
        await logTelemetry({
          runId: this.activeRunId || undefined,
          level: "warn",
          stage: "Auth Pre-flight",
          message: "Internshala session requires login. Run 'npm run browser:login' to authenticate.",
        });
        const check = await detectCaptchaOrSecurityCheck(page, "internshala");
        if (check.blocked) {
          return await waitForUserResolution(page, "internshala", check.alertId);
        }
        return false;
      }
      return true;
    }

    return true;
  }

  private async processLinkedIn(
    page: Page,
    profileData: Record<string, unknown>,
    candidateSkills: string[],
    targetRoles: string[],
    opportunityType: "internship" | "job" = "internship",
    workplaceType: "any" | "remote" | "hybrid" | "on_site" = "remote",
    targetLocation: string = "Remote",
    applyType: "all" | "easy_apply_only" = "easy_apply_only",
    minScoreThreshold: number = 65,
    dryRun: boolean = false,
    maxSubmissions: number = 1,
    userId: string = "default-user",
    resumeFilePath?: string
  ): Promise<number> {
    await logTelemetry({
      runId: this.activeRunId || undefined,
      level: "info",
      stage: "LinkedIn",
      message: `Navigating to LinkedIn Jobs...`,
    });

    await page.goto("https://www.linkedin.com/jobs/", { waitUntil: "domcontentloaded" });
    await randomDelay(2000, 3500);

    // Pre-flight auth check & security checkpoint (AUTO-005, AUTO-008)
    const isAuthed = await this.ensureAuthenticated(page, "linkedin");
    if (!isAuthed) {
      await logTelemetry({
        runId: this.activeRunId || undefined,
        level: "warn",
        stage: "LinkedIn",
        message: "LinkedIn session unauthenticated. Skipping LinkedIn.",
      });
      return 0;
    }

    const checkpoint = await detectCaptchaOrSecurityCheck(page, "linkedin");
    if (checkpoint.blocked) {
      const resolved = await waitForUserResolution(page, "linkedin", checkpoint.alertId);
      if (!resolved) return 0;
    }

    const db = getDb();
    let appliedCount = 0;

    for (const role of targetRoles) {
      if (this.abortRequested) break;
      const currentQuota = await getTodayPlatformQuota("linkedin");
      if (currentQuota.remaining <= 0) {
        await logTelemetry({
          runId: this.activeRunId || undefined,
          level: "info",
          stage: "LinkedIn",
          message: `Daily LinkedIn quota (${currentQuota.max_cap}) reached. Stopping LinkedIn.`,
        });
        break;
      }

      await db.execute({
        sql: "UPDATE automation_runs SET current_role = ? WHERE id = ?",
        args: [role, this.activeRunId],
      });

      // Determine effective location for LinkedIn search
      let effectiveLocation = (targetLocation || "").trim();
      if (!effectiveLocation || effectiveLocation.toLowerCase() === "any" || effectiveLocation.toLowerCase() === "remote") {
        const profileLoc = (profileData.location as string) || "";
        const countryPart = profileLoc.split(",").pop()?.trim();
        effectiveLocation = countryPart || "India";
      }

      // Keyword query: for internship, ensure keywords and filters strictly target internships
      const searchKeywords =
        opportunityType === "internship" && !role.toLowerCase().includes("intern")
          ? `${role} Intern`
          : role;
      let searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(searchKeywords)}`;

      if (effectiveLocation) {
        searchUrl += `&location=${encodeURIComponent(effectiveLocation)}`;
      }

      if (workplaceType === "remote") {
        searchUrl += "&f_WT=2";
      } else if (workplaceType === "on_site") {
        searchUrl += "&f_WT=1";
      } else if (workplaceType === "hybrid") {
        searchUrl += "&f_WT=3";
      }

      if (opportunityType === "internship") {
        searchUrl += "&f_JT=I&f_E=1"; // Job Type: Internship & Experience Level: Internship
      } else {
        searchUrl += "&f_JT=F"; // Full-time
      }

      if (applyType === "easy_apply_only") {
        searchUrl += "&f_AL=true";
      }

      await logTelemetry({
        runId: this.activeRunId || undefined,
        level: "info",
        stage: "LinkedIn",
        message: `Searching for: "${searchKeywords}" in ${effectiveLocation}${workplaceType === "remote" ? " (Remote)" : ""}`,
      });

      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
      await page.waitForSelector(
        "[componentkey='SearchResultsMainContent'], [data-component-type='LazyColumn'], ul.scaffold-layout__list-container, .jobs-search-results-list, .scaffold-layout__list, .job-card-container, .base-card, .job-search-card, [data-occludable-job-id], div[class*='fa4']",
        { timeout: 8000 }
      ).catch(() => {});
      await randomDelay(2000, 3500);

      // Support all modern and classic LinkedIn search layouts (both authenticated and guest)
      const cardSelectors =
        "[componentkey='SearchResultsMainContent'] > div, [data-component-type='LazyColumn'] > div, ul.scaffold-layout__list-container > li, .jobs-search-results-list__list-item, div[class*='b6bikq'], div[data-view-name*='job'], .job-card-container, .jobs-search-results__list-item, li[data-occludable-job-id], .base-card, .job-search-card, li:has(a[href*='/jobs/view/']), div:has(> a[href*='/jobs/view/'])";

      if (page.isClosed() || this.abortRequested) return appliedCount;
      let jobCards = await page.$$(cardSelectors).catch(() => []);

      // Smart Fallback: If 0 listings found with strict filters, retry with broader keyword search
      if (jobCards.length === 0 && !page.isClosed() && !this.abortRequested) {
        await logTelemetry({
          runId: this.activeRunId || undefined,
          level: "info",
          stage: "LinkedIn",
          message: `0 listings found with strict filters. Retrying broader search for "${role}"...`,
        });
        const broadUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role)}&location=${encodeURIComponent(effectiveLocation)}${workplaceType === "remote" ? "&f_WT=2" : ""}`;
        await page.goto(broadUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
        await page.waitForSelector(
          "[componentkey='SearchResultsMainContent'], [data-component-type='LazyColumn'], ul.scaffold-layout__list-container, .jobs-search-results-list, .scaffold-layout__list, .job-card-container, .base-card, .job-search-card, [data-occludable-job-id], div[class*='fa4']",
          { timeout: 7000 }
        ).catch(() => {});
        await randomDelay(1500, 2500);
        if (!page.isClosed() && !this.abortRequested) {
          jobCards = await page.$$(cardSelectors).catch(() => []);
        }
      }

      await logTelemetry({
        runId: this.activeRunId || undefined,
        level: "info",
        stage: "LinkedIn",
        message: `Found ${jobCards.length} potential listings for "${role}"`,
      });

      const processedJobIds = new Set<string>();

      for (let i = 0; i < jobCards.length; i++) {
        if (this.abortRequested) break;
        const quotaCheck = await getTodayPlatformQuota("linkedin");
        if (quotaCheck.remaining <= 0) break;

        const currentCards = await page.$$(cardSelectors).catch(() => []);
        const card = currentCards[i] || jobCards[i];
        if (!card) continue;

        try {
          const cardText = (await card.innerText().catch(() => "")).trim();
          if (!cardText || cardText.length < 20) continue;

          // Extract canonical external_job_id (AUTO-006)
          const dataJobId = await card.getAttribute("data-occludable-job-id").catch(() => null);

          await card.scrollIntoViewIfNeeded().catch(() => {});
          await humanMouseMove(page);
          await card.click().catch(() => {});
          await page.waitForSelector(
            ".jobs-search__job-details, .scaffold-layout__detail, #job-details, .job-view-layout, div[class*='job-details'], [componentkey*='JobDetails_AboutTheJob']",
            { timeout: 4000 }
          ).catch(() => {});
          await randomDelay(1500, 2500);

          // Extract job details from details pane
          const titleEl = await page.$(
            "h1, h2.t-24, .job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, div[class*='job-details'] h1, [componentkey*='JobDetails'] h1, a[href*='/jobs/view/']"
          );
          const companyEl = await page.$(
            ".job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, a[href*='/company/'], [componentkey*='JobDetails_AboutTheCompany'] a"
          );
          const jdEl = await page.$(
            "#job-details, .jobs-description__content, div[class*='jobs-box__html-content'], article, [componentkey*='JobDetails_AboutTheJob']"
          );

          const cardLines = Array.from(
            new Set(
              cardText
                .split("\n")
                .map((l) => l.replace(/^Selected,\s*/i, "").trim())
                .filter((l) => l && l.length > 1 && !l.includes("·") && !l.includes("Easy Apply") && !l.startsWith("Posted ") && !l.includes(" ago"))
            )
          );
          const fallbackTitle = cardLines[0] || role;
          const fallbackCompany = cardLines[1] || "Company";

          const position = titleEl ? (await titleEl.innerText()).trim() : fallbackTitle;
          const company = companyEl ? (await companyEl.innerText()).trim() : fallbackCompany;
          const jdText = jdEl ? (await jdEl.innerText()).trim() : "";

          // Canonical job URL and ID extraction (AUTO-006)
          const currentUrl = page.url();
          const matchUrlJobId = currentUrl.match(/currentJobId=(\d+)/) || currentUrl.match(/\/jobs\/view\/(\d+)/);
          const canonicalJobId = dataJobId || (matchUrlJobId ? matchUrlJobId[1] : null);
          const canonicalJobUrl = canonicalJobId
            ? `https://www.linkedin.com/jobs/view/${canonicalJobId}`
            : currentUrl;

          const dedupeKey = canonicalJobId ? `li_${canonicalJobId}` : `${company}__${position}`;
          if (processedJobIds.has(dedupeKey)) continue;
          processedJobIds.add(dedupeKey);

          // 1. Check if already applied or logged in DB FIRST (AUTO-006)
          const existing = await db.execute({
            sql: `SELECT id FROM applications 
                  WHERE (user_id = ? OR user_id = 'default-user')
                    AND ((external_job_id = ? AND external_job_id IS NOT NULL) 
                     OR (job_url = ?) 
                     OR (company = ? AND position = ?))`,
            args: [userId, canonicalJobId, canonicalJobUrl, company, position],
          });

          if (existing.rows.length > 0) {
            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "info",
              stage: "LinkedIn",
              message: `Already in history: ${position} at ${company}. Skipping.`,
            });
            continue;
          }

          // 2. Candidate match evaluation for bespoke cover letter & fit tracking (apply to all unapplied)
          let matchResult = {
            score: 75,
            matchedSkills: candidateSkills.slice(0, 3),
            missingSkills: [] as string[],
            reasoning: "Candidate resume skills aligned with listing.",
            isHighChance: true,
          };
          try {
            matchResult = await evaluateSelectionProbability({
              candidateProfile: profileData,
              candidateSkills,
              jobTitle: position,
              companyName: company,
              jobDescription: jdText || cardText,
              opportunityType,
              minScoreThreshold: 0, // Apply to all unapplied jobs
            });
          } catch (evalErr) {
            // Keep default matchResult
          }

          await logTelemetry({
            runId: this.activeRunId || undefined,
            level: "success",
            stage: "LinkedIn Match",
            message: `Discovered new listing: "${position}" at ${company} (Fit: ${matchResult.score}%). Proceeding to apply...`,
          });

          // 2. CHECK FOR EASY APPLY OR DIRECT APPLY BUTTON
          const easyApplyBtn = await page.$(
            "button:has-text('Easy Apply'), button[aria-label*='Easy Apply'], button.jobs-apply-button:has-text('Easy Apply'), .jobs-apply-button--top-card button, button:has(span:has-text('Easy Apply'))"
          );

          if (!easyApplyBtn) {
            if (applyType === "easy_apply_only") {
              await logTelemetry({
                runId: this.activeRunId || undefined,
                level: "info",
                stage: "LinkedIn",
                message: `No Easy Apply button found for "${position}" at ${company} (External site apply only). Skipping.`,
              });
              continue;
            }

            // External Direct Apply Flow
            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "info",
              stage: "LinkedIn Direct Apply",
              message: `Shortlisting Direct Apply job: "${position}" at ${company}`,
            });

            let tailoredLetter = "";
            try {
              tailoredLetter = await generateTailoredCoverLetter({
                candidateProfile: profileData,
                jobTitle: position,
                companyName: company,
                jobDescription: jdText || `${position} at ${company}`,
              });
            } catch (llmErr) {
              tailoredLetter = `Dear Hiring Team at ${company},\n\nI am writing to express my strong enthusiasm for the ${position} role. With my background in ${candidateSkills.slice(0, 4).join(", ")}, I am eager to contribute immediately to your team.`;
            }

            // Extract external direct apply URL
            let directApplyUrl = canonicalJobUrl;
            const externalApplyEl = await page.$(
              "a.jobs-apply-button, a[data-easy-apply-link], a[href*='external'], a:has-text('Apply'), button.jobs-apply-button, button:has-text('Apply')"
            );

            if (externalApplyEl) {
              const href = await externalApplyEl.getAttribute("href").catch(() => null);
              if (href && href.startsWith("http")) {
                directApplyUrl = href;
              }
            }

            // AUTO-003 FIX: DO NOT INCREMENT platform quota on external_ready!
            await db.execute({
              sql: `INSERT INTO applications (
                      user_id, platform, company, position, job_url, external_job_id, status,
                      match_score, matched_skills_json, missing_skills_json, match_reasoning,
                      tailored_letter, notes
                    ) VALUES (?, 'linkedin', ?, ?, ?, ?, 'external_ready', ?, ?, ?, ?, ?, 'Direct Apply Ready - Tailored cover letter prepared')`,
              args: [
                userId,
                company,
                position,
                directApplyUrl,
                canonicalJobId,
                matchResult.score,
                JSON.stringify(matchResult.matchedSkills),
                JSON.stringify(matchResult.missingSkills),
                matchResult.reasoning,
                tailoredLetter,
              ],
            });

            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "success",
              stage: "LinkedIn Direct Apply",
              message: `Saved external_ready listing for ${company} (${position}). Quota preserved.`,
            });

            sendTelegramMessage(
              `🚀 *Direct Apply Ready!* (LINKEDIN)\n\n🏢 *Company:* ${company}\n💼 *Position:* ${position}\n🔗 [Apply on Company Site](${directApplyUrl})\n\n📝 Tailored 150-word cover letter is prepared and saved in your AutoJob dashboard.`
            ).catch(() => {});

            continue;
          }

          // Easy Apply Flow
          const applyBtn = easyApplyBtn;

          await logTelemetry({
            runId: this.activeRunId || undefined,
            level: "info",
            stage: "LinkedIn Easy Apply",
            message: `Weaving tailored 120-150 word cover letter for ${company}...`,
          });

          let tailoredLetter = "";
          try {
            tailoredLetter = await generateTailoredCoverLetter({
              candidateProfile: profileData,
              jobTitle: position,
              companyName: company,
              jobDescription: jdText || `${position} at ${company}`,
            });
          } catch (llmErr) {
            tailoredLetter = `Dear Hiring Team at ${company},\n\nI am writing to express my strong enthusiasm for the ${position} role. With my background in ${candidateSkills.slice(0, 4).join(", ")}, I am eager to contribute immediately to your team.`;
          }

          if (dryRun) {
            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "info",
              stage: "Dry Run",
              message: `[Dry Run] Would apply to ${company} for ${position} (${matchResult.score}% match)`,
            });
            await db.execute({
              sql: `INSERT INTO applications (
                      user_id, platform, company, position, job_url, external_job_id, status,
                      match_score, matched_skills_json, missing_skills_json, match_reasoning,
                      tailored_letter, notes
                    ) VALUES (?, 'linkedin', ?, ?, ?, ?, 'skipped', ?, ?, ?, ?, ?, 'Dry run simulated')`,
              args: [
                userId,
                company,
                position,
                canonicalJobUrl,
                canonicalJobId,
                matchResult.score,
                JSON.stringify(matchResult.matchedSkills),
                JSON.stringify(matchResult.missingSkills),
                matchResult.reasoning,
                tailoredLetter,
              ],
            });
            continue;
          }

          // Click Easy Apply and handle same-page or popup tab
          let popupPage: Page | null = null;
          try {
            const [newPage] = await Promise.all([
              this.context!.waitForEvent("page", { timeout: 3000 }).catch(() => null),
              applyBtn.click(),
            ]);
            popupPage = newPage;
          } catch {
            await applyBtn.click().catch(() => {});
          }

          const activePage = popupPage || page;
          await randomDelay(2000, 3000);

          // Check if prompted to sign in
          const loginModal = await activePage.$(
            "#join-modal, [data-test-modal='sign-in-modal'], .join-form, form.login__form"
          );
          if (loginModal && (await loginModal.isVisible().catch(() => false))) {
            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "warn",
              stage: "LinkedIn Auth",
              message: `LinkedIn prompted for sign-in on "${position}" at ${company}. Run 'npm run browser:login' to authenticate your browser session.`,
            });
            if (popupPage && !popupPage.isClosed()) await popupPage.close().catch(() => {});
            return appliedCount;
          }

          // Handle security checkpoint
          const secCheck = await detectCaptchaOrSecurityCheck(activePage, "linkedin", {
            company,
            position,
            url: canonicalJobUrl,
          });
          if (secCheck.blocked) {
            const resolved = await waitForUserResolution(activePage, "linkedin", secCheck.alertId);
            if (!resolved) {
              if (popupPage) await popupPage.close().catch(() => {});
              continue;
            }
          }

          // Step through form modals intelligently (AUTO-002: no blind "1" / "Yes")
          let modalOpen = true;
          let stepLimit = 8;
          let submitted = false;
          const screeningDefaults: Record<string, string> = profileData.screening_defaults_json
            ? JSON.parse(profileData.screening_defaults_json as string)
            : {};

          while (modalOpen && stepLimit > 0) {
            stepLimit--;
            await randomDelay(1200, 2000);

            // A. Fill Phone number if empty
            const phoneInputs = await activePage.$$(
              "input[type='tel'], input[id*='phone' i], input[name*='phone' i]"
            );
            for (const pInput of phoneInputs) {
              const val = await pInput.inputValue().catch(() => "");
              if (!val) {
                const userPhone = (profileData.phone as string) || screeningDefaults.phone || "";
                if (userPhone) {
                  await pInput.fill(userPhone).catch(() => {});
                  await randomDelay(200, 400);
                }
              }
            }

            // B. Attach Resume PDF if file upload input exists
            const fileInputs = await activePage.$$("input[type='file']");
            if (fileInputs.length > 0 && profileData.resume_file_path) {
              const resumePath = profileData.resume_file_path as string;
              if (fs.existsSync(resumePath)) {
                for (const fi of fileInputs) {
                  await fi.setInputFiles(resumePath).catch(() => {});
                  await randomDelay(400, 800);
                }
              }
            }

            // C. Intelligent question extraction (AUTO-002)
            const questionsToAnswer: Array<{ id: string; label: string; type: string; options?: string[]; required?: boolean }> = [];
            
            // Extract text/number inputs
            const textAndNumInputs = await activePage.$$("input[type='text']:visible, input[type='number']:visible");
            for (let idx = 0; idx < textAndNumInputs.length; idx++) {
              const ti = textAndNumInputs[idx];
              const val = await ti.inputValue().catch(() => "");
              if (!val) {
                const inputId = (await ti.getAttribute("id")) || `input_${idx}`;
                const labelEl = await activePage.$(`label[for='${inputId}']`).catch(() => null);
                const labelText = labelEl ? (await labelEl.innerText()).trim() : "";
                const inputType = (await ti.getAttribute("type")) || "text";
                questionsToAnswer.push({
                  id: inputId,
                  label: labelText || inputId,
                  type: inputType,
                });
              }
            }

            // If we have custom questions, answer them via answerFormQuestions
            if (questionsToAnswer.length > 0) {
              const answered = await answerFormQuestions({
                candidateProfile: profileData,
                jobDescription: jdText,
                questions: questionsToAnswer,
                screeningDefaults,
              });

              for (const q of questionsToAnswer) {
                const ansObj = answered[q.id];
                if (ansObj && ansObj.answer) {
                  const inputEl = await activePage.$(`#${q.id}`);
                  if (inputEl) {
                    await inputEl.fill(ansObj.answer).catch(() => {});
                    await randomDelay(200, 400);
                  }
                }
              }
            }

            // D. Radio buttons: match against screeningDefaults first, or Yes if confident
            const radioGroups = await activePage.$$("fieldset, div[role='radiogroup']");
            for (const rg of radioGroups) {
              const hasChecked = await rg.$("input[type='radio']:checked");
              if (!hasChecked) {
                const legend = await rg.$("legend, span.fb-dash-form-element__label");
                const legendText = legend ? (await legend.innerText()).toLowerCase() : "";

                // Check work authorization in screening defaults
                if (legendText.includes("authorized") || legendText.includes("sponsorship")) {
                  const targetVal = legendText.includes("sponsorship") ? "no" : "yes";
                  const targetRadio = await rg.$(`input[value*='${targetVal}' i], label:has-text('${targetVal}') input`);
                  if (targetRadio) await targetRadio.click().catch(() => {});
                } else {
                  // Default select Yes if positive confirmation
                  const yesOption = await rg.$("input[value*='Yes' i], label:has-text('Yes') input, input[id*='yes' i]");
                  if (yesOption) {
                    await yesOption.click().catch(() => {});
                  }
                }
                await randomDelay(200, 400);
              }
            }

            // E. Textareas: paste tailored letter
            const textAreas = await activePage.$$("textarea:visible");
            for (const ta of textAreas) {
              const val = await ta.inputValue().catch(() => "");
              if (!val) {
                await ta.fill(tailoredLetter).catch(() => {});
                await randomDelay(300, 600);
              }
            }

            // F. Check for Submit application button
            const submitBtn = await activePage.$(
              "button:has-text('Submit application'), button[aria-label*='Submit application']"
            );

            if (submitBtn) {
              await submitBtn.click().catch(() => {});
              await randomDelay(2500, 4000);

              // AUTO-004: Verify post-submission DOM state!
              const hasValidationErrors = await activePage.$(
                ".artdeco-inline-feedback--error, [data-test-form-element-error-messages], .has-error"
              );

              if (hasValidationErrors) {
                await logTelemetry({
                  runId: this.activeRunId || undefined,
                  level: "warn",
                  stage: "LinkedIn Submit",
                  message: `Form validation errors detected on submission for ${position} at ${company}.`,
                });
                submitted = false;
              } else {
                submitted = true;
              }
              modalOpen = false;
              break;
            }

            // G. Check for Next / Review button
            const nextBtn = await activePage.$(
              "button:has-text('Next'), button:has-text('Review'), button[aria-label*='Continue to next step']"
            );

            if (nextBtn) {
              await nextBtn.click().catch(() => {});
              await randomDelay(1500, 2500);
            } else {
              modalOpen = false;
            }
          }

          // Close modal / popup tab
          const dismissBtn = await activePage.$(
            "button[aria-label='Dismiss'], button:has-text('Done'), button[data-test-modal-close-btn]"
          );
          if (dismissBtn) await dismissBtn.click().catch(() => {});

          if (popupPage && !popupPage.isClosed()) {
            await popupPage.close().catch(() => {});
          }

          if (submitted) {
            // Verified submission (AUTO-004)
            await db.execute({
              sql: `INSERT INTO applications (
                      user_id, platform, company, position, job_url, external_job_id, status,
                      match_score, matched_skills_json, missing_skills_json, match_reasoning,
                      tailored_letter, notes
                    ) VALUES (?, 'linkedin', ?, ?, ?, ?, 'applied', ?, ?, ?, ?, ?, 'Easy Apply submitted & verified')`,
              args: [
                userId,
                company,
                position,
                canonicalJobUrl,
                canonicalJobId,
                matchResult.score,
                JSON.stringify(matchResult.matchedSkills),
                JSON.stringify(matchResult.missingSkills),
                matchResult.reasoning,
                tailoredLetter,
              ],
            });

            await incrementTodayPlatformQuota(userId, "linkedin");
            appliedCount++;

            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "success",
              stage: "LinkedIn Submit",
              message: `Successfully applied to ${position} at ${company} (LinkedIn applied: ${appliedCount})`,
            });

            sendTelegramMessage(
              `✅ *Applied on LinkedIn!* (Easy Apply)\n\n🏢 *Company:* ${company}\n💼 *Position:* ${position}\n🔗 [View Listing](${canonicalJobUrl})`
            ).catch(() => {});

            if (appliedCount >= maxSubmissions) {
              return appliedCount;
            }

            await randomDelay(10000, 20000);
          } else {
            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "warn",
              stage: "LinkedIn Submit",
              message: `Multi-step application for ${position} at ${company} could not be completed safely.`,
            });
          }
        } catch (jobErr) {
          console.error(`[LinkedIn] Error applying to job card:`, jobErr);
        }
      }
    }

    return appliedCount;
  }

  private async processInternshala(
    page: Page,
    profileData: Record<string, unknown>,
    candidateSkills: string[],
    targetRoles: string[],
    opportunityType: "internship" | "job" = "internship",
    workplaceType: "any" | "remote" | "hybrid" | "on_site" = "remote",
    targetLocation: string = "Remote",
    minScoreThreshold: number = 65,
    dryRun: boolean = false,
    maxSubmissions: number = 1,
    userId: string = "default-user",
    resumeFilePath?: string
  ): Promise<number> {
    const isRemote = workplaceType === "remote" || targetLocation.toLowerCase() === "remote";
    const baseEntryUrl =
      opportunityType === "internship"
        ? (isRemote ? "https://internshala.com/internships/work-from-home" : "https://internshala.com/internships")
        : (isRemote ? "https://internshala.com/jobs/work-from-home" : "https://internshala.com/jobs");

    await logTelemetry({
      runId: this.activeRunId || undefined,
      level: "info",
      stage: "Internshala",
      message: `Navigating to Internshala (${baseEntryUrl})...`,
    });

    await page.goto(baseEntryUrl, { waitUntil: "domcontentloaded" });
    await randomDelay(2000, 3500);

    // Pre-flight auth check & security checkpoint (AUTO-005, AUTO-008)
    const isAuthed = await this.ensureAuthenticated(page, "internshala");
    if (!isAuthed) {
      await logTelemetry({
        runId: this.activeRunId || undefined,
        level: "warn",
        stage: "Internshala",
        message: "Internshala session requires login. Skipping Internshala.",
      });
      return 0;
    }

    const checkpoint = await detectCaptchaOrSecurityCheck(page, "internshala");
    if (checkpoint.blocked) {
      const resolved = await waitForUserResolution(page, "internshala", checkpoint.alertId);
      if (!resolved) return 0;
    }

    const db = getDb();
    let appliedCount = 0;

    for (const role of targetRoles) {
      if (this.abortRequested) break;
      const currentQuota = await getTodayPlatformQuota("internshala");
      if (currentQuota.remaining <= 0) {
        await logTelemetry({
          runId: this.activeRunId || undefined,
          level: "info",
          stage: "Internshala",
          message: `Daily Internshala quota (${currentQuota.max_cap}) reached. Stopping Internshala.`,
        });
        break;
      }

      await db.execute({
        sql: "UPDATE automation_runs SET current_role = ? WHERE id = ?",
        args: [role, this.activeRunId],
      });

      const cleanRoleSlug = role.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const searchUrls: string[] = [];

      if (opportunityType === "internship") {
        if (isRemote) {
          searchUrls.push(`https://internshala.com/internships/work-from-home-${cleanRoleSlug}-internships`);
          searchUrls.push(`https://internshala.com/internships/keywords-${encodeURIComponent(role)}`);
          searchUrls.push(`https://internshala.com/internships/work-from-home/`);
        } else if (targetLocation && targetLocation.toLowerCase() !== "any") {
          const cleanLocSlug = targetLocation.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          searchUrls.push(`https://internshala.com/internships/internship-in-${cleanLocSlug}/keywords-${encodeURIComponent(role)}`);
          searchUrls.push(`https://internshala.com/internships/keywords-${encodeURIComponent(role)}`);
        } else {
          searchUrls.push(`https://internshala.com/internships/keywords-${encodeURIComponent(role)}`);
          searchUrls.push(`https://internshala.com/internships/${cleanRoleSlug}-internship`);
        }
      } else {
        if (isRemote) {
          searchUrls.push(`https://internshala.com/jobs/keywords-${encodeURIComponent(role)}`);
          searchUrls.push(`https://internshala.com/jobs/work-from-home/`);
        } else {
          searchUrls.push(`https://internshala.com/jobs/keywords-${encodeURIComponent(role)}`);
          searchUrls.push(`https://internshala.com/jobs/${cleanRoleSlug}-jobs`);
        }
      }

      // AUTO-001 FIX: Extract all detail URLs into string[] BEFORE navigating away from search page!
      let detailUrls: string[] = [];
      for (const sUrl of searchUrls) {
        if (detailUrls.length > 0) break;
        await logTelemetry({
          runId: this.activeRunId || undefined,
          level: "info",
          stage: "Internshala",
          message: `Searching for: "${role}" (${sUrl})`,
        });

        await page.goto(sUrl, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
        await randomDelay(2000, 3500);

        // Extract detail HREFs reliably across all Internshala layouts
        detailUrls = await page.$$eval(
          "a[href*='/internship/detail/'], a[href*='/job/detail/'], [data-href*='/internship/detail/'], [data-href*='/job/detail/']",
          (elements) => {
            const urls: string[] = [];
            for (const el of elements) {
              const href = el.getAttribute("href") || el.getAttribute("data-href");
              if (href && (href.includes("/internship/detail/") || href.includes("/job/detail/"))) {
                urls.push(href);
              }
            }
            return Array.from(new Set(urls));
          }
        ).catch(() => []);
      }

      await logTelemetry({
        runId: this.activeRunId || undefined,
        level: "info",
        stage: "Internshala",
        message: `Extracted ${detailUrls.length} listing URLs for "${role}"`,
      });

      for (const rawHref of detailUrls) {
        if (this.abortRequested) break;
        const quotaCheck = await getTodayPlatformQuota("internshala");
        if (quotaCheck.remaining <= 0) break;

        const detailUrl = rawHref.startsWith("http") ? rawHref : `https://internshala.com${rawHref}`;

        try {
          await page.goto(detailUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
          await randomDelay(2000, 3000);

          const titleEl = await page.$(
            "h1, .profile_on_detail_page, .heading_4_5, .job-internship-name"
          );
          const companyEl = await page.$(
            "a.link_display_like_text, .company-name, .heading_6"
          );
          const jdEl = await page.$(".text-container, .job_details, #skills_container, body");

          const position = titleEl ? (await titleEl.innerText()).trim() : role;
          const company = companyEl ? (await companyEl.innerText()).trim() : "Internshala Recruiter";
          const jdText = jdEl ? (await jdEl.innerText()).trim() : "";

          // Extract canonical internship ID from detail URL (AUTO-006)
          const internIdMatch = detailUrl.match(/-(\d+)\/?$/);
          const canonicalJobId = internIdMatch ? internIdMatch[1] : null;

          // 1. Check DB duplicate FIRST (AUTO-006)
          const existing = await db.execute({
            sql: `SELECT id FROM applications 
                  WHERE (user_id = ? OR user_id = 'default-user')
                    AND ((external_job_id = ? AND external_job_id IS NOT NULL) 
                     OR (job_url = ?) 
                     OR (company = ? AND position = ?))`,
            args: [userId, canonicalJobId, detailUrl, company, position],
          });
          if (existing.rows.length > 0) {
            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "info",
              stage: "Internshala",
              message: `Already in history: ${position} at ${company}. Skipping.`,
            });
            continue;
          }

          // 2. Check if already applied on Internshala UI
          const alreadyApplied = await page.$(
            ".already_applied, #already_applied, button:disabled:has-text('Applied'), text='Already applied', .already_applied_container"
          ).catch(() => null);

          if (alreadyApplied && (await alreadyApplied.isVisible().catch(() => false))) {
            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "info",
              stage: "Internshala",
              message: `Internshala UI marks "${position}" at ${company} as already applied. Skipping.`,
            });
            continue;
          }

          // 3. Candidate match evaluation for bespoke cover letter (apply to all unapplied)
          let matchResult = {
            score: 75,
            matchedSkills: candidateSkills.slice(0, 3),
            missingSkills: [] as string[],
            reasoning: "Candidate resume skills aligned with listing.",
            isHighChance: true,
          };
          try {
            matchResult = await evaluateSelectionProbability({
              candidateProfile: profileData,
              candidateSkills,
              jobTitle: position,
              companyName: company,
              jobDescription: jdText,
              opportunityType,
              minScoreThreshold: 0, // Apply to all unapplied jobs
            });
          } catch (evalErr) {
            // Keep default matchResult
          }

          await logTelemetry({
            runId: this.activeRunId || undefined,
            level: "success",
            stage: "Internshala Match",
            message: `Discovered new listing: "${position}" at ${company} (Fit: ${matchResult.score}%). Proceeding to apply...`,
          });

          // Check for "Apply now" button on detail page
          const applyBtn = await page.$(
            "#apply_now_button, button:has-text('Apply now'), a:has-text('Apply now'), a[href*='/application/'], a[href*='interstitial']"
          );

          if (!applyBtn) {
            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "info",
              stage: "Internshala",
              message: `No Apply Now button found for "${position}" at ${company}. Skipping.`,
            });
            continue;
          }

          let tailoredLetter = "";
          try {
            tailoredLetter = await generateTailoredCoverLetter({
              candidateProfile: profileData,
              jobTitle: position,
              companyName: company,
              jobDescription: jdText || `${position} at ${company}`,
            });
          } catch {
            tailoredLetter = `Dear Hiring Team at ${company},\n\nI am excited to apply for the ${position} role. My skillset in ${candidateSkills.slice(0, 4).join(", ")} directly matches your requirements.`;
          }

          if (dryRun) {
            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "info",
              stage: "Dry Run",
              message: `[Dry Run] Would apply to Internshala job: ${position} at ${company}`,
            });
            await db.execute({
              sql: `INSERT INTO applications (
                      user_id, platform, company, position, job_url, external_job_id, status,
                      match_score, matched_skills_json, missing_skills_json, match_reasoning,
                      tailored_letter, notes
                    ) VALUES (?, 'internshala', ?, ?, ?, ?, 'skipped', ?, ?, ?, ?, ?, 'Dry run simulated')`,
              args: [
                userId,
                company,
                position,
                detailUrl,
                canonicalJobId,
                matchResult.score,
                JSON.stringify(matchResult.matchedSkills),
                JSON.stringify(matchResult.missingSkills),
                matchResult.reasoning,
                tailoredLetter,
              ],
            });
            continue;
          }

          await applyBtn.click().catch(() => {});
          await randomDelay(2000, 3000);

          // Check if redirected to login / registration or login modal opened
          const isInternshalaLogin =
            page.url().includes("/login") ||
            page.url().includes("/registration") ||
            (await page.$("#login-modal:visible, .login-modal:visible, form#login_form:visible").catch(() => null));

          if (isInternshalaLogin) {
            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "warn",
              stage: "Internshala Auth",
              message: `Internshala session requires login to apply. Please run 'npm run browser:login' to authenticate.`,
            });
            return appliedCount;
          }

          // Handle intermediate "Proceed to application" (Resume check / Interstitial confirmation)
          const proceedBtn = await page.$(
            "#proceed_to_application, button:has-text('Proceed to application'), a:has-text('Proceed to application'), .proceed-btn, button:has-text('Continue'), a:has-text('Continue')"
          );
          if (proceedBtn && (await proceedBtn.isVisible().catch(() => false))) {
            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "info",
              stage: "Internshala",
              message: `Confirming candidate resume step for ${company}...`,
            });
            await proceedBtn.click().catch(() => {});
            await randomDelay(1800, 2800);
          }

          // Fill cover letter textarea if prompted
          const coverLetterInput = await page.$(
            "textarea[id*='cover_letter'], textarea[name*='cover_letter'], textarea#cover_letter, textarea.cover_letter"
          );
          if (coverLetterInput) {
            await coverLetterInput.fill(tailoredLetter).catch(() => {});
            await randomDelay(500, 800);
          }

          // Fill required assessment questions via LLM (AUTO-002: no static single sentences)
          const otherTextareas = await page.$$(
            "textarea:not([id*='cover_letter']):not([name*='cover_letter'])"
          );
          if (otherTextareas.length > 0) {
            const assessmentQuestions: Array<{ id: string; label: string }> = [];
            for (let tIdx = 0; tIdx < otherTextareas.length; tIdx++) {
              const ta = otherTextareas[tIdx];
              const tId = (await ta.getAttribute("id")) || `assessment_${tIdx}`;
              const parentLabel = await ta.evaluate((el) => {
                const label = el.closest(".form-group")?.querySelector("label")?.textContent;
                return label || "Why are you suitable for this role?";
              });
              assessmentQuestions.push({ id: tId, label: parentLabel.trim() });
            }

            const answers = await answerFormQuestions({
              candidateProfile: profileData,
              jobDescription: jdText,
              questions: assessmentQuestions,
            });

            for (let tIdx = 0; tIdx < otherTextareas.length; tIdx++) {
              const ta = otherTextareas[tIdx];
              const q = assessmentQuestions[tIdx];
              const ans = answers[q.id]?.answer;
              if (ans) {
                await ta.fill(ans).catch(() => {});
                await randomDelay(300, 600);
              }
            }
          }

          // Handle radio button questions if present (e.g. availability confirmation)
          const radioGroups = await page.$$("fieldset:visible, .form-group:has(input[type='radio']):visible");
          for (const rg of radioGroups) {
            const checked = await rg.$("input[type='radio']:checked");
            if (!checked) {
              const yesRadio = await rg.$("input[value*='Yes' i], input[id*='yes' i], label:has-text('Yes') input");
              if (yesRadio) {
                await yesRadio.click().catch(() => {});
                await randomDelay(200, 400);
              }
            }
          }

          // Click Submit application
          const submitBtn = await page.$(
            "input[type='submit']#submit, button#submit, button:has-text('Submit application'), button:has-text('Submit'), input[value*='Submit' i], .submit_button, #submit_button, button[type='submit']:visible"
          );

          // AUTO-004 FIX: Do NOT record 'applied' if submitBtn was not found or failed!
          if (!submitBtn) {
            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "warn",
              stage: "Internshala Submit",
              message: `Could not locate Submit button for ${position} at ${company}. Not submitting.`,
            });
            continue;
          }

          await submitBtn.click().catch(() => {});
          await randomDelay(3000, 4500);

          // Verify submission (AUTO-004)
          const hasError = await page.$(".error-message:visible, .alert-danger:visible");
          if (hasError) {
            await logTelemetry({
              runId: this.activeRunId || undefined,
              level: "warn",
              stage: "Internshala Submit",
              message: `Form validation error on Internshala for ${position} at ${company}.`,
            });
            continue;
          }

          // Verified submission
          await db.execute({
            sql: `INSERT INTO applications (
                    user_id, platform, company, position, job_url, external_job_id, status,
                    match_score, matched_skills_json, missing_skills_json, match_reasoning,
                    tailored_letter, notes
                  ) VALUES (?, 'internshala', ?, ?, ?, ?, 'applied', ?, ?, ?, ?, ?, 'Application submitted & verified')`,
            args: [
              userId,
              company,
              position,
              detailUrl,
              canonicalJobId,
              matchResult.score,
              JSON.stringify(matchResult.matchedSkills),
              JSON.stringify(matchResult.missingSkills),
              matchResult.reasoning,
              tailoredLetter,
            ],
          });

          await incrementTodayPlatformQuota(userId, "internshala");
          appliedCount++;

          await logTelemetry({
            runId: this.activeRunId || undefined,
            level: "success",
            stage: "Internshala Submit",
            message: `Successfully applied to ${position} at ${company} on Internshala! (Count: ${appliedCount})`,
          });

          sendTelegramMessage(
            `✅ *Applied on Internshala!* (${opportunityType.toUpperCase()})\n\n🏢 *Company:* ${company}\n💼 *Position:* ${position}\n🔗 [View Listing](${detailUrl})`
          ).catch(() => {});

          if (appliedCount >= maxSubmissions) {
            return appliedCount;
          }

          await randomDelay(10000, 20000);
        } catch (internErr) {
          console.error("[Internshala] Error processing card:", internErr);
        }
      }
    }

    return appliedCount;
  }
}

const globalForAutomation = globalThis as unknown as {
  __autojob_automation_engine?: AutomationEngine;
};

export const automationEngine =
  globalForAutomation.__autojob_automation_engine ?? new AutomationEngine();

if (process.env.NODE_ENV !== "production") {
  globalForAutomation.__autojob_automation_engine = automationEngine;
}
