"use client";

import { useEffect, useState } from "react";
import { Play, AlertTriangle, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

export function Header() {
  const [engineStatus, setEngineStatus] = useState<"idle" | "running" | "cap_reached">("idle");
  const [activeAlert, setActiveAlert] = useState<{ id: number; message: string; platform: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkStatus() {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/api/automation");
      if (res.ok) {
        const data = await res.json();
        if (data.isCapReached) {
          setEngineStatus("cap_reached");
        } else {
          setEngineStatus("idle");
        }
      }

      const alertRes = await fetch("/api/alerts");
      if (alertRes.ok) {
        const alertData = await alertRes.json();
        const pending = alertData.alerts?.find((a: { status: string }) => a.status === "pending");
        setActiveAlert(pending || null);
      }
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  async function triggerRun(dryRun: boolean = false) {
    setLoading(true);
    try {
      const res = await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "both", dryRun }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to start automation run.");
      } else {
        alert(dryRun ? "Dry run test simulated successfully." : "Automation engine launched in background.");
        checkStatus();
      }
    } catch {
      alert("Network error triggering engine.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <header className="h-14 border-b border-border bg-sidebar/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      {/* Status Indicator */}
      <div className="flex items-center gap-3 pl-10 lg:pl-0">
        {activeAlert ? (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-destructive/8 border border-destructive/25 text-destructive text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Verification needed on {activeAlert.platform}</span>
            <span className="sm:hidden">Verify</span>
          </div>
        ) : engineStatus === "cap_reached" ? (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/8 border border-amber-500/25 text-amber-400 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Daily cap reached — Standby</span>
            <span className="sm:hidden">Cap reached</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-primary/6 border border-primary/20 text-foreground text-xs font-medium">
            <span className="status-dot" />
            <span className="hidden sm:inline">Engine ready — Playwright idle</span>
            <span className="sm:hidden">Ready</span>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => triggerRun(true)}
          disabled={loading || engineStatus === "cap_reached"}
          className="hidden sm:inline-flex text-xs h-8 px-3 rounded-md border-border bg-card text-foreground hover:bg-secondary transition-colors duration-150"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Dry run
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={() => triggerRun(false)}
          disabled={loading || engineStatus === "cap_reached"}
          className="text-xs h-8 px-3.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors duration-150"
        >
          <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
          <span className="hidden sm:inline">Start runner</span>
          <span className="sm:hidden">Run</span>
        </Button>
      </div>
    </header>
  );
}
