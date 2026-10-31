import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { extractTextFromPdf } from "@/lib/llm/pdf-parser";
import { parseResumeWithLLM } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("resume") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No PDF resume file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    const rawText = await extractTextFromPdf(buffer);
    if (!rawText.trim()) {
      return NextResponse.json({ error: "Could not extract text from the PDF file." }, { status: 400 });
    }

    // Parse structured profile using LLM
    let parsedProfile;
    try {
      parsedProfile = await parseResumeWithLLM(rawText);
    } catch (llmErr) {
      console.warn("LLM parsing fallback:", llmErr);
      parsedProfile = {
        fullName: "",
        skills: [],
        experience: [],
        education: [],
        rawText,
      };
    }

    // Save into SQLite
    const db = getDb();
    await db.execute({
      sql: `UPDATE profile SET
            full_name = COALESCE(NULLIF(?, ''), full_name),
            email = COALESCE(NULLIF(?, ''), email),
            phone = COALESCE(NULLIF(?, ''), phone),
            location = COALESCE(NULLIF(?, ''), location),
            github_url = COALESCE(NULLIF(?, ''), github_url),
            linkedin_url = COALESCE(NULLIF(?, ''), linkedin_url),
            portfolio_url = COALESCE(NULLIF(?, ''), portfolio_url),
            summary = COALESCE(NULLIF(?, ''), summary),
            skills_json = ?,
            experience_json = ?,
            education_json = ?,
            raw_resume_text = ?,
            updated_at = CURRENT_TIMESTAMP
            WHERE id = 1`,
      args: [
        parsedProfile.fullName || "",
        parsedProfile.email || "",
        parsedProfile.phone || "",
        parsedProfile.location || "",
        parsedProfile.githubUrl || "",
        parsedProfile.linkedinUrl || "",
        parsedProfile.portfolioUrl || "",
        parsedProfile.summary || "",
        JSON.stringify(parsedProfile.skills || []),
        JSON.stringify(parsedProfile.experience || []),
        JSON.stringify(parsedProfile.education || []),
        rawText,
      ],
    });

    return NextResponse.json({
      success: true,
      profile: parsedProfile,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Resume upload failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
