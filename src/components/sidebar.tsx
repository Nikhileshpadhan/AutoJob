"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileSpreadsheet,
  UserCheck,
  SlidersHorizontal,
  Bot,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { useEffect, useState } from "react";

interface QuickStats {
  totalApplied: number;
  todayApplied: number;
  todayCap: number;
  todayRemaining: number;
  pendingAlerts: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const [stats, setStats] = useState<QuickStats>({
    totalApplied: 0,
    todayApplied: 0,
    todayCap: 5,
    todayRemaining: 5,
    pendingAlerts: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to load quick stats:", err);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Applications", href: "/applications", icon: FileSpreadsheet },
    { label: "Master Profile", href: "/profile", icon: UserCheck },
    { label: "Runner Console", href: "/runner", icon: Bot },
    { label: "Alerts & Exceptions", href: "/alerts", icon: AlertTriangle, count: stats.pendingAlerts },
    { label: "Settings", href: "/settings", icon: SlidersHorizontal },
  ];

  return (
    <aside className="w-64 border-r bg-card/60 backdrop-blur-md flex flex-col justify-between h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-md shadow-primary/20">
            A
          </div>
          <div>
            <span className="font-bold tracking-tight text-base block">AutoJob</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
              24/7 Engine
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.count && item.count > 0 ? (
                  <Badge variant="destructive" className="h-5 px-1.5 text-[11px] font-bold animate-pulse">
                    {item.count}
                  </Badge>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Quick Metrics Widget in Minimalist Sidebar */}
      <div className="p-4 border-t space-y-3 bg-muted/20">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Quick Metrics
        </div>

        {/* Quota Progress */}
        <div className="p-3 rounded-lg border bg-background/80 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Daily Quota</span>
            <span className="font-semibold text-foreground">
              {stats.todayApplied} / {stats.todayCap}
            </span>
          </div>
          <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500 rounded-full",
                stats.todayRemaining === 0 ? "bg-amber-500" : "bg-primary"
              )}
              style={{
                width: `${Math.min(100, (stats.todayApplied / (stats.todayCap || 5)) * 100)}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
            <span>Remaining:</span>
            <span className="font-mono font-medium text-foreground">{stats.todayRemaining} slots</span>
          </div>
        </div>

        {/* Total Applied & Active Alerts */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg border bg-background/80 space-y-0.5 shadow-2xs">
            <span className="text-[11px] text-muted-foreground block">Total Applied</span>
            <span className="font-bold text-base text-foreground font-mono">{stats.totalApplied}</span>
          </div>

          <div
            className={cn(
              "p-2.5 rounded-lg border space-y-0.5 shadow-2xs transition-colors",
              stats.pendingAlerts > 0
                ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                : "bg-background/80 text-foreground"
            )}
          >
            <span className="text-[11px] text-muted-foreground block">Alerts</span>
            <span className="font-bold text-base font-mono">{stats.pendingAlerts}</span>
          </div>
        </div>

        {/* Platform Targets */}
        <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Target Platforms:</span>
          </span>
          <div className="flex gap-1.5">
            <Badge variant="linkedin" className="text-[10px] py-0 px-1.5">
              LinkedIn
            </Badge>
            <Badge variant="internshala" className="text-[10px] py-0 px-1.5">
              Internshala
            </Badge>
          </div>
        </div>
      </div>
    </aside>
  );
}
