"use client";

import { useEffect, useState } from "react";
import {
  Send,
  Save,
  CheckCircle2,
  Shield,
  Bot,
  Key,
  SlidersHorizontal,
  ExternalLink,
  MessageSquare,
  Lock,
  Sparkles,
  GraduationCap,
  Briefcase,
  Target,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const [opportunityType, setOpportunityType] = useState<"internship" | "job">("internship");
  const [linkedinDailyCap, setLinkedinDailyCap] = useState("5");
  const [internshalaDailyCap, setInternshalaDailyCap] = useState("5");
  const [minMatchScore, setMinMatchScore] = useState("65");

  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [activeLlm, setActiveLlm] = useState("gemini");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          const s = data.settings;
          if (s) {
            setOpportunityType(s.opportunity_type || "internship");
            setLinkedinDailyCap(s.linkedin_daily_cap || "5");
            setInternshalaDailyCap(s.internshala_daily_cap || "5");
            setMinMatchScore(s.min_match_score || "65");
            setActiveLlm(s.active_llm || "gemini");
            setTelegramChatId(s.telegram_chat_id || "");
            if (s.gemini_api_key === "configured") setGeminiApiKey("••••••••••••••••");
            if (s.groq_api_key === "configured") setGroqApiKey("••••••••••••••••");
            if (s.telegram_bot_token === "configured") setTelegramBotToken("••••••••••••••••");
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }

    fetchSettings();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    const totalCap = (parseInt(linkedinDailyCap, 10) || 5) + (parseInt(internshalaDailyCap, 10) || 5);

    const payload: Record<string, string> = {
      opportunity_type: opportunityType,
      linkedin_daily_cap: linkedinDailyCap,
      internshala_daily_cap: internshalaDailyCap,
      daily_cap: totalCap.toString(),
      min_match_score: minMatchScore,
      active_llm: activeLlm,
      telegram_chat_id: telegramChatId,
    };

    if (geminiApiKey && !geminiApiKey.includes("•••")) {
      payload.gemini_api_key = geminiApiKey;
    }
    if (groqApiKey && !groqApiKey.includes("•••")) {
      payload.groq_api_key = groqApiKey;
    }
    if (telegramBotToken && !telegramBotToken.includes("•••")) {
      payload.telegram_bot_token = telegramBotToken;
    }

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        alert("Failed to save settings.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestTelegram() {
    setTestingTelegram(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/telegram/test", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTestResult("Success: Test ping delivered to your Telegram chat.");
      } else {
        setTestResult(`Error: ${data.error || "Failed to deliver Telegram message."}`);
      }
    } catch {
      setTestResult("Network error connecting to Telegram API.");
    } finally {
      setTestingTelegram(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl animate-enter">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Preferences & Targeting</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            System & Targeting Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose between Internships and Jobs, configure per-platform daily caps, and tune selection fit.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="text-xs h-8 px-4 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all duration-150 shrink-0"
        >
          {savedSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Saved
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save Configuration
            </>
          )}
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Opportunity Type: Internship vs Job */}
        <section className="border border-border bg-card rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Opportunity Search Mode (Choose One)
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select whether AutoJob should search and apply for Student Internships or Full-Time Jobs.
              </p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 capitalize">
              Active: {opportunityType}
            </span>
          </div>

          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Internship */}
              <div
                onClick={() => setOpportunityType("internship")}
                className={`p-4 rounded-md border cursor-pointer transition-all duration-150 relative ${
                  opportunityType === "internship"
                    ? "border-primary bg-primary/8 shadow-sm"
                    : "border-border bg-secondary/15 hover:border-border/80"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                      opportunityType === "internship"
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Student Internship Mode
                      </span>
                      {opportunityType === "internship" && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-primary text-primary-foreground rounded font-medium">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Filters for student internships, traineeships, and junior roles. Auto-disqualifies senior/staff requirements and targets Internshala Internship Portal &amp; LinkedIn Internship filters (<code className="text-[11px] bg-background px-1 py-0.5 rounded font-mono">&amp;f_E=1&amp;f_JT=I</code>).
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 2: Full-Time Job */}
              <div
                onClick={() => setOpportunityType("job")}
                className={`p-4 rounded-md border cursor-pointer transition-all duration-150 relative ${
                  opportunityType === "job"
                    ? "border-primary bg-primary/8 shadow-sm"
                    : "border-border bg-secondary/15 hover:border-border/80"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                      opportunityType === "job"
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Full-Time Job Mode
                      </span>
                      {opportunityType === "job" && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-primary text-primary-foreground rounded font-medium">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Searches standard full-time engineering and developer postings on LinkedIn (<code className="text-[11px] bg-background px-1 py-0.5 rounded font-mono">&amp;f_JT=F</code>) and Internshala Jobs Portal.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Independent Per-Platform Safety Quotas */}
        <section className="border border-border bg-card rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Independent Platform Daily Safety Quotas
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set individual daily submission limits for each platform to prevent anti-bot velocity triggers.
              </p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground">
              Total: {(parseInt(linkedinDailyCap, 10) || 5) + (parseInt(internshalaDailyCap, 10) || 5)}/day
            </span>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* LinkedIn Quota */}
              <div className="p-3.5 rounded-md border border-border bg-secondary/15 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    LinkedIn Daily Cap
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">Default: 5/day</span>
                </div>
                <Input
                  type="number"
                  min="1"
                  max="25"
                  value={linkedinDailyCap}
                  onChange={(e) => setLinkedinDailyCap(e.target.value)}
                  className="font-mono text-[13px] h-8 rounded-md border-border bg-background"
                />
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Applications will stop on LinkedIn once this cap is reached, leaving Internshala untouched.
                </p>
              </div>

              {/* Internshala Quota */}
              <div className="p-3.5 rounded-md border border-border bg-secondary/15 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Internshala Daily Cap
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">Default: 5/day</span>
                </div>
                <Input
                  type="number"
                  min="1"
                  max="25"
                  value={internshalaDailyCap}
                  onChange={(e) => setInternshalaDailyCap(e.target.value)}
                  className="font-mono text-[13px] h-8 rounded-md border-border bg-background"
                />
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Applications will stop on Internshala once this cap is reached, without restricting LinkedIn.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Selection Probability & High-Chance Matching */}
        <section className="border border-border bg-card rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Resume Selection Fit &amp; Match Threshold
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ensures AutoJob applies only to postings with high selection probability based on your resume.
              </p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary text-foreground font-semibold">
              Min Threshold: {minMatchScore}%
            </span>
          </div>

          <div className="p-4 space-y-3">
            <div className="space-y-1.5 max-w-sm">
              <div className="flex items-center justify-between">
                <Label htmlFor="minMatchScore" className="text-xs text-muted-foreground">
                  Minimum Selection Match Score
                </Label>
                <span className="text-xs font-mono font-medium text-primary">{minMatchScore}% Match</span>
              </div>
              <input
                id="minMatchScore"
                type="range"
                min="40"
                max="90"
                step="5"
                value={minMatchScore}
                onChange={(e) => setMinMatchScore(e.target.value)}
                className="w-full accent-primary cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>40% (Lenient)</span>
                <span>65% (Recommended - High Selection Chance)</span>
                <span>90% (Strict)</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                Postings with match scores below <strong>{minMatchScore}%</strong> are automatically skipped. This prevents wasted applications and ensures you only apply to roles where your resume stands out.
              </p>
            </div>
          </div>
        </section>

        {/* LLM Engine */}
        <section className="border border-border bg-card rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  LLM Intelligence Engine
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Powers resume ingestion, 150-word cover letter weaver, and automated screening answers.
              </p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground">
              Free Tier APIs
            </span>
          </div>

          <div className="p-4 space-y-4">
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs text-muted-foreground">Primary Text Model</Label>
              <select
                value={activeLlm}
                onChange={(e) => setActiveLlm(e.target.value)}
                className="w-full h-8 px-2.5 text-xs rounded-md border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
              >
                <option value="gemini">Google Gemini 2.5 / 3 Flash (Recommended)</option>
                <option value="groq">Groq Cloud (Llama 3.3 70B)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="geminiApiKey" className="text-xs text-muted-foreground">
                    Google Gemini API Key
                  </Label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                  >
                    Get Free Key <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <Input
                  id="geminiApiKey"
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="h-8 text-[13px] font-mono rounded-md border-border bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="groqApiKey" className="text-xs text-muted-foreground">
                    Groq Cloud API Key
                  </Label>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                  >
                    Get Free Key <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <Input
                  id="groqApiKey"
                  type="password"
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  placeholder="gsk_..."
                  className="h-8 text-[13px] font-mono rounded-md border-border bg-background"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Telegram Checkpoint */}
        <section className="border border-border bg-card rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Telegram Human-in-the-Loop Bridge
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Instant screenshot dispatch and execution pause when CAPTCHA or OTP challenges appear.
              </p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground">
              Instant Push
            </span>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="telegramBotToken" className="text-xs text-muted-foreground">
                  Telegram Bot Token
                </Label>
                <Input
                  id="telegramBotToken"
                  type="password"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
                  className="h-8 text-[13px] font-mono rounded-md border-border bg-background"
                />
                <span className="text-[11px] text-muted-foreground block">
                  Created via @BotFather on Telegram
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telegramChatId" className="text-xs text-muted-foreground">
                  Telegram Chat ID
                </Label>
                <Input
                  id="telegramChatId"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="e.g. 987654321"
                  className="h-8 text-[13px] font-mono rounded-md border-border bg-background"
                />
                <span className="text-[11px] text-muted-foreground block">
                  Obtained via @userinfobot on Telegram
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestTelegram}
                disabled={testingTelegram}
                className="text-xs h-8 px-3 rounded-md border-border bg-card hover:bg-secondary transition-colors"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {testingTelegram ? "Dispatching Ping..." : "Send Test Ping"}
              </Button>

              {testResult && (
                <span
                  className={`text-xs font-mono leading-tight max-w-xl ${
                    testResult.startsWith("Success")
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {testResult}
                </span>
              )}
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
