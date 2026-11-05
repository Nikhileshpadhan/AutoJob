import { NextResponse } from "next/server";
import { getDb, getTodayQuota, initDatabase } from "@/lib/db";
import { getRunnerStatus } from "@/lib/automation/runner-state";
import { resolveBrowserExecutablePath } from "@/lib/automation/stealth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initDatabase();
    const db = getDb();
    const quota = await getTodayQuota();
    const engineStatus = getRunnerStatus();

    const countsRes = await db.execute(`
      SELECT 
        COUNT(CASE WHEN status = 'applied' THEN 1 END) as total_applied,
        COUNT(CASE WHEN status = 'awaiting_approval' THEN 1 END) as total_awaiting_approval,
        COUNT(CASE WHEN status = 'external_ready' THEN 1 END) as total_external_ready,
        COUNT(CASE WHEN status IN ('failed', 'captcha_blocked') THEN 1 END) as total_failed,
        COUNT(CASE WHEN status IN ('interviewing', 'offered') THEN 1 END) as total_interviewing
      FROM applications
    `);

    const row = countsRes.rows[0] || {};
    const totalApplied = Number(row.total_applied || 0);
    const totalAwaitingApproval = Number(row.total_awaiting_approval || 0);
    const totalExternalReady = Number(row.total_external_ready || 0);
    const totalFailed = Number(row.total_failed || 0);
    const totalInterviewing = Number(row.total_interviewing || 0);

    const pendingAlertsRes = await db.execute("SELECT COUNT(*) as count FROM alerts WHERE status = 'pending'");
    const pendingAlerts = Number(pendingAlertsRes.rows[0]?.count || 0);

    const platformBreakdownRes = await db.execute(`
      SELECT platform, COUNT(*) as count 
      FROM applications 
      WHERE status = 'applied' 
      GROUP BY platform
    `);

    const platformBreakdown: Record<string, number> = {
      linkedin: 0,
      internshala: 0,
    };

    for (const r of platformBreakdownRes.rows) {
      if (r.platform) {
        platformBreakdown[r.platform as string] = Number(r.count || 0);
      }
    }

    const settingsRes = await db.execute(
      "SELECT key, value FROM system_settings WHERE key IN ('opportunity_type', 'min_match_score', 'workplace_type', 'apply_type', 'pacing_enabled', 'ignore_time_window', 'active_window_start', 'active_window_end', 'min_rest_minutes', 'max_rest_minutes')"
    );
    const settingsMap: Record<string, string> = {
      opportunity_type: "internship",
      min_match_score: "65",
      workplace_type: "remote",
      apply_type: "easy_apply_only",
      pacing_enabled: "true",
      ignore_time_window: "false",
      active_window_start: "9",
      active_window_end: "23",
      min_rest_minutes: "20",
      max_rest_minutes: "60",
    };
    for (const r of settingsRes.rows) {
      if (r.key && r.value) settingsMap[r.key as string] = r.value as string;
    }

    const browserInfo = resolveBrowserExecutablePath();

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
      opportunityType: settingsMap.opportunity_type,
      minMatchScore: settingsMap.min_match_score,
      workplaceType: settingsMap.workplace_type,
      applyType: settingsMap.apply_type,
      pacingEnabled: settingsMap.pacing_enabled !== "false",
      ignoreTimeWindow: settingsMap.ignore_time_window === "true",
      activeWindowStart: parseInt(settingsMap.active_window_start || "9", 10),
      activeWindowEnd: parseInt(settingsMap.active_window_end || "23", 10),
      minRestMinutes: parseInt(settingsMap.min_rest_minutes || "20", 10),
      maxRestMinutes: parseInt(settingsMap.max_rest_minutes || "60", 10),
      browserName: browserInfo.name,
      browserPath: browserInfo.path || "Bundled Chromium",
      platforms: quota.platforms,
      isRunning: engineStatus.isRunning,
      isResting: engineStatus.isResting,
      nextRunAt: engineStatus.nextRunAt,
      activeRunId: engineStatus.activeRunId,
      abortRequested: engineStatus.abortRequested,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
