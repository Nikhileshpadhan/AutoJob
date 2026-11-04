import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { getDb } from "../db";
import type { ParsedProfile } from "./pdf-parser";

interface LLMConfig {
  geminiApiKey?: string;
  groqApiKey?: string;
  preferredProvider?: "gemini" | "groq";
  geminiModel?: string;
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
    geminiModel: process.env.GEMINI_MODEL || settings.gemini_model || "gemini-3.5-flash",
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
        return await callGemini(prompt, config.geminiApiKey, systemInstruction, config.geminiModel);
      }
      throw err;
    }
  }

  // Default to Gemini
  if (config.geminiApiKey) {
    try {
      return await callGemini(prompt, config.geminiApiKey, systemInstruction, config.geminiModel);
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

async function callGemini(
  prompt: string,
  apiKey: string,
  systemInstruction?: string,
  preferredModel: string = "gemini-3.5-flash"
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  // Priority candidate models: preferred first, with auto-fallback to 3.5-flash, 3.8-flash, and 3.1-flash-lite
  const candidateModels = [
    preferredModel,
    process.env.GEMINI_MODEL,
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
  ].filter(Boolean) as string[];

  const models = Array.from(new Set(candidateModels));
  let lastError: unknown;

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            abortSignal: controller.signal,
            ...(systemInstruction ? { systemInstruction } : {}),
          },
        });
        if (response.text) {
          return response.text;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: unknown) {
      console.warn(`Gemini model ${model} failed, attempting fallback:`, err);
      lastError = err;
    }
  }

  throw lastError;
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
    let jsonString = output.trim();
    const firstBrace = jsonString.indexOf("{");
    const lastBrace = jsonString.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = jsonString.slice(firstBrace, lastBrace + 1);
    } else {
      jsonString = jsonString.replace(/```json/gi, "").replace(/```/g, "").trim();
    }
    const parsed = JSON.parse(jsonString);
    return {
      ...parsed,
      rawText: rawResumeText,
    };
  } catch (err) {
    console.error("Failed to parse LLM resume response as JSON:", output, err);
    throw new Error(`Failed to parse structured JSON from LLM: ${err instanceof Error ? err.message : String(err)}`);
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

export interface MatchEvaluationResult {
  isRelevant: boolean;
  score: number; // 0 to 100
  isHighChance: boolean;
  reasoning: string;
  matchedSkills: string[];
}

/**
 * Evaluates whether a candidate has a high probability of selection for a given position
 * based on resume skills, student/internship status, and job requirements.
 */
export async function evaluateSelectionProbability(params: {
  candidateProfile: Record<string, unknown>;
  candidateSkills: string[];
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  opportunityType: "internship" | "job";
  minScoreThreshold?: number;
}): Promise<MatchEvaluationResult> {
  const titleLower = params.jobTitle.toLowerCase();
  const jdLower = (params.jobDescription || "").toLowerCase();
  const combined = `${titleLower} ${jdLower}`;
  const threshold = params.minScoreThreshold ?? 65;

  // 1. Strict negative filter: if student/internship mode, disqualify senior/lead roles
  if (params.opportunityType === "internship") {
    const seniorKeywords = [
      "senior",
      "sr.",
      "lead",
      "principal",
      "staff",
      "director",
      "vp",
      "manager",
      "architect",
      "5+ years",
      "6+ years",
      "7+ years",
      "8+ years",
      "10+ years",
    ];

    for (const kw of seniorKeywords) {
      if (titleLower.includes(kw)) {
        return {
          isRelevant: false,
          score: 15,
          isHighChance: false,
          reasoning: `Disqualified senior title "${kw}" - not suited for student internship.`,
          matchedSkills: [],
        };
      }
    }
  }

  // 2. Disqualify completely unrelated domains
  const unrelatedDomains = [
    "nurse",
    "physician",
    "medical",
    "accountant",
    "accounting",
    "audit executive",
    "sales executive",
    "b2b sales",
    "telecaller",
    "customer support",
    "graphic designer",
    "legal counsel",
    "lawyer",
    "driver",
    "chef",
  ];

  for (const neg of unrelatedDomains) {
    if (
      titleLower.includes(neg) &&
      !titleLower.includes("engineer") &&
      !titleLower.includes("developer") &&
      !titleLower.includes("ai") &&
      !titleLower.includes("software")
    ) {
      return {
        isRelevant: false,
        score: 0,
        isHighChance: false,
        reasoning: `Disqualified unrelated domain (${neg}).`,
        matchedSkills: [],
      };
    }
  }

  // 3. Match resume skills against description
  const matched: string[] = [];
  for (const skill of params.candidateSkills) {
    const clean = skill.trim().toLowerCase();
    if (!clean || clean.length < 2) continue;
    if (clean.length <= 4) {
      const reg = new RegExp(`\\b${clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (reg.test(combined)) matched.push(skill);
    } else {
      if (combined.includes(clean)) matched.push(skill);
    }
  }

  // Calculate baseline match score (0 - 100)
  let score = 0;
  if (params.candidateSkills.length > 0) {
    const ratio = matched.length / Math.min(params.candidateSkills.length, 6);
    score = Math.min(100, Math.round(ratio * 70));
  } else {
    score = 40;
  }

  // Bonus for internship keyword alignment in internship mode
  if (params.opportunityType === "internship") {
    const internTerms = ["intern", "internship", "trainee", "fresher", "junior", "apprentice", "graduate"];
    if (internTerms.some((t) => titleLower.includes(t))) {
      score += 25;
    }
  } else {
    const jobTerms = ["developer", "engineer", "software", "programmer", "analyst"];
    if (jobTerms.some((t) => titleLower.includes(t))) {
      score += 15;
    }
  }

  score = Math.min(100, score);
  const isHighChance = score >= threshold;

  return {
    isRelevant: score >= 40,
    score,
    isHighChance,
    reasoning: isHighChance
      ? `High selection match (${score}% >= ${threshold}%): matches ${matched.length} key skills [${matched.slice(0, 4).join(", ")}]`
      : `Moderate/low selection chance (${score}% < ${threshold}% threshold): insufficient skill overlap.`,
    matchedSkills: matched,
  };
}
