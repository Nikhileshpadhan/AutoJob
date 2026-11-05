import { NextResponse } from "next/server";
import { getDb, initDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDatabase();
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const allowedStatuses = [
      "applied",
      "awaiting_approval",
      "external_ready",
      "interviewing",
      "offered",
      "rejected",
      "skipped",
      "failed",
      "captcha_blocked",
    ];

    const updates: string[] = [];
    const args: (string | number | null)[] = [];

    if (body.status !== undefined) {
      if (!allowedStatuses.includes(body.status)) {
        return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
      }
      updates.push("status = ?");
      args.push(body.status);
    }

    if (body.notes !== undefined) {
      updates.push("notes = ?");
      args.push(body.notes);
    }

    if (body.tailored_letter !== undefined) {
      updates.push("tailored_letter = ?");
      args.push(body.tailored_letter);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    args.push(id);
    await db.execute({
      sql: `UPDATE applications SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    const updated = await db.execute({
      sql: "SELECT * FROM applications WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true, application: updated.rows[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDatabase();
    const { id } = await params;
    const db = getDb();

    await db.execute({
      sql: "DELETE FROM applications WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true, message: `Application ${id} deleted.` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
