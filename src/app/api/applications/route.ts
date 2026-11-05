import { NextResponse } from "next/server";
import { getDb, initDatabase, incrementTodayPlatformQuota } from "@/lib/db";

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
    await initDatabase();
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100", 10), 1), 500);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

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

    // Count total matching
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
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDatabase();
    const body = await request.json();
    const {
      platform,
      company,
      position,
      job_url,
      external_job_id,
      status,
      match_score,
      matched_skills,
      missing_skills,
      match_reasoning,
      tailored_letter,
      form_payload,
      notes,
    } = body;

    if (!platform || !company || !position || !status) {
      return NextResponse.json({ error: "Missing required fields: platform, company, position, status" }, { status: 400 });
    }

    const validPlatform = platform === "internshala" ? "internshala" : "linkedin";
    const safeJobUrl = sanitizeUrl(job_url);

    const db = getDb();
    const result = await db.execute({
      sql: `INSERT INTO applications (
              platform, company, position, job_url, external_job_id, status,
              match_score, matched_skills_json, missing_skills_json, match_reasoning,
              tailored_letter, form_payload_json, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        validPlatform,
        company,
        position,
        safeJobUrl,
        external_job_id || null,
        status,
        typeof match_score === "number" ? match_score : null,
        matched_skills ? JSON.stringify(matched_skills) : null,
        missing_skills ? JSON.stringify(missing_skills) : null,
        match_reasoning || null,
        tailored_letter || null,
        form_payload ? JSON.stringify(form_payload) : null,
        notes || null,
      ],
    });

    // Only increment daily quota if application is confirmed 'applied' (BE-003, AUTO-003)
    if (status === "applied") {
      await incrementTodayPlatformQuota(validPlatform);
    }

    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
