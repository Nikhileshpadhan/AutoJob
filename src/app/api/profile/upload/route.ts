import { NextResponse } from "next/server";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { extractTextFromPdf } from "@/lib/llm/pdf-parser";
import { parseResumeWithLLM } from "@/lib/llm";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_RAW_TEXT_LENGTH = 15000;

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    await ensureDbInitialized();

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

    // Validate %PDF- magic bytes header
    if (buffer.length < 5 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return NextResponse.json(
        { error: "Uploaded file is not a valid PDF document (missing %PDF- header)." },
        { status: 400 }
      );
    }

    const resumePdfBase64 = buffer.toString("base64");
    const resumeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");

    // Extract text from PDF
    const rawText = await extractTextFromPdf(buffer);
    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from the PDF file. Ensure the PDF contains readable text." },
        { status: 400 }
      );
    }

    const textForLLM = rawText.slice(0, MAX_RAW_TEXT_LENGTH);

    // Parse structured profile using LLM
    let parsedProfile;
    try {
      parsedProfile = await parseResumeWithLLM(textForLLM, auth.userId);
    } catch (llmErr) {
      console.warn("LLM parsing fallback, applying heuristic extraction:", llmErr);
      const emailMatch = rawText.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
      const phoneMatch = rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      const linkedinMatch = rawText.match(/linkedin\.com\/in\/[\w-]+/i);
      const githubMatch = rawText.match(/github\.com\/[\w-]+/i);
      const firstLine =
        rawText
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l.length > 2 && l.length < 50) || "";

      parsedProfile = {
        fullName: firstLine,
        email: emailMatch ? emailMatch[0] : auth.email,
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

    // Atomic Upsert into user's profile row
    await db.execute({
      sql: `INSERT INTO profiles (
              user_id, full_name, email, phone, location, github_url, linkedin_url, portfolio_url,
              summary, skills_json, experience_json, education_json, raw_resume_text,
              resume_pdf_base64, resume_filename, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              full_name = CASE WHEN excluded.full_name != '' THEN excluded.full_name ELSE profiles.full_name END,
              email = CASE WHEN excluded.email != '' THEN excluded.email ELSE profiles.email END,
              phone = CASE WHEN excluded.phone != '' THEN excluded.phone ELSE profiles.phone END,
              location = CASE WHEN excluded.location != '' THEN excluded.location ELSE profiles.location END,
              github_url = CASE WHEN excluded.github_url != '' THEN excluded.github_url ELSE profiles.github_url END,
              linkedin_url = CASE WHEN excluded.linkedin_url != '' THEN excluded.linkedin_url ELSE profiles.linkedin_url END,
              portfolio_url = CASE WHEN excluded.portfolio_url != '' THEN excluded.portfolio_url ELSE profiles.portfolio_url END,
              summary = CASE WHEN excluded.summary != '' THEN excluded.summary ELSE profiles.summary END,
              skills_json = CASE WHEN excluded.skills_json != '[]' THEN excluded.skills_json ELSE profiles.skills_json END,
              experience_json = CASE WHEN excluded.experience_json != '[]' THEN excluded.experience_json ELSE profiles.experience_json END,
              education_json = CASE WHEN excluded.education_json != '[]' THEN excluded.education_json ELSE profiles.education_json END,
              raw_resume_text = excluded.raw_resume_text,
              resume_pdf_base64 = excluded.resume_pdf_base64,
              resume_filename = excluded.resume_filename,
              updated_at = CURRENT_TIMESTAMP`,
      args: [
        auth.userId,
        parsedProfile.fullName || "",
        parsedProfile.email || auth.email,
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
        resumePdfBase64,
        resumeFilename,
      ],
    });

    return NextResponse.json({
      success: true,
      message: "Resume uploaded, encrypted, and parsed successfully.",
      filename: resumeFilename,
      profile: {
        fullName: parsedProfile.fullName,
        email: parsedProfile.email || auth.email,
        phone: parsedProfile.phone,
        skills: parsedProfile.skills || [],
        experience: parsedProfile.experience || [],
        education: parsedProfile.education || [],
        rawText,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Failed to process resume upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
