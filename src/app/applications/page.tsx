"use client";

import React, { useEffect, useState } from "react";
import {
  Download,
  Search,
  Eye,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportApplicationsToCSV } from "@/lib/csv-export";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useTelemetry } from "@/components/telemetry-provider";

interface ApplicationRecord {
  id: number;
  timestamp: string;
  platform: "linkedin" | "internshala";
  company: string;
  position: string;
  status:
    | "applied"
    | "awaiting_approval"
    | "external_ready"
    | "interviewing"
    | "offered"
    | "rejected"
    | "skipped"
    | "failed"
    | "captcha_blocked";
  match_score?: number;
  matched_skills_json?: string;
  missing_skills_json?: string;
  match_reasoning?: string;
  job_url?: string;
  tailored_letter?: string;
  notes?: string;
}

export default function ApplicationsPage() {
  const toast = useToast();
  const { refreshStats } = useTelemetry();

  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Debounced search term
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  async function loadApplications() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (platformFilter !== "all") params.set("platform", platformFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/applications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error("Failed to load applications:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApplications();
  }, [platformFilter, statusFilter, debouncedSearch]);

  async function updateStatus(id: number, newStatus: string) {
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Application updated to ${newStatus}.`, "Status Updated");
        setApplications((prev) =>
          prev.map((app) => (app.id === id ? { ...app, status: newStatus as any } : app))
        );
        if (selectedApp && selectedApp.id === id) {
          setSelectedApp((prev) => (prev ? { ...prev, status: newStatus as any } : null));
        }
        await refreshStats();
      }
    } catch (err) {
      toast.error("Failed to update application status.", "Error");
    }
  }

  async function deleteApplication(id: number) {
    if (!confirm("Are you sure you want to delete this application record?")) return;
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Application removed.", "Deleted");
        setApplications((prev) => prev.filter((a) => a.id !== id));
        if (selectedApp && selectedApp.id === id) setSelectedApp(null);
        await refreshStats();
      }
    } catch (err) {
      toast.error("Failed to delete application.", "Error");
    }
  }

  function handleCopyLetter() {
    if (!selectedApp?.tailored_letter) return;
    navigator.clipboard.writeText(selectedApp.tailored_letter);
    setCopied(true);
    toast.success("Cover letter copied to clipboard.", "Copied");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleExportCsv() {
    const success = exportApplicationsToCSV(applications);
    if (!success) {
      toast.warning("No applications matching current filters to export.", "CSV Export");
    } else {
      toast.success("CSV file downloaded successfully.", "Export Ready");
    }
  }

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
        return "border border-sky-400/40 bg-sky-500/15 text-sky-300 font-semibold";
      case "captcha_blocked":
      case "failed":
        return "border border-rose-500/40 bg-rose-500/10 text-rose-400";
      case "skipped":
        return "border border-[#303132] bg-[#262728] text-[#B8B9B9]";
      default:
        return "border border-[#303132] bg-[#141516] text-[#B8B9B9]";
    }
  }

  function getPlatformStyle(platform: string) {
    return platform === "linkedin"
      ? "border border-sky-400/30 bg-sky-500/10 text-sky-300"
      : "border border-[#CCF2DF]/40 bg-[#CCF2DF]/10 text-[#CCF2DF]";
  }

  function isSafeExternalUrl(url?: string): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  return (
    <div className="space-y-8 animate-enter">
      {/* Header — Aronya display heading */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-6 border-b border-[#303132]">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 border border-[#303132] bg-[#262728] text-[#B8B9B9]">
              {applications.length} RECORDS
            </span>
            <span className="text-xs uppercase font-mono tracking-widest text-[#B8B9B9]">
              PIPELINE INTELLIGENCE
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-normal tracking-[-0.03em] text-white">
            APPLICATIONS & <span className="font-serif italic font-normal text-white">FUNNEL</span>
          </h1>
          <p className="text-sm text-[#CCF2DF] font-light max-w-2xl leading-relaxed">
            Historical logs, tailored cover letter archive, match scoring breakdown, and conversion pipeline status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={loadApplications}
            disabled={loading}
            className="text-xs h-12 px-5"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="lg"
            onClick={handleExportCsv}
            disabled={applications.length === 0}
            className="text-xs h-12 px-6"
          >
            <Download className="w-3.5 h-3.5 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-none border border-[#303132] bg-[#131415] flex flex-col sm:flex-row items-center gap-4">
        {/* Search Input (Debounced) */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#B8B9B9] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company or position (e.g. Creative Chaos, Full Stack)..."
            className="pl-10 text-xs sm:text-sm h-11 bg-[#141516] border-2 border-[#303132]"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Platform Filter */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="h-11 px-3.5 rounded-[8px] border-2 border-[#303132] bg-[#141516] text-white text-xs font-mono uppercase tracking-wider focus:border-white focus:outline-none"
          >
            <option value="all">All Platforms</option>
            <option value="linkedin">LinkedIn</option>
            <option value="internshala">Internshala</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 px-3.5 rounded-[8px] border-2 border-[#303132] bg-[#141516] text-white text-xs font-mono uppercase tracking-wider focus:border-white focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="applied">Applied (Submitted)</option>
            <option value="awaiting_approval">Awaiting Approval</option>
            <option value="external_ready">Direct Apply Ready</option>
            <option value="interviewing">Interviewing</option>
            <option value="offered">Offered</option>
            <option value="skipped">Skipped / Dry Run</option>
            <option value="failed">Failed / Blocked</option>
          </select>
        </div>
      </div>

      {/* Applications Table */}
      <div className="rounded-none border border-[#303132] bg-[#131415] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#141516] border-b-2 border-[#303132] text-[#B8B9B9] font-mono text-[10px] uppercase tracking-widest">
              <tr>
                <th className="py-3.5 px-5">Date & Time</th>
                <th className="py-3.5 px-4">Platform</th>
                <th className="py-3.5 px-5">Company & Role</th>
                <th className="py-3.5 px-4">Match</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#303132]/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-[#B8B9B9] font-mono text-xs uppercase tracking-wider">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#CCF2DF] mb-3" />
                    Loading applications database...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-[#B8B9B9] font-light italic">
                    No application records found matching current criteria.
                  </td>
                </tr>
              ) : (
                applications.map((app) => {
                  const matchScore = app.match_score ?? null;
                  const isHighMatch = matchScore !== null && matchScore >= 70;
                  const isModerateMatch = matchScore !== null && matchScore >= 60 && matchScore < 70;

                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-[#262728]/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedApp(app)}
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-5 whitespace-nowrap text-[#B8B9B9] font-mono text-[11px]">
                        {formatDate(app.timestamp)}
                      </td>

                      {/* Platform */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-mono uppercase tracking-wider ${getPlatformStyle(
                            app.platform
                          )}`}
                        >
                          {app.platform}
                        </span>
                      </td>

                      {/* Company & Role */}
                      <td className="py-3.5 px-5">
                        <div className="font-medium text-white truncate max-w-xs sm:max-w-md">
                          {app.position}
                        </div>
                        <div className="text-[11px] text-[#B8B9B9] flex items-center gap-2 mt-0.5 font-light">
                          <span>{app.company}</span>
                          {app.job_url && isSafeExternalUrl(app.job_url) && (
                            <a
                              href={app.job_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[#CCF2DF] hover:underline transition-colors p-0.5"
                              title="Open original listing"
                            >
                              <ExternalLink className="w-3 h-3 inline" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Match Score Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {matchScore !== null ? (
                          <span
                            className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded-none border ${
                              isHighMatch
                                ? "border-[#CCF2DF]/50 bg-[#CCF2DF]/10 text-[#CCF2DF]"
                                : isModerateMatch
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                                : "border-[#303132] bg-[#262728] text-[#B8B9B9]"
                            }`}
                          >
                            {matchScore}%
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* Status Dropdown */}
                      <td
                        className="py-3.5 px-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={app.status}
                          onChange={(e) => updateStatus(app.id, e.target.value)}
                          className={`text-[10px] font-mono uppercase tracking-wider py-1 px-2.5 rounded-none border focus:border-white focus:outline-none ${getStatusStyle(
                            app.status
                          )}`}
                        >
                          <option value="applied" className="bg-[#141516] text-white">Applied</option>
                          <option value="awaiting_approval" className="bg-[#141516] text-white">Awaiting Approval</option>
                          <option value="external_ready" className="bg-[#141516] text-white">Direct Apply Ready</option>
                          <option value="interviewing" className="bg-[#141516] text-white">Interviewing</option>
                          <option value="offered" className="bg-[#141516] text-white">Offered</option>
                          <option value="rejected" className="bg-[#141516] text-white">Rejected</option>
                          <option value="skipped" className="bg-[#141516] text-white">Skipped</option>
                          <option value="failed" className="bg-[#141516] text-white">Failed</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedApp(app)}
                            className="h-8 px-3 text-xs uppercase font-mono tracking-wider text-[#B8B9B9] hover:text-white"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            View
                          </Button>
                          <button
                            type="button"
                            onClick={() => deleteApplication(app.id)}
                            className="p-2 text-[#B8B9B9] hover:text-rose-400 rounded-[8px] hover:bg-rose-500/10 transition-colors"
                            title="Delete record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-Over / Dialog Inspection Drawer */}
      <Dialog open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
        <DialogContent className="max-w-2xl bg-[#131415] border-2 border-[#303132] p-8 max-h-[90vh] overflow-y-auto">
          {selectedApp && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-center gap-3 pb-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-mono uppercase tracking-wider ${getPlatformStyle(
                      selectedApp.platform
                    )}`}
                  >
                    {selectedApp.platform}
                  </span>
                  {selectedApp.match_score && (
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-none border border-[#CCF2DF]/50 bg-[#CCF2DF]/10 text-[#CCF2DF]">
                      {selectedApp.match_score}% MATCH
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-none ${getStatusStyle(
                      selectedApp.status
                    )}`}
                  >
                    {selectedApp.status.replace("_", " ")}
                  </span>
                </div>

                <DialogTitle className="text-xl sm:text-2xl font-normal text-white">
                  {selectedApp.position}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#CCF2DF] font-mono uppercase tracking-wider">
                  {selectedApp.company} • Submitted {formatDate(selectedApp.timestamp)}
                </DialogDescription>
              </DialogHeader>

              {/* Job URL Link */}
              {selectedApp.job_url && isSafeExternalUrl(selectedApp.job_url) && (
                <div className="p-3.5 rounded-none border border-[#303132] bg-[#141516] flex items-center justify-between text-xs">
                  <span className="text-[#B8B9B9] uppercase font-mono text-[10px]">Original Listing URL</span>
                  <a
                    href={selectedApp.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-[#CCF2DF] hover:underline"
                  >
                    Open Link <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Match Reasoning */}
              {selectedApp.match_reasoning && (
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#B8B9B9] block">
                    AI Match Analysis
                  </span>
                  <p className="text-xs text-white/90 leading-relaxed p-4 rounded-none border border-[#303132] bg-[#141516]">
                    {selectedApp.match_reasoning}
                  </p>
                </div>
              )}

              {/* Skills Chips */}
              {(selectedApp.matched_skills_json || selectedApp.missing_skills_json) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedApp.matched_skills_json && (
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-[#CCF2DF] block">
                        Matched Skills
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {JSON.parse(selectedApp.matched_skills_json).map((skill: string, i: number) => (
                          <span
                            key={i}
                            className="text-[11px] font-mono px-2 py-0.5 rounded-none border border-[#CCF2DF]/30 bg-[#CCF2DF]/10 text-[#CCF2DF]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedApp.missing_skills_json && (
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-[#B8B9B9] block">
                        Missing Skills
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {JSON.parse(selectedApp.missing_skills_json).map((skill: string, i: number) => (
                          <span
                            key={i}
                            className="text-[11px] font-mono px-2 py-0.5 rounded-none border border-[#303132] bg-[#262728] text-[#B8B9B9]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tailored Cover Letter in Serif Creative Typography */}
              {selectedApp.tailored_letter && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-[#B8B9B9]">
                      Tailored Letter (AI Generated)
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLetter}
                      className="h-8 px-3 text-xs"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-[#CCF2DF]" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copy Letter
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="p-6 rounded-none border border-[#303132] bg-[#141516] font-serif text-sm leading-relaxed text-white whitespace-pre-wrap selection:bg-[#CCF2DF]/20">
                    {selectedApp.tailored_letter}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
