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
  Radio,
  X,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";

interface QuickStats {
  totalApplied: number;
  todayApplied: number;
  todayCap: number;
  todayRemaining: number;
  pendingAlerts: number;
  opportunityType?: "internship" | "job";
  platforms?: {
    linkedin: { applied_count: number; max_cap: number; remaining: number };
    internshala: { applied_count: number; max_cap: number; remaining: number };
  };
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stats, setStats] = useState<QuickStats>({
    totalApplied: 0,
    todayApplied: 0,
    todayCap: 5,
    todayRemaining: 5,
    pendingAlerts: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
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
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    if (mobileOpen) {
      document.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Applications", href: "/applications", icon: FileSpreadsheet },
    { label: "Master profile", href: "/profile", icon: UserCheck },
    { label: "Runner console", href: "/runner", icon: Bot },
    {
      label: "Alerts queue",
      href: "/alerts",
      icon: AlertTriangle,
      count: stats.pendingAlerts,
    },
    { label: "Settings", href: "/settings", icon: SlidersHorizontal },
  ];

  const quotaPercent = Math.min(
    100,
    Math.round((stats.todayApplied / (stats.todayCap || 5)) * 100)
  );

  const sidebarContent = (
    <>
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border">
        <Link
          href="/"
          className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
        >
          <div className="w-7 h-7 rounded-md bg-primary/12 border border-primary/25 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="leading-none">
            <span className="font-semibold text-sm tracking-tight text-foreground block">
              AutoJob
            </span>
            <span className="text-[11px] text-muted-foreground leading-none">
              automation engine
            </span>
          </div>
        </Link>
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-card border border-border text-[11px] text-muted-foreground">
          <span className="status-dot" />
          <span className="num">v1.0</span>
        </div>
        {/* Mobile close button */}
        <button
          className="lg:hidden p-1 rounded-md hover:bg-card text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive
                  ? "bg-card text-foreground font-medium border border-border/60"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={cn(
                    "w-[15px] h-[15px] transition-colors duration-150",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span>{item.label}</span>
              </div>
              {item.count && item.count > 0 ? (
                <span className="num text-[11px] min-w-[20px] text-center px-1.5 py-0.5 rounded-md bg-destructive text-destructive-foreground font-semibold">
                  {item.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer: Quota & Stats */}
      <div className="p-3 border-t border-border space-y-2.5">
        {/* Dual Platform Quota card */}
        <div className="p-3 rounded-md border border-border bg-card/60 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground capitalize">
              {stats.opportunityType || "internship"} Pacing
            </span>
            <span className="num text-foreground font-medium">
              {stats.todayApplied} / {stats.todayCap}
            </span>
          </div>

          {/* LinkedIn Progress */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                LinkedIn
              </span>
              <span className="num font-medium text-foreground">
                {stats.platforms?.linkedin?.applied_count ?? 0} / {stats.platforms?.linkedin?.max_cap ?? 5}
              </span>
            </div>
            <div className="w-full bg-secondary h-1 rounded-sm overflow-hidden">
              <div
                className="bg-sky-500 h-full rounded-sm transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((stats.platforms?.linkedin?.applied_count ?? 0) /
                        (stats.platforms?.linkedin?.max_cap ?? 5)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Internshala Progress */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Internshala
              </span>
              <span className="num font-medium text-foreground">
                {stats.platforms?.internshala?.applied_count ?? 0} / {stats.platforms?.internshala?.max_cap ?? 5}
              </span>
            </div>
            <div className="w-full bg-secondary h-1 rounded-sm overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-sm transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((stats.platforms?.internshala?.applied_count ?? 0) /
                        (stats.platforms?.internshala?.max_cap ?? 5)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-0.5 border-t border-border/40">
            <span>Slots remaining</span>
            <span className="num font-medium text-foreground">
              {stats.todayRemaining} total
            </span>
          </div>
        </div>

        {/* Mini metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-md border border-border bg-card/40 text-center">
            <span className="text-[11px] text-muted-foreground block">Total</span>
            <span className="num text-base font-semibold text-foreground">
              {stats.totalApplied}
            </span>
          </div>
          <div className="p-2.5 rounded-md border border-border bg-card/40 text-center">
            <span className="text-[11px] text-muted-foreground block">Alerts</span>
            <span
              className={cn(
                "num text-base font-semibold",
                stats.pendingAlerts > 0 ? "text-destructive" : "text-foreground"
              )}
            >
              {stats.pendingAlerts}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
          <span className="capitalize">{stats.opportunityType || "internship"} Mode</span>
          <span className="text-foreground">5 each / day</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger trigger */}
      <button
        className="lg:hidden fixed top-3.5 left-3 z-50 p-2 rounded-md bg-card border border-border text-foreground hover:bg-secondary transition-colors"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border bg-sidebar flex-col h-screen fixed top-0 left-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 z-50 w-72 max-w-[85vw] h-screen bg-sidebar border-r border-border flex flex-col transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
