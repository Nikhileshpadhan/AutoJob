"use client";

import { useEffect, useState } from "react";
import { Download, Search, Eye, RefreshCw, ExternalLink, Copy, Check, FileSpreadsheet } from "lucide-react";
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

interface ApplicationRecord {
  id: number;
  timestamp: string;
  platform: "linkedin" | "internshala";
  company: string;
  position: string;
  status: "applied" | "skipped" | "failed" | "captcha_blocked" | "in_progress";
  job_url?: string;
  tailored_letter?: string;
  notes?: string;
}

function SkeletonRow() {
  return (
    <tr>
      <td className="py-3 px-4"><div className="skeleton h-3 w-24 rounded" /></td>
      <td className="py-3 px-4"><div className="skeleton h-5 w-16 rounded" /></td>
      <td className="py-3 px-4"><div className="skeleton h-3 w-28 rounded" /></td>
      <td className="py-3 px-4"><div className="skeleton h-3 w-32 rounded" /></td>
      <td className="py-3 px-4"><div className="skeleton h-5 w-16 rounded" /></td>
      <td className="py-3 px-4 text-right"><div className="skeleton h-6 w-12 rounded ml-auto" /></td>
    </tr>
  );
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  async function loadApplications() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (platformFilter !== "all") params.set("platform", platformFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

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
  }, [platformFilter, statusFilter]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadApplications();
  }

  function handleCopyLetter() {
    if (!selectedApp?.tailored_letter) return;
    navigator.clipboard.writeText(selectedApp.tailored_letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case "applied":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "captcha_blocked":
        return "bg-destructive/10 text-destructive border border-destructive/20";
      case "failed":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "in_progress":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      default:
        return "bg-secondary text-muted-foreground border border-border";
    }
  }

  function getPlatformStyle(platform: string) {
    return platform === "linkedin"
      ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
  }

  return (
    <div className="space-y-5 animate-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Application records</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            Applications
          </h1>
          <p className="text-sm text-muted-foreground">
            Audit trail of submissions, cover letters, and exportable records.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportApplicationsToCSV(applications)}
            disabled={applications.length === 0}
            className="text-xs h-8 px-3 rounded-md border-border bg-card hover:bg-secondary transition-colors duration-150"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadApplications}
            disabled={loading}
            className="text-xs h-8 px-3 rounded-md border-border bg-card hover:bg-secondary transition-colors duration-150"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="border border-border bg-card rounded-md p-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by company or job title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-[13px] h-8 rounded-md border-border bg-background"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              aria-label="Filter by Platform"
              className="h-8 px-2.5 text-xs rounded-md border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-150"
            >
              <option value="all">All platforms</option>
              <option value="linkedin">LinkedIn</option>
              <option value="internshala">Internshala</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by Status"
              className="h-8 px-2.5 text-xs rounded-md border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-150"
            >
              <option value="all">All statuses</option>
              <option value="applied">Applied</option>
              <option value="skipped">Skipped</option>
              <option value="failed">Failed</option>
              <option value="captcha_blocked">Blocked</option>
            </select>

            <Button
              type="submit"
              size="sm"
              className="text-xs h-8 px-3.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors duration-150"
            >
              Apply
            </Button>
          </div>
        </form>
      </div>

      {/* Data Table */}
      <div className="border border-border bg-card rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-secondary/25 border-b border-border text-muted-foreground">
              <tr>
                <th className="py-2.5 px-4 font-medium text-xs w-[140px]">Date</th>
                <th className="py-2.5 px-4 font-medium text-xs w-[100px]">Platform</th>
                <th className="py-2.5 px-4 font-medium text-xs">Company</th>
                <th className="py-2.5 px-4 font-medium text-xs">Position</th>
                <th className="py-2.5 px-4 font-medium text-xs w-[120px]">Status</th>
                <th className="py-2.5 px-4 font-medium text-xs w-[90px] text-right">Letter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="h-40 text-center">
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-md bg-secondary border border-border flex items-center justify-center mx-auto">
                        <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No records match your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="hover:bg-secondary/10 transition-colors duration-100">
                    <td className="py-2.5 px-4 num text-muted-foreground whitespace-nowrap text-xs">
                      {formatDate(app.timestamp)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${getPlatformStyle(app.platform)}`}>
                        {app.platform}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground truncate max-w-[180px]">{app.company}</span>
                        {app.job_url ? (
                          <a
                            href={app.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors duration-150 shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-foreground truncate max-w-[200px]">{app.position}</td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize ${getStatusStyle(app.status)}`}>
                        {app.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {app.tailored_letter ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedApp(app); setCopied(false); }}
                          className="h-7 text-xs px-2 text-primary hover:text-primary hover:bg-primary/8 transition-colors duration-150"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-border bg-card/40 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="num">Records: {applications.length}</span>
          <span>RFC 4180 compliant</span>
        </div>
      </div>

      {/* Cover Letter Modal */}
      <Dialog open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
        <DialogContent className="max-w-xl border-border bg-card text-foreground rounded-md">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-semibold">
              Cover letter — {selectedApp?.company}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Position: <span className="text-foreground">{selectedApp?.position}</span> ·{" "}
              <span className={`capitalize ${
                selectedApp?.platform === "linkedin" ? "text-sky-400" : "text-emerald-400"
              }`}>
                {selectedApp?.platform}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-2">
            <div className="p-4 rounded-md bg-background border border-border text-[13px] leading-relaxed whitespace-pre-wrap font-mono max-h-[360px] overflow-y-auto terminal-scroll">
              {selectedApp?.tailored_letter || "No tailored letter recorded for this submission."}
            </div>

            {selectedApp?.tailored_letter ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLetter}
                className="absolute top-2 right-2 h-7 px-2.5 text-xs border-border bg-card text-foreground hover:bg-secondary transition-colors duration-150"
              >
                {copied ? (
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
            ) : null}
          </div>

          {selectedApp?.notes ? (
            <div className="text-xs text-muted-foreground pt-2 border-t border-border">
              <span className="font-medium text-foreground">Notes:</span> {selectedApp.notes}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
