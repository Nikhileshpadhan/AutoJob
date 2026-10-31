"use client";

import { useEffect, useState } from "react";
import { Play, ShieldAlert, CheckCircle, Terminal, Bot, RefreshCw, Cpu, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function RunnerConsolePage() {
  const [platform, setPlatform] = useState<"both" | "linkedin" | "internshala">("both");
  const [dryRun, setDryRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "[System] AutoJob engine initialized.",
    "[Storage] Persistent browser user directory linked: ./data/browser_profile",
    "[Scheduler] Daily quota monitor standing by.",
  ]);
  const [quota, setQuota] = useState<{ applied: number; max: number; remaining: number } | null>(null);

  async function loadQuota() {
    try {
      const res = await fetch("/api/automation");
      if (res.ok) {
        const data = await res.json();
        setQuota({
          applied: data.quota.applied_count,
          max: data.quota.max_cap,
          remaining: data.quota.remaining,
        });
      }
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    loadQuota();
    const interval = setInterval(loadQuota, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleStart() {
    setIsRunning(true);
    addLog(`[Runner] Requesting automation launch (Platform: ${platform}, DryRun: ${dryRun})...`);

    try {
      const res = await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, dryRun }),
      });

      const data = await res.json();
      if (!res.ok) {
        addLog(`[Error] ${data.error || "Failed to start run."}`);
      } else {
        addLog(`[Engine] Background Playwright worker dispatched successfully.`);
        addLog(`[Crawler] Navigating target platforms with human mouse-jitter emulation...`);
      }
    } catch (err) {
      addLog(`[Network Error] Could not reach runner endpoint.`);
    } finally {
      setTimeout(() => setIsRunning(false), 2000);
      loadQuota();
    }
  }

  function addLog(msg: string) {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Runner Console & Automation Daemon</h1>
        <p className="text-sm text-muted-foreground">
          Milestone 3 & 5: Trigger real-time browser runs, monitor Playwright events, and observe quota pacing.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Controls Card */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              Run Controls
            </CardTitle>
            <CardDescription>Execution parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Target Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="w-full h-9 px-3 text-xs rounded-md border border-input bg-background text-foreground"
              >
                <option value="both">Both (LinkedIn & Internshala)</option>
                <option value="linkedin">LinkedIn Only</option>
                <option value="internshala">Internshala Only</option>
              </select>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Dry Run Mode</span>
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                When enabled, searches listings & generates cover letters without pressing the final Submit button.
              </p>
            </div>

            {/* Quota Status Box */}
            <div className="p-3 rounded-lg border bg-muted/30 space-y-1 text-xs">
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Today&apos;s Quota:</span>
                <span className="font-mono font-bold">
                  {quota?.applied ?? 0} / {quota?.max ?? 5}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground text-[11px]">
                <span>Remaining:</span>
                <span className="font-mono font-semibold text-foreground">
                  {quota?.remaining ?? 5} applications
                </span>
              </div>
            </div>

            <Button
              className="w-full"
              size="sm"
              disabled={isRunning || (quota?.remaining ?? 5) <= 0}
              onClick={handleStart}
            >
              <Play className="w-4 h-4 mr-2 fill-current" />
              {isRunning ? "Starting..." : "Dispatch Runner Now"}
            </Button>

            {(quota?.remaining ?? 5) <= 0 && (
              <p className="text-[11px] text-amber-500 font-medium text-center">
                Strict daily quota limit reached for today.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Live Terminal & Logs Card */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="w-4 h-4 text-sky-400" />
                Live Execution Logs
              </CardTitle>
              <CardDescription>Event log stream</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogs(["[System] Logs cleared."])}
              className="text-xs h-7 px-2"
            >
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            <div className="bg-black/90 text-emerald-400 font-mono text-xs p-4 rounded-lg h-[340px] overflow-y-auto space-y-1.5 border border-border/40 shadow-inner">
              {logs.map((log, idx) => (
                <div key={idx} className="leading-relaxed whitespace-pre-wrap">
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CLI & Cloud Provisioning Info (Milestone 5) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            Milestone 5: 24/7 Background Cron Automation
          </CardTitle>
          <CardDescription>
            Run natively via Node/TypeScript CLI or configure a server cron job.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <p className="text-muted-foreground">
            You can run the engine headlessly on a schedule, VPS, or local machine using the package CLI command:
          </p>
          <pre className="p-3 rounded-lg bg-muted/40 font-mono text-xs text-foreground overflow-x-auto border">
            npm run bot:run
          </pre>
          <p className="text-muted-foreground text-[11px]">
            Example Crontab (Runs twice daily at 9:00 AM and 2:00 PM, capped automatically by the SQLite quota):
          </p>
          <pre className="p-2.5 rounded-lg bg-muted/40 font-mono text-[11px] text-foreground overflow-x-auto border">
            0 9,14 * * * cd /path/to/AUTOJOB && npm run bot:run &gt;&gt; /var/log/autojob.log 2&gt;&amp;1
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
