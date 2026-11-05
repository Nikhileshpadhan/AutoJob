"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Play, Square, AlertTriangle, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { useTelemetry } from "./telemetry-provider";

export function Header() {
  const { stats, startRunner, stopRunner } = useTelemetry();
  const [loading, setLoading] = useState(false);

  const isRunning = stats?.isRunning ?? false;
  const isCapReached = (stats?.todayRemaining ?? 1) <= 0;
  const pendingAlerts = stats?.pendingAlerts ?? 0;

  async function handleStart(dryRun: boolean = false) {
    setLoading(true);
    try {
      await startRunner({ platform: "both", dryRun });
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    setLoading(true);
    try {
      await stopRunner();
    } finally {
      setLoading(false);
    }
  }

  return (
    <header className="h-20 border-b border-[#303132] bg-[#141516]/95 backdrop-blur-sm px-6 sm:px-8 flex items-center justify-between sticky top-0 z-[900] shrink-0">
      {/* Live Worker Status Indicator (Aronya aesthetic) */}
      <div className="flex items-center gap-3 pl-10 lg:pl-0">
        {isRunning ? (
          stats?.isResting ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[#262728] border-2 border-amber-500/40 text-amber-300 text-xs font-mono uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>
                Resting ({stats.nextRunAt ? `Next apply at ${new Date(stats.nextRunAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Scheduled"})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-[8px] bg-[#131415] border-2 border-[#CCF2DF] text-[#CCF2DF] text-xs font-mono uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#CCF2DF] animate-ping" />
              <span>Worker: Active</span>
            </div>
          )
        ) : pendingAlerts > 0 ? (
          <Link
            href="/alerts"
            className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-rose-500/10 border-2 border-rose-500/50 text-rose-300 text-xs font-mono uppercase tracking-wider hover:bg-rose-500/20 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{pendingAlerts} verification checkpoint pending</span>
          </Link>
        ) : isCapReached ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[#262728] border-2 border-amber-500/40 text-amber-300 text-xs font-mono uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="tabular-nums">Daily cap reached ({stats?.todayApplied}/{stats?.todayCap})</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-[8px] bg-[#131415] border-2 border-[#303132] text-[#B8B9B9] text-xs font-mono uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#CCF2DF] inline-block" />
            <span>Worker: Standby / Ready</span>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {isRunning ? (
          <Button
            variant="destructive"
            size="default"
            onClick={handleStop}
            disabled={loading}
            className="text-xs h-10 px-4"
          >
            <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
            Stop runner
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="default"
              onClick={() => handleStart(true)}
              disabled={loading || isCapReached}
              className="hidden sm:inline-flex text-xs h-10 px-4"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Dry run
            </Button>

            <Button
              size="default"
              onClick={() => handleStart(false)}
              disabled={loading || isCapReached}
              className="text-xs h-10 px-5"
            >
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
              Start runner
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
