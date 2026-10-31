"use client";

import { useEffect, useState } from "react";
import { Play, Square, AlertTriangle, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export function Header() {
  const [engineStatus, setEngineStatus] = useState<"idle" | "running" | "cap_reached">("idle");
  const [activeAlert, setActiveAlert] = useState<{ id: number; message: string; platform: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkStatus() {
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
        const pending = alertData.alerts?.find((a: any) => a.status === "pending");
        setActiveAlert(pending || null);
      }
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
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
        alert(dryRun ? "Dry run test simulated successfully!" : "Automation engine launched in background!");
        checkStatus();
      }
    } catch {
      alert("Network error triggering engine.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <header className="h-16 border-b bg-card/40 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left Status Indicator */}
      <div className="flex items-center gap-3">
        {activeAlert ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Human Intervention Needed on {activeAlert.platform.toUpperCase()}</span>
          </div>
        ) : engineStatus === "cap_reached" ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Strict Daily Cap (5/5) Reached — Standby</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Engine Ready • Background Daemon Active</span>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => triggerRun(true)}
          disabled={loading || engineStatus === "cap_reached"}
          className="text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Test Dry Run
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={() => triggerRun(false)}
          disabled={loading || engineStatus === "cap_reached"}
          className="text-xs"
        >
          <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
          Start Run (LinkedIn & Internshala)
        </Button>
      </div>
    </header>
  );
}
