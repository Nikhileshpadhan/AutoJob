import { NextResponse } from "next/server";
import { getDb, initDatabase } from "@/lib/db";
import { extractTextFromPdf } from "@/lib/llm/pdf-parser";
import { parseResumeWithLLM } from "@/lib/llm";
import path from "node:path";
import fs from "node:fs";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB (SEC-004)
const MAX_RAW_TEXT_LENGTH = 15000; // Cap LLM token payload (SEC-004)

export async function POST(request: Request) {
  try {
    await initDatabase();
    const formData = await request.formData();
    const file = formData.get("resume") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No PDF resume file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Resume file exceeds maximum allowed limit of 5 MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate %PDF- magic bytes header (SEC-004)
    if (buffer.length < 5 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return NextResponse.json(
        { error: "Uploaded file is not a valid PDF document (missing %PDF- header)." },
        { status: 400 }
      );
    }

    // Persist uploaded PDF into ./data/resumes/ for automated Playwright uploads
    const resumesDir = path.join(process.cwd(), "data", "resumes");
    if (!fs.existsSync(resumesDir)) {
      fs.mkdirSync(resumesDir, { recursive: true });
    }

    const sanitizedBase = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const resumeFileName = `resume_${Date.now()}_${sanitizedBase}`;
    const resumeFilePath = path.join(resumesDir, resumeFileName);
    fs.writeFileSync(resumeFilePath, buffer);

    // Extract text from PDF
    const rawText = await extractTextFromPdf(buffer);
    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from the PDF file. Ensure the PDF contains readable text." },
        { status: 400 }
      );
    }

    // Truncate rawText to 15,000 characters before LLM parsing (SEC-004)
    const textForLLM = rawText.slice(0, MAX_RAW_TEXT_LENGTH);

    // Parse structured profile using LLM with regex fallback
    let parsedProfile;
    try {
      parsedProfile = await parseResumeWithLLM(textForLLM);
    } catch (llmErr) {
      console.warn("LLM parsing fallback, applying heuristic extraction:", llmErr);
      const emailMatch = rawText.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
      const phoneMatch = rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      const linkedinMatch = rawText.match(/linkedin\.com\/in\/[\w-]+/i);
      const githubMatch = rawText.match(/github\.com\/[\w-]+/i);
      const firstLine = rawText.split('\n').map(l => l.trim()).find(l => l.length > 2 && l.length < 50) || "";

      parsedProfile = {
        fullName: firstLine,
        email: emailMatch ? emailMatch[0] : "",
        phone: phoneMatch ? phoneMatch[0] : "",
        location: "",
        githubUrl: githubMatch ? `https://${githubMatch[0]}` : "",
        linkedinUrl: linkedinMatch ? `https://${linkedinMatch[0]}` : "",
        portfolioUrl: "",
        summary: "",
        skills: [],
        experience: [],
        education: [],
        rawText,
      };
    }

    const db = getDb();
    const skillsJson = JSON.stringify(parsedProfile.skills || []);
    const expJson = JSON.stringify(parsedProfile.experience || []);
    const eduJson = JSON.stringify(parsedProfile.education || []);

    // Atomic Upsert: guarantees profile exists even on fresh DB (BE-001)
    await db.execute({
      sql: `INSERT INTO profile (
              id, full_name, email, phone, location, github_url, linkedin_url, portfolio_url,
              summary, skills_json, experience_json, education_json, raw_resume_text, resume_file_path, updated_at
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              full_name = CASE WHEN excluded.full_name != '' THEN excluded.full_name ELSE profile.full_name END,
              email = CASE WHEN excluded.email != '' THEN excluded.email ELSE profile.email END,
              phone = CASE WHEN excluded.phone != '' THEN excluded.phone ELSE profile.phone END,
              location = CASE WHEN excluded.location != '' THEN excluded.location ELSE profile.location END,
              github_url = CASE WHEN excluded.github_url != '' THEN excluded.github_url ELSE profile.github_url END,
              linkedin_url = CASE WHEN excluded.linkedin_url != '' THEN excluded.linkedin_url ELSE profile.linkedin_url END,
              portfolio_url = CASE WHEN excluded.portfolio_url != '' THEN excluded.portfolio_url ELSE profile.portfolio_url END,
              summary = CASE WHEN excluded.summary != '' THEN excluded.summary ELSE profile.summary END,
              skills_json = CASE WHEN excluded.skills_json != '[]' THEN excluded.skills_json ELSE profile.skills_json END,
              experience_json = CASE WHEN excluded.experience_json != '[]' THEN excluded.experience_json ELSE profile.experience_json END,
              education_json = CASE WHEN excluded.education_json != '[]' THEN excluded.education_json ELSE profile.education_json END,
              raw_resume_text = excluded.raw_resume_text,
              resume_file_path = excluded.resume_file_path,
              updated_at = CURRENT_TIMESTAMP`,
      args: [
        parsedProfile.fullName || "",
        parsedProfile.email || "",
        parsedProfile.phone || "",
        parsedProfile.location || "",
        parsedProfile.githubUrl || "",
        parsedProfile.linkedinUrl || "",
        parsedProfile.portfolioUrl || "",
        parsedProfile.summary || "",
        skillsJson,
        expJson,
        eduJson,
        rawText,
        resumeFilePath,
      ],
    });

    const res = await db.execute("SELECT * FROM profile WHERE id = 1");
    const row = res.rows[0];

    const finalProfile = {
      fullName: (row.full_name as string) || parsedProfile.fullName || "",
      email: (row.email as string) || parsedProfile.email || "",
      phone: (row.phone as string) || parsedProfile.phone || "",
      location: (row.location as string) || parsedProfile.location || "",
      githubUrl: (row.github_url as string) || parsedProfile.githubUrl || "",
      linkedinUrl: (row.linkedin_url as string) || parsedProfile.linkedinUrl || "",
      portfolioUrl: (row.portfolio_url as string) || parsedProfile.portfolioUrl || "",
      summary: (row.summary as string) || parsedProfile.summary || "",
      skills: row.skills_json ? JSON.parse(row.skills_json as string) : parsedProfile.skills || [],
      experience: row.experience_json ? JSON.parse(row.experience_json as string) : parsedProfile.experience || [],
      education: row.education_json ? JSON.parse(row.education_json as string) : parsedProfile.education || [],
      rawText,
      resumeFilePath,
    };

    return NextResponse.json({
      success: true,
      profile: finalProfile,
      message: "Resume parsed and profile updated successfully.",
    });
  } catch (err: unknown) {
    console.error("Resume upload & parsing error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
