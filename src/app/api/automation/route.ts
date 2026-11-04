import { NextResponse } from "next/server";
import { automationEngine } from "@/lib/automation/playwright-runner";
import { getTodayQuota } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const quota = await getTodayQuota();
  return NextResponse.json({
    quota,
    isCapReached: quota.remaining <= 0,
    platforms: quota.platforms,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      platform = "both",
      opportunityType,
      workplaceType,
      targetLocation,
      applyType,
      dryRun = false,
    } = body;

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
      applyType: applyType || "all",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
