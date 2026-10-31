"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck, CheckCircle2, XCircle, RefreshCw, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Security Checkpoints & Telegram Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Phase 5 Human-in-the-Loop tracking: Review CAPTCHA, OTP, and authentication barriers detected by Playwright.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadAlerts} disabled={loading} className="text-xs">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Alerts
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
            Loading alert records...
          </CardContent>
        </Card>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground space-y-2">
            <ShieldCheck className="w-10 h-10 mx-auto text-emerald-500 opacity-80" />
            <h3 className="font-semibold text-foreground text-sm">No Security Checkpoints Detected</h3>
            <p className="text-xs max-w-sm mx-auto">
              All automation runs have proceeded smoothly without encountering unresolved CAPTCHA or OTP barriers.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className={
                alert.status === "pending"
                  ? "border-rose-500/50 bg-rose-500/5 shadow-xs"
                  : "border-border/70"
              }
            >
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={alert.status === "pending" ? "destructive" : "secondary"}
                      className="text-[10px] uppercase font-bold"
                    >
                      {alert.status}
                    </Badge>
                    <Badge variant={alert.platform === "linkedin" ? "linkedin" : "internshala"} className="text-[10px]">
                      {alert.platform}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">
                      {formatDate(alert.timestamp)}
                    </span>
                  </div>

                  <p className="font-semibold text-sm text-foreground">{alert.message}</p>
                  {alert.screenshot_path ? (
                    <p className="text-xs font-mono text-muted-foreground">
                      Snapshot: {alert.screenshot_path}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {alert.status === "pending" ? (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        className="text-xs bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => resolveAlert(alert.id, "resolved")}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Mark Resolved
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => resolveAlert(alert.id, "dismissed")}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1.5" />
                        Dismiss
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Resolved {alert.resolved_at ? formatDate(alert.resolved_at) : ""}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
