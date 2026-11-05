"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useToast } from "./ui/toast";

export interface PlatformQuota {
  date: string;
  platform: "linkedin" | "internshala";
  applied_count: number;
  max_cap: number;
  remaining: number;
}

export interface StatsData {
  totalApplied: number;
  totalAwaitingApproval: number;
  totalExternalReady: number;
  totalFailed: number;
  totalInterviewing: number;
  todayApplied: number;
  todayCap: number;
  todayRemaining: number;
  pendingAlerts: number;
  platformBreakdown: {
    linkedin: number;
    internshala: number;
  };
  todayDate: string;
  opportunityType: string;
  minMatchScore: string;
  workplaceType: string;
  applyType: string;
  pacingEnabled?: boolean;
  ignoreTimeWindow?: boolean;
  activeWindowStart?: number;
  activeWindowEnd?: number;
  minRestMinutes?: number;
  maxRestMinutes?: number;
  browserName?: string;
  browserPath?: string;
  platforms: {
    linkedin: PlatformQuota;
    internshala: PlatformQuota;
  };
  isRunning: boolean;
  isResting?: boolean;
  nextRunAt?: string | null;
  activeRunId: number | null;
  abortRequested: boolean;
}

interface TelemetryContextValue {
  stats: StatsData | null;
  isLoading: boolean;
  refreshStats: () => Promise<void>;
  startRunner: (options?: {
    platform?: "linkedin" | "internshala" | "both";
    dryRun?: boolean;
    opportunityType?: "internship" | "job";
    workplaceType?: "any" | "remote" | "hybrid" | "on_site";
    targetLocation?: string;
    applyType?: "all" | "easy_apply_only";
    pacingMode?: "pacing" | "burst";
    ignoreTimeWindow?: boolean;
  }) => Promise<boolean>;
  stopRunner: () => Promise<void>;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const toast = useToast();

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) {
          try {
            const data = JSON.parse(text);
            setStats(data);
          } catch (jsonErr) {
            console.warn("Failed to parse telemetry response body:", jsonErr);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to fetch telemetry stats:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Unified single background polling interval (15s)
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const startRunner = useCallback(
    async (options = {}) => {
      try {
        const res = await fetch("/api/automation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options),
        });

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to trigger automation runner.", "Runner Launch Failed");
          return false;
        }

        toast.success(
          data.dryRun
            ? "Dry Run simulation launched in background."
            : "Playwright automation engine launched in background.",
          "Runner Dispatched"
        );
        await fetchStats();
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Network error launching runner.", "Error");
        return false;
      }
    },
    [fetchStats, toast]
  );

  const stopRunner = useCallback(async () => {
    try {
      const res = await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      if (res.ok) {
        toast.warning("Abort command issued to active runner.", "Stopping Worker");
        await fetchStats();
      }
    } catch (err) {
      console.error("Failed to stop runner:", err);
    }
  }, [fetchStats, toast]);

  return (
    <TelemetryContext.Provider
      value={{
        stats,
        isLoading,
        refreshStats: fetchStats,
        startRunner,
        stopRunner,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry(): TelemetryContextValue {
  const ctx = useContext(TelemetryContext);
  if (!ctx) {
    throw new Error("useTelemetry must be used within a TelemetryProvider");
  }
  return ctx;
}
