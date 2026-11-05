"use client";

import React, { useEffect, useState } from "react";
import {
  Send,
  Save,
  Shield,
  Bot,
  Key,
  MessageSquare,
  Sparkles,
  GraduationCap,
  Briefcase,
  Target,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useTelemetry } from "@/components/telemetry-provider";
import { formatHour12 } from "@/lib/automation/pacing";

export default function SettingsPage() {
  const toast = useToast();
  const { refreshStats } = useTelemetry();

  // Targeting preferences
  const [opportunityType, setOpportunityType] = useState<"internship" | "job">("internship");
  const [workplaceType, setWorkplaceType] = useState<"remote" | "hybrid" | "on_site" | "any">("remote");
  const [targetLocation, setTargetLocation] = useState("Remote");
  const [applyType, setApplyType] = useState<"easy_apply_only" | "all">("easy_apply_only");
  const [linkedinDailyCap, setLinkedinDailyCap] = useState("5");
  const [internshalaDailyCap, setInternshalaDailyCap] = useState("5");
  const [minMatchScore, setMinMatchScore] = useState("65");

  // Pacing & Operating Window Settings
  const [pacingEnabled, setPacingEnabled] = useState("true");
  const [ignoreTimeWindow, setIgnoreTimeWindow] = useState("false");
  const [activeWindowStart, setActiveWindowStart] = useState("9");
  const [activeWindowEnd, setActiveWindowEnd] = useState("23");
  const [minRestMinutes, setMinRestMinutes] = useState("20");
  const [maxRestMinutes, setMaxRestMinutes] = useState("60");

  // LLM Provider & Model
  const [activeLlm, setActiveLlm] = useState<"gemini" | "groq">("gemini");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [groqConfigured, setGroqConfigured] = useState(false);

  // Telegram Bridge
  const [telegramEnabled, setTelegramEnabled] = useState("true");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramApiBaseUrl, setTelegramApiBaseUrl] = useState("");
  const [telegramConfigured, setTelegramConfigured] = useState(false);

  // Cloud Platform Session Cookies (BYOK Auth)
  const [linkedinLiAtCookie, setLinkedinLiAtCookie] = useState("");
  const [internshalaSessionCookie, setInternshalaSessionCookie] = useState("");
  const [linkedinCookieConfigured, setLinkedinCookieConfigured] = useState(false);
  const [internshalaCookieConfigured, setInternshalaCookieConfigured] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const s = data.settings;
        if (s) {
          setOpportunityType(s.opportunity_type || "internship");
          setWorkplaceType(s.workplace_type || "remote");
          setTargetLocation(s.target_location || "Remote");
          setApplyType(s.apply_type || "easy_apply_only");
          setLinkedinDailyCap(s.linkedin_daily_cap || "5");
          setInternshalaDailyCap(s.internshala_daily_cap || "5");
          setMinMatchScore(s.min_match_score || "65");
          setPacingEnabled(s.pacing_enabled || "true");
          setIgnoreTimeWindow(s.ignore_time_window || "false");
          setActiveWindowStart(s.active_window_start || "9");
          setActiveWindowEnd(s.active_window_end || "23");
          setMinRestMinutes(s.min_rest_minutes || "20");
          setMaxRestMinutes(s.max_rest_minutes || "60");

          setActiveLlm(s.active_llm || "gemini");
          setGeminiModel(s.gemini_model || "gemini-2.5-flash");
          setGeminiConfigured(Boolean(s.gemini_api_key_configured));
          setGroqConfigured(Boolean(s.groq_api_key_configured));

          setTelegramEnabled(s.telegram_enabled || "true");
          setTelegramChatId(s.telegram_chat_id || "");
          setTelegramApiBaseUrl(s.telegram_api_base_url || "");
          setTelegramConfigured(Boolean(s.telegram_bot_token_configured));
          setLinkedinCookieConfigured(Boolean(s.linkedin_cookie_configured));
          setInternshalaCookieConfigured(Boolean(s.internshala_cookie_configured));
        }
      }
    } catch (err) {
      toast.error("Could not load configuration settings.", "Settings Load Error");
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const totalCap = (parseInt(linkedinDailyCap, 10) || 5) + (parseInt(internshalaDailyCap, 10) || 5);

    const payload: Record<string, string> = {
      opportunity_type: opportunityType,
      workplace_type: workplaceType,
      target_location: targetLocation,
      apply_type: applyType,
      linkedin_daily_cap: linkedinDailyCap,
      internshala_daily_cap: internshalaDailyCap,
      daily_cap: totalCap.toString(),
      min_match_score: minMatchScore,
      pacing_enabled: pacingEnabled,
      ignore_time_window: ignoreTimeWindow,
      active_window_start: activeWindowStart,
      active_window_end: activeWindowEnd,
      min_rest_minutes: minRestMinutes,
      max_rest_minutes: maxRestMinutes,
      active_llm: activeLlm,
      gemini_model: geminiModel,
      telegram_enabled: telegramEnabled,
      telegram_chat_id: telegramChatId,
      telegram_api_base_url: telegramApiBaseUrl,
    };

    if (geminiApiKey.trim()) {
      payload.gemini_api_key = geminiApiKey.trim();
    }
    if (groqApiKey.trim()) {
      payload.groq_api_key = groqApiKey.trim();
    }
    if (telegramBotToken.trim()) {
      payload.telegram_bot_token = telegramBotToken.trim();
    }
    if (linkedinLiAtCookie.trim()) {
      payload.linkedin_li_at_cookie = linkedinLiAtCookie.trim();
    }
    if (internshalaSessionCookie.trim()) {
      payload.internshala_session_cookie = internshalaSessionCookie.trim();
    }

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("System and targeting settings persisted successfully.", "Saved");
        setGeminiApiKey("");
        setGroqApiKey("");
        setTelegramBotToken("");
        await fetchSettings();
        await refreshStats();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save settings.", "Error");
      }
    } catch {
      toast.error("Network error saving settings.", "Error");
    } finally {
      setSaving(false);
    }
  }

  async function clearSecret(
    key:
      | "gemini_api_key"
      | "groq_api_key"
      | "telegram_bot_token"
      | "linkedin_li_at_cookie"
      | "internshala_session_cookie"
  ) {
    if (!confirm(`Are you sure you want to clear the configured ${key.replace(/_/g, " ")}?`)) return;
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: "" }),
      });
      if (res.ok) {
        toast.success(`Cleared ${key.replace(/_/g, " ")}.`, "Revoked");
        await fetchSettings();
      }
    } catch (err) {
      toast.error("Failed to clear secret.", "Error");
    }
  }

  async function handleTestTelegram() {
    setTestingTelegram(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: "Test alert dispatched! Check your Telegram app." });
        toast.success("Telegram test message delivered!", "Telegram Verified");
      } else {
        setTestResult({ success: false, message: data.error || "Telegram message failed to send." });
        toast.error(data.error || "Telegram connection failed.", "Telegram Error");
      }
    } catch (err) {
      setTestResult({ success: false, message: "Network error connecting to Telegram route." });
    } finally {
      setTestingTelegram(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-5xl animate-enter">
      {/* Header — Aronya display heading */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-6 border-b border-[#303132]">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 border border-[#CCF2DF]/40 bg-[#CCF2DF]/10 text-[#CCF2DF]">
              ENGINE PREFERENCES
            </span>
            <span className="text-xs uppercase font-mono tracking-widest text-[#B8B9B9]">
              SYSTEM CONFIGURATION
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-normal tracking-[-0.03em] text-white">
            SETTINGS & <span className="font-serif italic font-normal text-white">TARGETING</span>
          </h1>
          <p className="text-sm text-[#CCF2DF] font-light max-w-2xl leading-relaxed">
            Targeting constraints, daily safety thresholds, active operating windows, LLM routing, and Telegram verification.
          </p>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={saving}
          className="text-xs h-12 px-6"
        >
          <Save className={`w-3.5 h-3.5 mr-2 ${saving ? "animate-spin" : ""}`} />
          Save Preferences
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* SECTION 1: Targeting Preferences */}
        <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-5">
          <div className="flex items-center gap-2.5 border-b border-[#303132] pb-3.5">
            <Target className="w-4 h-4 text-[#CCF2DF]" />
            <h2 className="text-xs uppercase font-mono tracking-widest text-white">
              Targeting & Opportunity Rules
            </h2>
          </div>

          {/* Opportunity Type */}
          <div className="space-y-2">
            <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Opportunity Mode</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOpportunityType("internship")}
                className={`p-3 rounded-[8px] border-2 text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  opportunityType === "internship"
                    ? "border-white bg-transparent text-white font-bold"
                    : "border-[#303132] bg-transparent text-[#B8B9B9] hover:border-white/50"
                }`}
              >
                <GraduationCap className="w-4 h-4 text-[#CCF2DF]" />
                Internship Mode
              </button>

              <button
                type="button"
                onClick={() => setOpportunityType("job")}
                className={`p-3 rounded-[8px] border-2 text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  opportunityType === "job"
                    ? "border-white bg-transparent text-white font-bold"
                    : "border-[#303132] bg-transparent text-[#B8B9B9] hover:border-white/50"
                }`}
              >
                <Briefcase className="w-4 h-4 text-[#CCF2DF]" />
                Job Mode
              </button>
            </div>
            <p className="text-[11px] text-[#B8B9B9] font-light">
              Internship mode targets student, trainee, and direct internship opportunities across all platforms.
            </p>
          </div>

          {/* Workplace Type & Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Workplace</Label>
              <select
                value={workplaceType}
                onChange={(e) => setWorkplaceType(e.target.value as any)}
                className="w-full h-11 px-3 rounded-[8px] border-2 border-[#303132] bg-[#141516] text-white text-xs font-mono focus:border-white focus:outline-none"
              >
                <option value="remote">Remote (Default)</option>
                <option value="hybrid">Hybrid</option>
                <option value="on_site">On-site</option>
                <option value="any">Any Workplace</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Target Location</Label>
              <Input
                value={targetLocation}
                onChange={(e) => setTargetLocation(e.target.value)}
                placeholder="Remote / Bengaluru / India"
                className="text-xs sm:text-sm h-11 bg-[#141516]"
              />
            </div>
          </div>

          {/* Apply Type */}
          <div className="space-y-2">
            <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Application Link Handling</Label>
            <select
              value={applyType}
              onChange={(e) => setApplyType(e.target.value as any)}
              className="w-full h-11 px-3 rounded-[8px] border-2 border-[#303132] bg-[#141516] text-white text-xs font-mono focus:border-white focus:outline-none"
            >
              <option value="easy_apply_only">Easy Apply Only (Recommended)</option>
              <option value="all">Include External Links (Bookmarks in Review Queue)</option>
            </select>
            <p className="text-[11px] text-[#B8B9B9] font-light">
              Easy Apply Only submits 1-click forms directly. External links do not consume safety quotas.
            </p>
          </div>

          {/* Match Score Threshold Slider */}
          <div className="space-y-2 pt-2 border-t border-[#303132]">
            <div className="flex justify-between items-center text-xs">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Min Match Score Threshold</Label>
              <span className="font-mono text-[#CCF2DF] font-bold text-sm">{minMatchScore}%</span>
            </div>
            <input
              type="range"
              min="40"
              max="90"
              step="5"
              value={minMatchScore}
              onChange={(e) => setMinMatchScore(e.target.value)}
              className="w-full accent-white h-1.5 bg-[#262728] rounded-none cursor-pointer"
            />
            <p className="text-[11px] text-[#B8B9B9] font-light">
              Jobs scoring below this threshold are skipped to safeguard account credibility.
            </p>
          </div>
        </div>

        {/* SECTION 2: Platform Safety Quotas */}
        <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-5">
          <div className="flex items-center gap-2.5 border-b border-[#303132] pb-3.5">
            <Shield className="w-4 h-4 text-[#CCF2DF]" />
            <h2 className="text-xs uppercase font-mono tracking-widest text-white">
              Platform Safety Caps (Anti-Ban)
            </h2>
          </div>

          <p className="text-xs text-[#B8B9B9] font-light leading-relaxed">
            AutoJob enforces separate daily application ceilings for each network to prevent account shadow-bans and rate limits.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-none border border-sky-400/30 bg-[#141516] space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-sky-300">LinkedIn Daily Cap</Label>
              <Input
                type="number"
                min="1"
                max="25"
                value={linkedinDailyCap}
                onChange={(e) => setLinkedinDailyCap(e.target.value)}
                className="text-xs h-10 bg-[#131415] font-mono"
              />
              <span className="text-[10px] text-[#B8B9B9] font-mono block">Default: 5 applications / day</span>
            </div>

            <div className="p-4 rounded-none border border-[#CCF2DF]/40 bg-[#141516] space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-[#CCF2DF]">Internshala Daily Cap</Label>
              <Input
                type="number"
                min="1"
                max="25"
                value={internshalaDailyCap}
                onChange={(e) => setInternshalaDailyCap(e.target.value)}
                className="text-xs h-10 bg-[#131415] font-mono"
              />
              <span className="text-[10px] text-[#B8B9B9] font-mono block">Default: 5 applications / day</span>
            </div>
          </div>

          <div className="p-4 rounded-none border border-[#303132] bg-[#141516] text-xs font-mono flex justify-between items-center">
            <span className="text-[#B8B9B9] uppercase">Combined Daily Cap:</span>
            <span className="font-bold text-white text-sm">
              {(parseInt(linkedinDailyCap, 10) || 5) + (parseInt(internshalaDailyCap, 10) || 5)} submissions / day
            </span>
          </div>
        </div>

        {/* SECTION: Human Pacing & Operating Window */}
        <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-5">
          <div className="flex items-center justify-between border-b border-[#303132] pb-3.5">
            <div className="flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs uppercase font-mono tracking-widest text-white">
                Operating Window & Pacing
              </h2>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border border-[#303132] bg-[#262728] text-[#B8B9B9]">
              {ignoreTimeWindow === "true"
                ? "Mode: 24/7 (Anytime)"
                : `${formatHour12(parseInt(activeWindowStart, 10) || 9)} – ${formatHour12(parseInt(activeWindowEnd, 10) || 23)}`}
            </span>
          </div>

          <p className="text-xs text-[#B8B9B9] font-light leading-relaxed">
            Spreads submissions across your preferred active window so you don&apos;t blast all quotas in one burst. The engine applies to 1 job, rests for an organic random interval, and shuts down between runs.
          </p>

          {/* Operating Window Enforcement Toggle */}
          <div className="space-y-2">
            <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Window Enforcement</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIgnoreTimeWindow("false")}
                className={`p-3 rounded-[8px] border-2 text-xs font-mono uppercase tracking-wider flex items-center justify-center transition-all ${
                  ignoreTimeWindow === "false"
                    ? "border-white bg-transparent text-white font-bold"
                    : "border-[#303132] bg-transparent text-[#B8B9B9] hover:border-white/50"
                }`}
              >
                Enforce Hours
              </button>
              <button
                type="button"
                onClick={() => setIgnoreTimeWindow("true")}
                className={`p-3 rounded-[8px] border-2 text-xs font-mono uppercase tracking-wider flex items-center justify-center transition-all ${
                  ignoreTimeWindow === "true"
                    ? "border-amber-400 bg-amber-500/10 text-amber-300 font-bold"
                    : "border-[#303132] bg-transparent text-[#B8B9B9] hover:border-white/50"
                }`}
              >
                24/7 Anytime
              </button>
            </div>
          </div>

          {/* Start and End Hour Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Start Hour (0–23)</Label>
                <span className="text-[10px] font-mono text-[#CCF2DF] font-semibold">
                  {formatHour12(parseInt(activeWindowStart, 10) || 0)}
                </span>
              </div>
              <Input
                type="number"
                min="0"
                max="23"
                value={activeWindowStart}
                onChange={(e) => setActiveWindowStart(e.target.value)}
                className="text-xs h-10 bg-[#141516] font-mono"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs uppercase font-mono text-[#B8B9B9]">End Hour (0–24)</Label>
                <span className="text-[10px] font-mono text-[#CCF2DF] font-semibold">
                  {formatHour12(parseInt(activeWindowEnd, 10) || 0)}
                </span>
              </div>
              <Input
                type="number"
                min="0"
                max="24"
                value={activeWindowEnd}
                onChange={(e) => setActiveWindowEnd(e.target.value)}
                className="text-xs h-10 bg-[#141516] font-mono"
              />
            </div>
          </div>

          {/* Rest Minutes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Min Rest (Minutes)</Label>
              <Input
                type="number"
                min="5"
                max="120"
                value={minRestMinutes}
                onChange={(e) => setMinRestMinutes(e.target.value)}
                className="text-xs h-10 bg-[#141516] font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Max Rest (Minutes)</Label>
              <Input
                type="number"
                min="10"
                max="240"
                value={maxRestMinutes}
                onChange={(e) => setMaxRestMinutes(e.target.value)}
                className="text-xs h-10 bg-[#141516] font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: LLM Providers & Models */}
        <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-5">
          <div className="flex items-center gap-2.5 border-b border-[#303132] pb-3.5">
            <Bot className="w-4 h-4 text-[#CCF2DF]" />
            <h2 className="text-xs uppercase font-mono tracking-widest text-white">
              AI Intelligence & LLM Router
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Preferred AI Engine</Label>
              <select
                value={activeLlm}
                onChange={(e) => setActiveLlm(e.target.value as any)}
                className="w-full h-11 px-3 rounded-[8px] border-2 border-[#303132] bg-[#141516] text-white text-xs font-mono focus:border-white focus:outline-none"
              >
                <option value="gemini">Google Gemini (Recommended)</option>
                <option value="groq">Groq (Llama 3.3 70B)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Gemini Model</Label>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="w-full h-11 px-3 rounded-[8px] border-2 border-[#303132] bg-[#141516] text-white text-xs font-mono focus:border-white focus:outline-none"
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Accurate)</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro (High Quality)</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash (Legacy)</option>
              </select>
            </div>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9] flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#CCF2DF]" /> Google Gemini API Key
              </Label>
              {geminiConfigured && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#CCF2DF] font-mono uppercase">Configured</span>
                  <button
                    type="button"
                    onClick={() => clearSecret("gemini_api_key")}
                    className="text-[10px] text-rose-400 hover:underline uppercase font-mono"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            <Input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder={geminiConfigured ? "Enter new key to replace..." : "AIzaSy..."}
              className="text-xs h-10 bg-[#141516] font-mono"
            />
          </div>

          {/* Groq API Key */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9] flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#CCF2DF]" /> Groq API Key
              </Label>
              {groqConfigured && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#CCF2DF] font-mono uppercase">Configured</span>
                  <button
                    type="button"
                    onClick={() => clearSecret("groq_api_key")}
                    className="text-[10px] text-rose-400 hover:underline uppercase font-mono"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            <Input
              type="password"
              value={groqApiKey}
              onChange={(e) => setGroqApiKey(e.target.value)}
              placeholder={groqConfigured ? "Enter new key to replace..." : "gsk_..."}
              className="text-xs h-10 bg-[#141516] font-mono"
            />
          </div>
        </div>

        {/* SECTION: Browser Engine & Visibility */}
        <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-5">
          <div className="flex items-center justify-between border-b border-[#303132] pb-3.5">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#CCF2DF]" />
              <h2 className="text-xs uppercase font-mono tracking-widest text-white">
                Browser Automation Engine
              </h2>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border border-[#CCF2DF]/40 text-[#CCF2DF]">
              GUI: Visible
            </span>
          </div>

          <p className="text-xs text-[#B8B9B9] font-light leading-relaxed">
            AutoJob launches your installed desktop browser in a maximized window with full desktop visibility so you can watch job searches and applications live on screen.
          </p>

          <div className="p-4 rounded-none border border-[#303132] bg-[#141516] space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[#B8B9B9] uppercase">Active Binary:</span>
              <span className="font-bold text-white">
                Google Chrome (Locked)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#B8B9B9] uppercase">Path:</span>
              <span className="text-[10px] text-white/70 truncate max-w-[300px]">
                C:\Program Files\Google\Chrome\Application\chrome.exe
              </span>
            </div>
          </div>
        </div>

        {/* SECTION: Cloud Platform Session Cookies */}
        <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-5">
          <div className="flex items-center justify-between border-b border-[#303132] pb-3.5">
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-[#CCF2DF]" />
              <h2 className="text-xs uppercase font-mono tracking-widest text-white">
                Cloud Platform Session Cookies (BYOK Authentication)
              </h2>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border border-[#CCF2DF]/40 text-[#CCF2DF]">
              Encrypted at Rest
            </span>
          </div>

          <div className="p-4 rounded-[8px] bg-[#262728]/40 border border-[#303132] space-y-2 text-xs">
            <span className="font-mono text-[#CCF2DF] uppercase tracking-wider text-[11px] block font-semibold">
              How to copy your session cookies (3-Step Guide):
            </span>
            <ol className="list-decimal list-inside space-y-1 text-[#B8B9B9] font-light">
              <li>Open LinkedIn or Internshala in your desktop browser and sign in.</li>
              <li>Press <kbd className="px-1.5 py-0.5 rounded bg-[#141516] border border-[#303132] font-mono text-[10px] text-white">F12</kbd> (or right click -&gt; Inspect) &gt; Navigate to the <strong className="text-white">Application</strong> tab &gt; Expand <strong className="text-white">Cookies</strong> in the left sidebar.</li>
              <li>Find the <code className="text-[#CCF2DF]">li_at</code> cookie for LinkedIn or <code className="text-[#CCF2DF]">PHPSESSID</code> for Internshala, copy its value, and paste it into the respective input below.</li>
            </ol>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs uppercase font-mono text-[#B8B9B9] flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-[#CCF2DF]" /> LinkedIn Session Cookie (li_at)
                </Label>
                {linkedinCookieConfigured && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#CCF2DF] font-mono uppercase">Configured</span>
                    <button
                      type="button"
                      onClick={() => clearSecret("linkedin_li_at_cookie")}
                      className="text-[10px] text-rose-400 hover:underline uppercase font-mono"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              <Input
                type="password"
                value={linkedinLiAtCookie}
                onChange={(e) => setLinkedinLiAtCookie(e.target.value)}
                placeholder={linkedinCookieConfigured ? "Enter new li_at cookie to replace..." : "AQEDAT..."}
                className="text-xs h-10 bg-[#141516] font-mono"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs uppercase font-mono text-[#B8B9B9] flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-[#CCF2DF]" /> Internshala Session Cookie (PHPSESSID)
                </Label>
                {internshalaCookieConfigured && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#CCF2DF] font-mono uppercase">Configured</span>
                    <button
                      type="button"
                      onClick={() => clearSecret("internshala_session_cookie")}
                      className="text-[10px] text-rose-400 hover:underline uppercase font-mono"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              <Input
                type="password"
                value={internshalaSessionCookie}
                onChange={(e) => setInternshalaSessionCookie(e.target.value)}
                placeholder={internshalaCookieConfigured ? "Enter new PHPSESSID cookie to replace..." : "abc123xyz..."}
                className="text-xs h-10 bg-[#141516] font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: Telegram Bridge */}
        <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-5">
          <div className="flex items-center gap-2.5 border-b border-[#303132] pb-3.5">
            <MessageSquare className="w-4 h-4 text-[#CCF2DF]" />
            <h2 className="text-xs uppercase font-mono tracking-widest text-white">
              Telegram Alert Bridge
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Telegram Alerts</Label>
              <select
                value={telegramEnabled}
                onChange={(e) => setTelegramEnabled(e.target.value)}
                className="w-full h-11 px-3 rounded-[8px] border-2 border-[#303132] bg-[#141516] text-white text-xs font-mono focus:border-white focus:outline-none"
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Chat ID</Label>
              <Input
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="123456789"
                className="text-xs sm:text-sm h-11 bg-[#141516] font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Bot Token</Label>
              {telegramConfigured && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#CCF2DF] font-mono uppercase">Configured</span>
                  <button
                    type="button"
                    onClick={() => clearSecret("telegram_bot_token")}
                    className="text-[10px] text-rose-400 hover:underline uppercase font-mono"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            <Input
              type="password"
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.target.value)}
              placeholder={telegramConfigured ? "Enter new token to replace..." : "1234567890:ABC..."}
              className="text-xs h-10 bg-[#141516] font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Reverse Proxy Base URL</Label>
            <Input
              value={telegramApiBaseUrl}
              onChange={(e) => setTelegramApiBaseUrl(e.target.value)}
              placeholder="https://api.telegram.org (or custom Cloudflare proxy)"
              className="text-xs h-10 bg-[#141516] font-mono"
            />
            <span className="text-[10px] text-[#B8B9B9] font-light block">
              Bypasses Indian ISP connection resets (ECONNRESET) when configured.
            </span>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleTestTelegram}
              disabled={testingTelegram}
              className="text-xs h-10 px-4"
            >
              <Send className={`w-3.5 h-3.5 mr-1.5 ${testingTelegram ? "animate-spin" : ""}`} />
              Send Test Message
            </Button>

            {testResult && (
              <span
                className={`text-[11px] font-mono uppercase ${
                  testResult.success ? "text-[#CCF2DF]" : "text-rose-400"
                }`}
              >
                {testResult.message}
              </span>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
