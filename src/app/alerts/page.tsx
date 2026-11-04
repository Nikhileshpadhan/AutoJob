"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  ShieldAlert,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface AlertRecord {
  id: number;
  timestamp: string;
  platform: string;
  type: string;
  message: string;
  screenshot_path?: string;
  status: "pending" | "resolved" | "dismissed";
  resolved_at?: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAlerts() {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  async function resolveAlert(alertId: number, action: "resolved" | "dismissed") {
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId, action }),
      });
      if (res.ok) {
        loadAlerts();
      }
    } catch (err) {
      console.error("Failed to update alert:", err);
    }
  }

  const pendingCount = alerts.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-6 max-w-5xl animate-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Human-In-The-Loop Verification</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            Security Checkpoints
          </h1>
          <p className="text-sm text-muted-foreground">
            Review security challenges intercepted by Playwright (CAPTCHA, OTP, login verification).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
              {pendingCount} Pending Challenge{pendingCount > 1 ? "s" : ""}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadAlerts}
            disabled={loading}
            className="text-xs h-8 px-3 rounded-md border-border bg-card text-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="border border-border bg-card rounded-md p-12 text-center text-xs text-muted-foreground space-y-2">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary" />
          <p>Querying security checkpoint audit log...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="border border-border bg-card rounded-md p-12 text-center space-y-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold text-foreground text-sm">
              All Clear — Zero Checkpoints Intercepted
            </h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No active CAPTCHAs, OTP requests, or account barriers have paused execution.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 stagger-enter">
          {alerts.map((alert) => {
            const isPending = alert.status === "pending";
            return (
              <div
                key={alert.id}
                className={`border rounded-md p-4 transition-all duration-150 ${
                  isPending
                    ? "border-destructive/40 bg-destructive/5 hover:border-destructive/60"
                    : "border-border bg-card hover:border-border/80"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                          isPending
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-secondary text-muted-foreground border border-border"
                        }`}
                      >
                        {alert.status}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-secondary text-[10px] font-mono text-muted-foreground capitalize">
                        {alert.platform}
                      </span>
                      <span className="num text-muted-foreground text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(alert.timestamp)}
                      </span>
                    </div>

                    <p className="font-medium text-sm text-foreground">
                      {alert.message}
                    </p>

                    {alert.screenshot_path ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <ImageIcon className="w-3.5 h-3.5 text-primary" />
                        <span>Snapshot Path: </span>
                        <code className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-background border border-border truncate max-w-md">
                          {alert.screenshot_path}
                        </code>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isPending ? (
                      <>
                        <Button
                          size="sm"
                          className="text-xs h-8 px-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                          onClick={() => resolveAlert(alert.id, "resolved")}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          Mark Solved
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 px-3 rounded-md border-border bg-card text-foreground hover:bg-secondary transition-colors"
                          onClick={() => resolveAlert(alert.id, "dismissed")}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5" />
                          Dismiss
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5 px-2.5 py-1 rounded bg-secondary/50">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>
                          Resolved {alert.resolved_at ? formatDate(alert.resolved_at) : ""}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
