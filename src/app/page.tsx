"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  ArrowRight,
  Bot,
  ExternalLink,
  Activity,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface StatsData {
  totalApplied: number;
  todayApplied: number;
  todayCap: number;
  todayRemaining: number;
  pendingAlerts: number;
  opportunityType?: "internship" | "job";
  platforms?: {
    linkedin: { applied_count: number; max_cap: number; remaining: number };
    internshala: { applied_count: number; max_cap: number; remaining: number };
  };
  platformBreakdown: {
    linkedin: number;
    internshala: number;
  };
  todayDate: string;
}

interface ApplicationItem {
  id: number;
  platform: string;
  job_id: string;
  company: string;
  position: string;
  job_url: string;
  status: string;
  match_score?: number;
  timestamp: string;
}

function SkeletonCard() {
  return (
    <div className="p-4 rounded-md border border-border bg-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-3.5 w-3.5 rounded" />
      </div>
      <div className="skeleton h-7 w-16 rounded" />
      <div className="skeleton h-2.5 w-32 rounded" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      <td className="py-3 px-4"><div className="skeleton h-3 w-32 rounded" /><div className="skeleton h-2.5 w-20 rounded mt-1.5" /></td>
      <td className="py-3 px-4"><div className="skeleton h-5 w-16 rounded" /></td>
      <td className="py-3 px-4"><div className="skeleton h-3 w-20 rounded" /></td>
      <td className="py-3 px-4 text-right"><div className="skeleton h-5 w-14 rounded ml-auto" /></td>
    </tr>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentApps, setRecentApps] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const [statsRes, appsData] = await Promise.all([
          fetch("/api/stats").then((r) => r.json()),
          fetch("/api/applications").then((r) => r.json()),
        ]);

        setStats(statsRes);
        setRecentApps(appsData.applications?.slice(0, 7) || []);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const quotaPercent = Math.min(
    100,
    Math.round(((stats?.todayApplied ?? 0) / (stats?.todayCap ?? 5)) * 100)
  );

  const totalPlatformApps = (stats?.platformBreakdown?.linkedin ?? 0) + (stats?.platformBreakdown?.internshala ?? 0);
  const linkedinPct = totalPlatformApps > 0 ? Math.round(((stats?.platformBreakdown?.linkedin ?? 0) / totalPlatformApps) * 100) : 50;

  return (
    <div className="space-y-6 animate-enter">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Activity className="w-3.5 h-3.5" />
            <span>Automation telemetry</span>
            <span className="text-border">·</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 capitalize">
              {stats?.opportunityType || "internship"} Mode (High-Chance Filter Active)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            Overview
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg">
            Multi-platform submission engine with independent 5-quota pacing, resume match scoring, and human-in-the-loop verification.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/profile">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 px-3 rounded-md border-border bg-card hover:bg-secondary transition-colors duration-150"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Profile
            </Button>
          </Link>
          <Link href="/runner">
            <Button
              size="sm"
              className="text-xs h-8 px-3.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150"
            >
              <Bot className="w-3.5 h-3.5 mr-1.5" />
              Runner console
            </Button>
          </Link>
        </div>
      </div>

      {/* Alert Banner */}
      {stats && stats.pendingAlerts > 0 ? (
        <div className="p-4 rounded-md border border-destructive/30 bg-destructive/6 flex items-center justify-between gap-4 animate-enter">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-destructive/12 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Security verification required
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.pendingAlerts} pending checkpoint{stats.pendingAlerts > 1 ? "s" : ""} — complete to resume automation
              </p>
            </div>
          </div>
          <Link href="/alerts" className="shrink-0">
            <Button
              size="sm"
              className="text-xs h-8 px-3 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors duration-150"
            >
              Inspect
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      ) : null}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-enter">
        {/* Metric 1: Daily Quota */}
        {loading ? <SkeletonCard /> : (
          <div className="p-4 rounded-md border border-border bg-card space-y-2.5 hover:border-border/80 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Daily quota</span>
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="num text-2xl font-bold text-foreground">
                {stats?.todayRemaining ?? 10}
              </span>
              <span className="num text-xs text-muted-foreground">
                / {stats?.todayCap ?? 10} total
              </span>
            </div>
            <div className="w-full bg-secondary h-1.5 rounded-sm overflow-hidden">
              <div
                className="bg-primary h-full rounded-sm transition-all duration-500"
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              LI: {stats?.platforms?.linkedin?.remaining ?? 5}/{stats?.platforms?.linkedin?.max_cap ?? 5} · IS: {stats?.platforms?.internshala?.remaining ?? 5}/{stats?.platforms?.internshala?.max_cap ?? 5}
            </p>
          </div>
        )}

        {/* Metric 2: Total Applications */}
        {loading ? <SkeletonCard /> : (
          <div className="p-4 rounded-md border border-border bg-card space-y-2.5 hover:border-border/80 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total applied</span>
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="num text-2xl font-bold text-foreground">
                {stats?.totalApplied ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">all-time</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              SQLite audit ledger
            </p>
          </div>
        )}

        {/* Metric 3: Platform Breakdown */}
        {loading ? <SkeletonCard /> : (
          <div className="p-4 rounded-md border border-border bg-card space-y-2.5 hover:border-border/80 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">By platform</span>
              <Zap className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            {/* Visual bar */}
            <div className="flex gap-0.5 h-2 rounded-sm overflow-hidden bg-secondary">
              <div className="bg-sky-500 rounded-l-sm transition-all duration-500" style={{ width: `${linkedinPct}%` }} />
              <div className="bg-emerald-500 rounded-r-sm transition-all duration-500" style={{ width: `${100 - linkedinPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                <span className="text-muted-foreground">LI</span>
                <span className="num font-semibold text-foreground">{stats?.platformBreakdown?.linkedin ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">IS</span>
                <span className="num font-semibold text-foreground">{stats?.platformBreakdown?.internshala ?? 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* Metric 4: Active Alerts */}
        {loading ? <SkeletonCard /> : (
          <div className="p-4 rounded-md border border-border bg-card space-y-2.5 hover:border-border/80 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Checkpoints</span>
              <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`num text-2xl font-bold ${
                  stats && stats.pendingAlerts > 0 ? "text-destructive" : "text-foreground"
                }`}
              >
                {stats?.pendingAlerts ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">active</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Telegram bot bridge
            </p>
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Applications */}
        <div className="lg:col-span-2 border border-border bg-card rounded-md flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Recent activity
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Latest job submissions
              </p>
            </div>
            <Link href="/applications">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2.5 text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                View all
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
                </table>
              </div>
            ) : recentApps.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-10 h-10 rounded-md bg-secondary border border-border flex items-center justify-center mx-auto">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">No applications yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Upload your resume and start the runner</p>
                </div>
                <div className="flex justify-center gap-2 pt-1">
                  <Link href="/profile">
                    <Button variant="outline" size="sm" className="text-xs h-8 rounded-md">
                      Upload resume
                    </Button>
                  </Link>
                  <Link href="/runner">
                    <Button size="sm" className="text-xs h-8 rounded-md bg-primary text-primary-foreground">
                      Launch runner
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/30 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-4 font-medium text-xs">Position</th>
                      <th className="py-2.5 px-4 font-medium text-xs">Platform</th>
                      <th className="py-2.5 px-4 font-medium text-xs hidden sm:table-cell">Date</th>
                      <th className="py-2.5 px-4 font-medium text-xs text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {recentApps.map((app) => (
                      <tr key={app.id} className="hover:bg-card/80 transition-colors duration-100">
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-foreground truncate max-w-[220px] text-[13px]">
                            {app.position}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                            {app.company}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
                            app.platform === "linkedin"
                              ? "bg-sky-500/12 text-sky-400 border border-sky-500/20"
                              : "bg-emerald-500/12 text-emerald-400 border border-emerald-500/20"
                          }`}>
                            {app.platform}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground num hidden sm:table-cell">
                          {formatDate(app.timestamp)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                              app.status === "applied"
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : app.status === "captcha_blocked"
                                ? "bg-destructive/10 text-destructive border border-destructive/20"
                                : "bg-secondary text-muted-foreground border border-border"
                            }`}
                          >
                            {app.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border bg-card/40 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Strict daily limit: 5 apps</span>
            <span className="num">Jitter: 15–45s</span>
          </div>
        </div>

        {/* Pipeline Architecture */}
        <div className="border border-border bg-card rounded-md flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              Engine pipeline
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              5-phase execution flow
            </p>
          </div>

          <div className="p-3 flex-1 space-y-1.5 stagger-enter">
            {[
              { phase: "1", title: "Ingestion", desc: "Resume & career preferences", tag: "SQLite" },
              { phase: "2", title: "Crawler", desc: "Stealth browser job scraping", tag: "Playwright" },
              { phase: "3", title: "LLM Weaver", desc: "Cover letter & Q\u0026A synthesis", tag: "Gemini / Groq", highlight: true },
              { phase: "4", title: "Submission", desc: "Quota-gated form submission", tag: "5/day cap" },
              { phase: "5", title: "Checkpoint", desc: "CAPTCHA/OTP pause & alert", tag: "Telegram" },
            ].map((step) => (
              <div
                key={step.phase}
                className={`p-3 rounded-md border transition-colors duration-150 ${
                  step.highlight
                    ? "border-primary/20 bg-primary/4"
                    : "border-border/60 bg-secondary/15 hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                      step.highlight
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary text-muted-foreground"
                    }`}>
                      {step.phase}
                    </span>
                    <span className="font-medium text-[13px] text-foreground">{step.title}</span>
                  </div>
                  <span className={`text-[10px] ${step.highlight ? "text-primary" : "text-muted-foreground"}`}>
                    {step.tag}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-7">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-border bg-card/40 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Mode: Standalone</span>
            <Link href="/settings" className="hover:text-foreground inline-flex items-center gap-1 transition-colors duration-150">
              Configure <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
