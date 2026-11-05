"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Play,
  Square,
  Terminal,
  Trash2,
  GraduationCap,
  Briefcase,
  Target,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTelemetry } from "@/components/telemetry-provider";
import { useToast } from "@/components/ui/toast";
import { formatHour12, isWithinActiveWindow } from "@/lib/automation/pacing";

interface LogMessage {
  id?: number;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  stage?: string;
  message: string;
}

export default function RunnerConsolePage() {
  const { stats, startRunner, stopRunner } = useTelemetry();
  const toast = useToast();

  const [platform, setPlatform] = useState<"both" | "linkedin" | "internshala">("both");
  const [opportunityType, setOpportunityType] = useState<"internship" | "job">("internship");
  const [workplaceType, setWorkplaceType] = useState<"remote" | "hybrid" | "on_site" | "any">("remote");
  const [applyType, setApplyType] = useState<"easy_apply_only" | "all">("easy_apply_only");
  const [pacingMode, setPacingMode] = useState<"pacing" | "burst">("pacing");
  const [ignoreTimeWindow, setIgnoreTimeWindow] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "success" | "errors">("all");
  const [sessionHealth, setSessionHealth] = useState<{
    browserProfileExists: boolean;
    hasSessionCookies: boolean;
  } | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const isRunning = stats?.isRunning ?? false;

  // Initialize settings from stats
  useEffect(() => {
    if (stats) {
      if (stats.opportunityType) {
        setOpportunityType(stats.opportunityType as "internship" | "job");
      }
      if (stats.workplaceType) {
        setWorkplaceType(stats.workplaceType as any);
      }
      if (stats.applyType) {
        setApplyType(stats.applyType as any);
      }
      if (stats.ignoreTimeWindow !== undefined) {
        setIgnoreTimeWindow(stats.ignoreTimeWindow);
      }
      if (stats.pacingEnabled !== undefined) {
        setPacingMode(stats.pacingEnabled ? "pacing" : "burst");
      }
    }
  }, [stats]);

  // Check browser session health
  useEffect(() => {
    fetch("/api/automation/session-health")
      .then((r) => r.json())
      .then((data) => setSessionHealth(data))
      .catch(() => {});
  }, []);

  // Connect to real-time Server-Sent Events (SSE) telemetry stream (FE-001)
  useEffect(() => {
    const eventSource = new EventSource("/api/automation/stream");

    eventSource.addEventListener("init", (event: MessageEvent) => {
      try {
        const initialLogs: LogMessage[] = JSON.parse(event.data);
        setLogs(initialLogs);
      } catch (err) {
        console.warn("Failed to parse initial logs:", err);
      }
    });

    eventSource.addEventListener("log", (event: MessageEvent) => {
      try {
        const newLog: LogMessage = JSON.parse(event.data);
        setLogs((prev) => [...prev.slice(-300), newLog]);
      } catch (err) {
        console.warn("Failed to parse SSE log chunk:", err);
      }
    });

    eventSource.onerror = () => {
      // Reconnect handled automatically by EventSource
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function handleStart() {
    await startRunner({
      platform,
      opportunityType,
      workplaceType,
      applyType,
      dryRun,
      pacingMode,
      ignoreTimeWindow,
    });
  }

  async function handleStop() {
    await stopRunner();
  }

  const linkedinRemaining = stats?.platforms?.linkedin?.remaining ?? 5;
  const internshalaRemaining = stats?.platforms?.internshala?.remaining ?? 5;
  const windowStart = stats?.activeWindowStart ?? 9;
  const windowEnd = stats?.activeWindowEnd ?? 23;
  const isCurrentlyInWindow = isWithinActiveWindow(new Date(), windowStart, windowEnd, ignoreTimeWindow);

  const filteredLogs = logs.filter((l) => {
    if (logFilter === "success") return l.level === "success";
    if (logFilter === "errors") return l.level === "error" || l.level === "warn";
    return true;
  });

  return (
    <div className="space-y-8 animate-enter">
      {/* Header — Aronya display heading */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-6 border-b border-[#303132]">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span
              className={`text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 border ${
                isRunning
                  ? stats?.isResting
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-300 animate-pulse"
                    : "border-[#CCF2DF]/50 bg-[#CCF2DF]/10 text-[#CCF2DF] animate-pulse"
                  : "border-[#303132] bg-[#262728] text-[#B8B9B9]"
              }`}
            >
              {isRunning
                ? stats?.isResting
                  ? `RESTING: Next apply ${stats.nextRunAt ? new Date(stats.nextRunAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Scheduled"}`
                  : "WORKER ACTIVE"
                : "WORKER STANDBY"}
            </span>
            <span className="text-xs uppercase font-mono tracking-widest text-[#B8B9B9]">
              EXECUTION STREAM
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-normal tracking-[-0.03em] text-white">
            RUNNER <span className="font-serif italic font-normal text-white">CONSOLE</span>
          </h1>
          <p className="text-sm text-[#CCF2DF] font-light max-w-2xl leading-relaxed">
            Real-time Playwright automation engine telemetry, stealth browser pacing, and live event monitoring.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isRunning ? (
            <Button
              variant="destructive"
              size="lg"
              onClick={handleStop}
              className="text-xs h-12 px-6"
            >
              <Square className="w-3.5 h-3.5 mr-2 fill-current" />
              Stop execution
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setDryRun(true);
                  handleStart();
                }}
                disabled={(stats?.todayRemaining ?? 1) <= 0}
                className="text-xs h-12 px-5"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-2" />
                Dry run
              </Button>

              <Button
                size="lg"
                onClick={() => {
                  setDryRun(false);
                  handleStart();
                }}
                disabled={(stats?.todayRemaining ?? 1) <= 0}
                className="text-xs h-12 px-6"
              >
                <Play className="w-3.5 h-3.5 mr-2 fill-current" />
                Dispatch runner
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Grid: Controls + Live Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Targeting & Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Dispatch Configuration Card */}
          <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-5">
            <div className="flex items-center justify-between border-b border-[#303132] pb-3.5">
              <span className="text-xs font-mono uppercase tracking-widest text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-[#CCF2DF]" />
                Targeting & Strategy
              </span>
              <span className="text-[10px] text-[#B8B9B9] font-mono">
                Pacing: 10–20s jitter
              </span>
            </div>

            {/* Opportunity Mode Toggle */}
            <div className="space-y-2">
              <label className="text-[11px] uppercase font-mono tracking-wider text-[#B8B9B9] block">
                Opportunity Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOpportunityType("internship")}
                  className={`p-3 rounded-[8px] border-2 text-left transition-all ${
                    opportunityType === "internship"
                      ? "bg-transparent border-white text-white font-medium"
                      : "bg-transparent border-[#303132] text-[#B8B9B9] hover:border-white/50"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold">
                    <GraduationCap className="w-4 h-4 text-[#CCF2DF]" />
                    Internships
                  </div>
                  <div className="text-[10px] text-[#CCF2DF] mt-1 font-mono uppercase tracking-wider">
                    Internships & Trainee
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOpportunityType("job")}
                  className={`p-3 rounded-[8px] border-2 text-left transition-all ${
                    opportunityType === "job"
                      ? "bg-transparent border-white text-white font-medium"
                      : "bg-transparent border-[#303132] text-[#B8B9B9] hover:border-white/50"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold">
                    <Briefcase className="w-4 h-4 text-[#CCF2DF]" />
                    Full-Time Jobs
                  </div>
                  <div className="text-[10px] text-[#B8B9B9] mt-1 font-mono uppercase tracking-wider">
                    Full-time opportunities
                  </div>
                </button>
              </div>
            </div>

            {/* Platform Selection */}
            <div className="space-y-2">
              <label className="text-[11px] uppercase font-mono tracking-wider text-[#B8B9B9] block">
                Target Platforms
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(["both", "linkedin", "internshala"] as const).map((p) => {
                  const isSelected = platform === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlatform(p)}
                      className={`py-2.5 px-3 rounded-[8px] border-2 text-center text-xs font-mono uppercase tracking-wider transition-all ${
                        isSelected
                          ? "bg-transparent border-white text-white font-bold"
                          : "bg-transparent border-[#303132] text-[#B8B9B9] hover:border-white/50"
                      }`}
                    >
                      {p === "both" ? "Both" : p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Workplace Type & Apply Mode Overrides */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] uppercase font-mono tracking-wider text-[#B8B9B9] block">
                  Workplace
                </label>
                <select
                  value={workplaceType}
                  onChange={(e) => setWorkplaceType(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-[8px] border-2 border-[#303132] bg-[#141516] text-white text-xs font-mono focus:border-white focus:outline-none"
                >
                  <option value="remote">Remote (Default)</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="on_site">On-site</option>
                  <option value="any">Any Workplace</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] uppercase font-mono tracking-wider text-[#B8B9B9] block">
                  Apply Mode
                </label>
                <select
                  value={applyType}
                  onChange={(e) => setApplyType(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-[8px] border-2 border-[#303132] bg-[#141516] text-white text-xs font-mono focus:border-white focus:outline-none"
                >
                  <option value="easy_apply_only">Easy Apply Only</option>
                  <option value="all">Include External</option>
                </select>
              </div>
            </div>

            {/* Operating & Pacing Controls */}
            <div className="space-y-3 pt-3 border-t border-[#303132]">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase font-mono tracking-wider text-[#B8B9B9] block">
                  Operating Cadence
                </label>
                <span className="text-[10px] text-[#B8B9B9] font-mono">
                  {pacingMode === "pacing" ? "9 AM–11 PM window" : "burst mode"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPacingMode("pacing")}
                  className={`p-3 rounded-[8px] border-2 text-left transition-all ${
                    pacingMode === "pacing"
                      ? "bg-transparent border-white text-white font-medium"
                      : "bg-transparent border-[#303132] text-[#B8B9B9] hover:border-white/50"
                  }`}
                >
                  <div className="text-xs uppercase font-mono tracking-wider font-semibold">
                    Smart Pacing
                  </div>
                  <div className="text-[10px] text-[#B8B9B9] mt-0.5 font-light">
                    1 job → 20-60m rest
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPacingMode("burst")}
                  className={`p-3 rounded-[8px] border-2 text-left transition-all ${
                    pacingMode === "burst"
                      ? "bg-transparent border-white text-white font-medium"
                      : "bg-transparent border-[#303132] text-[#B8B9B9] hover:border-white/50"
                  }`}
                >
                  <div className="text-xs uppercase font-mono tracking-wider font-semibold">
                    Instant Run
                  </div>
                  <div className="text-[10px] text-[#B8B9B9] mt-0.5 font-light">
                    Fast sequential
                  </div>
                </button>
              </div>

              {!isCurrentlyInWindow && !isRunning && (
                <div className="p-3 rounded-none border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-mono uppercase text-[11px]">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Outside Operating Window ({formatHour12(windowStart)} – {formatHour12(windowEnd)})</span>
                  </div>
                  <p className="text-[11px] text-[#B8B9B9] font-light leading-relaxed">
                    Starting now with Smart Pacing enabled will cause the worker to sleep until {formatHour12(windowStart)} tomorrow.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIgnoreTimeWindow(true)}
                    className="self-start text-[11px] font-mono uppercase tracking-wider text-[#CCF2DF] underline hover:text-white transition-colors"
                  >
                    Bypass window & apply immediately →
                  </button>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <label htmlFor="ignoreTimeWindowCheck" className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    id="ignoreTimeWindowCheck"
                    type="checkbox"
                    checked={ignoreTimeWindow}
                    onChange={(e) => setIgnoreTimeWindow(e.target.checked)}
                    className="rounded-[4px] border-2 border-[#303132] bg-transparent text-white focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs text-white font-light">
                    Run anytime 24/7 (Ignore window)
                  </span>
                </label>
                <span className="text-[10px] text-[#B8B9B9] font-mono">
                  {formatHour12(windowStart)} – {formatHour12(windowEnd)}
                </span>
              </div>
            </div>

            {/* Platform Quota Bars */}
            <div className="space-y-3 pt-3 border-t border-[#303132]">
              <div className="flex justify-between items-center text-xs font-mono uppercase tracking-wider text-[#B8B9B9]">
                <span>Daily Platform Slots</span>
                <span className="text-white font-medium">
                  {stats?.todayApplied ?? 0} / {stats?.todayCap ?? 10} used
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-sky-400">LinkedIn</span>
                  <span className="text-[#B8B9B9]">
                    {linkedinRemaining} slots left
                  </span>
                </div>
                <div className="h-1.5 bg-[#262728] rounded-none overflow-hidden">
                  <div
                    className="bg-sky-400 h-full rounded-none transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (((stats?.platforms?.linkedin?.applied_count ?? 0)) /
                            (stats?.platforms?.linkedin?.max_cap ?? 5)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-[#CCF2DF]">Internshala</span>
                  <span className="text-[#B8B9B9]">
                    {internshalaRemaining} slots left
                  </span>
                </div>
                <div className="h-1.5 bg-[#262728] rounded-none overflow-hidden">
                  <div
                    className="bg-[#CCF2DF] h-full rounded-none transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (((stats?.platforms?.internshala?.applied_count ?? 0)) /
                            (stats?.platforms?.internshala?.max_cap ?? 5)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Session Health & Stealth Card */}
          <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-4">
            <span className="text-xs uppercase font-mono tracking-widest text-white block border-b border-[#303132] pb-3">
              Stealth Browser Environment
            </span>

            <div className="flex items-center justify-between p-3 rounded-none border border-[#303132] bg-[#141516] text-xs font-mono">
              <span className="text-[#B8B9B9] uppercase">Browser:</span>
              <span className="text-white font-medium">
                {stats?.browserName || "Google Chrome"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-none border border-[#303132] bg-[#141516] text-xs font-mono">
              <span className="text-[#B8B9B9] uppercase">Session Cookies:</span>
              <span className="flex items-center gap-1.5">
                {sessionHealth?.hasSessionCookies ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#CCF2DF]" />
                    <span className="text-[#CCF2DF]">Active</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-400">Unauthenticated</span>
                  </>
                )}
              </span>
            </div>

            <div className="p-3.5 rounded-none border border-[#303132] bg-[#141516] text-xs text-[#B8B9B9] font-light space-y-2">
              <p className="text-white font-mono uppercase tracking-wider text-[11px]">
                Visible Interactive Desktop Window
              </p>
              <p className="leading-relaxed">
                Google Chrome launches maximized on your display so you can observe live DOM search iterations and form completions.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Streaming Terminal (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col h-[680px] rounded-none border-2 border-[#303132] bg-[#0e0f10] overflow-hidden">
          {/* Terminal Title Bar */}
          <div className="h-12 px-5 bg-[#131415] border-b-2 border-[#303132] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white/20 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/20 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#CCF2DF] inline-block" />
              </div>
              <span className="text-xs font-mono uppercase tracking-wider text-white ml-2 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#CCF2DF]" />
                playwright-telemetry.log
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5">
              {(["all", "success", "errors"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setLogFilter(tab)}
                  className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-[4px] border transition-colors ${
                    logFilter === tab
                      ? "border-[#CCF2DF] bg-[#CCF2DF]/10 text-[#CCF2DF] font-bold"
                      : "border-transparent text-[#B8B9B9] hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setLogs([])}
                className="text-[#B8B9B9] hover:text-rose-400 p-1.5 ml-1 transition-colors"
                title="Clear screen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Terminal Body */}
          <div className="flex-1 p-5 overflow-y-auto font-mono text-xs leading-relaxed space-y-2 select-text">
            {filteredLogs.length === 0 ? (
              <div className="text-[#B8B9B9]/50 py-16 text-center font-light italic">
                Awaiting runner execution telemetry... Click Dispatch Runner to stream live scraping and application steps.
              </div>
            ) : (
              filteredLogs.map((log, index) => {
                const isError = log.level === "error";
                const isWarn = log.level === "warn";
                const isSuccess = log.level === "success";

                const timeStr = log.timestamp
                  ? new Date(log.timestamp).toLocaleTimeString()
                  : "";

                return (
                  <div
                    key={index}
                    className={`flex items-start gap-2.5 break-all ${
                      isError
                        ? "text-rose-400"
                        : isWarn
                        ? "text-amber-400"
                        : isSuccess
                        ? "text-[#CCF2DF]"
                        : "text-[#E5E7EB]"
                    }`}
                  >
                    <span className="text-[#B8B9B9]/40 select-none shrink-0 font-mono text-[11px]">
                      [{timeStr}]
                    </span>
                    {log.stage && (
                      <span className="text-white/60 font-semibold shrink-0 uppercase">
                        [{log.stage}]
                      </span>
                    )}
                    <span>{log.message}</span>
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>

          {/* Terminal Status Footer */}
          <div className="h-9 px-5 bg-[#131415] border-t border-[#303132] flex items-center justify-between text-[11px] font-mono text-[#B8B9B9] shrink-0">
            <span>Buffer: {filteredLogs.length} events</span>
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-[#CCF2DF] animate-ping" : "bg-zinc-600"}`} />
              SSE Stream Connected
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
