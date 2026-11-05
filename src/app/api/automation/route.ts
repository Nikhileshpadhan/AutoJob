import { NextResponse } from "next/server";
import {
  getDb,
  ensureDbInitialized,
  getRunnerState,
  updateRunnerState,
  getRunnerLogs,
  addRunnerLog,
  getTodayQuota,
} from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { automationEngine } from "@/lib/automation/playwright-runner";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    await ensureDbInitialized();
    const userId = auth.userId;

    const runnerState = await getRunnerState(userId);
    const logs = await getRunnerLogs(userId, 100);
    const quota = await getTodayQuota(userId);

    return NextResponse.json({
      isRunning: runnerState.isEnabled,
      isResting: runnerState.status === "resting",
      status: runnerState.status,
      nextRunAt: runnerState.nextRunAt,
      lastRunAt: runnerState.lastRunAt,
      platform: runnerState.platform,
      opportunityType: runnerState.opportunityType,
      dryRun: runnerState.dryRun,
      quota,
      logs,
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    await ensureDbInitialized();
    const userId = auth.userId;
    const body = await request.json().catch(() => ({}));
    const {
      action,
      platform = "both",
      opportunityType = "internship",
      dryRun = false,
    } = body;

    // Handle STOP
    if (action === "stop") {
      await updateRunnerState(userId, {
        isEnabled: false,
        status: "stopped",
        nextRunAt: null,
      });
      await addRunnerLog(userId, "[System] Worker stopped by user command.", "warn");
      await automationEngine.stopUserDaemon(userId);
      return NextResponse.json({
        success: true,
        message: "Worker stopped successfully.",
      });
    }

    // Handle START
    await updateRunnerState(userId, {
      isEnabled: true,
      status: "running",
      platform: platform as "both" | "linkedin" | "internshala",
      opportunityType: opportunityType as "internship" | "job",
      dryRun: Boolean(dryRun),
      nextRunAt: new Date().toISOString(),
    });

    await addRunnerLog(
      userId,
      `[System] Worker activated forever until stopped (${platform.toUpperCase()}, ${opportunityType.toUpperCase()}).`,
      "success"
    );

    // If running in cloud (Vercel) with GitHub Actions credentials configured:
    const githubRepo = process.env.GITHUB_REPO;
    const githubPat = process.env.GITHUB_PAT;

    if (githubRepo && githubPat) {
      try {
        const dispatchUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/autojob-worker.yml/dispatches`;
        const ghRes = await fetch(dispatchUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${githubPat}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "AutoJob-SaaS-Dispatcher",
          },
          body: JSON.stringify({ ref: "main" }),
        });

        if (ghRes.ok) {
          await addRunnerLog(
            userId,
            `[Cloud Dispatch] Dispatched GitHub Actions cloud worker tick on repository ${githubRepo}.`,
            "info"
          );
        } else {
          const errText = await ghRes.text();
          console.warn("[Cloud Dispatcher] Non-OK response from GitHub:", errText);
        }
      } catch (ghErr) {
        console.error("[Cloud Dispatcher] Failed to trigger GitHub Actions:", ghErr);
      }
    } else {
      // Local dev mode: run tick / start daemon in background in-process
      automationEngine.startUserDaemon(userId).catch((err) => {
        console.error(`[Daemon Error for ${userId}]:`, err);
      });
    }

    return NextResponse.json({
      success: true,
      message: "Autonomous worker activated.",
      status: "running",
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
