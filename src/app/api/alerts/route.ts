import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT 50");
    return NextResponse.json({ alerts: rows.rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { alertId, action } = body; // action: 'resolved' | 'dismissed'

    const db = getDb();
    await db.execute({
      sql: "UPDATE alerts SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [action || "resolved", alertId],
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
