import { NextResponse } from "next/server";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    await ensureDbInitialized();
    const { id } = await params;
    const db = getDb();

    const res = await db.execute({
      sql: "SELECT screenshot_base64, screenshot_path FROM alerts WHERE id = ? AND user_id = ?",
      args: [id, auth.userId],
    });

    if (res.rows.length === 0) {
      return new NextResponse("Screenshot not found", { status: 404 });
    }

    const row = res.rows[0];
    if (row.screenshot_base64) {
      const cleanBase64 = String(row.screenshot_base64).replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    if (row.screenshot_path) {
      const rawPath = String(row.screenshot_path);
      const screenshotsDir = path.resolve(process.cwd(), "data", "screenshots");
      const resolvedPath = path.resolve(rawPath);

      if (resolvedPath.startsWith(screenshotsDir) && fs.existsSync(resolvedPath)) {
        const fileBuffer = fs.readFileSync(resolvedPath);
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }

    return new NextResponse("Screenshot data unavailable", { status: 404 });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return new NextResponse(err.message, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return new NextResponse(message, { status: 500 });
  }
}
