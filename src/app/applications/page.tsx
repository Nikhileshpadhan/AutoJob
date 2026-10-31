"use client";

import { useEffect, useState } from "react";
import { Download, Search, Filter, Eye, RefreshCw, Briefcase, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Application History Grid</h1>
          <p className="text-sm text-muted-foreground">
            High-density tracking matrix of automated submissions with tailored cover letters and RFC 4180 CSV export.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportApplicationsToCSV(applications)}
            disabled={applications.length === 0}
            className="text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-2" />
            Universal CSV Export
          </Button>

          <Button variant="outline" size="sm" onClick={loadApplications} disabled={loading} className="text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search by company or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Platform Filter */}
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                aria-label="Filter by Platform"
                className="h-9 px-3 text-xs rounded-md border border-input bg-background text-foreground"
              >
                <option value="all">All Platforms</option>
                <option value="linkedin">LinkedIn</option>
                <option value="internshala">Internshala</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by Status"
                className="h-9 px-3 text-xs rounded-md border border-input bg-background text-foreground"
              >
                <option value="all">All Statuses</option>
                <option value="applied">Applied</option>
                <option value="skipped">Skipped / Dry Run</option>
                <option value="failed">Failed</option>
                <option value="captcha_blocked">CAPTCHA Blocked</option>
              </select>

              <Button type="submit" size="sm" className="text-xs h-9">
                Filter
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* High-Density Data Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Timestamp</TableHead>
                <TableHead className="w-[110px]">Platform</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Position</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[110px] text-right">Tailored Letter</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                    Loading application records...
                  </TableCell>
                </TableRow>
              ) : applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No applications matched your filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatDate(app.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={app.platform === "linkedin" ? "linkedin" : "internshala"}
                        className="text-[10px] uppercase font-bold"
                      >
                        {app.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-sm">
                      <div className="flex items-center gap-1.5">
                        <span>{app.company}</span>
                        {app.job_url ? (
                          <a
                            href={app.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{app.position}</TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-right">
                      {app.tailored_letter ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedApp(app)}
                          className="h-7 text-xs px-2 text-primary hover:text-primary"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Dialog for Tailored Letter */}
      <Dialog open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Briefcase className="w-4 h-4 text-primary" />
              Tailored Letter — {selectedApp?.company}
            </DialogTitle>
            <DialogDescription>
              Role: <span className="font-semibold text-foreground">{selectedApp?.position}</span> • Platform:{" "}
              <span className="capitalize text-foreground">{selectedApp?.platform}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 p-4 rounded-lg bg-muted/30 border border-border/80 text-sm leading-relaxed whitespace-pre-wrap font-mono text-xs">
            {selectedApp?.tailored_letter || "No tailored letter recorded for this submission."}
          </div>

          {selectedApp?.notes ? (
            <div className="text-xs text-muted-foreground pt-1">
              <span className="font-semibold">Notes:</span> {selectedApp.notes}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
