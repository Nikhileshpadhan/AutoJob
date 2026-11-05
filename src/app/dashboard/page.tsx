"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Play,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Shield,
  ArrowRight,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { useTelemetry } from "@/components/telemetry-provider";

interface ApplicationItem {
  id: number;
  timestamp: string;
  platform: "linkedin" | "internshala";
  company: string;
  position: string;
  status: string;
  match_score?: number;
  job_url?: string;
  tailored_letter?: string;
}

export default function DashboardPage() {
  const { stats, startRunner } = useTelemetry();
  const [recentApps, setRecentApps] = useState<ApplicationItem[]>([]);
  const [actionRequiredApps, setActionRequiredApps] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecent() {
      try {
        setLoading(true);
        // Only fetch limit=8 applications (PERF-002)
        const res = await fetch("/api/applications?limit=8");
        if (res.ok) {
          const data = await res.json();
          const apps: ApplicationItem[] = data.applications || [];
          setRecentApps(apps);
          setActionRequiredApps(
            apps.filter((a) => a.status === "awaiting_approval" || a.status === "external_ready")
          );
        }
      } catch (err) {
        console.warn("Failed to load dashboard applications:", err);
      } finally {
        setLoading(false);
      }
    }

    loadRecent();
  }, [stats?.todayApplied]);

  const quotaPercent = Math.min(
    100,
    Math.round(((stats?.todayApplied ?? 0) / (stats?.todayCap || 10)) * 100)
  );

  const liCap = stats?.platforms?.linkedin?.max_cap ?? 5;
  const liApplied = stats?.platforms?.linkedin?.applied_count ?? 0;
  const isCap = stats?.platforms?.internshala?.max_cap ?? 5;
  const isApplied = stats?.platforms?.internshala?.applied_count ?? 0;

  function getStatusStyle(status: string) {
    switch (status) {
      case "applied":
        return "border border-[#CCF2DF]/50 bg-[#CCF2DF]/10 text-[#CCF2DF]";
      case "awaiting_approval":
        return "border border-amber-500/50 bg-amber-500/15 text-amber-300 animate-pulse";
      case "external_ready":
        return "border border-amber-500/40 bg-amber-500/10 text-amber-300";
      case "interviewing":
      case "offered":
        return "border border-sky-400/40 bg-sky-500/15 text-sky-300";
      case "failed":
      case "captcha_blocked":
        return "border border-rose-500/40 bg-rose-500/10 text-rose-400";
      default:
        return "border border-[#303132] bg-[#262728] text-[#B8B9B9]";
    }
  }

  return (
    <div className="space-y-8 animate-enter">
      {/* Aronya Hero Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-6 border-b border-[#303132]">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-none border border-[#CCF2DF]/40 bg-[#CCF2DF]/10 text-[#CCF2DF]">
              {stats?.opportunityType || "internship"} Mode
            </span>
            <span className="text-xs uppercase font-mono tracking-widest text-[#B8B9B9]">
              AUTONOMOUS CAREER SYSTEM
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-normal tracking-[-0.03em] text-white">
            COMMAND <span className="font-serif italic font-normal text-white">CENTER</span>
          </h1>
          <p className="text-sm text-[#CCF2DF] font-light max-w-2xl leading-relaxed">
            Autonomous multi-platform job application engine with strict pacing, LLM tailoring, and Telegram verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/runner">
            <Button
              size="lg"
              className="text-xs h-12 px-6"
            >
              <Play className="w-3.5 h-3.5 mr-2 fill-current" />
              Open Runner Console
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Row: 4 Metric Cards with Aronya Color-Blocking & Serif Typography */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Daily Safety Quota */}
        <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-3">
          <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-widest text-[#B8B9B9]">
            <span>Daily Pacing</span>
            <Shield className="w-4 h-4 text-[#CCF2DF]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-4xl font-normal text-white">
              {stats?.todayApplied ?? 0}
            </span>
            <span className="text-xs font-mono text-[#B8B9B9]">
              / {stats?.todayCap ?? 10} MAX
            </span>
          </div>
          <div className="w-full bg-[#262728] h-1.5 rounded-none overflow-hidden">
            <div
              className="bg-[#CCF2DF] h-full rounded-none transition-all duration-300"
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-[#B8B9B9] pt-1 border-t border-[#303132]/60">
            <span>LI: {liApplied}/{liCap}</span>
            <span>IS: {isApplied}/{isCap}</span>
          </div>
        </div>

        {/* Metric 2: Applications Submitted */}
        <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-3">
          <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-widest text-[#B8B9B9]">
            <span>Total Applied</span>
            <CheckCircle2 className="w-4 h-4 text-[#CCF2DF]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-4xl font-normal text-white">
              {stats?.totalApplied ?? 0}
            </span>
            <span className="text-xs font-mono text-[#CCF2DF]">
              VERIFIED
            </span>
          </div>
          <p className="text-xs text-[#B8B9B9] font-light leading-relaxed">
            Verified submissions landed across platforms.
          </p>
        </div>

        {/* Metric 3: Action Required Inbox */}
        <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-3">
          <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-widest text-[#B8B9B9]">
            <span>Action Required</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-4xl font-normal text-amber-300">
              {(stats?.totalAwaitingApproval ?? 0) + (stats?.totalExternalReady ?? 0) + (stats?.pendingAlerts ?? 0)}
            </span>
            <span className="text-xs font-mono text-[#B8B9B9]">
              ITEMS
            </span>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-[#B8B9B9] pt-1 border-t border-[#303132]/60">
            <span>DIRECT: {stats?.totalExternalReady ?? 0}</span>
            <span>ALERTS: {stats?.pendingAlerts ?? 0}</span>
          </div>
        </div>

        {/* Metric 4: Interview Funnel */}
        <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-3">
          <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-widest text-[#B8B9B9]">
            <span>Pipeline</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-4xl font-normal text-sky-300">
              {stats?.totalInterviewing ?? 0}
            </span>
            <span className="text-xs font-mono text-[#B8B9B9]">
              ACTIVE
            </span>
          </div>
          <p className="text-xs text-[#B8B9B9] font-light leading-relaxed">
            Interviews and offers in active review.
          </p>
        </div>
      </div>

      {/* Main Split: Left (8 Cols) + Right (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Recent Applications & Scorecard (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#CCF2DF]" />
              <h2 className="text-xs uppercase font-mono tracking-widest text-white">
                Recent Application Telemetry
              </h2>
            </div>
            <Link
              href="/applications"
              className="text-xs uppercase font-mono tracking-wider text-[#CCF2DF] hover:text-white inline-flex items-center gap-1.5 transition-colors"
            >
              View all ({stats?.totalApplied ?? 0}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="rounded-none border border-[#303132] bg-[#131415] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141516] border-b-2 border-[#303132] text-[#B8B9B9] text-[10px] font-mono uppercase tracking-widest">
                <tr>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Position & Company</th>
                  <th className="py-3 px-4">Match</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#303132]/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#B8B9B9] font-mono text-xs uppercase tracking-wider">
                      Loading telemetry stream...
                    </td>
                  </tr>
                ) : recentApps.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#B8B9B9] font-light italic">
                      No applications submitted yet. Launch the runner console to begin.
                    </td>
                  </tr>
                ) : (
                  recentApps.map((app) => (
                    <tr key={app.id} className="hover:bg-[#262728]/40 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#B8B9B9]">
                          {app.platform}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-white truncate max-w-xs">
                          {app.position}
                        </div>
                        <div className="text-[11px] text-[#B8B9B9] font-light">{app.company}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {app.match_score ? (
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-none border border-[#CCF2DF]/40 bg-[#CCF2DF]/10 text-[#CCF2DF]">
                            {app.match_score}%
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-none ${getStatusStyle(
                            app.status
                          )}`}
                        >
                          {app.status.replace("_", " ")}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-[11px] text-[#B8B9B9]">
                        {formatDate(app.timestamp)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Action Inbox & Engine Health (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Action Required Inbox */}
          <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-4">
            <div className="flex items-center justify-between border-b border-[#303132] pb-3">
              <h2 className="text-xs uppercase font-mono tracking-widest text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Action Inbox
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-wider text-amber-300 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 rounded-none">
                {actionRequiredApps.length} Ready
              </span>
            </div>

            {actionRequiredApps.length === 0 ? (
              <p className="text-xs text-[#B8B9B9] font-light py-4 text-center leading-relaxed">
                All queues clear. No pending external portals or review drafts.
              </p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {actionRequiredApps.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-none border border-[#303132] bg-[#141516] space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-white truncate max-w-[170px]">
                        {item.position}
                      </span>
                      <span className="text-[10px] font-mono text-[#B8B9B9]">
                        {item.company}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-amber-300 text-[10px] font-mono uppercase tracking-wider">
                        Direct Apply Ready
                      </span>
                      {item.job_url && (
                        <a
                          href={item.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] uppercase font-mono tracking-wider text-[#CCF2DF] hover:underline"
                        >
                          Open Portal <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Engine Session & Targeting Profile Card */}
          <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-4 text-xs">
            <span className="text-xs uppercase font-mono tracking-widest text-white block border-b border-[#303132] pb-3">
              Automation Constraints
            </span>

            <div className="space-y-2.5 font-mono text-[11px]">
              <div className="flex justify-between items-center py-1 border-b border-[#303132]/40">
                <span className="text-[#B8B9B9] uppercase">Target Mode:</span>
                <span className="font-medium text-white uppercase">
                  {stats?.opportunityType || "internship"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#303132]/40">
                <span className="text-[#B8B9B9] uppercase">Workplace:</span>
                <span className="font-medium text-white uppercase">
                  {stats?.workplaceType || "remote"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#303132]/40">
                <span className="text-[#B8B9B9] uppercase">Min Match Score:</span>
                <span className="font-bold text-[#CCF2DF]">
                  ≥ {stats?.minMatchScore || "65"}%
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-[#B8B9B9] uppercase">Platform Quota:</span>
                <span className="text-white font-medium">
                  {liCap} LI / {isCap} IS
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

