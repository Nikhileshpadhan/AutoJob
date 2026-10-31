import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const res = await db.execute("SELECT * FROM profile WHERE id = 1");
    if (res.rows.length === 0) {
      return NextResponse.json({ profile: null });
    }
    const profile = res.rows[0];
    return NextResponse.json({
      profile: {
        ...profile,
        skills: profile.skills_json ? JSON.parse(profile.skills_json as string) : [],
        experience: profile.experience_json ? JSON.parse(profile.experience_json as string) : [],
        education: profile.education_json ? JSON.parse(profile.education_json as string) : [],
        targetRoles: profile.target_roles_json ? JSON.parse(profile.target_roles_json as string) : [],
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = getDb();

    const {
      fullName,
      email,
      phone,
      location,
      githubUrl,
      linkedinUrl,
      portfolioUrl,
      summary,
      skills,
      experience,
      education,
      targetRoles,
    } = body;

    await db.execute({
      sql: `UPDATE profile SET
            full_name = ?,
            email = ?,
            phone = ?,
            location = ?,
            github_url = ?,
            linkedin_url = ?,
            portfolio_url = ?,
            summary = ?,
            skills_json = ?,
            experience_json = ?,
            education_json = ?,
            target_roles_json = ?,
            updated_at = CURRENT_TIMESTAMP
            WHERE id = 1`,
      args: [
        fullName || "",
        email || "",
        phone || "",
        location || "",
        githubUrl || "",
        linkedinUrl || "",
        portfolioUrl || "",
        summary || "",
        JSON.stringify(skills || []),
        JSON.stringify(experience || []),
        JSON.stringify(education || []),
        JSON.stringify(targetRoles || []),
      ],
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
