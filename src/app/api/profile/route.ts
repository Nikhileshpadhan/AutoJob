import { NextResponse } from "next/server";
import { getDb, initDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initDatabase();
    const db = getDb();
    const res = await db.execute("SELECT * FROM profile WHERE id = 1");
    if (res.rows.length === 0) {
      return NextResponse.json({ profile: null });
    }
    const profile = res.rows[0];
    return NextResponse.json({
      profile: {
        id: profile.id,
        fullName: profile.full_name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        location: profile.location || "",
        githubUrl: profile.github_url || "",
        linkedinUrl: profile.linkedin_url || "",
        portfolioUrl: profile.portfolio_url || "",
        summary: profile.summary || "",
        resumeFilePath: profile.resume_file_path || "",
        rawResumeText: profile.raw_resume_text || "",
        skills: profile.skills_json ? JSON.parse(profile.skills_json as string) : [],
        experience: profile.experience_json ? JSON.parse(profile.experience_json as string) : [],
        education: profile.education_json ? JSON.parse(profile.education_json as string) : [],
        projects: profile.projects_json ? JSON.parse(profile.projects_json as string) : [],
        screeningDefaults: profile.screening_defaults_json
          ? JSON.parse(profile.screening_defaults_json as string)
          : {},
        targetRoles: profile.target_roles_json ? JSON.parse(profile.target_roles_json as string) : [],
        updatedAt: profile.updated_at || profile.created_at,
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
      projects,
      screeningDefaults,
      targetRoles,
    } = body;

    await db.execute({
      sql: `INSERT INTO profile (
              id, full_name, email, phone, location, github_url, linkedin_url, portfolio_url,
              summary, skills_json, experience_json, education_json, projects_json,
              screening_defaults_json, target_roles_json, updated_at
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              full_name = excluded.full_name,
              email = excluded.email,
              phone = excluded.phone,
              location = excluded.location,
              github_url = excluded.github_url,
              linkedin_url = excluded.linkedin_url,
              portfolio_url = excluded.portfolio_url,
              summary = excluded.summary,
              skills_json = excluded.skills_json,
              experience_json = excluded.experience_json,
              education_json = excluded.education_json,
              projects_json = excluded.projects_json,
              screening_defaults_json = excluded.screening_defaults_json,
              target_roles_json = excluded.target_roles_json,
              updated_at = CURRENT_TIMESTAMP`,
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
        JSON.stringify(projects || []),
        JSON.stringify(screeningDefaults || {}),
        JSON.stringify(targetRoles || []),
      ],
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
