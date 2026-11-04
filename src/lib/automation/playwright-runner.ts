import { chromium, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";
import {
  getDb,
  getTodayQuota,
  getTodayPlatformQuota,
  incrementTodayPlatformQuota,
} from "../db";
import { STEALTH_CHROMIUM_ARGS, randomDelay, humanMouseMove, humanType } from "./stealth";
import { detectCaptchaOrSecurityCheck, waitForUserResolution } from "./captcha-detector";
import { generateTailoredCoverLetter, evaluateSelectionProbability } from "../llm";
import { sendTelegramMessage } from "../telegram";

export interface AutomationRunOptions {
  platform?: "linkedin" | "internshala" | "both";
  opportunityType?: "internship" | "job";
  workplaceType?: "any" | "remote" | "hybrid" | "on_site";
  targetLocation?: string;
  applyType?: "all" | "easy_apply_only";
  dryRun?: boolean;
}

/**
 * Dynamically derives targeted job search queries based on candidate resume skills
 * and any user-configured target roles.
 */
export function deriveSearchRolesFromSkills(
  skills: string[],
  configuredRoles: string[] = []
): string[] {
  const derived = new Set<string>();

  // Include user configured target roles first
  for (const r of configuredRoles) {
    if (r && r.trim()) derived.add(r.trim());
  }

  const sLower = skills.map((s) => s.toLowerCase());

  // Derive roles directly matching resume skills
  if (sLower.some((s) => s.includes("generative ai") || s.includes("genai") || s.includes("llm"))) {
    derived.add("Generative AI Engineer");
    derived.add("AI Engineer");
  }
  if (sLower.some((s) => s.includes("machine learning") || s.includes("ml"))) {
    derived.add("Machine Learning Engineer");
  }
  if (sLower.some((s) => s.includes("data science") || s.includes("data scientist"))) {
    derived.add("Data Scientist");
    derived.add("Data Science Intern");
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

  // Fallback defaults if empty
  if (derived.size === 0) {
    derived.add("Software Engineer");
    derived.add("Python Developer");
  }

  return Array.from(derived);
}

/**
 * Evaluates whether a job posting matches the candidate's skills and tech domain.
 * Filters out completely unrelated jobs (e.g. Finance, Accounting, Sales, Marketing).
 */
export function isJobRelevantToSkills(
  jobTitle: string,
  jobDescription: string,
  candidateSkills: string[]
): { isRelevant: boolean; score: number; matchedSkills: string[] } {
  const titleLower = jobTitle.toLowerCase();
  const jdLower = (jobDescription || "").toLowerCase();
  const text = `${titleLower} ${jdLower}`;

  // Strict negative filters for non-engineering / unrelated fields
  const unrelatedKeywords = [
    "financial planning",
    "accounting",
    "accountant",
    "sales manager",
    "sales executive",
    "b2b sales",
    "marketing manager",
    "digital marketing",
    "graphic designer",
    "human resources",
    "hr recruiter",
    "medical",
    "nurse",
    "legal counsel",
  ];

  for (const neg of unrelatedKeywords) {
    if (
      titleLower.includes(neg) &&
      !titleLower.includes("engineer") &&
      !titleLower.includes("developer") &&
      !titleLower.includes("ai") &&
      !titleLower.includes("software")
    ) {
      return { isRelevant: false, score: 0, matchedSkills: [] };
    }
  }

  // Match against candidate's actual extracted skills
  const matched = new Set<string>();
  for (const skill of candidateSkills) {
    const cleanSkill = skill.toLowerCase().trim();
    if (!cleanSkill || cleanSkill.length < 2) continue;

    if (cleanSkill.length <= 4) {
      const regex = new RegExp(`\\b${cleanSkill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(text)) {
        matched.add(skill);
      }
    } else {
      if (text.includes(cleanSkill)) {
        matched.add(skill);
      }
    }
  }

  // Common core tech keywords for development/software roles
  const coreTech = [
    "software",
    "developer",
    "engineer",
    "python",
    "data",
    "machine learning",
    "ai",
    "artificial intelligence",
    "frontend",
    "backend",
    "full stack",
    "web development",
    "react",
    "node",
    "java",
    "coding",
    "algorithm",
    "automation",
    "tester",
  ];

  for (const term of coreTech) {
    if (titleLower.includes(term)) {
      matched.add(term);
    }
  }

  const matchedSkills = Array.from(matched);
  const score = matchedSkills.length;
  const isRelevant =
    score >= 1 &&
    (coreTech.some((t) => titleLower.includes(t)) || matchedSkills.length >= 2);

  return { isRelevant, score, matchedSkills };
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

    try {
      const db = getDb();

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
        options.applyType || (settingsMap.apply_type as any) || "all";
      const minScoreThreshold = settingsMap.min_match_score ? parseInt(settingsMap.min_match_score, 10) : 65;

      console.log(
        `[AutoJob] Starting automation engine | Mode: ${opportunityType.toUpperCase()} | Platform: ${options.platform || "both"} | Workplace: ${workplaceType.toUpperCase()} | Location: "${targetLocation}" | Apply Mode: ${applyType.toUpperCase()} | Match Threshold: ${minScoreThreshold}%`
      );

      // Check per-platform daily quotas
      const [linkedinQuota, internshalaQuota] = await Promise.all([
        getTodayPlatformQuota("linkedin"),
        getTodayPlatformQuota("internshala"),
      ]);

      console.log(
        `[AutoJob Quota] LinkedIn: ${linkedinQuota.applied_count}/${linkedinQuota.max_cap} (${linkedinQuota.remaining} slots) | Internshala: ${internshalaQuota.applied_count}/${internshalaQuota.max_cap} (${internshalaQuota.remaining} slots)`
      );

      const targetPlatform = options.platform || "both";
      const canRunLinkedIn = (targetPlatform === "linkedin" || targetPlatform === "both") && linkedinQuota.remaining > 0;
      const canRunInternshala = (targetPlatform === "internshala" || targetPlatform === "both") && internshalaQuota.remaining > 0;

      if (!canRunLinkedIn && !canRunInternshala) {
        console.log(`[AutoJob Quota Cap] Daily quotas for target platforms are fully exhausted for today. Standby.`);
        return {
          status: "quota_reached",
          linkedin: linkedinQuota,
          internshala: internshalaQuota,
        };
      }

      // Setup persistent browser context
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

      // Load user profile and derive skill-based roles
      const profileRow = await db.execute("SELECT * FROM profile WHERE id = 1");
      const profileData = profileRow.rows[0] || {};
      const candidateSkills: string[] = profileData.skills_json
        ? JSON.parse(profileData.skills_json as string)
        : [];
      const configuredRoles: string[] = profileData.target_roles_json
        ? JSON.parse(profileData.target_roles_json as string)
        : [];

      const searchRoles = deriveSearchRolesFromSkills(candidateSkills, configuredRoles);
      console.log(`[AutoJob] Candidate Skills: ${candidateSkills.join(", ")}`);
      console.log(`[AutoJob] Target search queries: ${searchRoles.join(", ")}`);

      let applicationsSubmittedThisSession = 0;

      // 1. Run LinkedIn Workflow if quota remaining (Isolated)
      let linkedinActions = 0;
      if (canRunLinkedIn && !this.abortRequested) {
        try {
          console.log(`[AutoJob Phase 1] >>> Starting LinkedIn processing (Target: up to ${linkedinQuota.remaining} applications)...`);
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
            options.dryRun
          );
          applicationsSubmittedThisSession += linkedinActions;
          console.log(`[AutoJob Phase 1] <<< LinkedIn phase finished with ${linkedinActions} applications/actions.`);
        } catch (linkedInErr) {
          console.error("[AutoJob Phase 1 Error] LinkedIn execution encountered an issue:", linkedInErr);
        }
      } else if (targetPlatform === "linkedin" || targetPlatform === "both") {
        console.log(`[AutoJob] LinkedIn daily quota (${linkedinQuota.max_cap}) reached for today. Skipping LinkedIn.`);
      }

      // Explicit transition to Internshala
      console.log(`[AutoJob Transition] >>> Switching to Internshala...`);

      // 2. Run Internshala Workflow if quota remaining (Isolated)
      let internshalaActions = 0;
      if (canRunInternshala && !this.abortRequested) {
        try {
          console.log(`[AutoJob Phase 2] >>> Starting Internshala processing (Target: up to ${internshalaQuota.remaining} applications)...`);
          internshalaActions = await this.processInternshala(
            page,
            profileData,
            candidateSkills,
            searchRoles,
            opportunityType,
            workplaceType,
            targetLocation,
            minScoreThreshold,
            options.dryRun
          );
          applicationsSubmittedThisSession += internshalaActions;
          console.log(`[AutoJob Phase 2] <<< Internshala phase finished with ${internshalaActions} applications.`);
        } catch (internshalaErr) {
          console.error("[AutoJob Phase 2 Error] Internshala execution encountered an issue:", internshalaErr);
        }
      } else if (targetPlatform === "internshala" || targetPlatform === "both") {
        console.log(`[AutoJob] Internshala daily quota (${internshalaQuota.max_cap}) reached for today. Skipping Internshala.`);
      }

      const updatedOverallQuota = await getTodayQuota();

      return {
        status: "completed",
        applicationsSubmittedThisSession,
        todayRemaining: updatedOverallQuota.remaining,
        platforms: updatedOverallQuota.platforms,
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
    candidateSkills: string[],
    targetRoles: string[],
    opportunityType: "internship" | "job" = "internship",
    workplaceType: "any" | "remote" | "hybrid" | "on_site" = "remote",
    targetLocation: string = "Remote",
    applyType: "all" | "easy_apply_only" = "all",
    minScoreThreshold: number = 65,
    dryRun: boolean = false
  ): Promise<number> {
    console.log(
      `[AutoJob] Navigating to LinkedIn (Target: ${opportunityType.toUpperCase()} | Workplace: ${workplaceType} | Location: ${targetLocation} | Apply: ${applyType})...`
    );
    await page.goto("https://www.linkedin.com/jobs/", { waitUntil: "domcontentloaded" });
    await randomDelay(2000, 3500);

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
      const currentQuota = await getTodayPlatformQuota("linkedin");
      if (currentQuota.remaining <= 0) {
        console.log(`[LinkedIn] Daily cap (${currentQuota.max_cap}) reached. Stopping LinkedIn.`);
        break;
      }

      const searchKeywords =
        opportunityType === "internship" && !role.toLowerCase().includes("intern")
          ? `${role} intern`
          : role;

      let searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(searchKeywords)}`;

      if (targetLocation && targetLocation.toLowerCase() !== "any") {
        searchUrl += `&location=${encodeURIComponent(targetLocation)}`;
      }

      if (workplaceType === "remote") {
        searchUrl += "&f_WT=2";
      } else if (workplaceType === "on_site") {
        searchUrl += "&f_WT=1";
      } else if (workplaceType === "hybrid") {
        searchUrl += "&f_WT=3";
      }

      if (opportunityType === "internship") {
        searchUrl += "&f_E=1&f_JT=I";
      } else {
        searchUrl += "&f_JT=F";
      }

      if (applyType === "easy_apply_only") {
        searchUrl += "&f_AL=true";
      }

      console.log(`[LinkedIn] Searching for skill-aligned ${opportunityType}: "${searchKeywords}" (${searchUrl})`);
      await page.goto(searchUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
      await randomDelay(3000, 5000);

      // Support modern and classic LinkedIn search layouts
      let jobCards = await page.$$(
        "div[class*='b6bikq'], div[data-view-name*='job'], .job-card-container, .jobs-search-results__list-item, li[data-occludable-job-id]"
      );

      console.log(`[LinkedIn] Found ${jobCards.length} potential listings for "${role}"`);

      const processedTitles = new Set<string>();

      for (let i = 0; i < jobCards.length; i++) {
        if (this.abortRequested) break;
        const quotaCheck = await getTodayPlatformQuota("linkedin");
        if (quotaCheck.remaining <= 0) break;

        const card = jobCards[i];

        try {
          const cardText = (await card.innerText().catch(() => "")).trim();
          if (!cardText || cardText.length < 20) continue;

          // Skip navigation buttons, filters, and non-job elements
          const navHeaders = [
            "home",
            "my network",
            "jobs",
            "messaging",
            "notifications",
            "try premium",
            "date posted",
            "company",
            "workplace type",
            "experience level",
            "employment type",
            "easy apply",
            "all filters",
            "reset",
            "verified",
            "in my network",
          ];
          const firstLine = cardText.split("\n")[0].trim();
          if (navHeaders.some((nav) => firstLine.toLowerCase() === nav)) continue;

          // Ensure it's a real job card with employment details
          const isJobListing =
            cardText.includes("ago") ||
            cardText.includes("applicant") ||
            cardText.includes("On-site") ||
            cardText.includes("Remote") ||
            cardText.includes("Hybrid") ||
            cardText.includes("Verified job");
          if (!isJobListing) continue;

          await card.scrollIntoViewIfNeeded().catch(() => {});
          await humanMouseMove(page);
          await card.click().catch(() => {});
          await randomDelay(2000, 3000);

          // Extract job details from details pane
          const titleEl = await page.$(
            "h1, h2.t-24, .job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, div[class*='job-details'] h1"
          );
          const companyEl = await page.$(
            ".job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, a[href*='/company/']"
          );
          const jdEl = await page.$(
            "#job-details, .jobs-description__content, div[class*='jobs-box__html-content'], article"
          );

          const cardLines = cardText
            .split("\n")
            .map((l) => l.replace(/^Selected,\s*/i, "").trim())
            .filter((l) => l && l.length > 1 && !l.includes("·") && !l.includes("Easy Apply"));
          const fallbackTitle = cardLines[0] || role;
          const fallbackCompany = cardLines[1] || "Company";

          const position = titleEl ? (await titleEl.innerText()).trim() : fallbackTitle;
          const company = companyEl ? (await companyEl.innerText()).trim() : fallbackCompany;
          const jdText = jdEl ? (await jdEl.innerText()).trim() : "";
          const jobUrl = page.url();

          // Avoid processing same job multiple times
          const jobKey = `${company}__${position}`;
          if (processedTitles.has(jobKey)) continue;
          processedTitles.add(jobKey);

          // 1. HIGH SELECTION CHANCE & RESUME MATCH EVALUATION
          const matchResult = await evaluateSelectionProbability({
            candidateProfile: profileData,
            candidateSkills,
            jobTitle: position,
            companyName: company,
            jobDescription: jdText || cardText,
            opportunityType,
            minScoreThreshold,
          });

          if (!matchResult.isHighChance) {
            console.log(
              `[LinkedIn Selection Filter] Skipping "${position}" at ${company} (Score: ${matchResult.score}% < ${minScoreThreshold}% - ${matchResult.reasoning})`
            );
            continue;
          }

          console.log(
            `[LinkedIn High Match Confirmed] "${position}" at ${company} matched candidate profile! (Score: ${matchResult.score}%)`
          );

          // Check if already applied or logged in DB
          const existing = await db.execute({
            sql: "SELECT id FROM applications WHERE (job_url = ? OR (company = ? AND position = ?))",
            args: [jobUrl, company, position],
          });

          if (existing.rows.length > 0) {
            console.log(`[LinkedIn] Already applied to ${position} at ${company}, skipping.`);
            continue;
          }

          // 2. CHECK FOR EASY APPLY OR DIRECT APPLY BUTTON
          const easyApplyBtn = await page.$(
            "button:has-text('Easy Apply'), button[aria-label*='Easy Apply'], button.jobs-apply-button:has-text('Easy Apply')"
          );

          if (!easyApplyBtn) {
            if (applyType === "easy_apply_only") {
              console.log(
                `[LinkedIn] No Easy Apply button found for "${position}" at ${company} (Easy Apply Only mode), skipping.`
              );
              continue;
            }

            // Normal Company Application Flow
            console.log(
              `[LinkedIn Direct Apply] Processing company career listing for "${position}" at ${company}...`
            );

            // Generate Tailored 150-word Cover Letter via LLM
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
              tailoredLetter = `Dear Hiring Team at ${company},\n\nI am writing to express my strong enthusiasm for the ${position} role. With my background in ${candidateSkills.slice(0, 4).join(", ")}, I am eager to contribute immediately to your team.`;
            }

            // Extract external direct apply URL
            let directApplyUrl = jobUrl;
            const externalApplyEl = await page.$(
              "a.jobs-apply-button, a[data-easy-apply-link], a[href*='external'], a:has-text('Apply'), button.jobs-apply-button, button:has-text('Apply')"
            );

            if (externalApplyEl) {
              const href = await externalApplyEl.getAttribute("href").catch(() => null);
              if (href && href.startsWith("http")) {
                directApplyUrl = href;
              } else {
                try {
                  const [popup] = await Promise.all([
                    this.context!.waitForEvent("page", { timeout: 3500 }).catch(() => null),
                    externalApplyEl.click().catch(() => {}),
                  ]);
                  if (popup) {
                    await randomDelay(1200, 2000);
                    directApplyUrl = popup.url();
                    await popup.close().catch(() => {});
                  }
                } catch {}
              }
            }

            if (dryRun) {
              console.log(
                `[DryRun] Would record direct apply opportunity for ${company} (${position}).`
              );
              await db.execute({
                sql: `INSERT INTO applications (platform, company, position, job_url, status, tailored_letter, notes)
                      VALUES ('linkedin', ?, ?, ?, 'skipped', ?, 'Dry run simulated - Direct Apply Ready')`,
                args: [company, position, directApplyUrl, tailoredLetter],
              });
              continue;
            }

            // Record into applications as external_ready
            await db.execute({
              sql: `INSERT INTO applications (platform, company, position, job_url, status, tailored_letter, notes)
                    VALUES ('linkedin', ?, ?, ?, 'external_ready', ?, 'Direct Apply Ready - Tailored cover letter prepared')`,
              args: [company, position, directApplyUrl, tailoredLetter],
            });

            await incrementTodayPlatformQuota("linkedin");
            appliedCount++;
            console.log(
              `[Success] Direct Apply opportunity logged for ${position} at ${company}! (Platform count: ${appliedCount})`
            );

            sendTelegramMessage(
              `🚀 *Direct Apply Ready!* (LINKEDIN)\n\n🏢 *Company:* ${company}\n💼 *Position:* ${position}\n🔗 [Apply on Company Site](${directApplyUrl})\n\n📝 Tailored 150-word cover letter is prepared and saved in your AutoJob dashboard.`
            ).catch(() => {});

            await randomDelay(3000, 5000);
            continue;
          }

          const applyBtn = easyApplyBtn;

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
            tailoredLetter = `Dear Hiring Team at ${company},\n\nI am writing to express my strong enthusiasm for the ${position} role. With my background in ${candidateSkills.slice(0, 4).join(", ")}, I am eager to contribute immediately to your team.`;
          }

          if (dryRun) {
            console.log(`[DryRun] Would submit application to ${company} for ${position}.`);
            await db.execute({
              sql: `INSERT INTO applications (platform, company, position, job_url, status, tailored_letter, notes)
                    VALUES ('linkedin', ?, ?, ?, 'skipped', ?, 'Dry run simulated - Match score: ' || ?)`,
              args: [company, position, jobUrl, tailoredLetter, `${matchResult.score}%`],
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
          await randomDelay(2000, 3500);

          // Handle multi-step modal or questions
          const isSecurityCheck = await detectCaptchaOrSecurityCheck(activePage, "linkedin", {
            company,
            position,
            url: jobUrl,
          });
          if (isSecurityCheck) {
            const resolved = await waitForUserResolution(activePage, "linkedin");
            if (!resolved) {
              if (popupPage) await popupPage.close().catch(() => {});
              continue;
            }
          }

          // Step through form modals (Contact Info, Screening Questions, Review)
          let modalOpen = true;
          let stepLimit = 8;
          let submitted = false;

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
                const userPhone = (profileData.phone as string) || "9876543210";
                await pInput.fill(userPhone).catch(() => {});
                await randomDelay(200, 400);
              }
            }

            // B. Fill numeric / text screening questions if empty
            const textInputs = await activePage.$$(
              "input[type='text']:visible, input[type='number']:visible"
            );
            for (const ti of textInputs) {
              const val = await ti.inputValue().catch(() => "");
              if (!val) {
                const inputType = await ti.getAttribute("type");
                if (inputType === "number") {
                  await ti.fill("1").catch(() => {});
                } else {
                  await ti.fill("Yes").catch(() => {});
                }
                await randomDelay(200, 400);
              }
            }

            // C. Fill Radio buttons if unselected
            const radioGroups = await activePage.$$("fieldset, div[role='radiogroup']");
            for (const rg of radioGroups) {
              const hasChecked = await rg.$("input[type='radio']:checked");
              if (!hasChecked) {
                const yesOption = await rg.$(
                  "input[value*='Yes' i], label:has-text('Yes') input, input[id*='yes' i]"
                );
                if (yesOption) {
                  await yesOption.click().catch(() => {});
                } else {
                  const firstRadio = await rg.$("input[type='radio']");
                  if (firstRadio) await firstRadio.click().catch(() => {});
                }
                await randomDelay(200, 400);
              }
            }

            // D. Fill Select dropdowns if unselected
            const selects = await activePage.$$("select:visible");
            for (const sel of selects) {
              const val = await sel.inputValue().catch(() => "");
              if (!val || val === "Select an option") {
                await sel.selectOption({ index: 1 }).catch(() => {});
                await randomDelay(200, 400);
              }
            }

            // E. Fill Cover Letter in textareas
            const textAreas = await activePage.$$("textarea:visible");
            for (const ta of textAreas) {
              const val = await ta.inputValue().catch(() => "");
              if (!val) {
                await ta.fill(tailoredLetter).catch(() => {});
                await randomDelay(300, 600);
              }
            }

            // F. Check for Submit button first
            const submitBtn = await activePage.$(
              "button:has-text('Submit application'), button[aria-label*='Submit application']"
            );

            if (submitBtn) {
              await submitBtn.click().catch(() => {});
              await randomDelay(2500, 4000);
              submitted = true;
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
            // Record application in DB and increment quota
            await db.execute({
              sql: `INSERT INTO applications (platform, company, position, job_url, status, tailored_letter, notes)
                    VALUES ('linkedin', ?, ?, ?, 'applied', ?, 'Easy Apply completed successfully')`,
              args: [company, position, jobUrl, tailoredLetter],
            });

            await incrementTodayPlatformQuota("linkedin");
            appliedCount++;
            console.log(
              `[Success] Applied to ${position} at ${company}! (Platform count: ${appliedCount})`
            );

            sendTelegramMessage(
              `✅ *Applied on LinkedIn!* (Easy Apply)\n\n🏢 *Company:* ${company}\n💼 *Position:* ${position}\n🔗 [View Listing](${jobUrl})`
            ).catch(() => {});

            // Anti-ban delay between submissions
            await randomDelay(10000, 20000);
          } else {
            console.log(
              `[LinkedIn] Multi-step application for ${position} at ${company} was not finalized.`
            );
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
    dryRun: boolean = false
  ): Promise<number> {
    const isRemote = workplaceType === "remote" || targetLocation.toLowerCase() === "remote";
    const baseEntryUrl =
      opportunityType === "internship"
        ? (isRemote ? "https://internshala.com/internships/work-from-home" : "https://internshala.com/internships")
        : (isRemote ? "https://internshala.com/jobs/work-from-home" : "https://internshala.com/jobs");

    console.log(
      `[AutoJob] Navigating to Internshala (${baseEntryUrl}) [Workplace: ${workplaceType}, Location: ${targetLocation}]...`
    );
    await page.goto(baseEntryUrl, { waitUntil: "domcontentloaded" });
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
      const currentQuota = await getTodayPlatformQuota("internshala");
      if (currentQuota.remaining <= 0) {
        console.log(`[Internshala] Daily cap (${currentQuota.max_cap}) reached. Stopping Internshala.`);
        break;
      }

      const cleanRoleSlug = role.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const searchUrls: string[] = [];

      if (opportunityType === "internship") {
        if (isRemote) {
          searchUrls.push(`https://internshala.com/internships/work-from-home-${cleanRoleSlug}-internships`);
          searchUrls.push(`https://internshala.com/internships/work-from-home/keywords-${encodeURIComponent(role)}`);
          searchUrls.push("https://internshala.com/internships/work-from-home");
        } else if (targetLocation && targetLocation.toLowerCase() !== "any") {
          const cleanLocSlug = targetLocation.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          searchUrls.push(`https://internshala.com/internships/internship-in-${cleanLocSlug}`);
          searchUrls.push(
            `https://internshala.com/internships?keywords=${encodeURIComponent(role)}&location=${encodeURIComponent(
              targetLocation
            )}`
          );
        } else {
          searchUrls.push(`https://internshala.com/internships/${cleanRoleSlug}-internship`);
          searchUrls.push(`https://internshala.com/internships?keywords=${encodeURIComponent(role)}`);
        }
      } else {
        if (isRemote) {
          searchUrls.push(`https://internshala.com/jobs/work-from-home/keywords-${encodeURIComponent(role)}`);
          searchUrls.push("https://internshala.com/jobs/work-from-home");
        } else {
          searchUrls.push(`https://internshala.com/jobs/${cleanRoleSlug}-jobs`);
          searchUrls.push(`https://internshala.com/jobs?keywords=${encodeURIComponent(role)}`);
        }
      }

      let jobCards: any[] = [];
      for (const sUrl of searchUrls) {
        if (jobCards.length > 0) break;
        console.log(`[Internshala] Searching for skill-aligned ${opportunityType}: "${role}" (${sUrl})`);
        await page.goto(sUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
        await randomDelay(2000, 3500);

        jobCards = await page.$$(
          ".individual_internship, .internship_meta, div[data-internship-id], div[class*='internship_list']"
        );
      }

      console.log(`[Internshala] Found ${jobCards.length} listings for "${role}"`);

      for (const card of jobCards) {
        if (this.abortRequested) break;
        const quotaCheck = await getTodayPlatformQuota("internshala");
        if (quotaCheck.remaining <= 0) break;

        try {
          // In Internshala, the Apply now button is on the detail page
          const detailHref = await card
            .$eval(
              "a.job-title-href, a.view_detail_button, .heading_4_5 a, a[href*='/internship/detail/'], a[href*='/job/detail/']",
              (el: Element) => el.getAttribute("href")
            )
            .catch(() => null);

          if (!detailHref) continue;

          const detailUrl = detailHref.startsWith("http")
            ? detailHref
            : `https://internshala.com${detailHref}`;

          // Navigate to detail page
          console.log(`[Internshala] Inspecting ${opportunityType} details: ${detailUrl}`);
          await page.goto(detailUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
          await randomDelay(2000, 3500);

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

          // 1. HIGH SELECTION CHANCE & RESUME MATCH EVALUATION
          const matchResult = await evaluateSelectionProbability({
            candidateProfile: profileData,
            candidateSkills,
            jobTitle: position,
            companyName: company,
            jobDescription: jdText,
            opportunityType,
            minScoreThreshold,
          });

          if (!matchResult.isHighChance) {
            console.log(
              `[Internshala Selection Filter] Skipping "${position}" at ${company} (Score: ${matchResult.score}% < ${minScoreThreshold}% - ${matchResult.reasoning})`
            );
            continue;
          }

          console.log(
            `[Internshala High Match Confirmed] "${position}" at ${company} matches resume! (Score: ${matchResult.score}%)`
          );

          // Check DB duplicate
          const existing = await db.execute({
            sql: "SELECT id FROM applications WHERE (job_url = ? OR (company = ? AND position = ?))",
            args: [detailUrl, company, position],
          });
          if (existing.rows.length > 0) {
            console.log(`[Internshala] Already applied to ${position} at ${company}, skipping.`);
            continue;
          }

          // Check for "Apply now" button on the detail page first
          const applyBtn = await page.$(
            "#apply_now_button, button:has-text('Apply now'), a:has-text('Apply now')"
          );

          if (!applyBtn) {
            console.log(`[Internshala] No Apply Now button found for "${position}" at ${company}, skipping.`);
            continue;
          }

          // Generate tailored letter via LLM
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
            console.log(`[DryRun] Would submit Internshala application to ${company} for ${position}.`);
            await db.execute({
              sql: `INSERT INTO applications (platform, company, position, job_url, status, tailored_letter, notes)
                    VALUES ('internshala', ?, ?, ?, 'skipped', ?, 'Dry run simulated')`,
              args: [company, position, detailUrl, tailoredLetter],
            });
            continue;
          }

          await applyBtn.click().catch(() => {});
          await randomDelay(2000, 3500);

          // Fill cover letter textarea if prompted
          const coverLetterInput = await page.$(
            "textarea[id*='cover_letter'], textarea[name*='cover_letter']"
          );
          if (coverLetterInput) {
            await coverLetterInput.fill(tailoredLetter).catch(() => {});
            await randomDelay(500, 1000);
          }

          // Fill any required assessment questions
          const otherTextareas = await page.$$(
            "textarea:not([id*='cover_letter']):not([name*='cover_letter'])"
          );
          for (const ta of otherTextareas) {
            const val = await ta.inputValue().catch(() => "");
            if (!val) {
              await ta
                .fill(
                  `I have strong practical experience with ${candidateSkills.slice(0, 3).join(", ")}, having built real-world projects and scalable systems.`
                )
                .catch(() => {});
              await randomDelay(300, 600);
            }
          }

          // Click Submit application
          const submitBtn = await page.$(
            "input[type='submit']#submit, button#submit, button:has-text('Submit'), input[value*='Submit' i]"
          );
          if (submitBtn) {
            await submitBtn.click().catch(() => {});
            await randomDelay(3000, 5000);
          }

          await db.execute({
            sql: `INSERT INTO applications (platform, company, position, job_url, status, tailored_letter, notes)
                  VALUES ('internshala', ?, ?, ?, 'applied', ?, 'Application submitted successfully')`,
            args: [company, position, detailUrl, tailoredLetter],
          });

          await incrementTodayPlatformQuota("internshala");
          appliedCount++;
          console.log(
            `[Success] Applied to ${position} at ${company} on Internshala! (Platform count: ${appliedCount})`
          );

          sendTelegramMessage(
            `✅ *Applied on Internshala!* (${opportunityType.toUpperCase()})\n\n🏢 *Company:* ${company}\n💼 *Position:* ${position}\n🔗 [View Listing](${detailUrl})`
          ).catch(() => {});

          await randomDelay(10000, 20000);
        } catch (internErr) {
          console.error("[Internshala] Error processing card:", internErr);
        }
      }
    }

    return appliedCount;
  }
}

export const automationEngine = new AutomationEngine();
