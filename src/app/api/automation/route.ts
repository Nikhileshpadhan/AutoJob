import { NextResponse } from "next/server";
import { automationEngine } from "@/lib/automation/playwright-runner";
import { getTodayQuota, getDb, initDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await initDatabase();
  const db = getDb();
  const quota = await getTodayQuota();
  const engineStatus = automationEngine.getStatus();

  // Fetch recent active or last run
  const lastRunRes = await db.execute("SELECT * FROM automation_runs ORDER BY id DESC LIMIT 1");
  const lastRun = lastRunRes.rows[0] || null;

  return NextResponse.json({
    isRunning: engineStatus.isRunning,
    isResting: engineStatus.isResting,
    nextRunAt: engineStatus.nextRunAt,
    activeRunId: engineStatus.activeRunId,
    abortRequested: engineStatus.abortRequested,
    lastRun,
    quota,
    isCapReached: quota.remaining <= 0,
    platforms: quota.platforms,
  });
}

export async function POST(request: Request) {
  try {
    await initDatabase();
    const body = await request.json().catch(() => ({}));
    const {
      action,
      platform = "both",
      opportunityType,
      workplaceType,
      targetLocation,
      applyType,
      dryRun = false,
      pacingMode,
      ignoreTimeWindow,
    } = body;

    // Handle stop action
    if (action === "stop") {
      await automationEngine.stop();
      return NextResponse.json({ success: true, message: "Stop command issued to runner." });
    }

    const currentStatus = automationEngine.getStatus();
    if (currentStatus.isRunning) {
      return NextResponse.json(
        { error: "Automation engine is already active and running in background." },
        { status: 409 }
      );
    }

    const quota = await getTodayQuota();

    // Check platform specific quota
    if (platform === "linkedin" && quota.platforms.linkedin.remaining <= 0) {
      return NextResponse.json(
        { error: `LinkedIn daily application cap of ${quota.platforms.linkedin.max_cap} has already been reached for today.` },
        { status: 400 }
      );
    }

    if (platform === "internshala" && quota.platforms.internshala.remaining <= 0) {
      return NextResponse.json(
        { error: `Internshala daily application cap of ${quota.platforms.internshala.max_cap} has already been reached for today.` },
        { status: 400 }
      );
    }

    if (platform === "both" && quota.remaining <= 0) {
      return NextResponse.json(
        { error: `Daily application caps for both platforms have already been reached for today.` },
        { status: 400 }
      );
    }

    // Launch automation run in background
    automationEngine
      .start({
        platform,
        opportunityType,
        workplaceType,
        targetLocation,
        applyType,
        dryRun,
        pacingMode,
        ignoreTimeWindow,
      })
      .catch((err) => {
        console.error("Background automation run error:", err);
      });

    return NextResponse.json({
      success: true,
      message: "Automation engine launched in background.",
      dryRun,
      opportunityType: opportunityType || "internship",
      workplaceType: workplaceType || "remote",
      targetLocation: targetLocation || "Remote",
      applyType: applyType || "easy_apply_only",
      pacingMode,
      ignoreTimeWindow,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  automationEngine.stop();
  return NextResponse.json({ success: true, message: "Runner abort signal delivered." });
}
