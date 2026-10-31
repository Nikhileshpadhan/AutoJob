"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Send,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Briefcase,
  Layers,
  ArrowRight,
  TrendingUp,
  Cpu,
  Bot,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface StatsData {
  totalApplied: number;
  todayApplied: number;
  todayCap: number;
  todayRemaining: number;
  pendingAlerts: number;
  platformBreakdown: {
    linkedin: number;
    internshala: number;
  };
  todayDate: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentApps, setRecentApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsRes, appsRes] = await fetch("/api/stats").then((r) => r.json()),
          appsData = await fetch("/api/applications").then((r) => r.json());

        setStats(statsRes);
        setRecentApps(appsData.applications?.slice(0, 5) || []);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-background to-secondary/30 border border-primary/20 shadow-xs">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
              Self-Hosted Job Engine
            </span>
            <span className="text-xs text-muted-foreground">• 24/7 Automation</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            LinkedIn & Internshala Application Automation
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Autonomous multi-platform job application runner with strict daily 5-application pacing, dynamic LLM cover letter tailoring, and Telegram-backed human-in-the-loop CAPTCHA bypass.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/profile">
            <Button variant="outline" size="sm">
              <FileText className="w-4 h-4 mr-2" />
              Upload Resume
            </Button>
          </Link>
          <Link href="/runner">
            <Button size="sm">
              <Bot className="w-4 h-4 mr-2" />
              Engine Console
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Today's Quota */}
        <Card className="relative overflow-hidden border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Daily Quota Remaining
            </CardTitle>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-foreground">
                {stats?.todayRemaining ?? 5}
              </span>
              <span className="text-xs text-muted-foreground">
                of {stats?.todayCap ?? 5} slots left
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Strict 5/day cap enforced to maintain account safety.
            </p>
            <div className="w-full bg-secondary h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${Math.min(100, ((stats?.todayApplied ?? 0) / (stats?.todayCap ?? 5)) * 100)}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Total Applied */}
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Applications
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-foreground">
                {stats?.totalApplied ?? 0}
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Successfully logged
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              All submissions backed by SQLite history.
            </p>
          </CardContent>
        </Card>

        {/* Metric 3: Platform Breakdown */}
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Platform Distribution
            </CardTitle>
            <Briefcase className="w-4 h-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <Badge variant="linkedin" className="h-4 px-1.5 text-[10px]">
                    IN
                  </Badge>
                  LinkedIn
                </span>
                <span className="font-mono font-bold">{stats?.platformBreakdown?.linkedin ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <Badge variant="internshala" className="h-4 px-1.5 text-[10px]">
                    IS
                  </Badge>
                  Internshala
                </span>
                <span className="font-mono font-bold">{stats?.platformBreakdown?.internshala ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Human-in-the-Loop Alerts */}
        <Card
          className={
            stats && stats.pendingAlerts > 0
              ? "border-rose-500/40 bg-rose-500/5"
              : "border-border/80"
          }
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Security Checkpoints
            </CardTitle>
            <AlertTriangle
              className={
                stats && stats.pendingAlerts > 0
                  ? "w-4 h-4 text-rose-500 animate-pulse"
                  : "w-4 h-4 text-muted-foreground"
              }
            />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-foreground">
                {stats?.pendingAlerts ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">Pending Human Review</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Connected to Telegram for instant snapshot alerts.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Section: System Architecture & Recent Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Applications Feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent Submissions</CardTitle>
              <CardDescription>
                Live stream of applications handled by the automated Playwright runner.
              </CardDescription>
            </div>
            <Link href="/applications">
              <Button variant="ghost" size="sm" className="text-xs">
                View Full Grid <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentApps.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground space-y-3">
                <FileText className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm">No applications recorded yet.</p>
                <div className="flex justify-center gap-3">
                  <Link href="/profile">
                    <Button variant="outline" size="sm">
                      Setup Candidate Profile
                    </Button>
                  </Link>
                  <Link href="/runner">
                    <Button size="sm">Launch First Run</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {recentApps.map((app) => (
                  <div key={app.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{app.position}</span>
                        <Badge
                          variant={app.platform === "linkedin" ? "linkedin" : "internshala"}
                          className="text-[10px] uppercase font-bold"
                        >
                          {app.platform}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {app.company} • {formatDate(app.timestamp)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={
                          app.status === "applied"
                            ? "applied"
                            : app.status === "captcha_blocked"
                            ? "blocked"
                            : "pending"
                        }
                      >
                        {app.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Blueprint Architecture Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              5-Phase Blueprint
            </CardTitle>
            <CardDescription>Engine state machine pipeline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs">
            <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>Phase 1: Onboarding</span>
                <span className="text-[10px] text-primary font-mono">SQLite DB</span>
              </div>
              <p className="text-muted-foreground">PDF resume ingestion & matrix extraction.</p>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>Phase 2: Job Scraper</span>
                <span className="text-[10px] text-sky-500 font-mono">Playwright</span>
              </div>
              <p className="text-muted-foreground">Crawler with persistent cookie state.</p>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>Phase 3: Context Weaver</span>
                <span className="text-[10px] text-emerald-500 font-mono">Gemini / Groq</span>
              </div>
              <p className="text-muted-foreground">150-word tailored letters & form Q&A.</p>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>Phase 4: Submission</span>
                <span className="text-[10px] text-amber-500 font-mono">Strict 5 Cap</span>
              </div>
              <p className="text-muted-foreground">Auto-submission & incremental quota counter.</p>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>Phase 5: Human-In-The-Loop</span>
                <span className="text-[10px] text-rose-500 font-mono">Telegram Bot</span>
              </div>
              <p className="text-muted-foreground">Instant photo alerts on CAPTCHA / OTP barriers.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
