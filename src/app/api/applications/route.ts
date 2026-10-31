import { NextResponse } from "next/server";
import { getDb, incrementTodayQuota } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const db = getDb();
    let query = "SELECT * FROM applications WHERE 1=1";
    const args: (string | number)[] = [];

    if (platform && platform !== "all") {
      query += " AND platform = ?";
      args.push(platform);
    }

    if (status && status !== "all") {
      query += " AND status = ?";
      args.push(status);
    }

    if (search) {
      query += " AND (company LIKE ? OR position LIKE ?)";
      args.push(`%${search}%`, `%${search}%`);
    }

    query += " ORDER BY id DESC";

    const res = await db.execute({ sql: query, args });
    return NextResponse.json({ applications: res.rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { platform, company, position, job_url, status, tailored_letter, notes } = body;

    if (!platform || !company || !position || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getDb();
    const result = await db.execute({
      sql: `INSERT INTO applications (platform, company, position, job_url, status, tailored_letter, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [platform, company, position, job_url || null, status, tailored_letter || null, notes || null],
    });

    if (status === "applied") {
      await incrementTodayQuota();
    }

    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
