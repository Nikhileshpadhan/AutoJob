import { NextResponse } from "next/server";
import { getDb, getTodayQuota, ensureDbInitialized, getUserSettings, getRunnerState } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { resolveBrowserExecutablePath } from "@/lib/automation/stealth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    await ensureDbInitialized();
    const db = getDb();
    const userId = auth.userId;

    const quota = await getTodayQuota(userId);
    const runnerState = await getRunnerState(userId);

    const countsRes = await db.execute({
      sql: `SELECT 
              COUNT(CASE WHEN status = 'applied' THEN 1 END) as total_applied,
              COUNT(CASE WHEN status = 'awaiting_approval' THEN 1 END) as total_awaiting_approval,
              COUNT(CASE WHEN status = 'external_ready' THEN 1 END) as total_external_ready,
              COUNT(CASE WHEN status IN ('failed', 'captcha_blocked') THEN 1 END) as total_failed,
              COUNT(CASE WHEN status IN ('interviewing', 'offered') THEN 1 END) as total_interviewing
            FROM applications
            WHERE user_id = ?`,
      args: [userId],
    });

    const row = countsRes.rows[0] || {};
    const totalApplied = Number(row.total_applied || 0);
    const totalAwaitingApproval = Number(row.total_awaiting_approval || 0);
    const totalExternalReady = Number(row.total_external_ready || 0);
    const totalFailed = Number(row.total_failed || 0);
    const totalInterviewing = Number(row.total_interviewing || 0);

    const pendingAlertsRes = await db.execute({
      sql: "SELECT COUNT(*) as count FROM alerts WHERE user_id = ? AND status = 'pending'",
      args: [userId],
    });
    const pendingAlerts = Number(pendingAlertsRes.rows[0]?.count || 0);

    const platformBreakdownRes = await db.execute({
      sql: `SELECT platform, COUNT(*) as count 
            FROM applications 
            WHERE user_id = ? AND status = 'applied' 
            GROUP BY platform`,
      args: [userId],
    });

    const platformBreakdown: Record<string, number> = {
      linkedin: 0,
      internshala: 0,
    };

    for (const r of platformBreakdownRes.rows) {
      if (r.platform) {
        platformBreakdown[r.platform as string] = Number(r.count || 0);
      }
    }

    const settings = await getUserSettings(userId);
    const browserInfo = resolveBrowserExecutablePath();

    const isRunning = runnerState.isEnabled;
    const isResting = runnerState.status === "resting";

    return NextResponse.json({
      totalApplied,
      totalAwaitingApproval,
      totalExternalReady,
      totalFailed,
      totalInterviewing,
      todayApplied: quota.applied_count,
      todayCap: quota.max_cap,
      todayRemaining: quota.remaining,
      pendingAlerts,
      platformBreakdown,
      todayDate: quota.date,
      opportunityType: settings.opportunity_type || "internship",
      minMatchScore: settings.min_match_score || "65",
      workplaceType: settings.workplace_type || "remote",
      applyType: settings.apply_type || "easy_apply_only",
      pacingEnabled: settings.pacing_enabled !== "false",
      ignoreTimeWindow: settings.ignore_time_window === "true",
      activeWindowStart: parseInt(settings.active_window_start || "9", 10),
      activeWindowEnd: parseInt(settings.active_window_end || "23", 10),
      minRestMinutes: parseInt(settings.min_rest_minutes || "20", 10),
      maxRestMinutes: parseInt(settings.max_rest_minutes || "60", 10),
      browserName: browserInfo.name,
      browserPath: browserInfo.path || "Headless Chromium",
      platforms: quota.platforms,
      isRunning,
      isResting,
      status: runnerState.status,
      nextRunAt: runnerState.nextRunAt,
      lastRunAt: runnerState.lastRunAt,
      activeRunId: runnerState.isEnabled ? "Active" : null,
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
