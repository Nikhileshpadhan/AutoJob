"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, Key, Send, Shield, Save, CheckCircle2, RefreshCw, Bot } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [activeLlm, setActiveLlm] = useState("gemini");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [dailyCap, setDailyCap] = useState("5");

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
            setDailyCap(s.daily_cap || "5");
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

    const payload: Record<string, string> = {
      daily_cap: dailyCap,
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
        setTestResult("✅ Success! Check your Telegram chat for the test ping.");
      } else {
        setTestResult(`❌ Error: ${data.error || "Failed to deliver Telegram message."}`);
      }
    } catch {
      setTestResult("❌ Network error connecting to Telegram.");
    } finally {
      setTestingTelegram(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System & Security Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure free LLM keys (Gemini / Groq), Telegram Human-in-the-Loop credentials, and daily application pacing.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Strict Quota & Rate Limit Pacing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Strict Quota & Safety Pacing
            </CardTitle>
            <CardDescription>
              Hard limits to safeguard your LinkedIn and Internshala accounts against aggressive bot detection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 max-w-xs">
              <Label htmlFor="dailyCap">Daily Application Cap (Default: 5)</Label>
              <Input
                id="dailyCap"
                type="number"
                min="1"
                max="25"
                value={dailyCap}
                onChange={(e) => setDailyCap(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Per roadmap specification, enforcing a strict cap of 5 applications/day avoids algorithmic shadowbans.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Free LLM Provider Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-emerald-500" />
              Free LLM Text Engine (Gemini & Groq)
            </CardTitle>
            <CardDescription>
              Used for PDF resume extraction, 150-word cover letter tailoring, and answering custom screening questionnaires.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 max-w-xs">
              <Label>Active LLM Engine</Label>
              <select
                value={activeLlm}
                onChange={(e) => setActiveLlm(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-md border border-input bg-background text-foreground"
              >
                <option value="gemini">Google Gemini 2.5 Flash (Free Tier)</option>
                <option value="groq">Groq Llama 3.3 70B (Free Tier)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="geminiApiKey">Google Gemini API Key</Label>
                <Input
                  id="geminiApiKey"
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                />
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline block"
                >
                  Get free key on Google AI Studio ↗
                </a>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="groqApiKey">Groq Cloud API Key</Label>
                <Input
                  id="groqApiKey"
                  type="password"
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  placeholder="gsk_..."
                />
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline block"
                >
                  Get free key on Groq Console ↗
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Telegram Bot Human-in-the-Loop Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-500" />
              Telegram Human-In-The-Loop Exception Bridge
            </CardTitle>
            <CardDescription>
              Phase 5 exception handling: When a CAPTCHA or OTP barrier is detected, the runner pauses and transmits snapshot alerts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="telegramBotToken">Telegram Bot Token</Label>
                <Input
                  id="telegramBotToken"
                  type="password"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
                />
                <span className="text-[11px] text-muted-foreground block">
                  Created via @BotFather on Telegram
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telegramChatId">Telegram Chat ID</Label>
                <Input
                  id="telegramChatId"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="e.g. 987654321"
                />
                <span className="text-[11px] text-muted-foreground block">
                  Find your numeric ID using @userinfobot
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
                className="text-xs"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {testingTelegram ? "Dispatching..." : "Send Test Telegram Ping"}
              </Button>

              {testResult && (
                <span className="text-xs font-mono">{testResult}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {savedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
                Settings Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
