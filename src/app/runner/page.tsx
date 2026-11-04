"use client";

import { useEffect, useState, useRef } from "react";
import {
  Play,
  Terminal,
  Bot,
  Copy,
  Check,
  Radio,
  Trash2,
  Cpu,
  Layers,
  Sparkles,
  ShieldAlert,
  GraduationCap,
  Briefcase,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlatformQuotaInfo {
  applied_count: number;
  max_cap: number;
  remaining: number;
}

export default function RunnerConsolePage() {
  const [platform, setPlatform] = useState<"both" | "linkedin" | "internshala">("both");
  const [opportunityType, setOpportunityType] = useState<"internship" | "job">("internship");
  const [dryRun, setDryRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "[System] AutoJob headless worker initialized.",
    "[Storage] Persistent browser profile mounted at ./data/browser_profile",
    "[Scheduler] Daily quota governor active (independent platform pacing).",
    "[Targeting] Opportunity mode configured: INTERNSHIPS (Student filter active).",
    "[Filter] High-chance resume matching enabled - only strong matches will be submitted.",
    "[Ready] Playwright stealth dispatcher awaiting execution trigger.",
  ]);
  const [quota, setQuota] = useState<{
    applied: number;
    max: number;
    remaining: number;
    platforms?: {
      linkedin: PlatformQuotaInfo;
      internshala: PlatformQuotaInfo;
    };
  } | null>(null);
  const [copiedCli, setCopiedCli] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  async function loadQuota() {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/api/automation");
      if (res.ok) {
        const data = await res.json();
        setQuota({
          applied: data.quota.applied_count,
          max: data.quota.max_cap,
          remaining: data.quota.remaining,
          platforms: data.platforms || data.quota.platforms,
        });
      }

      // Also get default opportunity_type
      const settingsRes = await fetch("/api/settings");
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData.settings?.opportunity_type) {
          setOpportunityType(settingsData.settings.opportunity_type as "internship" | "job");
        }
      }
    } catch {
      // Ignore background refresh errors
    }
  }

  useEffect(() => {
    loadQuota();
    const interval = setInterval(loadQuota, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function handleStart() {
    setIsRunning(true);
    addLog(
      `[Runner] Dispatching automation run (platform: ${platform}, target: ${opportunityType.toUpperCase()}, dryRun: ${dryRun})...`
    );

    try {
      const res = await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, opportunityType, dryRun }),
      });

      const data = await res.json();
      if (!res.ok) {
        addLog(`[Error] ${data.error || "Failed to start run."}`);
      } else {
        addLog(`[Engine] Background Playwright worker dispatched successfully.`);
        addLog(
          `[Targeting] Filtering exclusively for ${opportunityType.toUpperCase()} listings with high candidate selection probability...`
        );
      }
    } catch {
      addLog(`[Network Error] Could not connect to automation runner endpoint.`);
    } finally {
      setTimeout(() => setIsRunning(false), 2000);
      loadQuota();
    }
  }

  function addLog(msg: string) {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }

  function handleCopyCli() {
    navigator.clipboard.writeText("npm run bot:run");
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  }

  const linkedinRemaining = quota?.platforms?.linkedin?.remaining ?? 5;
  const internshalaRemaining = quota?.platforms?.internshala?.remaining ?? 5;
  const isPlatformBlocked =
    (platform === "linkedin" && linkedinRemaining <= 0) ||
    (platform === "internshala" && internshalaRemaining <= 0) ||
    (platform === "both" && linkedinRemaining <= 0 && internshalaRemaining <= 0);

  return (
    <div className="space-y-6 max-w-5xl animate-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Bot className="w-3.5 h-3.5 text-primary" />
            <span>Process Dispatcher</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            Runner Console
          </h1>
          <p className="text-sm text-muted-foreground">
            Launch browser workers, monitor real-time Playwright telemetry, and track platform-specific quotas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-secondary border border-border text-foreground flex items-center gap-1.5">
            {opportunityType === "internship" ? (
              <GraduationCap className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Briefcase className="w-3.5 h-3.5 text-primary" />
            )}
            <span className="capitalize">{opportunityType} Mode</span>
          </span>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card text-xs text-muted-foreground">
            <span className="status-dot" />
            <span>Worker: {isRunning ? "Active" : "Idle"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Run Controls Panel */}
        <div className="border border-border bg-card rounded-md p-4 space-y-4 lg:col-span-1 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Run Configuration
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">Local Session</span>
            </div>

            {/* Opportunity Target Selector (Internship vs Job) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground block">
                Target Opportunity Type
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-md bg-secondary/30 border border-border">
                <button
                  type="button"
                  onClick={() => setOpportunityType("internship")}
                  className={`py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    opportunityType === "internship"
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  Internship
                </button>
                <button
                  type="button"
                  onClick={() => setOpportunityType("job")}
                  className={`py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    opportunityType === "job"
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  Full-Time Job
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {opportunityType === "internship"
                  ? "Student filter: applies to internships on LinkedIn and Internshala."
                  : "Searches full-time software and engineering postings."}
              </p>
            </div>

            {/* Platform Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground block">
                Platform Scope
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as "both" | "linkedin" | "internshala")}
                className="w-full h-8 px-2.5 text-xs rounded-md border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
              >
                <option value="both">Both (LinkedIn & Internshala - 5 each)</option>
                <option value="linkedin">LinkedIn Only</option>
                <option value="internshala">Internshala Only</option>
              </select>
            </div>

            {/* Dry Run Checkbox */}
            <div className="p-3 rounded-md border border-border bg-secondary/15 space-y-1.5">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-medium text-foreground">
                  Dry-Run Simulation
                </span>
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4 bg-background"
                />
              </label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Evaluates resume selection score and drafts cover letters without submitting forms.
              </p>
            </div>

            {/* Independent Quota Telemetry (LinkedIn & Internshala) */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-foreground block">
                Daily Platform Capacity
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* LinkedIn Box */}
                <div className="p-2.5 rounded-md border border-border bg-secondary/15 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                      LinkedIn
                    </span>
                    <span className="num font-semibold text-foreground">
                      {quota?.platforms?.linkedin?.applied_count ?? 0} /{" "}
                      {quota?.platforms?.linkedin?.max_cap ?? 5}
                    </span>
                  </div>
                  <div className="w-full bg-secondary h-1 rounded-sm overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-sm"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            ((quota?.platforms?.linkedin?.applied_count ?? 0) /
                              (quota?.platforms?.linkedin?.max_cap ?? 5)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground block pt-0.5">
                    {quota?.platforms?.linkedin?.remaining ?? 5} slots left
                  </span>
                </div>

                {/* Internshala Box */}
                <div className="p-2.5 rounded-md border border-border bg-secondary/15 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Internshala
                    </span>
                    <span className="num font-semibold text-foreground">
                      {quota?.platforms?.internshala?.applied_count ?? 0} /{" "}
                      {quota?.platforms?.internshala?.max_cap ?? 5}
                    </span>
                  </div>
                  <div className="w-full bg-secondary h-1 rounded-sm overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-sm"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            ((quota?.platforms?.internshala?.applied_count ?? 0) /
                              (quota?.platforms?.internshala?.max_cap ?? 5)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground block pt-0.5">
                    {quota?.platforms?.internshala?.remaining ?? 5} slots left
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Button
              className="w-full h-9 rounded-md bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary transition-all duration-150"
              disabled={isRunning || isPlatformBlocked}
              onClick={handleStart}
            >
              <Play className="w-3.5 h-3.5 mr-2 fill-current" />
              {isRunning ? "Starting Engine..." : `Dispatch ${opportunityType === "internship" ? "Internship" : "Job"} Runner`}
            </Button>

            {isPlatformBlocked && (
              <div className="flex items-center gap-1.5 justify-center p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px]">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Daily safety quota exhausted for selected platform</span>
              </div>
            )}
          </div>
        </div>

        {/* Live Terminal & Logs */}
        <div className="border border-border bg-card rounded-md overflow-hidden lg:col-span-2 flex flex-col justify-between">
          <div>
            {/* Terminal Window Chrome */}
            <div className="px-4 py-2.5 border-b border-border bg-secondary/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <div className="h-3 w-px bg-border mx-1" />
                <Terminal className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-mono font-medium text-foreground">
                  playwright-stdout
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogs(["[System] Buffer cleared by user."])}
                className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>

            {/* Terminal Body */}
            <div className="bg-[#0b0e12] text-zinc-300 font-mono text-[12px] p-4 h-[340px] overflow-y-auto terminal-scroll space-y-1.5 selection:bg-primary/25">
              {logs.map((log, idx) => {
                const isError = log.includes("[Error]") || log.includes("[Network Error]");
                const isSys = log.includes("[System]") || log.includes("[Storage]");
                const isReady =
                  log.includes("[Ready]") || log.includes("[Engine]") || log.includes("Applied to");
                const isTargeting =
                  log.includes("[Targeting]") || log.includes("[Filter]") || log.includes("[Success]");
                return (
                  <div
                    key={idx}
                    className={`leading-relaxed break-words font-mono ${
                      isError
                        ? "text-rose-400"
                        : isSys
                        ? "text-zinc-500"
                        : isReady
                        ? "text-emerald-400 font-medium"
                        : isTargeting
                        ? "text-sky-400"
                        : "text-zinc-300"
                    }`}
                  >
                    {log}
                  </div>
                );
              })}
              <div ref={terminalEndRef} />
            </div>
          </div>

          <div className="px-4 py-2 border-t border-border bg-card/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-mono">
              Mode: {opportunityType.toUpperCase()} | Pacing: 15–45s jitter
            </span>
            <span className="font-mono">Buffered Events: {logs.length}</span>
          </div>
        </div>
      </div>

      {/* Headless CLI & Daemon Automation */}
      <div className="border border-border bg-card rounded-md p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Headless CLI &amp; Daemon Automation
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Run autonomously in background daemons or configure standard cron schedules.
            </p>
          </div>
        </div>

        <div className="relative group">
          <pre className="p-3 rounded-md bg-background border border-border font-mono text-xs text-foreground overflow-x-auto selection:bg-primary/20">
            npm run bot:run
          </pre>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCli}
            className="absolute top-2 right-2 h-7 px-2.5 text-xs border-border bg-card hover:bg-secondary transition-colors"
          >
            {copiedCli ? (
              <>
                <Check className="w-3 h-3 mr-1 text-primary" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </>
            )}
          </Button>
        </div>

        <div className="space-y-1 pt-1">
          <p className="text-[11px] text-muted-foreground">
            Production Crontab recipe (fires twice daily, capped independently by SQLite per platform):
          </p>
          <pre className="p-2.5 rounded-md bg-background/80 border border-border/80 font-mono text-[11px] text-muted-foreground overflow-x-auto">
            0 9,14 * * * cd /path/to/AUTOJOB &amp;&amp; npm run bot:run &gt;&gt; /var/log/autojob.log 2&gt;&amp;1
          </pre>
        </div>
      </div>
    </div>
  );
}
