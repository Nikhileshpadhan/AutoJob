import { NextResponse } from "next/server";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    await ensureDbInitialized();
    const resolvedParams = await params;
    const appId = parseInt(resolvedParams.id, 10);
    const db = getDb();

    const res = await db.execute({
      sql: "SELECT * FROM applications WHERE id = ? AND user_id = ?",
      args: [appId, auth.userId],
    });

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json({ application: res.rows[0] });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    await ensureDbInitialized();
    const resolvedParams = await params;
    const appId = parseInt(resolvedParams.id, 10);
    const body = await request.json();
    const db = getDb();

    const allowedFields = ["status", "notes", "match_score", "tailored_letter"];
    const updates: string[] = [];
    const args: (string | number)[] = [];

    for (const [key, val] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        args.push(val as string | number);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid fields provided for update" }, { status: 400 });
    }

    args.push(appId, auth.userId);
    await db.execute({
      sql: `UPDATE applications SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
      args,
    });

    return NextResponse.json({ success: true, message: "Application updated successfully" });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    await ensureDbInitialized();
    const resolvedParams = await params;
    const appId = parseInt(resolvedParams.id, 10);
    const db = getDb();

    await db.execute({
      sql: "DELETE FROM applications WHERE id = ? AND user_id = ?",
      args: [appId, auth.userId],
    });

    return NextResponse.json({ success: true, message: "Application deleted successfully" });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
