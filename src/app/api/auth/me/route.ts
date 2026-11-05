import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { getDb, ensureDbInitialized } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    await ensureDbInitialized();
    const db = getDb();

    const res = await db.execute({
      sql: "SELECT id, name, email, created_at FROM users WHERE id = ?",
      args: [auth.userId],
    });

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const row = res.rows[0];
    return NextResponse.json({
      user: {
        id: String(row.id),
        name: String(row.name),
        email: String(row.email),
        createdAt: String(row.created_at),
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

