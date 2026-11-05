import { NextResponse } from "next/server";
import { getDb, initDatabase } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDatabase();
    const { id } = await params;
    const db = getDb();

    const res = await db.execute({
      sql: "SELECT screenshot_path FROM alerts WHERE id = ?",
      args: [id],
    });

    if (res.rows.length === 0 || !res.rows[0].screenshot_path) {
      return new NextResponse("Screenshot not found", { status: 404 });
    }

    const rawPath = res.rows[0].screenshot_path as string;
    const screenshotsDir = path.resolve(process.cwd(), "data", "screenshots");
    const resolvedPath = path.resolve(rawPath);

    // Guard against directory traversal: ensure file is strictly inside data/screenshots/
    if (!resolvedPath.startsWith(screenshotsDir)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (!fs.existsSync(resolvedPath)) {
      return new NextResponse("Screenshot file not found on disk", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(resolvedPath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return new NextResponse(message, { status: 500 });
  }
}
