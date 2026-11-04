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

    // Save into SQLite
    const db = getDb();
    const skillsJson = JSON.stringify(parsedProfile.skills || []);
    const expJson = JSON.stringify(parsedProfile.experience || []);
    const eduJson = JSON.stringify(parsedProfile.education || []);

    await db.execute({
      sql: `UPDATE profile SET
            full_name = CASE WHEN ? != '' THEN ? ELSE full_name END,
            email = CASE WHEN ? != '' THEN ? ELSE email END,
            phone = CASE WHEN ? != '' THEN ? ELSE phone END,
            location = CASE WHEN ? != '' THEN ? ELSE location END,
            github_url = CASE WHEN ? != '' THEN ? ELSE github_url END,
            linkedin_url = CASE WHEN ? != '' THEN ? ELSE linkedin_url END,
            portfolio_url = CASE WHEN ? != '' THEN ? ELSE portfolio_url END,
            summary = CASE WHEN ? != '' THEN ? ELSE summary END,
            skills_json = CASE WHEN ? != '[]' THEN ? ELSE skills_json END,
            experience_json = CASE WHEN ? != '[]' THEN ? ELSE experience_json END,
            education_json = CASE WHEN ? != '[]' THEN ? ELSE education_json END,
            raw_resume_text = ?,
            updated_at = CURRENT_TIMESTAMP
            WHERE id = 1`,
      args: [
        parsedProfile.fullName || "",
        parsedProfile.fullName || "",
        parsedProfile.email || "",
        parsedProfile.email || "",
        parsedProfile.phone || "",
        parsedProfile.phone || "",
        parsedProfile.location || "",
        parsedProfile.location || "",
        parsedProfile.githubUrl || "",
        parsedProfile.githubUrl || "",
        parsedProfile.linkedinUrl || "",
        parsedProfile.linkedinUrl || "",
        parsedProfile.portfolioUrl || "",
        parsedProfile.portfolioUrl || "",
        parsedProfile.summary || "",
        parsedProfile.summary || "",
        skillsJson,
        skillsJson,
        expJson,
        expJson,
        eduJson,
        eduJson,
        rawText,
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
    };

    return NextResponse.json({
      success: true,
      profile: finalProfile,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Resume upload failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
