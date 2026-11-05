import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveSearchRolesFromSkills } from "../src/lib/automation/playwright-runner";
import { evaluateSelectionProbability } from "../src/lib/llm";
import { escapeCsvField, exportApplicationsToCSV } from "../src/lib/csv-export";
import { encryptSecret, decryptSecret } from "../src/lib/crypto";
import { signJwt, verifyJwt, hashPassword, verifyPassword } from "../src/lib/auth";
import { initDatabase, getDb, getTodayPlatformQuota, incrementTodayPlatformQuota } from "../src/lib/db";
import {
  isWithinActiveWindow,
  getMsUntilNextWindowOpen,
  calculateRandomRestTimeMs,
  interruptibleSleep,
  formatDurationMs,
  formatHour12,
} from "../src/lib/automation/pacing";

async function runTests() {
  console.log("==========================================");
  console.log("   AUTOJOB AUTOMATED REGRESSION SUITE     ");
  console.log("==========================================");
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL: ${name}`);
      console.error(`    ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  // TEST 1: Role Derivation
  await test("deriveSearchRolesFromSkills derives roles matching candidate skills", () => {
    const skills = ["Python", "Generative AI", "React"];
    const roles = deriveSearchRolesFromSkills(skills, ["Custom AI Lead"]);
    assert.ok(roles.includes("Custom AI Lead"));
    assert.ok(roles.includes("Generative AI Engineer"));
    assert.ok(roles.includes("AI Engineer"));
    assert.ok(roles.includes("Python Developer"));
    assert.ok(roles.includes("Frontend Developer"));
  });

  // TEST 2: AUTO-007 Empty skills guard
  await test("evaluateSelectionProbability returns score=0 and isHighChance=false for empty skills (AUTO-007)", async () => {
    const result = await evaluateSelectionProbability({
      candidateProfile: {},
      candidateSkills: [],
      jobTitle: "Software Engineer Intern",
      companyName: "Acme Corp",
      jobDescription: "Looking for an enthusiastic intern with basic coding skills.",
      opportunityType: "internship",
    });

    assert.equal(result.score, 0, "Score must be 0 for empty skills");
    assert.equal(result.isHighChance, false, "Must not be high chance with empty skills");
    assert.ok(result.reasoning.includes("zero configured skills"));
  });

  // TEST 3: Senior Role Disqualification in Internship Mode
  await test("evaluateSelectionProbability disqualifies senior roles in internship mode", async () => {
    const result = await evaluateSelectionProbability({
      candidateProfile: {},
      candidateSkills: ["Python", "Django", "PostgreSQL"],
      jobTitle: "Senior Staff Backend Engineer",
      companyName: "TechCorp",
      jobDescription: "Python, Django, PostgreSQL, 8+ years experience required.",
      opportunityType: "internship",
    });

    assert.equal(result.isHighChance, false);
    assert.ok(result.reasoning.includes("Disqualified senior title"));
  });

  // TEST 4: High Match Scoring for Aligned Skills
  await test("evaluateSelectionProbability scores >= 65% for strongly aligned internship", async () => {
    const result = await evaluateSelectionProbability({
      candidateProfile: {},
      candidateSkills: ["Python", "FastAPI", "Docker", "Machine Learning", "PyTorch"],
      jobTitle: "Machine Learning Intern",
      companyName: "AI Research Lab",
      jobDescription: "We are hiring a Machine Learning Intern proficient in Python, FastAPI, Docker, and PyTorch.",
      opportunityType: "internship",
      minScoreThreshold: 65,
    });

    assert.ok(result.score >= 65, `Expected score >= 65, got ${result.score}`);
    assert.equal(result.isHighChance, true);
    assert.ok(result.matchedSkills.length >= 3);
  });

  // TEST 5: CSV Escaping (RFC 4180)
  await test("escapeCsvField handles commas, quotes, and newlines properly (RFC 4180)", () => {
    assert.equal(escapeCsvField("simple"), '"simple"');
    assert.equal(escapeCsvField('with "quotes" inside'), '"with ""quotes"" inside"');
    assert.equal(escapeCsvField("line1\nline2"), '"line1\nline2"');
    assert.equal(escapeCsvField("item1, item2"), '"item1, item2"');
    assert.equal(escapeCsvField(null), '""');
  });

  // TEST 6: Secret Encryption & Decryption (SEC-002)
  await test("encryptSecret and decryptSecret correctly round-trip AES-256-GCM ciphertext", () => {
    const original = "sk-ant-api03-1234567890abcdef-CONFIDENTIAL";
    const encrypted = encryptSecret(original);
    assert.ok(encrypted.startsWith("enc:v1:"), "Ciphertext must have enc:v1: prefix");
    const decrypted = decryptSecret(encrypted);
    assert.equal(decrypted, original, "Decrypted text must match original plaintext");
  });

  // TEST 7: Database Initializer and Multi-User Schema
  await test("initDatabase initializes multi-user schema idempotently", async () => {
    await initDatabase();
    const db = getDb();
    const res = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'profiles', 'runner_states')");
    assert.ok(res.rows.length >= 2, "Core SaaS tables must exist");
  });

  // TEST 7B: Web Crypto JWT Signing & Verification
  await test("signJwt and verifyJwt correctly sign and verify HS256 tokens", async () => {
    const payload = { userId: "user-12345", email: "test@autojob.dev" };
    const token = await signJwt(payload);
    assert.ok(token && token.split(".").length === 3, "Token must be valid 3-part JWT");
    const verified = await verifyJwt(token);
    assert.ok(verified, "Token must verify successfully");
    assert.equal(verified?.userId, payload.userId);
    assert.equal(verified?.email, payload.email);
  });

  // TEST 7C: Password Hashing with Scrypt and Timing-Safe Verification
  await test("hashPassword and verifyPassword correctly hash and verify credentials", () => {
    const pass = "CorrectHorseBatteryStaple123!";
    const hash = hashPassword(pass);
    assert.ok(hash.startsWith("scrypt:"), "Hash must follow scrypt format");
    assert.equal(verifyPassword(pass, hash), true, "Correct password must verify");
    assert.equal(verifyPassword("WrongPassword!", hash), false, "Wrong password must be rejected");
  });

  // TEST 8: Atomic Per-Platform Quota Increment (BE-003, DB-002)
  await test("incrementTodayPlatformQuota atomically increments specific platform quota", async () => {
    const initialLi = await getTodayPlatformQuota("linkedin");
    const initialIs = await getTodayPlatformQuota("internshala");

    const res = await incrementTodayPlatformQuota("internshala");
    assert.equal(res.platform, "internshala");
    assert.ok(res.applied_count >= 1);

    // Clean up test increment so regression tests never pollute live application statistics
    const db = getDb();
    const todayStr = new Date().toISOString().split("T")[0];
    await db.execute({
      sql: "UPDATE platform_daily_quota SET applied_count = ? WHERE date = ? AND platform = 'internshala'",
      args: [initialIs.applied_count, todayStr],
    });
  });

  // TEST 9: Active Operating Window (09:00 - 23:00)
  await test("isWithinActiveWindow correctly validates local operating window", () => {
    const morningActive = new Date();
    morningActive.setHours(10, 30, 0, 0); // 10:30 AM
    assert.equal(isWithinActiveWindow(morningActive, 9, 23), true, "10:30 AM must be within 9-23 window");

    const eveningActive = new Date();
    eveningActive.setHours(22, 45, 0, 0); // 10:45 PM
    assert.equal(isWithinActiveWindow(eveningActive, 9, 23), true, "10:45 PM must be within 9-23 window");

    const nightOutside = new Date();
    nightOutside.setHours(23, 15, 0, 0); // 11:15 PM
    assert.equal(isWithinActiveWindow(nightOutside, 9, 23), false, "11:15 PM must be outside window");

    const earlyMorningOutside = new Date();
    earlyMorningOutside.setHours(4, 0, 0, 0); // 4:00 AM
    assert.equal(isWithinActiveWindow(earlyMorningOutside, 9, 23), false, "4:00 AM must be outside window");

    // Bypass check
    assert.equal(isWithinActiveWindow(nightOutside, 9, 23, true), true, "ignoreTimeWindow=true must always be active");

    // 24/7 check
    assert.equal(isWithinActiveWindow(nightOutside, 0, 24), true, "0 to 24 must always be active (24/7)");

    // Wrap around midnight (e.g. 18 to 2)
    const midnightRun = new Date();
    midnightRun.setHours(1, 0, 0, 0); // 1:00 AM
    assert.equal(isWithinActiveWindow(midnightRun, 18, 2), true, "1:00 AM must be within 18 to 2 window");
    const afternoonOutside = new Date();
    afternoonOutside.setHours(14, 0, 0, 0); // 2:00 PM
    assert.equal(isWithinActiveWindow(afternoonOutside, 18, 2), false, "2:00 PM must be outside 18 to 2 window");

    // formatHour12 check
    assert.equal(formatHour12(9), "9:00 AM");
    assert.equal(formatHour12(12), "12:00 PM (Noon)");
    assert.equal(formatHour12(23), "11:00 PM");
  });

  // TEST 10: Window Open Duration with Jitter
  await test("getMsUntilNextWindowOpen returns positive duration with jitter", () => {
    const earlyMorning = new Date();
    earlyMorning.setHours(6, 0, 0, 0); // 6:00 AM
    const resEarly = getMsUntilNextWindowOpen(earlyMorning, 9, 23);
    assert.ok(resEarly.ms >= 3 * 3600 * 1000, "Must be at least 3 hours from 6 AM to 9 AM");
    assert.ok(resEarly.nextOpenTime.getHours() === 9, "Target hour should be 9 AM");

    const lateNight = new Date();
    lateNight.setHours(23, 30, 0, 0); // 11:30 PM
    const resLate = getMsUntilNextWindowOpen(lateNight, 9, 23);
    assert.ok(resLate.ms >= 9 * 3600 * 1000, "Must be at least 9.5 hours from 11:30 PM to 9 AM tomorrow");
  });

  // TEST 11: Randomized Rest Time Calculation & Window Clamping
  await test("calculateRandomRestTimeMs generates bounded random rest time and future timestamp", () => {
    const testNow = new Date();
    testNow.setHours(12, 0, 0, 0); // Noon

    const rest = calculateRandomRestTimeMs({
      remainingQuotaToday: 3,
      minRestMinutes: 20,
      maxRestMinutes: 60,
      windowEndHour: 23,
      now: testNow,
    });

    assert.ok(rest.restMs >= 10 * 60 * 1000, "Rest time must exceed minimum floor");
    assert.ok(rest.nextRunAt.getTime() > testNow.getTime(), "Next run time must be in the future");
    assert.ok(typeof rest.formattedDuration === "string" && rest.formattedDuration.includes("m"));
  });

  // TEST 12: Interruptible Sleep Responsiveness
  await test("interruptibleSleep aborts immediately when shouldAbort returns true", async () => {
    let abort = false;
    setTimeout(() => {
      abort = true;
    }, 50);

    const startTime = Date.now();
    const result = await interruptibleSleep(5000, () => abort, 20);
    const duration = Date.now() - startTime;

    assert.equal(result, false, "Must return false on aborted sleep");
    assert.ok(duration < 1000, `Sleep should have aborted within 1000ms, took ${duration}ms`);
  });

  console.log("==========================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed.`);
  console.log("==========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner threw uncaught error:", err);
  process.exit(1);
});
