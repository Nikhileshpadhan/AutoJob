import { NextResponse } from "next/server";
import { getDb, ensureDbInitialized, incrementTodayPlatformQuota } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

function sanitizeUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    await ensureDbInitialized();

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100", 10), 1), 500);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const db = getDb();
    let query = "SELECT * FROM applications WHERE user_id = ?";
    const args: (string | number)[] = [auth.userId];

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

    const countSql = query.replace("SELECT *", "SELECT COUNT(*) as total");
    const countRes = await db.execute({ sql: countSql, args: [...args] });
    const totalCount = Number(countRes.rows[0]?.total || 0);

    query += " ORDER BY id DESC LIMIT ? OFFSET ?";
    args.push(limit, offset);

    const res = await db.execute({ sql: query, args });

    return NextResponse.json({
      applications: res.rows,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
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
    const {
      platform,
      company,
      position,
      jobUrl,
      status = "applied",
      matchScore,
      tailoredLetter,
      formPayload,
      notes,
      externalJobId,
    } = body;

    if (!platform || !company || !position) {
      return NextResponse.json(
        { error: "platform, company, and position are mandatory fields." },
        { status: 400 }
      );
    }

    const db = getDb();
    const safeJobUrl = sanitizeUrl(jobUrl);

    const res = await db.execute({
      sql: `INSERT INTO applications (
              user_id, platform, company, position, job_url, status, match_score,
              tailored_letter, form_payload_json, notes, external_job_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        auth.userId,
        platform,
        company,
        position,
        safeJobUrl,
        status,
        matchScore || null,
        tailoredLetter || null,
        formPayload ? JSON.stringify(formPayload) : null,
        notes || null,
        externalJobId || null,
      ],
    });

    if (status === "applied") {
      await incrementTodayPlatformQuota(
        auth.userId,
        platform.toLowerCase() === "internshala" ? "internshala" : "linkedin"
      );
    }

    return NextResponse.json({
      success: true,
      id: Number(res.lastInsertRowid),
      message: "Application recorded successfully.",
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
