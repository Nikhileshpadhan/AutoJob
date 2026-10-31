import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { getDb } from "../db";
import type { ParsedProfile } from "./pdf-parser";

interface LLMConfig {
  geminiApiKey?: string;
  groqApiKey?: string;
  preferredProvider?: "gemini" | "groq";
}

async function getLLMConfig(): Promise<LLMConfig> {
  const db = getDb();
  const settingsRows = await db.execute("SELECT key, value FROM system_settings");
  const settings: Record<string, string> = {};
  for (const row of settingsRows.rows) {
    if (row.key && row.value) {
      settings[row.key as string] = row.value as string;
    }
  }

  return {
    geminiApiKey: process.env.GEMINI_API_KEY || settings.gemini_api_key || "",
    groqApiKey: process.env.GROQ_API_KEY || settings.groq_api_key || "",
    preferredProvider: (process.env.ACTIVE_LLM_PROVIDER || settings.active_llm || "gemini") as "gemini" | "groq",
  };
}

export async function callLLM(prompt: string, systemInstruction?: string): Promise<string> {
  const config = await getLLMConfig();
  const provider = config.preferredProvider;

  // Try preferred provider first, then fallback
  if (provider === "groq" && config.groqApiKey) {
    try {
      return await callGroq(prompt, config.groqApiKey, systemInstruction);
    } catch (err) {
      console.warn("Groq failed, attempting Gemini fallback:", err);
      if (config.geminiApiKey) {
        return await callGemini(prompt, config.geminiApiKey, systemInstruction);
      }
      throw err;
    }
  }

  // Default to Gemini
  if (config.geminiApiKey) {
    try {
      return await callGemini(prompt, config.geminiApiKey, systemInstruction);
    } catch (err) {
      console.warn("Gemini failed, attempting Groq fallback:", err);
      if (config.groqApiKey) {
        return await callGroq(prompt, config.groqApiKey, systemInstruction);
      }
      throw err;
    }
  }

  if (config.groqApiKey) {
    return await callGroq(prompt, config.groqApiKey, systemInstruction);
  }

  throw new Error("No API key configured for Gemini or Groq. Please configure an API key in Settings or .env.");
}

async function callGemini(prompt: string, apiKey: string, systemInstruction?: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: systemInstruction ? { systemInstruction } : undefined,
  });

  return response.text || "";
}

async function callGroq(prompt: string, apiKey: string, systemInstruction?: string): Promise<string> {
  const groq = new Groq({ apiKey });
  const messages: Array<{ role: "system" | "user"; content: string }> = [];

  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages,
    temperature: 0.4,
  });

  return completion.choices[0]?.message?.content || "";
}

export async function parseResumeWithLLM(rawResumeText: string): Promise<ParsedProfile> {
  const systemPrompt = `You are an expert resume parsing engine. Extract the candidate's structured profile information strictly as valid JSON adhering to this schema:
{
  "fullName": "Full Name",
  "email": "email address",
  "phone": "phone number",
  "location": "City, Country",
  "githubUrl": "github profile link or empty string",
  "linkedinUrl": "linkedin profile link or empty string",
  "portfolioUrl": "portfolio link or empty string",
  "skills": ["skill1", "skill2"],
  "experience": [
    {
      "role": "Title",
      "company": "Company Name",
      "duration": "Dates",
      "description": "Short description"
    }
  ],
  "education": [
    {
      "degree": "Degree Title",
      "institution": "University / College",
      "year": "Graduation year"
    }
  ],
  "summary": "2-3 sentence executive professional summary"
}
Output ONLY the raw JSON object, without backticks, markdown fences, or extra commentary.`;

  const output = await callLLM(
    `Extract structured data from the following resume text:\n\n${rawResumeText}`,
    systemPrompt
  );

  try {
    const cleaned = output.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      ...parsed,
      rawText: rawResumeText,
    };
  } catch (err) {
    console.error("Failed to parse LLM resume response as JSON:", output, err);
    return {
      fullName: "",
      skills: [],
      experience: [],
      education: [],
      rawText: rawResumeText,
    };
  }
}

export async function generateTailoredCoverLetter(params: {
  candidateProfile: Record<string, unknown>;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}): Promise<string> {
  const systemPrompt = `You are an elite career strategist. Write an ultra-tailored, impactful purpose/cover letter for a job application.
STRICT REQUIREMENTS:
1. Max length: exactly 120-150 words.
2. Tone: Confident, crisp, professional, human (not robotic or generic).
3. Connect the candidate's actual projects/skills directly with the target company's job requirements.
4. Do not include placeholder brackets like [Company Name] or [Your Name]; use the actual candidate and company names provided.
5. No conversational preamble or postscript (e.g., do not say 'Here is your letter:').`;

  const userPrompt = `Candidate Profile:
${JSON.stringify(params.candidateProfile, null, 2)}

Target Company: ${params.companyName}
Target Role: ${params.jobTitle}
Job Description:
${params.jobDescription}

Generate the tailored 150-word cover letter:`;

  return await callLLM(userPrompt, systemPrompt);
}

export async function answerFormQuestions(params: {
  candidateProfile: Record<string, unknown>;
  jobDescription: string;
  questions: Array<{ id: string; label: string; type?: string; options?: string[] }>;
}): Promise<Record<string, string>> {
  const systemPrompt = `You are an automated job application assistant. You answer custom company screening questions based strictly on the candidate's profile and truthfulness.
Given a list of form questions (labels, input types, and optional select options), output a valid JSON object where the keys are the question IDs and values are the concise, optimal answers.
Rules:
1. For years of experience, output a realistic number based on candidate's experience.
2. For multiple choice / select fields, pick the best matching option from the provided options list.
3. For short text or 'why should we hire you' or 'describe your experience with X', provide a punchy 1-3 sentence answer tailored to the company.
4. For salary expectations or notice period, if not specified in profile, use standard professional defaults (e.g., 'Negotiable' or 'Immediately available').
5. Return ONLY pure JSON matching { "question_id": "answer" }.`;

  const userPrompt = `Candidate Profile:
${JSON.stringify(params.candidateProfile, null, 2)}

Job Details:
${params.jobDescription.slice(0, 1000)}

Form Questions:
${JSON.stringify(params.questions, null, 2)}

Generate answers JSON:`;

  const response = await callLLM(userPrompt, systemPrompt);
  try {
    const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse answers as JSON:", response, err);
    return {};
  }
}
