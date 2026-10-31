import { NextResponse } from "next/server";
import { getDb, getTodayQuota } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const quota = await getTodayQuota();

    const totalAppliedRes = await db.execute("SELECT COUNT(*) as count FROM applications WHERE status = 'applied'");
    const totalApplied = Number(totalAppliedRes.rows[0]?.count || 0);

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

    for (const row of platformBreakdownRes.rows) {
      if (row.platform) {
        platformBreakdown[row.platform as string] = Number(row.count || 0);
      }
    }

    return NextResponse.json({
      totalApplied,
      todayApplied: quota.applied_count,
      todayCap: quota.max_cap,
      todayRemaining: quota.remaining,
      pendingAlerts,
      platformBreakdown,
      todayDate: quota.date,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
