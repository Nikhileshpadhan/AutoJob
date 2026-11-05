import { NextResponse } from "next/server";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    await ensureDbInitialized();
    const db = getDb();

    const res = await db.execute({
      sql: "SELECT * FROM profiles WHERE user_id = ?",
      args: [auth.userId],
    });

    if (res.rows.length === 0) {
      return NextResponse.json({
        profile: {
          userId: auth.userId,
          fullName: "",
          email: auth.email,
          phone: "",
          location: "",
          githubUrl: "",
          linkedinUrl: "",
          portfolioUrl: "",
          summary: "",
          resumeFilename: "",
          rawResumeText: "",
          skills: [],
          experience: [],
          education: [],
          targetRoles: [
            "Software Engineer",
            "Full Stack Developer",
            "Frontend Developer",
            "Backend Developer",
          ],
          updatedAt: new Date().toISOString(),
        },
      });
    }

    const p = res.rows[0];
    return NextResponse.json({
      profile: {
        userId: String(p.user_id),
        fullName: String(p.full_name || ""),
        email: String(p.email || auth.email),
        phone: String(p.phone || ""),
        location: String(p.location || ""),
        githubUrl: String(p.github_url || ""),
        linkedinUrl: String(p.linkedin_url || ""),
        portfolioUrl: String(p.portfolio_url || ""),
        summary: String(p.summary || ""),
        resumeFilename: String(p.resume_filename || ""),
        rawResumeText: String(p.raw_resume_text || ""),
        hasResumePdf: Boolean(p.resume_pdf_base64),
        skills: p.skills_json ? JSON.parse(String(p.skills_json)) : [],
        experience: p.experience_json ? JSON.parse(String(p.experience_json)) : [],
        education: p.education_json ? JSON.parse(String(p.education_json)) : [],
        targetRoles: p.target_roles_json ? JSON.parse(String(p.target_roles_json)) : [],
        updatedAt: String(p.updated_at || new Date().toISOString()),
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
    const db = getDb();
    const userId = auth.userId;

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
      sql: `INSERT INTO profiles (
              user_id, full_name, email, phone, location, github_url, linkedin_url, portfolio_url,
              summary, skills_json, experience_json, education_json, target_roles_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
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
              target_roles_json = excluded.target_roles_json,
              updated_at = CURRENT_TIMESTAMP`,
      args: [
        userId,
        fullName || "",
        email || auth.email,
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

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
