import { NextResponse } from "next/server";
import { automationEngine } from "@/lib/automation/playwright-runner";
import { getTodayQuota } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const quota = await getTodayQuota();
  return NextResponse.json({
    quota,
    isCapReached: quota.remaining <= 0,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { platform = "both", dryRun = false } = body;

    const quota = await getTodayQuota();
    if (quota.remaining <= 0) {
      return NextResponse.json(
        { error: `Daily application cap of ${quota.max_cap} has already been reached for today.` },
        { status: 400 }
      );
    }

    // Launch automation run in background
    automationEngine.start({ platform, dryRun }).catch((err) => {
      console.error("Background automation run error:", err);
    });

    return NextResponse.json({
      success: true,
      message: "Automation engine launched in background.",
      dryRun,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
