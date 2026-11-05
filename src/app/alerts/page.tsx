"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  ShieldAlert,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useTelemetry } from "@/components/telemetry-provider";

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
  const toast = useToast();
  const { refreshStats } = useTelemetry();

  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoomedScreenshotAlert, setZoomedScreenshotAlert] = useState<AlertRecord | null>(null);

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
        toast.success(
          action === "resolved" ? "Checkpoint marked as solved. Runner resumed." : "Alert dismissed.",
          "Updated"
        );
        loadAlerts();
        await refreshStats();
      }
    } catch (err) {
      toast.error("Failed to update alert status.", "Error");
    }
  }

  const pendingCount = alerts.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#303132]">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[#CCF2DF]">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>HUMAN-IN-THE-LOOP VERIFICATION</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-white uppercase">
            SECURITY <span className="font-serif italic font-normal text-white">CHECKPOINTS</span>
          </h1>
          <p className="text-xs text-[#B8B9B9] max-w-xl leading-relaxed">
            Review CAPTCHA, OTP, and login challenges intercepted by Playwright. Mark as solved to resume runner automation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 border border-rose-500/40 bg-rose-500/10 text-rose-300">
              {pendingCount} Pending Challenge{pendingCount > 1 ? "s" : ""}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadAlerts}
            disabled={loading}
            className="text-[11px] uppercase tracking-wider font-semibold h-9 px-4 rounded-lg border-2 border-[#303132] bg-transparent text-white hover:border-white hover:bg-white hover:text-[#141516]"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} />
            REFRESH
          </Button>
        </div>
      </div>

      {/* Alert Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center border border-[#303132] bg-[#131415]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#CCF2DF] mb-3" />
            <p className="text-xs font-mono uppercase tracking-widest text-[#B8B9B9]">
              Loading security checkpoints...
            </p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 border border-[#303132] bg-[#131415] text-center space-y-3">
            <ShieldCheck className="w-10 h-10 text-[#CCF2DF] mx-auto" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              No Security Checkpoints
            </h3>
            <p className="text-xs text-[#B8B9B9] max-w-md mx-auto leading-relaxed">
              Playwright has not encountered any unhandled CAPTCHAs, OTPs, or authentication obstacles.
            </p>
          </div>
        ) : (
          alerts.map((alert) => {
            const isPending = alert.status === "pending";
            const screenshotUrl = `/api/alerts/${alert.id}/screenshot`;

            return (
              <div
                key={alert.id}
                className={`p-5 border transition-all ${
                  isPending
                    ? "bg-[#181214] border-rose-500/40"
                    : "bg-[#131415] border-[#303132] opacity-85"
                }`}
              >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                        CHALLENGE #{alert.id}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-[#262728] border border-[#303132] text-white">
                        {alert.platform}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border ${
                          alert.type === "captcha"
                            ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                            : alert.type === "otp"
                            ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                            : "bg-[#CCF2DF]/10 text-[#CCF2DF] border-[#CCF2DF]/30"
                        }`}
                      >
                        {alert.type}
                      </span>
                      <span className="text-[11px] font-mono text-[#B8B9B9] flex items-center gap-1.5 ml-auto sm:ml-0">
                        <Clock className="w-3 h-3" />
                        {formatDate(alert.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs text-white leading-relaxed font-sans">
                      {alert.message}
                    </p>

                    {/* Screenshot Thumbnail Preview */}
                    {alert.screenshot_path && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setZoomedScreenshotAlert(alert)}
                          className="group relative flex items-center gap-3 p-1.5 border border-[#303132] bg-[#141516] hover:border-white transition-colors text-left"
                        >
                          <img
                            src={screenshotUrl}
                            alt={`Checkpoint ${alert.id}`}
                            className="w-24 h-14 object-cover border border-[#303132] group-hover:opacity-90"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                          <div className="pr-3">
                            <span className="text-[11px] uppercase tracking-wider font-semibold text-white flex items-center gap-1.5">
                              <ZoomIn className="w-3 h-3 text-[#CCF2DF]" /> View Snapshot
                            </span>
                            <span className="text-[10px] text-[#B8B9B9] font-mono block mt-0.5">
                              Click to inspect intercepted frame
                            </span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Resolution Actions */}
                  <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end pt-3 lg:pt-0 border-t lg:border-t-0 border-[#303132]">
                    {isPending ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => resolveAlert(alert.id, "resolved")}
                          className="text-[11px] uppercase tracking-wider font-semibold h-9 px-4 rounded-lg border-2 border-[#CCF2DF] bg-[#CCF2DF] text-[#141516] hover:bg-transparent hover:text-[#CCF2DF]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          SOLVED & RESUME
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resolveAlert(alert.id, "dismissed")}
                          className="text-[11px] uppercase tracking-wider font-semibold h-9 px-3 rounded-lg border-2 border-transparent text-[#B8B9B9] hover:border-[#303132] hover:text-white hover:bg-transparent"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          DISMISS
                        </Button>
                      </>
                    ) : (
                      <span className="text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 border border-[#CCF2DF]/30 bg-[#CCF2DF]/10 text-[#CCF2DF] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {alert.status === "resolved" ? "RESOLVED" : "DISMISSED"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Screenshot Zoom Modal */}
      <Dialog
        open={!!zoomedScreenshotAlert}
        onOpenChange={(open) => !open && setZoomedScreenshotAlert(null)}
      >
        <DialogContent className="max-w-4xl bg-[#131415] border-2 border-[#303132] rounded-none p-6">
          {zoomedScreenshotAlert && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold uppercase tracking-wider text-white flex items-center justify-between border-b border-[#303132] pb-3">
                  <span>
                    SNAPSHOT: ALERT #{zoomedScreenshotAlert.id} ({zoomedScreenshotAlert.platform.toUpperCase()})
                  </span>
                  <span className="text-xs font-mono text-[#B8B9B9]">
                    {formatDate(zoomedScreenshotAlert.timestamp)}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="border border-[#303132] bg-[#0E0F10] overflow-hidden max-h-[72vh] flex items-center justify-center p-2">
                <img
                  src={`/api/alerts/${zoomedScreenshotAlert.id}/screenshot`}
                  alt={`Screenshot ${zoomedScreenshotAlert.id}`}
                  className="max-h-[68vh] w-auto object-contain mx-auto border border-[#303132]"
                />
              </div>

              {zoomedScreenshotAlert.status === "pending" && (
                <div className="flex justify-end gap-3 pt-3 border-t border-[#303132]">
                  <Button
                    size="sm"
                    onClick={() => {
                      resolveAlert(zoomedScreenshotAlert.id, "resolved");
                      setZoomedScreenshotAlert(null);
                    }}
                    className="text-[11px] uppercase tracking-wider font-semibold h-9 px-5 rounded-lg border-2 border-[#CCF2DF] bg-[#CCF2DF] text-[#141516] hover:bg-transparent hover:text-[#CCF2DF]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    MARK SOLVED & RESUME RUNNER
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
