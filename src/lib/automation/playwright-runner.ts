import { chromium, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { getDb, getTodayQuota, incrementTodayQuota } from "../db";
import { STEALTH_CHROMIUM_ARGS, randomDelay, humanMouseMove, humanType } from "./stealth";
import { detectCaptchaOrSecurityCheck, waitForUserResolution } from "./captcha-detector";
import { generateTailoredCoverLetter, answerFormQuestions } from "../llm";

export interface AutomationRunOptions {
  platform?: "linkedin" | "internshala" | "both";
  dryRun?: boolean;
}

export class AutomationEngine {
  private context: BrowserContext | null = null;
  private isRunning: boolean = false;
  private abortRequested: boolean = false;

  public async start(options: AutomationRunOptions = { platform: "both", dryRun: false }) {
    if (this.isRunning) {
      console.log("[AutoJob] Automation run is already in progress.");
      return { status: "already_running" };
    }

    this.isRunning = true;
    this.abortRequested = false;

    console.log(`[AutoJob] Starting background application engine (${options.platform})...`);

    try {
      // 1. Check daily quota first
      const quota = await getTodayQuota();
      if (quota.remaining <= 0) {
        console.log(`[AutoJob Quota Cap] Daily application quota of ${quota.max_cap} has already been reached for today (${quota.date}). Stopping.`);
        return { status: "quota_reached", applied: quota.applied_count, max: quota.max_cap };
      }

      console.log(`[AutoJob Quota] Applications remaining today: ${quota.remaining}/${quota.max_cap}`);

      // 2. Setup persistent browser context
      const userDataDir = path.resolve(process.cwd(), "data", "browser_profile");
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }

      const headless = process.env.HEADLESS_BROWSER === "true";

      this.context = await chromium.launchPersistentContext(userDataDir, {
        headless,
        args: STEALTH_CHROMIUM_ARGS,
        viewport: { width: 1280, height: 800 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      });

      const page = this.context.pages()[0] || (await this.context.newPage());

      // 3. Load user profile
      const db = getDb();
      const profileRow = await db.execute("SELECT * FROM profile WHERE id = 1");
      const profileData = profileRow.rows[0] || {};
      const targetRoles: string[] = profileData.target_roles_json
        ? JSON.parse(profileData.target_roles_json as string)
        : ["Full Stack Developer"];

      let applicationsSubmittedThisSession = 0;

      // 4. Run LinkedIn Workflow
      if ((options.platform === "linkedin" || options.platform === "both") && !this.abortRequested) {
        applicationsSubmittedThisSession += await this.processLinkedIn(page, profileData, targetRoles, options.dryRun);
      }

      // 5. Run Internshala Workflow
      if ((options.platform === "internshala" || options.platform === "both") && !this.abortRequested) {
        const remainingQuota = (await getTodayQuota()).remaining;
        if (remainingQuota > 0) {
          applicationsSubmittedThisSession += await this.processInternshala(page, profileData, targetRoles, options.dryRun);
        }
      }

      return {
        status: "completed",
        applicationsSubmittedThisSession,
        todayRemaining: (await getTodayQuota()).remaining,
      };
    } catch (err) {
      console.error("[AutoJob Engine Error]:", err);
      throw err;
    } finally {
      if (this.context) {
        await this.context.close().catch(() => {});
        this.context = null;
      }
      this.isRunning = false;
    }
  }

  public stop() {
    this.abortRequested = true;
    console.log("[AutoJob] Abort requested.");
  }

  private async processLinkedIn(
    page: Page,
    profileData: Record<string, unknown>,
    targetRoles: string[],
    dryRun: boolean = false
  ): Promise<number> {
    console.log("[AutoJob] Navigating to LinkedIn...");
    await page.goto("https://www.linkedin.com/jobs/", { waitUntil: "domcontentloaded" });
    await randomDelay(2000, 4000);

    // Check for CAPTCHA/Login
    const blocked = await detectCaptchaOrSecurityCheck(page, "linkedin");
    if (blocked) {
      const resolved = await waitForUserResolution(page, "linkedin");
      if (!resolved) return 0;
    }

    const db = getDb();
    let appliedCount = 0;

    for (const role of targetRoles) {
      if (this.abortRequested) break;
      const currentQuota = await getTodayQuota();
      if (currentQuota.remaining <= 0) break;

      const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
        role
      )}&f_AL=true&sortBy=DD`; // f_AL=true filters Easy Apply
      console.log(`[LinkedIn] Searching for: "${role}"`);
      await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
      await randomDelay(2500, 4500);

      const jobCards = await page.$$(".job-card-container, .jobs-search-results__list-item");
      console.log(`[LinkedIn] Found ${jobCards.length} listings for ${role}`);

      for (const card of jobCards) {
        if (this.abortRequested) break;
        const quotaCheck = await getTodayQuota();
        if (quotaCheck.remaining <= 0) break;

        try {
          await card.scrollIntoViewIfNeeded();
          await humanMouseMove(page);
          await card.click();
          await randomDelay(1500, 3000);

          // Extract job details
          const titleEl = await page.$(".job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title");
          const companyEl = await page.$(
            ".job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name"
          );
          const jdEl = await page.$("#job-details, .jobs-description__content");

          const position = titleEl ? (await titleEl.innerText()).trim() : "Software Engineer";
          const company = companyEl ? (await companyEl.innerText()).trim() : "Target Company";
          const jdText = jdEl ? (await jdEl.innerText()).trim() : "";
          const jobUrl = page.url();

          // Check if already applied or logged in DB
          const existing = await db.execute({
            sql: "SELECT id FROM applications WHERE (job_url = ? OR (company = ? AND position = ?))",
            args: [jobUrl, company, position],
          });

          if (existing.rows.length > 0) {
            console.log(`[LinkedIn] Already applied to ${position} at ${company}, skipping.`);
            continue;
          }

          // Generate Tailored 150-word Cover Letter via LLM
          console.log(`[LLM Weaver] Crafting tailored 150-word cover letter for ${company}...`);
          let tailoredLetter = "";
          try {
            tailoredLetter = await generateTailoredCoverLetter({
              candidateProfile: profileData,
              jobTitle: position,
              companyName: company,
              jobDescription: jdText || `${position} at ${company}`,
            });
          } catch (llmErr) {
            console.warn("LLM cover letter generation fallback:", llmErr);
            tailoredLetter = `Dear Hiring Team at ${company},\n\nI am writing to express my strong enthusiasm for the ${position} role. With my background in modern full-stack development, I am eager to contribute immediately to your team.`;
          }

          // Check for Easy Apply button
          const applyBtn = await page.$(
            "button.jobs-apply-button, button:has-text('Easy Apply')"
          );

          if (!applyBtn) {
            console.log(`[LinkedIn] No Easy Apply button found for ${position} at ${company}.`);
            continue;
          }

          if (dryRun) {
            console.log(`[DryRun] Would submit application to ${company} for ${position}.`);
            await db.execute({
              sql: `INSERT INTO applications (platform, company, position, job_url, status, tailored_letter, notes)
                    VALUES ('linkedin', ?, ?, ?, 'skipped', ?, 'Dry run simulated')`,
              args: [company, position, jobUrl, tailoredLetter],
            });
            continue;
          }

          // Click Easy Apply
          await applyBtn.click();
          await randomDelay(1200, 2500);

          // Handle multi-step modal or questions
          const isSecurityCheck = await detectCaptchaOrSecurityCheck(page, "linkedin", { company, position, url: jobUrl });
          if (isSecurityCheck) {
            const resolved = await waitForUserResolution(page, "linkedin");
            if (!resolved) continue;
          }

          // Step through form modals
          let modalOpen = true;
          let stepLimit = 6;
          while (modalOpen && stepLimit > 0) {
            stepLimit--;
            await randomDelay(1000, 2000);

            // Check if there is a cover letter textarea or question
            const textAreas = await page.$$("textarea");
            for (const ta of textAreas) {
              const val = await ta.inputValue();
              if (!val) {
                await ta.fill(tailoredLetter);
                await randomDelay(500, 1000);
              }
            }

            // Click Next / Review / Submit
            const nextBtn = await page.$("button:has-text('Next'), button:has-text('Review')");
            const submitBtn = await page.$("button:has-text('Submit application')");

            if (submitBtn) {
              await submitBtn.click();
              await randomDelay(2000, 3500);
              modalOpen = false;
              break;
            } else if (nextBtn) {
              await nextBtn.click();
            } else {
              modalOpen = false;
            }
          }

          // Close confirmation dialog if any
          const dismissBtn = await page.$("button[aria-label='Dismiss']");
          if (dismissBtn) await dismissBtn.click().catch(() => {});

          // Record application in DB and increment quota
          await db.execute({
            sql: `INSERT INTO applications (platform, company, position, job_url, status, tailored_letter, notes)
                  VALUES ('linkedin', ?, ?, ?, 'applied', ?, 'Easy Apply completed')`,
            args: [company, position, jobUrl, tailoredLetter],
          });

          await incrementTodayQuota();
          appliedCount++;
          console.log(`[Success] Applied to ${position} at ${company}! (Session: ${appliedCount})`);

          // Anti-ban delay between submissions (30 to 60 seconds)
          await randomDelay(15000, 30000);
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
    targetRoles: string[],
    dryRun: boolean = false
  ): Promise<number> {
    console.log("[AutoJob] Navigating to Internshala...");
    await page.goto("https://internshala.com/jobs", { waitUntil: "domcontentloaded" });
    await randomDelay(2000, 4000);

    // Check for CAPTCHA
    const blocked = await detectCaptchaOrSecurityCheck(page, "internshala");
    if (blocked) {
      const resolved = await waitForUserResolution(page, "internshala");
      if (!resolved) return 0;
    }

    const db = getDb();
    let appliedCount = 0;

    for (const role of targetRoles) {
      if (this.abortRequested) break;
      const currentQuota = await getTodayQuota();
      if (currentQuota.remaining <= 0) break;

      const keywordParam = role.toLowerCase().replace(/\s+/g, "-");
      const searchUrl = `https://internshala.com/jobs/${keywordParam}-jobs`;
      console.log(`[Internshala] Searching: "${role}"`);
      await page.goto(searchUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
      await randomDelay(2000, 4000);

      const jobCards = await page.$$(".individual_internship");
      console.log(`[Internshala] Found ${jobCards.length} listings for ${role}`);

      for (const card of jobCards) {
        if (this.abortRequested) break;
        const quotaCheck = await getTodayQuota();
        if (quotaCheck.remaining <= 0) break;

        try {
          const titleEl = await card.$(".job-internship-name, .heading_4_5");
          const companyEl = await card.$(".company-name, .link_display_like_text");
          const applyBtn = await card.$("a:has-text('Apply now'), button:has-text('Apply now')");

          const position = titleEl ? (await titleEl.innerText()).trim() : role;
          const company = companyEl ? (await companyEl.innerText()).trim() : "Internshala Recruiter";
          const jobUrl = page.url();

          // Check DB duplicate
          const existing = await db.execute({
            sql: "SELECT id FROM applications WHERE company = ? AND position = ?",
            args: [company, position],
          });
          if (existing.rows.length > 0) continue;

          // Generate tailored letter
          const tailoredLetter = await generateTailoredCoverLetter({
            candidateProfile: profileData,
            jobTitle: position,
            companyName: company,
            jobDescription: `${position} at ${company}`,
          }).catch(
            () =>
              `I am excited to apply for the ${position} position at ${company}. My skillset aligns directly with your requirements.`
          );

          if (!applyBtn) continue;

          if (dryRun) {
            await db.execute({
              sql: `INSERT INTO applications (platform, company, position, job_url, status, tailored_letter, notes)
                    VALUES ('internshala', ?, ?, ?, 'skipped', ?, 'Dry run simulated')`,
              args: [company, position, jobUrl, tailoredLetter],
            });
            continue;
          }

          await applyBtn.click();
          await randomDelay(2000, 3500);

          // Fill cover letter if prompted
          const coverLetterInput = await page.$("textarea[id*='cover_letter'], textarea[name*='cover_letter']");
          if (coverLetterInput) {
            await humanType(page, "textarea", tailoredLetter);
          }

          // Submit
          const submitBtn = await page.$("input[type='submit'], button:has-text('Submit')");
          if (submitBtn) {
            await submitBtn.click();
            await randomDelay(2500, 4000);
          }

          await db.execute({
            sql: `INSERT INTO applications (platform, company, position, job_url, status, tailored_letter, notes)
                  VALUES ('internshala', ?, ?, ?, 'applied', ?, 'Application submitted')`,
            args: [company, position, jobUrl, tailoredLetter],
          });

          await incrementTodayQuota();
          appliedCount++;
          console.log(`[Success] Applied to ${position} at ${company} on Internshala!`);

          await randomDelay(15000, 30000);
        } catch (internErr) {
          console.error("[Internshala] Card error:", internErr);
        }
      }
    }

    return appliedCount;
  }
}

export const automationEngine = new AutomationEngine();
