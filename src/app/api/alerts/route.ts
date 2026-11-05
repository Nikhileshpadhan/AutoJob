import { NextResponse } from "next/server";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    await ensureDbInitialized();
    const db = getDb();

    const rows = await db.execute({
      sql: "SELECT * FROM alerts WHERE user_id = ? ORDER BY id DESC LIMIT 50",
      args: [auth.userId],
    });
    return NextResponse.json({ alerts: rows.rows });
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
    const body = await request.json();
    const { alertId, action } = body;

    const db = getDb();
    await db.execute({
      sql: "UPDATE alerts SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
      args: [action || "resolved", alertId, auth.userId],
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
